import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta charset="utf-8" />

        <meta name="msapplication-square70x70logo" content="/favicons/windows-tile-70x70.png" />
        <meta name="msapplication-square150x150logo" content="/favicons/windows-tile-150x150.png" />
        <meta name="msapplication-square310x310logo" content="/favicons/windows-tile-310x310.png" />
        <meta name="msapplication-TileImage" content="/favicons/windows-tile-144x144.png" />

        <link rel="apple-touch-icon-precomposed" sizes="152x152" href="/favicons/apple-touch-icon-152x152-precomposed.png" />
        <link rel="apple-touch-icon-precomposed" sizes="120x120" href="/favicons/apple-touch-icon-120x120-precomposed.png" />
        <link rel="apple-touch-icon-precomposed" sizes="76x76" href="/favicons/apple-touch-icon-76x76-precomposed.png" />
        <link rel="apple-touch-icon-precomposed" sizes="60x60" href="/favicons/apple-touch-icon-60x60-precomposed.png" />
        <link rel="apple-touch-icon-precomposed" sizes="144x144" href="/favicons/apple-touch-icon-144x144-precomposed.png" />
        <link rel="apple-touch-icon-precomposed" sizes="114x114" href="/favicons/apple-touch-icon-114x114-precomposed.png" />
        <link rel="apple-touch-icon-precomposed" sizes="72x72" href="/favicons/apple-touch-icon-72x72-precomposed.png" />
        <link rel="apple-touch-icon" sizes="57x57" href="/favicons/apple-touch-icon.png" />

        <link rel="icon" sizes="192x192" href="/favicons/homescreen-192x192.png" />
        <link rel="shortcut icon" href="/favicons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicons/favicon.png" />

        <meta name="mobile-web-app-capable" value="yes" />
        <meta name="theme-color" content="#000000" />

        <link rel="manifest" href="/manifest.json" />
      </Head>
      <body>
        {/* dummy script needed to prevent css flash */}
        <script>0</script>

        <Main />

        <NextScript />
      </body>
    </Html>
  )
}
