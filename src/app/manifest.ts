import type { MetadataRoute } from "next";

// 폰 홈 화면에 설치하는 앱 정보. 서비스 워커(오프라인 캐시)는 일부러 두지 않는다 —
// 환자 데이터와 로그인 상태를 오래된 캐시로 보여줄 위험이 있고, 설치 자체에는
// 필요하지 않다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Op Plan & 수술기록지",
    short_name: "OpPlan",
    description: "수술 계획 및 수술기록지 작성 시스템",
    start_url: "/patients",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ffffff",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
