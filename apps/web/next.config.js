/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@simvibe/engine', '@simvibe/shared'],
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  async rewrites() {
    const apiServerOrigin = process.env.API_SERVER_ORIGIN?.replace(/\/+$/, '');
    if (!apiServerOrigin) {
      return [];
    }

    // FE proxy mode: route all /api traffic to dedicated API server origin.
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${apiServerOrigin}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
