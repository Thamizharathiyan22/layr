# Layr — text behind anything

Live at **https://layrphoto.com** · Contact: hello [at] layrphoto.com

Upload a photo, type your brand, and the text appears **behind** the people and objects in it.
All AI runs in the visitor's browser: photos are never uploaded, and hosting costs nothing.

```
Home  →  Editor  →  [Done]  →  Result page (preview + download)
```

## Run it on your computer

Needs **Node.js 18+** (https://nodejs.org).

```bash
cd D:\Claude_Vibe_Code\001_website
npm install
npm run dev
```

Opens at http://localhost:5173.

## How it works

```
Layer 3  cut-out subject (AI mask + your fixes)   ← on top
Layer 2  your text                                 ← middle
Layer 1  original photo                            ← bottom
```

Two AI models, both running in the browser:

| Model | Job | Licence |
|---|---|---|
| IS-Net (`onnx-community/ISNet-ONNX`) | Automatic cutout of the main subject | AGPL-3.0 (as listed) |
| SlimSAM (`Xenova/slimsam-77-uniform`) | **Fix cutout**: tap an object to add or remove it | Apache-2.0 |

Where the work happens once the site is online:

```
Website host (Cloudflare) -------------> page files (small) ──┐
                                                              |
Hugging Face ----------------> AI models, once --------------------------------> Visitor's own GPU/CPU does the cutout
                                                                                      (photo never leaves the device)
```

| File | Job |
|---|---|
| `src/brand.ts` | **All site settings**: name, contact email, source-code link, AdSense IDs |
| `src/lib/ai.worker.ts`, `segment.ts` | Automatic cutout (IS-Net), GPU → CPU fallback |
| `src/lib/sam.worker.ts`, `sam.ts` | Tap-to-select (SlimSAM) |
| `src/lib/mask.ts` | Combines AI mask, solidity, taps and brush fixes |
| `src/lib/render.ts` | Draws photo, text layers, cutout; text effects |
| `src/lib/fonts.ts` | 55 fonts, 32 styles |
| `src/components/Editor.tsx`, `Controls.tsx` | Editor and side panel |
| `src/components/Result.tsx` | Final preview and downloads |
| `src/components/Info.tsx`, `Explainers.tsx` | How it works, Privacy, Terms, Licences, FAQ, footer |
| `src/components/Ads.tsx` | AdSense slots + cookie-consent banner |

## Before going live — checklist

1. ✅ `src/brand.ts` is filled in (contact email, site URL, source link).
2. **Publish the source code** (required by AGPL-3.0, see below):
   create a public GitHub repo, push this folder, and put its URL in `SOURCE_URL`.
3. **Add the full licence text**: on GitHub, *Add file → Create new file → `LICENSE.txt` → Choose a license template → GNU Affero General Public License v3.0*. Rename our `LICENSE` notice file to `NOTICE`.
4. **Deploy on Cloudflare Pages** (free plan allows ads/commercial use; Vercel's free plan does not):
   - Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo
   - Build command: `npm run build` · Output directory: `dist`
   - Add your own domain (AdSense needs a domain you control).
5. **Ads** (after the site is live with some content):
   - Apply at https://adsense.google.com. You must be 18+, and the site must follow AdSense policies.
   - When approved: put `ca-pub-…` in `ADSENSE_CLIENT` and your ad unit IDs in `AD_SLOTS`.
   - Create `public/ads.txt` with the line AdSense gives you (looks like `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`).
   - For visitors in the EU/UK, also turn on Google's consent message: AdSense → Privacy & messaging → European regulations.
6. Ask a lawyer to review the Privacy Policy and Terms before earning money.

## Why the code must be public (AGPL-3.0)

The IS-Net model copy we use is listed under **AGPL-3.0**. That licence allows anyone to use it for free, even to earn money,
with one condition: if people use it over a network (like a website), you must offer them the source code under the same licence.
Our site's code runs in the visitor's browser anyway, so anyone can already read it; publishing it on GitHub costs us nothing.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build into `dist/`
- `npm run preview` — serve the production build locally
- `npm run typecheck` — TypeScript checks

## Licence

AGPL-3.0-or-later. See `LICENSE`. Third-party models, libraries and fonts keep their own licences (listed on the site's Licences page).
