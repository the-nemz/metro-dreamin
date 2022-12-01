/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  async redirects() {
    return [
      {
        source: '/index.html',
        has: [
          {
            type: 'query',
            key: 'view',
            value: '(?<viewId>.*)'
          }
        ],
        destination: '/view/:viewId?',
        permanent: true
      },
      {
        source: '/',
        has: [
          {
            type: 'query',
            key: 'view',
            value: '(?<viewId>.*)'
          }
        ],
        destination: '/view/:viewId?',
        permanent: true
      },
      {
        source: '/',
        destination: '/explore',
        permanent: false
      },
      {
        source: '/index.html',
        destination: '/explore',
        permanent: false
      },
    ]
  }
}

module.exports = nextConfig
