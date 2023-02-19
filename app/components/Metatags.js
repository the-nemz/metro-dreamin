import React, { useEffect, useState } from 'react';
import Head from 'next/head';

import { LOGO_PNG } from '/lib/constants.js';

export function Metatags({
  systemDocData = {},
  title,
  thumbnail,
  description = 'MetroDreamin\' is a web application that allows you to design and visualize the transportation system that you wish your city had, and check out the transit dreams of other users from around the world.',
}) {
  const [titleToUse, setTitleToUse] = useState(systemDocData.title ? systemDocData.title : '');

  useEffect(() => {
    setTitleToUse(title);
  }, [title])

  const metaTitle = titleToUse ? `MetroDreamin\' | ${titleToUse}` : 'MetroDreamin\' | Build the Public Transit System of Your Dreams';
  const metaDesc = systemDocData.caption ? `MetroDreamin\' | ${systemDocData.caption}` : description;
  const image = thumbnail ? thumbnail : `https://metrodreamin.com${LOGO_PNG}`;

  return (
    <Head>
      <title>{metaTitle}</title>
      {systemDocData && systemDocData.systemId && <link rel="canonical" href={`https://metrodreamin.com/view/${systemDocData.systemId}`} />}

      <meta name="twitter:card" content={systemDocData && systemDocData.systemId ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:site" content="@metrodreamin" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={metaDesc} />

      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={metaDesc} />
      <meta property="og:type" content="website" />
    </Head>
  );
}
