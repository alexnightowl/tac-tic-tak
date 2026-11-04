/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // @tac/core ships TypeScript source (D31).
  transpilePackages: ['@tac/core'],
  allowedDevOrigins: ['172.20.10.3', '192.168.1.94'],
};

export default nextConfig;
