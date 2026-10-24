import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "진료 어시스트",
  description: "외래·수술·환자 관리",
  // iOS는 manifest 대신 이 설정으로 홈 화면 앱(주소창 없는 전체 화면)을 만든다.
  appleWebApp: { capable: true, title: "진료 어시스트", statusBarStyle: "default" },
  // 탭 아이콘도 직접 지정 — apple만 적으면 브라우저가 기본 favicon.ico(Vercel 삼각형)를 썼다(2026-10-25)
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  // 예전 iOS는 표준 태그(mobile-web-app-capable) 대신 이 애플 전용 태그를 본다.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
