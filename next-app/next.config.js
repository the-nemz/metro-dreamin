/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/explore',
      },
      {
        source: '/index.html',
        destination: '/explore',
      },
    ]
  }
}

module.exports = nextConfig
