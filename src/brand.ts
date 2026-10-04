// ─────────────────────────────────────────────────────────────
//  Site settings — edit these before going live.
// ─────────────────────────────────────────────────────────────

export const APP_NAME = 'Layr';
export const TAGLINE = 'Text behind anything';

/** Who runs the site (shown in Privacy Policy and Terms). */
export const OWNER_NAME = 'Layr';
/**
 * Contact address (forwards to your inbox via Cloudflare Email Routing).
 * Stored in two parts so spam bots scanning GitHub or the page can't read it as an email.
 * Use contactEmail() to get the full address.
 */
const CONTACT_PARTS = ['hello', 'layrphoto' + '.' + 'com'] as const;
export const contactEmail = () => CONTACT_PARTS.join('\u0040');
/** Shown before the visitor clicks "Show email". */
export const CONTACT_HINT = `${CONTACT_PARTS[0]} [at] ${CONTACT_PARTS[1]}`;

/** Live website address. */
export const SITE_URL = 'https://layrphoto.com';
/** Country whose law applies to the Terms. */
export const JURISDICTION = 'India';
/** Date the legal pages were last updated (YYYY-MM-DD). */
export const LEGAL_UPDATED = '2026-09-28';

/**
 * Public source code link. REQUIRED by the AGPL-3.0 licence of the cutout model:
 * anyone using the site must be able to get the code. Put your GitHub repo URL here.
 */
export const SOURCE_URL = 'https://github.com/Thamizharathiyan22/layr';

/**
 * Google AdSense. Leave empty to show no ads.
 * After AdSense approves your site, paste your publisher ID (ca-pub-…) and one slot ID per placement.
 */
export const ADSENSE_CLIENT = '';
export const AD_SLOTS = {
  home: '', // below "How it works" on the home page
  result: '', // next to the download options
  info: '', // bottom of info pages (How it works, FAQ)
};
