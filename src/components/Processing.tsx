import { isLowMemoryDevice } from '../lib/device';
import type { SegmentProgress } from '../lib/segment';

const PHONE = isLowMemoryDevice();
import { LockIcon } from './Explainers';
import Logo from './Logo';

type Props = {
  preview: string;
  progress: SegmentProgress | null;
  error?: string;
  slow?: boolean;
  onTryAgain?: () => void;
  onRetry: () => void;
  onSkip: () => void;
};

export default function Processing({ preview, progress, error, onRetry, onSkip, slow, onTryAgain }: Props) {
  let title = 'Warming up the AI…';
  let detail = 'Loading the cutout model';
  let pct: number | null = null;

  if (progress?.stage === 'download' && progress.percent >= 99.5) {
    // Files are in; the browser is now setting the model up on the GPU/CPU (no progress events)
    title = 'Setting up AI on your device…';
    detail = PHONE ? 'Phones need a little longer — up to a minute' : 'This can take up to a minute';
  } else if (progress?.stage === 'download') {
    pct = progress.percent;
    title = 'Downloading AI model (first time only)';
    const lite = progress.device === 'wasm' ? (PHONE ? 'Phone detected — using the lighter AI · ' : 'Using the lighter AI · ') : '';
    detail = progress.totalMB
      ? `${lite}${progress.loadedMB.toFixed(0)} / ${progress.totalMB.toFixed(0)} MB · saved for next time`
      : 'Starting download…';
  } else if (progress?.stage === 'fallback') {
    title = 'Graphics chip too slow — switching to CPU';
    detail = 'Slower, but works on every device. We’ll remember this.';
  } else if (progress?.stage === 'detect') {
    title = 'Finding people & objects…';
    detail = progress.device === 'webgpu'
      ? 'Using your graphics chip (GPU)'
      : PHONE
        ? 'Phone detected — using the lighter AI on your CPU (about 20–40 seconds)'
        : 'Using your CPU — can take 10–30 seconds';
  }

  return (
    <main className="processing">
      <nav className="nav"><Logo /></nav>
      <div className={`scan-card ${error ? 'has-error' : ''}`}>
        <div className="scan-img">
          <img src={preview} alt="Your photo" />
          {!error && <span className="scanline" />}
        </div>
        <div className="scan-info">
          {error ? (
            <>
              <h2>Couldn’t run the AI</h2>
              <p className="muted">{error}</p>
              <div className="row">
                <button className="btn ghost" onClick={onRetry}>Try another photo</button>
                <button className="btn" onClick={onSkip}>Continue without cutout</button>
              </div>
            </>
          ) : (
            <>
              <h2>{title}</h2>
              <p className="muted">{detail}</p>
              <div className={`bar ${pct === null ? 'indet' : ''}`}>
                <span style={pct === null ? undefined : { width: `${Math.max(3, pct)}%` }} />
              </div>
              {slow && (
                <div className="slow-box">
                  <div>
                    <strong>Taking longer than usual</strong>
                    <span>A slow connection or a busy graphics card can cause this.</span>
                  </div>
                  <button className="btn primary" onClick={onTryAgain}>Try again</button>
                </div>
              )}
              <p className="scan-tip">
                <span className="pill private-pill"><LockIcon /> Runs on your device — your photo is not uploaded</span>
                <br />
                Tip: busy digital art can confuse the AI. If it misses something, use <b>Fix cutout</b> in the editor.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
