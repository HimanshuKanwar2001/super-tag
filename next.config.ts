
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: ["6000-firebase-studio-1748507750147.cluster-nzwlpk54dvagsxetkvxzbvslyi.cloudworkstations.dev"],
  }
};

export default nextConfig;
