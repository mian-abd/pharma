import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    GATEWAY_URL: process.env.GATEWAY_URL || 'http://localhost:8000',
  },
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
