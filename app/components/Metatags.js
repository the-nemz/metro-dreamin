import Head from 'next/head';

export function Metatags({
  title,
  // description = 'MetroDreamin\' is a web application that allows you to design and visualize the transportation system that you wish your city had, and check out the transit dreams of other users from around the world.',
  // image = 'https://fireship.io/courses/react-next-firebase/img/featured.png',
}) {
  return (
    <Head>
      <title>{title ? title : 'MetroDreamin\' | Build the Public Transit System of Your Dreams'}</title>
      {/* <meta name="twitter:card" content="summary" />
      <meta name="twitter:site" content="@fireship_dev" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} /> */}
    </Head>
  );
}
