const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL || process.env.AGENT_URL || 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${agentUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
