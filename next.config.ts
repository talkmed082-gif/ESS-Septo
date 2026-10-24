import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 주간 수술 스케줄 엑셀(약 1.3MB)이 Server Action 기본 한도 1MB를 넘는다.
  // Vercel 함수 요청 한도(4.5MB) 안쪽으로 잡는다.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // 진료실 PC 프로그램(외래 도우미) — 로그인한 사람만 /templates/download 로 받는다(public 폴더에 두지 않음)
  // /api/opd-helper — 프로그램이 스스로 새 버전을 확인·받는다(연결 코드 세션)
  outputFileTracingIncludes: { "/templates/download": ["./downloads/OpdHelper.exe"], "/api/opd-helper": ["./downloads/OpdHelper.exe"] },
};

export default nextConfig;
