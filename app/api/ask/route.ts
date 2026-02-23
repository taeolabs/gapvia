import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

/* ================================
   1️⃣ Gemini 임베딩 생성
================================ */
const getEmbedding = async (text: string) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: {
            parts: [{ text }],
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Embedding API Error:", err);
      throw new Error("임베딩 API 호출 실패");
    }

    const data = await response.json();

    return data.embedding.values;
  } catch (error) {
    console.error("Embedding Error:", error);
    throw new Error("임베딩 생성 실패");
  }
};

/* ================================
   2️⃣ POST API
================================ */
export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (!question) {
      return NextResponse.json(
        { error: "질문이 비어있습니다." },
        { status: 400 }
      );
    }

    /* 1️⃣ 임베딩 생성 */
    const embedding = await getEmbedding(question);

    /* 2️⃣ GoldData 유사도 검색 */
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_gold_data",
      {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 1,
      }
    );

    if (matchError) {
      console.error("GoldData Search Error:", matchError);
    }

    /* 3️⃣ Gold 데이터 존재 시 반환 */
    if (matches && matches.length > 0) {
      const similarity = matches[0].similarity;

      if (similarity >= 0.85) {
        return NextResponse.json({
          answer: matches[0].final_answer,
          source: "gold",
        });
      }
    }

    /* 4️⃣ Gemini 답변 생성 */
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: question,
    });

    const finalAnswer =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "답변 생성 실패";

    /* 5️⃣ 질문 저장 */
    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .insert({
        content: question,
        embedding: embedding,
      })
      .select()
      .single();

    if (questionError) {
      console.error("Question Save Error:", questionError);
    }

    /* 6️⃣ AI 답변 저장 */
    if (questionData) {
      await supabase.from("ai_answers").insert({
        question_id: questionData.id,
        draft_text: finalAnswer,
        model: "gemini-2.5-flash",
      });
    }

    return NextResponse.json({
      answer: finalAnswer,
      source: "ai",
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류 발생" },
      { status: 500 }
    );
  }
}