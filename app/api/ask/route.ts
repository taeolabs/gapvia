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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error("Embedding API Error:", err);
    throw new Error("임베딩 생성 실패");
  }

  const data = await response.json();
  return data.embedding.values;
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

     /* 🔥 질문 정규화 */
    const normalizedQuestion = question.trim().toLowerCase();

    /* 0️⃣ 동일 질문 캐시 확인 */
    const { data: existingQuestion } = await supabase
      .from("questions")
      .select("id")
      .eq("content", question)
      .limit(1)
      .single();

    if (existingQuestion) {
      const { data: existingAnswer } = await supabase
        .from("ai_answers")
        .select("draft_text")
        .eq("question_id", existingQuestion.id)
        .limit(1)
        .single();

      if (existingAnswer) {
        return NextResponse.json({
          answer: existingAnswer.draft_text,
          source: "cache",
        });
      }
    }    

    /* 1️⃣ 임베딩 생성 */
    const embedding = await getEmbedding(question);

    /* 2️⃣ GoldData 유사도 검색 (Top 3) */
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_gold_data",
      {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 3,
      }
    );

    if (matchError) {
      console.error("GoldData Search Error:", matchError);
    }

    /* ================================
       3️⃣ Gold 완전 매칭 (0.85 이상)
    =================================*/
    if (matches && matches.length > 0) {
      if (matches[0].similarity >= 0.85) {
        return NextResponse.json({
          answer: matches[0].final_answer,
          source: "gold",
        });
      }
    }

    /* ================================
       4️⃣ RAG Context 구성 (0.7 이상)
    =================================*/
    let contextText = "";

    if (matches && matches.length > 0) {
      const validMatches = matches.filter(
        (m: any) => m.similarity >= 0.7
      );

      if (validMatches.length > 0) {
        contextText = validMatches
          .map(
            (m: any, i: number) =>
              `참고 문서 ${i + 1}:\n${m.final_answer}\n(유사도: ${m.similarity.toFixed(
                3
              )})`
          )
          .join("\n\n");
      }
    }

    /* ================================
       5️⃣ Gemini RAG 프롬프트 생성
    =================================*/
    const prompt = contextText
      ? `
당신은 회사 내부 지식 기반 AI 어시스턴트입니다.

아래는 질문과 관련된 참고 문서입니다:

${contextText}

위 참고 문서를 기반으로 질문에 답변하세요.
참고 문서에 없는 내용은 추측하지 마세요.

질문:
${question}
`
      : question;

    /* ================================
       6️⃣ Gemini 호출
    =================================*/
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const finalAnswer =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "답변 생성 실패";

    /* ================================
       7️⃣ 질문 저장
    =================================*/
    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .insert({
        content: normalizedQuestion,
        embedding: embedding,
      })
      .select()
      .single();

    if (questionError) {
      console.error("Question Save Error:", questionError);
    }

    /* ================================
       8️⃣ AI 답변 저장
    =================================*/
    if (questionData) {
      await supabase.from("ai_answers").insert({
        question_id: questionData.id,
        draft_text: finalAnswer,
        model: "gemini-2.5-flash",
      });
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