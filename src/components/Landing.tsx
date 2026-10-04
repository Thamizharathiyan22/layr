import { useEffect, useRef, useState } from 'react';
import { AD_SLOTS, APP_NAME } from '../brand';
import { navigate } from '../lib/router';
import { AdSlot } from './Ads';
import { BestResults, DeviceDiagram, FaqList, Steps, WhyYourGpu } from './Explainers';
import { Footer } from './Info';
import Logo from './Logo';

export default function Landing({ onFile }: { onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState('');

  const take = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('That file is not an image. Try JPG, PNG or WEBP.');
    setErr('');
    onFile(f);
  };

  // Paste an image from clipboard (Ctrl+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      if (item) take(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  return (
    <main className="landing">
      <nav className="nav">
        <Logo />
        <div className="row">
          <a className="nav-link" href="/how-it-works" onClick={(e) => { e.preventDefault(); navigate('/how-it-works'); }}>How it works</a>
          <span className="pill hide-sm">
            <span className="dot" /> AI runs on your device
          </span>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Branded photo ads in seconds</p>
          <h1>
            Put your brand <span className="grad">inside</span> the photo.
          </h1>
          <p className="sub">
            Upload any photo. {APP_NAME} finds the people and objects, then slides your text
            <em> behind</em> them — the depth effect top brands use, without Photoshop.
          </p>

          <div
            className={`drop ${over ? 'over' : ''}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          >
            <div className="drop-icon">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <div>
              <strong>Drop a photo here</strong>
              <span>or click to browse · paste with Ctrl+V</span>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          {err && <p className="err">{err}</p>}

          <ul className="feats">
            <li><b>Private</b> Photos never leave your device</li>
            <li><b>Any subject</b> People, cars, products, pets</li>
            <li><b>Full quality</b> Export sharp PNG or JPG</li>
          </ul>
        </div>

        <div className="stack" aria-hidden>
          <div className="layer l1"><span>Photo</span></div>
          <div className="layer l2"><span className="word">BRAND</span><span>Text</span></div>
          <div className="layer l3">
            <svg viewBox="0 0 200 240" className="figure">
              <defs>
                <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#c4b5fd" />
                  <stop offset="1" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="62" r="30" fill="url(#fg)" />
              <path d="M40 240c0-62 26-120 60-120s60 58 60 120z" fill="url(#fg)" />
            </svg>
            <span>Subject</span>
          </div>
        </div>
      </section>

      <section className="home-sec">
        <h2>Three steps. No Photoshop.</h2>
        <Steps />
      </section>

      <section className="home-sec split">
        <div>
          <p className="eyebrow">Private by design</p>
          <h2>Your device does the work. Your photo stays with you.</h2>
          <WhyYourGpu />
        </div>
        <DeviceDiagram />
      </section>

      <section className="home-sec">
        <p className="eyebrow">Best results</p>
        <h2>What the AI loves, and what confuses it</h2>
        <BestResults />
      </section>

      <AdSlot slot={AD_SLOTS.home} className="ad-home" />

      <section className="home-sec narrow">
        <h2>Questions</h2>
        <FaqList />
      </section>

      <Footer />
    </main>
  );
}
