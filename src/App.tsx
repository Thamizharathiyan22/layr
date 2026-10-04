import { useCallback, useEffect, useState } from 'react';
import { APP_NAME } from './brand';
import { ConsentBanner } from './components/Ads';
import Editor from './components/Editor';
import { HowItWorksPage, LicensesPage, PrivacyPage, TermsPage } from './components/Info';
import Landing from './components/Landing';
import Processing from './components/Processing';
import Result from './components/Result';
import { loadFontCss } from './lib/fonts';
import { canvasToBlob, loadImage } from './lib/render';
import { navigate, useRoute } from './lib/router';
import { CANCELLED, resetAI, segment, type Mask, type SegmentProgress } from './lib/segment';

//  Home  →  Processing  →  Editor  →  [Done]  →  Result
type Phase =
  | { kind: 'landing' }
  | { kind: 'processing'; img: HTMLCanvasElement; preview: string; progress: SegmentProgress | null; lastActivity: number; error?: string }
  | { kind: 'editor'; img: HTMLCanvasElement; mask: Mask | null; result: HTMLCanvasElement | null };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'landing' });
  const route = useRoute(APP_NAME);
  useEffect(loadFontCss, []);

  // Run the automatic cutout for a photo (also used by "Try again")
  const runCutout = useCallback(async (img: HTMLCanvasElement, preview: string) => {
    setPhase({ kind: 'processing', img, preview, progress: null, lastActivity: Date.now() });
    try {
      const blob = await canvasToBlob(img, 'image/jpeg', 0.95);
      const mask = await segment(blob, (progress) =>
        setPhase((p) => (p.kind === 'processing' && p.img === img ? { ...p, progress, lastActivity: Date.now() } : p)),
      );
      URL.revokeObjectURL(preview);
      setPhase((p) => (p.kind === 'processing' && p.img === img ? { kind: 'editor', img, mask, result: null } : p));
    } catch (e: any) {
      if (e?.message === CANCELLED) return; // replaced by "Try again"
      console.error(e);
      setPhase((p) =>
        p.kind === 'processing' && p.img === img ? { ...p, error: e?.message ?? 'Something went wrong' } : p,
      );
    }
  }, []);

  const start = useCallback(async (file: File) => {
    const img = await loadImage(file);
    const blob = await canvasToBlob(img, 'image/jpeg', 0.95);
    runCutout(img, URL.createObjectURL(blob));
  }, [runCutout]);

  // Watchdog: no sign of life for 60 s → offer "Try again"
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (phase.kind !== 'processing' || phase.error) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [phase.kind, phase.kind === 'processing' && phase.error]);
  const slow = phase.kind === 'processing' && !phase.error && now - phase.lastActivity > 60_000;

  const tryAgain = useCallback(() => {
    if (phase.kind !== 'processing') return;
    // Stuck mid-download = network, just retry. Stuck after download = GPU trouble, use the CPU.
    const p = phase.progress;
    const midDownload = p?.stage === 'download' && p.percent < 99.5;
    resetAI(!midDownload);
    runCutout(phase.img, phase.preview);
  }, [phase, runCutout]);

  const reset = useCallback(() => {
    setPhase({ kind: 'landing' });
    navigate('/');
  }, []);

  // Re-run the AI from inside the editor (keeps the user's text layers)
  const [cutoutJob, setCutoutJob] = useState<{ busy: boolean; msg: string } | null>(null);
  const retryCutout = useCallback(async () => {
    if (phase.kind !== 'editor') return;
    const img = phase.img;
    setCutoutJob({ busy: true, msg: 'Starting AI…' });
    try {
      const blob = await canvasToBlob(img, 'image/jpeg', 0.95);
      const mask = await segment(blob, (p) =>
        setCutoutJob({
          busy: true,
          msg: p.stage === 'download' ? `Downloading AI ${Math.round(p.percent)}%` : p.stage === 'fallback' ? 'Switching to CPU…' : 'Finding subject…',
        }),
      );
      setPhase((p) => (p.kind === 'editor' && p.img === img ? { ...p, mask } : p));
      setCutoutJob(null);
    } catch (e: any) {
      setCutoutJob({ busy: false, msg: `AI failed: ${e?.message ?? e}` });
    }
  }, [phase]);

  const setResult = (result: HTMLCanvasElement | null) => {
    setPhase((p) => (p.kind === 'editor' ? { ...p, result } : p));
    window.scrollTo({ top: 0 });
  };

  const onInfoPage = route !== '/';

  return (
    <div className="app">
      <div className="bg" aria-hidden>
        <span className="orb o1" />
        <span className="orb o2" />
        <span className="orb o3" />
        <span className="grain" />
      </div>

      {route === '/how-it-works' && <HowItWorksPage />}
      {route === '/privacy' && <PrivacyPage />}
      {route === '/terms' && <TermsPage />}
      {route === '/licenses' && <LicensesPage />}

      {/* The tool stays mounted while reading info pages, so work is never lost */}
      <div className="tool" hidden={onInfoPage}>
        {phase.kind === 'landing' && !onInfoPage && <Landing onFile={start} />}

        {phase.kind === 'processing' && (
          <Processing
            preview={phase.preview}
            progress={phase.progress}
            error={phase.error}
            slow={slow}
            onTryAgain={tryAgain}
            onRetry={() => setPhase({ kind: 'landing' })}
            onSkip={() => setPhase({ kind: 'editor', img: phase.img, mask: null, result: null })}
          />
        )}

        {phase.kind === 'editor' && (
          <>
            <div hidden={!!phase.result}>
              <Editor
                img={phase.img}
                mask={phase.mask}
                onNew={reset}
                onRetryCutout={retryCutout}
                cutoutJob={cutoutJob}
                onDone={setResult}
              />
            </div>
            {phase.result && <Result result={phase.result} onBack={() => setResult(null)} onNew={reset} />}
          </>
        )}
      </div>

      <ConsentBanner onOpenPrivacy={() => navigate('/privacy')} />
    </div>
  );
}
