
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getServerSideSitemap } from 'next-sitemap';

import { firestore } from '/lib/firebase.js';

export async function getServerSideProps(ctx) {
  const systemsByUserQuery = query(collection(firestore, 'systems'), where('isPrivate', '==', false));
  const systemDocs = await getDocs(systemsByUserQuery);

  let pages = [
    {
      loc: `https://${ctx.req.headers.host}/explore`,
      lastmod: new Date().toISOString()
    },
    {
      loc: `https://${ctx.req.headers.host}/edit/new`,
      lastmod: new Date().toISOString()
    },
    {
      loc: `https://${ctx.req.headers.host}/view/own`,
      lastmod: new Date().toISOString()
    }
  ];
  
  systemDocs.forEach((systemDoc) => {
    const systemDocData = systemDoc.data();
    pages.push({
      loc: `https://${ctx.req.headers.host}/view/${encodeURIComponent(systemDocData.systemId)}`,
      lastmod: new Date(systemDocData.lastUpdated).toISOString()
    })
  });

  return getServerSideSitemap(ctx, pages)
}

export default function Sitemap() {};