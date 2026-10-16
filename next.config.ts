import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isProduction ? { output: "export" } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (isProduction) return [];
    return [
      {
        source: "/api/:path*",
        destination: "https://crm-attendance.pages.dev/api/:path*",
      },
    ];
  },
};

export default nextConfig;

