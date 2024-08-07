import { getServerSideSitemapIndex } from 'next-sitemap';

import { getGlobalStatsData } from '/util/firebase.js';
import { generateAlphanumerics } from '/util/helpers.js';

const PAGES_PER_SITEMAP = 5000;

export async function getServerSideProps(ctx) {

  const alphanumericArray = generateAlphanumerics();

  // get number of systems created
  const globalStats = await getGlobalStatsData();
  if (!globalStats || !globalStats.systemsCreated) {
    throw 'Server Sitemap Error: systemsCreated count not found';
  }

  // figure out how many characters should map to each page, given a target of 5k systems per page
  const approxSystemsPerCharacter = globalStats.systemsCreated / alphanumericArray.length;
  const charactersPerSitemap = Math.round(PAGES_PER_SITEMAP / approxSystemsPerCharacter);

  // generate sitemap urls given the character range per sitemap
  const sitemaps = [];
  let currCharIndex = 0;
  while (currCharIndex < alphanumericArray.length) {
    const firstChar = alphanumericArray[currCharIndex];
    currCharIndex = currCharIndex + charactersPerSitemap;
    const secondChar = alphanumericArray[currCharIndex];

    if (secondChar) {
      sitemaps.push(`https://${ctx.req.headers.host}/server-sitemap/${firstChar}-${secondChar}.xml`);
    } else {
      sitemaps.push(`https://${ctx.req.headers.host}/server-sitemap/${firstChar}.xml`);
    }
  }

  return getServerSideSitemapIndex(ctx, sitemaps);
}

export default function ServerSitemapIndex() {};
