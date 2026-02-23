"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ history state 먼저 선언
  const [history, setHistory] = useState<
    { question: string; answer: string }[]
  >([]);

  // ✅ 그 다음 useEffect
  useEffect(() => {
    const saved = localStorage.getItem("ai_history");
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  const handleCopy = async () => {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    alert("복사되었습니다.");
  };

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

    // 🔥 여기 추가하세요 ↓↓↓
    const newItem = { question, answer: data.answer };
    const updatedHistory = [newItem, ...history];

    setHistory(updatedHistory);
    localStorage.setItem("ai_history", JSON.stringify(updatedHistory));

  } catch (error) {
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
        <div className="mt-8 p-6 border border-gray-200 rounded-lg bg-gray-50 whitespace-pre-wrap text-gray-800 leading-relaxed relative">
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 text-sm bg-black text-white px-3 py-1 rounded hover:bg-gray-800"
          >
             복사
          </button>
          {answer}
        </div>
      )}      

      {/* 🔥 여기 아래에 붙이세요 */}
      {history.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">질문 기록</h2>

          <div className="space-y-4">
            {history.map((item, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-white"
              >
                <p className="font-semibold">Q: {item.question}</p>
                <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                  A: {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}      

    </div>
  </div>
);
}