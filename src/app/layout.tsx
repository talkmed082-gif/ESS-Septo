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
  title: "Op Plan & 수술기록지",
  description: "수술 계획 및 수술기록지 작성 시스템",
  // iOS는 manifest 대신 이 설정으로 홈 화면 앱(주소창 없는 전체 화면)을 만든다.
  appleWebApp: { capable: true, title: "OpPlan", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
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
