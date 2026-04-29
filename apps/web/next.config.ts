import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const runnerInternalUrl =
      process.env.RUNNER_INTERNAL_URL ?? "http://127.0.0.1:3333";

    return [
      {
        source: "/api/runner/:path*",
        destination: `${runnerInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
