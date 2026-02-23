import "./globals.css";

export const metadata = {
  title: "GAPVIA AI 코칭",
  description: "AI 업무 코칭 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}