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
            value: '(?<systemId>.*)'
          }
        ],
        destination: '/view/:systemId',
        permanent: true
      },
      {
        // redirect /?view=xyz to /view/xyz to handle very old urls
        source: '/',
        has: [
          {
            type: 'query',
            key: 'view',
            value: '(?<systemId>.*)'
          }
        ],
        destination: '/view/:systemId',
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
        // rewrite /view to /view/own
        source: '/view',
        destination: '/view/own',
      },
      {
        // rewrite /view/index.html to /view/own
        source: '/view/index.html',
        destination: '/view/own',
      },
      {
        // rewrite /edit to /edit/new
        source: '/edit',
        destination: '/edit/new',
      },
      {
        // rewrite /edit/index.html to /edit/new
        source: '/edit/index.html',
        destination: '/edit/new',
      },
    ]
  }
}

module.exports = nextConfig
