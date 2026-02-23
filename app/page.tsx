"use client";

import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question) return;

    setLoading(true);
    setAnswer("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setAnswer(data.answer);
    } catch (error) {
      setAnswer("에러가 발생했습니다.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <h1 className="text-3xl font-bold mb-6">GAPVIA AI 코칭</h1>

      <textarea
        className="w-full border p-3 rounded mb-4"
        rows={4}
        placeholder="질문을 입력하세요..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <button
        onClick={handleAsk}
        className="bg-black text-white px-6 py-2 rounded"
      >
        {loading ? "답변 생성 중..." : "질문하기"}
      </button>

      {answer && (
        <div className="mt-8 p-4 border rounded bg-white text-black whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}