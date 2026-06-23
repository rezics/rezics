import type { NextConfig } from "next";

import config from "./config";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@rezics/backend"],
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      ...(config.backend.url
        ? [
            {
              source: "/api/:path*",
              destination: new URL("/api/:path*", config.backend.url).toString(),
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
