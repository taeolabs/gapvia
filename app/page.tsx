"use client";

import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<
    { question: string; answer: string }[]
  >([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleDelete = (index: number) => {
    const confirmed = window.confirm("정말 삭제하시겠습니까?");
    if (!confirmed) return;

    const updated = history.filter((_, i) => i !== index);
    setHistory(updated);
    localStorage.setItem("history", JSON.stringify(updated));
  };

  // ✅ 그 다음 useEffect
  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, content, answers ( ai_draft )")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const formatted = data.map((item) => ({
          question: item.content,
          answer: item.answers?.[0]?.ai_draft || "",
        }));

        setHistory(formatted);
      }
    };

    fetchHistory();
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

  } catch (error) {
    setAnswer("에러가 발생했습니다.");
  }

  setLoading(false);
};

return (
  <div className="min-h-screen bg-gray-100 flex justify-center py-12 px-4">
    <div className="w-full max-w-3xl">

      {/* 제목 */}
      <h1 className="text-4xl font-bold text-center mb-10">
        GAPVIA AI 코칭
      </h1>

      {/* 질문 입력 카드 */}
      <div className="bg-white shadow-md rounded-xl p-6 mb-10">
        <textarea
          className="w-full border rounded-lg p-4 mb-4 focus:outline-none focus:ring-2 focus:ring-black"
          rows={4}
          placeholder="질문을 입력하세요..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button
          onClick={handleAsk}
          className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition"
        >
          {loading ? "답변 생성 중..." : "질문하기"}
        </button>
      </div>

      {/* 질문 기록 */}
      {history.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">질문 기록</h2>

          <div className="space-y-6">
            {history.map((item, index) => {
              const isOpen = openIndex === index;

              return (
                <div
                  key={index}
                  className="bg-white shadow-sm rounded-xl border"
                >
                  {/* 질문 헤더 */}
                  <div className="p-6 flex justify-between items-center">

                    {/* 왼쪽: 질문 클릭 영역 */}
                    <div
                      onClick={() =>
                        setOpenIndex(isOpen ? null : index)
                      }
                      className="cursor-pointer flex items-center gap-3"
                    >
                      <p className="font-semibold text-lg">
                        Q. {item.question}
                      </p>

                      <span className="text-sm text-gray-500">
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </div>

                    {/* 오른쪽: 삭제 버튼 */}
                    <button
                      onClick={() => handleDelete(index)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>

                  </div>

                  {/* 답변 영역 */}
                  {isOpen && (
                    <div className="px-6 pb-6 text-gray-700 whitespace-pre-wrap leading-relaxed border-t">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  </div>
);
}