import Script from 'next/script';

export const Gtag = () => {
  return <>
    <Script id="gtag-init" strategy="beforeInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('consent','default', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          analytics_storage: 'granted',
          region: ['*']
        });
        gtag('consent', 'default', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'denied',
          region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB','IS','LI','NO'],
          wait_for_update: 500
        });
      `}
    </Script>
    <Script
      src="https://www.googletagmanager.com/gtag/js?id=G-7LR3CWMSPV"
      strategy="afterInteractive"
    />
  </>
}
