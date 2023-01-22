import { getCookie, setCookie } from 'cookies-next';

export const setThemeCookie = (domain = 'metrodreamin.com', theme = 'DarkMode') => {
  setCookie('theme', theme, { domain: domain });
}

export const getThemeCookieClient = () => {
  return getCookie('theme');
}

export const getThemeCookieSSR = (ctx) => {
  return getCookie('theme', ctx);
}
