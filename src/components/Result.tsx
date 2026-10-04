import { useEffect, useMemo, useState } from 'react';
import { AD_SLOTS, SOURCE_URL } from '../brand';
import { navigate } from '../lib/router';
import { canvasToBlob } from '../lib/render';
import { AdSlot } from './Ads';
import Logo from './Logo';

type Format = 'png' | 'jpg';
type Props = { result: HTMLCanvasElement; onBack: () => void; onNew: () => void };

function scaled(src: HTMLCanvasElement, longest: number) {
  const s = Math.min(1, longest / Math.max(src.width, src.height));
  if (s === 1) return src;
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const fmtBytes = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export default function Result({ result, onBack, onNew }: Props) {
  const [format, setFormat] = useState<Format>('png');
  const [size, setSize] = useState<number>(0); // 0 = original
  const [file, setFile] = useState<{ blob: Blob; url: string } | null>(null);
  const [toast, setToast] = useState('');
  const preview = useMemo(() => result.toDataURL('image/jpeg', 0.9), [result]);

  const longest = Math.max(result.width, result.height);
  const sizes = [
    { v: 0, label: 'Original', sub: `${result.width} × ${result.height}` },
    ...[2048, 1080].filter((n) => n < longest).map((n) => {
      const s = n / longest;
      return { v: n, label: n === 2048 ? 'Large' : 'Social', sub: `${Math.round(result.width * s)} × ${Math.round(result.height * s)}` };
    }),
  ];

  // Build the file whenever format or size changes
  useEffect(() => {
    let alive = true;
    const c = size ? scaled(result, size) : result;
    canvasToBlob(c, format === 'png' ? 'image/png' : 'image/jpeg', 0.92).then((blob) => {
      if (!alive) return;
      setFile((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
    });
    return () => { alive = false; };
  }, [result, format, size]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200); };
  const name = `layr-${Date.now()}.${format}`;

  const download = () => {
    if (!file) return;
    const a = document.createElement('a');
    a.href = file.url;
    a.download = name;
    a.click();
    flash('Downloaded ✓');
  };

  const copy = async () => {
    try {
      const png = format === 'png' && file ? file.blob : await canvasToBlob(size ? scaled(result, size) : result, 'image/png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      flash('Copied — paste it anywhere');
    } catch {
      flash('Your browser blocked copying. Use Download instead.');
    }
  };

  const shareFile = file && new File([file.blob], name, { type: file.blob.type });
  const canShare = !!shareFile && typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareFile] });
  const share = async () => {
    try { await navigator.share({ files: [shareFile!], title: 'Made with Layr' }); } catch { /* cancelled */ }
  };

  return (
    <main className="result">
      <header className="topbar">
        <Logo onClick={onNew} />
        <div className="topbar-mid" />
        <div className="row">
          <button className="btn ghost" onClick={onBack}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            Back to editing
          </button>
        </div>
      </header>

      <div className="result-body">
        <section className="result-preview">
          <div className="result-frame">
            <img src={preview} alt="Your finished image" />
          </div>
          <p className="muted small">Made in your browser — your photo was never uploaded.</p>
        </section>

        <aside className="result-panel">
          <div className="done-badge">
            <span>✓</span>
            <div>
              <h2>Your ad is ready</h2>
              <p className="muted">Pick a format and size, then download.</p>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Format</span>
            <div className="choice-grid">
              <button className={format === 'png' ? 'on' : ''} onClick={() => setFormat('png')}>
                <b>PNG</b><span>Best quality</span>
              </button>
              <button className={format === 'jpg' ? 'on' : ''} onClick={() => setFormat('jpg')}>
                <b>JPG</b><span>Smaller file</span>
              </button>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Size</span>
            <div className="choice-grid">
              {sizes.map((s) => (
                <button key={s.v} className={size === s.v ? 'on' : ''} onClick={() => setSize(s.v)}>
                  <b>{s.label}</b><span>{s.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="btn primary big" onClick={download} disabled={!file}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>
            Download {format.toUpperCase()} {file && <small>· {fmtBytes(file.blob.size)}</small>}
          </button>
          <div className="row two">
            <button className="btn ghost" onClick={copy}>Copy image</button>
            {canShare ? <button className="btn ghost" onClick={share}>Share</button> : <button className="btn ghost" onClick={onNew}>New photo</button>}
          </div>

          <AdSlot slot={AD_SLOTS.result} className="ad-result" />

          <p className="legal-links">
            <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Privacy</a>
            <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }}>Terms</a>
            <a href="/licenses" onClick={(e) => { e.preventDefault(); navigate('/licenses'); }}>Licences</a>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Source code</a>
          </p>
        </aside>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
