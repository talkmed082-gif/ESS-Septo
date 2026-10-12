import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 주간 수술 스케줄 엑셀(약 1.3MB)이 Server Action 기본 한도 1MB를 넘는다.
  // Vercel 함수 요청 한도(4.5MB) 안쪽으로 잡는다.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
