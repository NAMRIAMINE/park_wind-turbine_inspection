import type { NextConfig } from "next";

const remotePatterns: {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
}[] = [
  {
    protocol: "http",
    hostname: "localhost",
    port: "3000",
    pathname: "/uploads/**",
  },
];

// Allow configuring an image host at deploy time
if (process.env.NEXT_PUBLIC_IMAGE_HOSTNAME) {
  remotePatterns.push({
    protocol:
      (process.env.NEXT_PUBLIC_IMAGE_PROTOCOL as "http" | "https") || "https",
    hostname: process.env.NEXT_PUBLIC_IMAGE_HOSTNAME,
    port: process.env.NEXT_PUBLIC_IMAGE_PORT || undefined,
    pathname: process.env.NEXT_PUBLIC_IMAGE_PATHNAME || "/**",
  });
}

const nextConfig: NextConfig = {
  eslint: {
    // Prevent ESLint findings from failing production builds
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns,
    formats: ["image/webp", "image/avif"],
  },
  serverExternalPackages: ["sharp", "exifr"],
};

export default nextConfig;
