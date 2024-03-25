import { collection, query, where, getDocs, getDocsFromServer } from 'firebase/firestore';
import { getServerSideSitemap } from 'next-sitemap';

import { firestore } from '/util/firebase.js';

export async function getServerSideProps(ctx) {
  // expects a path like server-sitemap/7-E.xml or server-sitemap/w.xml
  if (!ctx.query || !ctx.query.range) throw 'Invalid sitemap path';
  if (!ctx.query.range.endsWith('.xml')) throw 'Invalid sitemap path';

  const range = ctx.query.range.replace('.xml', '');
  const rangeParts = range.split('-');

  // get all systems whose userId is after the first part of the range parameter
  const constraints = [ where('userId', '>=', rangeParts[0]) ];
  if (rangeParts.length > 1) {
    // limit it to systems whose userId is before the second part of the range parameter
    constraints.push(where('userId', '<', rangeParts[1]));
  }

  const systemsByUserQuery = query(collection(firestore, 'systems'), ...constraints);
  const systemDocs = await getDocsFromServer(systemsByUserQuery);

  const pages = [];
  systemDocs.forEach((systemDoc) => {
    const systemDocData = systemDoc.data();
    if (systemDocData.isPrivate === false) {
      pages.push({
        loc: `https://${ctx.req.headers.host}/view/${encodeURIComponent(systemDocData.systemId)}`,
        lastmod: new Date(systemDocData.lastUpdated).toISOString()
      });
    }
  });

  return getServerSideSitemap(ctx, pages);
}

export default function ServerSitemap() {};
