/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
};

export default nextConfig;
