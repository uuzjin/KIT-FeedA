import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: {
    // @ts-ignore: Next.js 15/16 타입 정의 오류를 우회하여 아이콘 숨기기
    appIsrStatus: false,
  },
};

export default nextConfig;
