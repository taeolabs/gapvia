import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import redis from "@/lib/redis";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

/* ================================
   정규화 + 해시
================================ */
const normalizeText = (text: string) =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

const generateHash = (text: string) =>
  crypto.createHash("sha256").update(text).digest("hex");

/* ================================
   임베딩
================================ */
const getEmbedding = async (text: string) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!res.ok) throw new Error("Embedding 실패");
  const data = await res.json();
  return data.embedding.values;
};

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question)
      return NextResponse.json(
        { error: "질문이 비어있습니다." },
        { status: 400 }
      );

    const normalized = normalizeText(question);
    const hash = generateHash(normalized);

    /* ================================
       1️⃣ Redis 캐시 확인
    =================================*/
    if (redis) {
      try {
        const cached = await redis.get<string>(`qa:${hash}`);
        if (cached) {
          return NextResponse.json({
            answer: cached,
            source: "redis-cache",
          });
        }
      } catch (err) {
        console.error("Redis read error:", err);
      }
    }

    /* ================================
       2️⃣ DB Hash 캐시 확인
    =================================*/
    const { data: existing } = await supabase
      .from("questions")
      .select("id")
      .eq("question_hash", hash)
      .maybeSingle();

    if (existing) {
      const { data: existingAnswer } = await supabase
        .from("ai_answers")
        .select("draft_text")
        .eq("question_id", existing.id)
        .maybeSingle();

      if (existingAnswer) {
        if (redis) {
          await redis.set(`qa:${hash}`, existingAnswer.draft_text, {
            ex: 3600, // 1시간 캐시
          });
        }

        return NextResponse.json({
          answer: existingAnswer.draft_text,
          source: "hash-cache",
        });
      }
    }

    /* ================================
       3️⃣ 임베딩
    =================================*/
    const embedding = await getEmbedding(normalized);

    /* ================================
       4️⃣ Gold 검색
    =================================*/
    const { data: goldMatches } = await supabase.rpc(
      "match_gold_data",
      {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 3,
      }
    );

    if (
      goldMatches?.length > 0 &&
      goldMatches[0].similarity >= 0.85
    ) {
      if (redis) {
        await redis.set(`qa:${hash}`, goldMatches[0].final_answer, {
          ex: 3600,
        });
      }

      return NextResponse.json({
        answer: goldMatches[0].final_answer,
        source: "gold",
      });
    }

    /* ================================
       5️⃣ RAG context 구성
    =================================*/
    let contextText = "";

    if (goldMatches?.length > 0) {
      const valid = goldMatches.filter(
        (m: any) => m.similarity >= 0.7
      );

      if (valid.length > 0) {
        contextText = valid
          .map((m: any) => m.final_answer)
          .join("\n\n");
      }
    }

    const prompt = contextText
      ? `다음 참고 문서를 기반으로 답하세요:\n\n${contextText}\n\n질문:\n${normalized}`
      : normalized;

    /* ================================
       6️⃣ Gemini 호출
    =================================*/
    let finalAnswer = "";

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      finalAnswer =
        result?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "답변 생성 실패";
    } catch (err: any) {
      if (err?.status === 429) {
        return NextResponse.json(
          { error: "AI 사용량 초과. 잠시 후 시도해주세요." },
          { status: 429 }
        );
      }
      throw err;
    }

    /* ================================
       7️⃣ DB 저장
    =================================*/
    const { data: questionData } = await supabase
      .from("questions")
      .insert({
        content: normalized,
        question_hash: hash,
        embedding,
      })
      .select()
      .single();

    if (questionData) {
      await supabase.from("ai_answers").insert({
        question_id: questionData.id,
        draft_text: finalAnswer,
        model: "gemini-2.5-flash",
      });
    }

    /* ================================
       8️⃣ Redis 저장
    =================================*/
    if (redis) {
      try {
        await redis.set(`qa:${hash}`, finalAnswer, {
          ex: 3600,
        });
      } catch (err) {
        console.error("Redis write error:", err);
      }
    }

    return NextResponse.json({
      answer: finalAnswer,
      source: contextText ? "rag" : "ai",
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류 발생" },
      { status: 500 }
    );
  }
}