import Head from 'next/head';

import { LOGO } from '/lib/constants.js';

// TODO: more meta tag support as it is currently only title and image

export function Metatags({
  systemId,
  thumbnail,
  title,
  // description = 'MetroDreamin\' is a web application that allows you to design and visualize the transportation system that you wish your city had, and check out the transit dreams of other users from around the world.',
  // image = 'https://fireship.io/courses/react-next-firebase/img/featured.png',
}) {
  const metaTitle = title ? title : 'MetroDreamin\' | Build the Public Transit System of Your Dreams';
  const image = thumbnail ? thumbnail : LOGO;

  return (
    <Head>
      <title>{metaTitle}</title>
      {/* <meta name="twitter:card" content="summary" />
      <meta name="twitter:site" content="@fireship_dev" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} /> */}
      <meta name="twitter:image" content={image} />

      <meta property="og:title" content={metaTitle} />
      {/* <meta property="og:description" content={description} /> */}
      <meta property="og:image" content={image} />
    </Head>
  );
}
