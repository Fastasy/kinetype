import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // VA guide consolidated onto the Philippines-specific URL (2026-08-18)
      {
        source: "/become-a-virtual-assistant",
        destination: "/how-to-become-a-virtual-assistant-philippines",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
