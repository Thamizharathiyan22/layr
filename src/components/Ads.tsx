import { useEffect, useRef, useState } from 'react';
import { ADSENSE_CLIENT } from '../brand';

// Ads load only when (1) an AdSense ID is set in brand.ts and (2) the visitor accepts ad cookies.
// Until then nothing from Google is loaded, so there is no tracking at all.

const CONSENT_KEY = 'layr.adConsent'; // 'yes' | 'no'
const listeners = new Set<() => void>();

export function getConsent(): 'yes' | 'no' | null {
  try { return (localStorage.getItem(CONSENT_KEY) as 'yes' | 'no' | null) ?? null; } catch { return null; }
}
export function setConsent(v: 'yes' | 'no' | null) {
  try { v ? localStorage.setItem(CONSENT_KEY, v) : localStorage.removeItem(CONSENT_KEY); } catch { /* private mode */ }
  listeners.forEach((f) => f());
}
function useConsent() {
  const [c, setC] = useState(getConsent);
  useEffect(() => {
    const f = () => setC(getConsent());
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return c;
}

let scriptAdded = false;
function loadAdSense() {
  if (scriptAdded || !ADSENSE_CLIENT) return;
  scriptAdded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
}

/** One ad placement. Shows a dashed placeholder while developing, nothing in production without an ID. */
export function AdSlot({ slot, format = 'auto', className = '' }: { slot: string; format?: string; className?: string }) {
  const consent = useConsent();
  const ref = useRef<HTMLModElement>(null);
  const live = !!ADSENSE_CLIENT && !!slot && consent === 'yes';

  useEffect(() => {
    if (!live || !ref.current || ref.current.dataset.done) return;
    loadAdSense();
    ref.current.dataset.done = '1';
    try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch { /* blocked */ }
  }, [live]);

  if (live) {
    return (
      <div className={`ad ${className}`}>
        <span className="ad-label">Advertisement</span>
        <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={ADSENSE_CLIENT} data-ad-slot={slot} data-ad-format={format} data-full-width-responsive="true" />
      </div>
    );
  }
  if (import.meta.env.DEV) {
    return <div className={`ad ad-placeholder ${className}`}>Ad space · shows after AdSense is set up in <code>src/brand.ts</code></div>;
  }
  return null;
}

/** Small bottom banner asking for ad-cookie consent. Only appears when ads are switched on. */
export function ConsentBanner({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  const consent = useConsent();
  if (!ADSENSE_CLIENT || consent) return null;
  return (
    <div className="consent" role="dialog" aria-label="Cookie choice">
      <p>
        We show ads to keep this tool free. Ads use cookies. Your photos are never uploaded either way.{' '}
        <button className="link" onClick={onOpenPrivacy}>Privacy Policy</button>
      </p>
      <div className="row">
        <button className="btn ghost" onClick={() => setConsent('no')}>No ads cookies</button>
        <button className="btn primary" onClick={() => setConsent('yes')}>Accept</button>
      </div>
    </div>
  );
}
