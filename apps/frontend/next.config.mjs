/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  allowedDevOrigins: ['172.20.10.3', '192.168.1.94'],
};

export default nextConfig;
