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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setAnswer(data.answer);
    } catch {
      setAnswer("에러가 발생했습니다.");
    }

    setLoading(false);
  };

return (
  <div className="min-h-screen bg-gray-100 flex justify-center py-16">
    <div className="w-full max-w-3xl bg-white shadow-lg rounded-xl p-10">
      <h1 className="text-3xl font-bold mb-6 text-center">
        GAPVIA AI 코칭
      </h1>

      <textarea
        className="w-full border border-gray-300 p-4 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-black"
        rows={4}
        placeholder="질문을 입력하세요..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <div className="flex justify-end">
        <button
          onClick={handleAsk}
          className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition"
        >
          {loading ? "답변 생성 중..." : "질문하기"}
        </button>
      </div>

      {answer && (
        <div className="mt-8 p-6 border border-gray-200 rounded-lg bg-gray-50 whitespace-pre-wrap text-gray-800 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  </div>
);
}