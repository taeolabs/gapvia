import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  const { question } = await req.json();

  // 1️⃣ 질문 저장
  const { data: questionData } = await supabase
    .from("questions")
    .insert({ content: question })
    .select()
    .single();

  // 2️⃣ Gemini 2.5 Flash 호출
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: question,
  });

  const answer = result.text;

  // 3️⃣ 답변 저장
  await supabase.from("answers").insert({
    question_id: questionData.id,
    ai_draft: answer,
  });

  return NextResponse.json({ answer });
}