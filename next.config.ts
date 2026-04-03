import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  generateBuildId: async () => {
    // ใช้ Timestamp เพื่อให้แต่ละรอบการ Build มี ID ที่แน่นอน
    return 'build-' + Date.now();
  },
};

export default nextConfig;
