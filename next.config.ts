import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "node-cron", "pdfjs-dist"],
};

export default nextConfig;
