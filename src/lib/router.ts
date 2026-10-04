// Tiny router: real URLs (/privacy, /terms…) without a library.
// Cloudflare Pages serves index.html for unknown paths, so deep links work when hosted.
import { useEffect, useState } from 'react';

export type Route = '/' | '/how-it-works' | '/privacy' | '/terms' | '/licenses';
const ROUTES: Route[] = ['/', '/how-it-works', '/privacy', '/terms', '/licenses'];

const TITLES: Record<Route, string> = {
  '/': '',
  '/how-it-works': 'How it works',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Use',
  '/licenses': 'Licences & Credits',
};

function current(): Route {
  const p = window.location.pathname.replace(/\/+$/, '') || '/';
  return (ROUTES as string[]).includes(p) ? (p as Route) : '/';
}

export function navigate(to: Route) {
  if (to !== current()) window.history.pushState(null, '', to);
  window.dispatchEvent(new Event('layr:route'));
  window.scrollTo({ top: 0 });
}

export function useRoute(appName: string): Route {
  const [r, setR] = useState(current);
  useEffect(() => {
    const f = () => setR(current());
    window.addEventListener('popstate', f);
    window.addEventListener('layr:route', f);
    return () => {
      window.removeEventListener('popstate', f);
      window.removeEventListener('layr:route', f);
    };
  }, []);
  useEffect(() => {
    document.title = TITLES[r] ? `${TITLES[r]} · ${appName}` : `${appName} — Text behind anything`;
  }, [r, appName]);
  return r;
}
