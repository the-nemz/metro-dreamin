/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  async redirects() {
    return [
      {
        // redirect /index.html?view=xyz to /view/xyz to handle very old urls
        source: '/index.html',
        has: [
          {
            type: 'query',
            key: 'view',
            value: '(?<viewId>.*)'
          }
        ],
        destination: '/view/:viewId',
        permanent: true
      },
      {
        // redirect /?view=xyz to /view/xyz to handle very old urls
        source: '/',
        has: [
          {
            type: 'query',
            key: 'view',
            value: '(?<viewId>.*)'
          }
        ],
        destination: '/view/:viewId',
        permanent: true
      },
      {
        // redirect / (root) to /explore
        source: '/',
        destination: '/explore',
        permanent: false
      },
      {
        // redirect /index.html to /explore
        source: '/index.html',
        destination: '/explore',
        permanent: false
      },
    ]
  },
  async rewrites() {
    return [
      {
        // rewrite /view to /view/new
        source: '/view',
        destination: '/view/new',
      },
      {
        // rewrite /view/index.html to /view/new
        source: '/view/index.html',
        destination: '/view/new',
      },
    ]
  }
}

module.exports = nextConfig
