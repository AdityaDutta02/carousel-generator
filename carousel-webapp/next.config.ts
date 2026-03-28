import type { NextConfig } from "next";

const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090'
const pbHostname = new URL(pbUrl).hostname
const pbPort = new URL(pbUrl).port || undefined
const pbProtocol = new URL(pbUrl).protocol.replace(':', '') as 'http' | 'https'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: pbProtocol,
        hostname: pbHostname,
        port: pbPort,
        pathname: '/api/files/**',
      },
    ],
  },
};

export default nextConfig;
