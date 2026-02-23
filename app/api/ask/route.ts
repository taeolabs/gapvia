import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// 🔵 Gemini 임베딩 생성
const getEmbedding = async (text: string) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
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

  const data = await response.json();
  return data.embedding.values; // 768차원
};

export async function POST(req: Request) {
  const { question } = await req.json();

  // 1️⃣ 임베딩 생성
  const embedding = await getEmbedding(question);

  // 2️⃣ GoldData 유사도 검색
  const { data: matches } = await supabase.rpc("match_gold_data", {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 1,
  });

  let finalAnswer = "";
  let source = "ai";

  // 3️⃣ 유사도 높으면 GoldData 반환
  if (matches && matches.length > 0) {
    const similarity = matches[0].similarity;

    if (similarity >= 0.85) {
      finalAnswer = matches[0].final_answer;
      source = "gold";

      return NextResponse.json({
        answer: finalAnswer,
        source,
      });
    }
  }

  // 4️⃣ Gemini 답변 생성
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: question,
  });

  finalAnswer = result.text;

  // 5️⃣ 질문 저장 (embedding 포함)
  const { data: questionData } = await supabase
    .from("questions")
    .insert({
      content: question,
      embedding: embedding,
    })
    .select()
    .single();

  // 6️⃣ AI 답변 저장
  await supabase.from("ai_answers").insert({
    question_id: questionData.id,
    draft_text: finalAnswer,
    model: "gemini-2.5-flash",
  });

  return NextResponse.json({
    answer: finalAnswer,
    source,
  });
}