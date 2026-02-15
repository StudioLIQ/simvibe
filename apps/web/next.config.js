/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@simvibe/engine', '@simvibe/shared'],
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

module.exports = nextConfig;
