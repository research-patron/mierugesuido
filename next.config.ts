import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  typedRoutes: false,
  devIndicators: false,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
