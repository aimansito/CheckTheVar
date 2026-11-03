import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El paquete compartido se publica como TypeScript sin compilar.
  transpilePackages: ["@checkthevar/shared"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
