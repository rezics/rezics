import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@rezics/api",
    "@rezics/contract",
    "@rezics/i18n",
    "@rezics/ui",
  ],
};

export default nextConfig;
