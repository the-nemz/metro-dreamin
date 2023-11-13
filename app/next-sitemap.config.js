let domain = 'https://metrodreamin.com';
if (process.env.NEXT_PUBLIC_STAGING) {
  domain = 'https://metrodreaminstaging.firebaseapp.com';
} else if (process.env.NEXT_PUBLIC_LOCAL) {
  domain = 'http://localhost:3000';
}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: domain,
  generateRobotsTxt: true,
  exclude: [ '/server-sitemap/*' ],
  robotsTxtOptions: {
    additionalSitemaps: [ `${domain}/server-sitemap/index.xml` ],
  },
}
