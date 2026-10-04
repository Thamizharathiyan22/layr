// Reusable explainer blocks: shown on the home page and the How-it-works page.
import { APP_NAME } from '../brand';

/** Thin-line lock icon, matching the other icons (no emoji). */
export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg className="lock-ico" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Where the work happens: files come from servers, the AI runs on the visitor's own device. */
export function DeviceDiagram() {
  return (
    <div className="device-diagram" role="img" aria-label="Website files come from Cloudflare, the AI model comes from Hugging Face once, and your own device cuts out the photo. Your photo never leaves your device.">
      <div className="dd-servers">
        <div className="dd-box">
          <b>Website host</b>
          <span>sends the page (small)</span>
        </div>
        <div className="dd-box">
          <b>Hugging Face</b>
          <span>sends the AI model once (~90 MB), then your browser keeps it</span>
        </div>
      </div>
      <div className="dd-arrows" aria-hidden>
        <svg viewBox="0 0 120 120" preserveAspectRatio="none">
          <defs>
            <marker id="dd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0L10 5L0 10z" fill="currentColor" />
            </marker>
          </defs>
          <path d="M5 28 C60 28 60 60 112 60" markerEnd="url(#dd-arrow)" />
          <path d="M5 92 C60 92 60 60 112 60" markerEnd="url(#dd-arrow)" />
        </svg>
      </div>
      <div className="dd-device">
        <div className="dd-screen">
          <span className="dd-chip">GPU / CPU</span>
          <b>Your device</b>
          <span>runs the AI and cuts out your photo</span>
          <span className="pill private-pill"><LockIcon /> Photo never uploaded</span>
        </div>
      </div>
    </div>
  );
}

export function WhyYourGpu() {
  return (
    <div className="prose">
      <h3>Why does {APP_NAME} use my graphics card?</h3>
      <p>
        Cutting a person out of a photo takes billions of small calculations. Your graphics card (GPU) does thousands of them at
        once, so it takes 1–2 seconds instead of 10–30 seconds on the processor (CPU).
      </p>
      <ul>
        <li><b>Only while working.</b> The GPU is used for the few seconds the AI runs, then it rests. Nothing runs in the background.</li>
        <li><b>Only for your photo.</b> Your device never works for anyone else, and nothing is mined or shared.</li>
        <li><b>No GPU? No problem.</b> If your device has no suitable GPU, {APP_NAME} uses the processor instead. It is slower but works on every modern browser.</li>
      </ul>
      <p className="muted">
        Most cutout websites upload your photo to their own servers and run the AI there. That costs them money and means they
        see every photo. Running on your own device keeps {APP_NAME} free and private.
      </p>
    </div>
  );
}

export function BestResults() {
  return (
    <div className="tips">
      <div className="tip good">
        <b>Works great</b>
        <ul>
          <li>People, cars, products, animals</li>
          <li>One clear main subject</li>
          <li>Subject stands out from the background</li>
        </ul>
      </div>
      <div className="tip hard">
        <b>Can confuse the AI</b>
        <ul>
          <li>Busy digital art and posters with strong colours everywhere</li>
          <li>Neon signs, outlines and shapes that look like the subject</li>
          <li>Many overlapping objects, or a subject the same colour as the background</li>
        </ul>
      </div>
      <div className="tip fix">
        <b>If the cutout is wrong</b>
        <p>
          Press <b>Fix cutout</b> in the editor, then <b>tap</b> anything the AI missed. Tap <b>Remove object</b> first to take out
          anything it picked by mistake. Each tap selects the whole object.
        </p>
      </div>
    </div>
  );
}

export function Steps() {
  return (
    <ol className="steps">
      <li><span>1</span><b>Upload a photo</b><p>Drop, browse or paste. The AI finds people and objects in seconds.</p></li>
      <li><span>2</span><b>Add your brand</b><p>Type your text and pick from 30+ styles and 55 fonts. It slides behind the subject.</p></li>
      <li><span>3</span><b>Download</b><p>Press Done to see the final image and save it as PNG or JPG.</p></li>
    </ol>
  );
}

export const FAQ: { q: string; a: string }[] = [
  { q: 'Is it free?', a: `Yes. ${APP_NAME} is free to use. Ads help pay for it.` },
  { q: 'Is my photo uploaded anywhere?', a: 'No. The AI runs inside your browser on your own device. Your photo and your text never leave it.' },
  { q: 'Why is the first photo slow?', a: 'The first time, your browser downloads the AI model (about 90 MB). After that it is saved in your browser, so the next photos start in seconds.' },
  { q: 'Why does my fan spin up for a moment?', a: 'That is your graphics card doing the cutout for a second or two. It stops as soon as the cutout is done.' },
  { q: 'Can I use the images in my ads?', a: 'Yes, the images you make are yours. You must own or have permission to use the photo and any brand names or characters in it.' },
  { q: 'Which browsers work best?', a: 'Chrome and Edge on a computer are fastest because they can use your graphics card. Other modern browsers work too, using the processor.' },
  { q: 'Is the code open source?', a: 'Yes. The full source code is public under the AGPL-3.0 licence. See the Licences page.' },
];

export function FaqList() {
  return (
    <div className="faq">
      {FAQ.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}
