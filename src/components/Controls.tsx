import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FONTS, FONT_CATS, PRESETS, PRESET_CATS, type FontCat, type Preset } from '../lib/fonts';
import { drawLayer, ensureFont, measureLayer, newLayer, type Blend, type TextLayer } from '../lib/render';

export type Tab = 'text' | 'style' | 'font' | 'color' | 'effects';

type Props = {
  layers: TextLayer[];
  selected: TextLayer | null;
  hasCutout: boolean;
  tab: Tab;
  fontTick: number;
  onTab: (t: Tab) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<TextLayer>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, dir: 1 | -1) => void;
  onFit: (id: string) => void;
  onRetryCutout: () => void;
  cutoutBusy: boolean;
  registerFocus: (fn: () => void) => void;
  solidity: number;
  onSolidity: (v: number) => void;
  onFixCutout: () => void;
  hasMask: boolean;
};

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'text', label: 'Text', icon: <path d="M5 6V4h14v2M12 4v16M9 20h6" /> },
  { id: 'style', label: 'Styles', icon: <path d="M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z" /> },
  { id: 'font', label: 'Font', icon: <path d="M4 20L10 4h1l6 16M6.5 14h8" /> },
  { id: 'color', label: 'Color', icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" /></> },
  { id: 'effects', label: 'Effects', icon: <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /> },
];

const SWATCHES = ['#ffffff', '#0b0b0f', '#facc15', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#06b6d4', '#22c55e', '#fef3c7', '#d97706'];

const BLENDS: { id: Blend; label: string }[] = [
  { id: 'source-over', label: 'Normal' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'soft-light', label: 'Soft light' },
  { id: 'screen', label: 'Screen' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'difference', label: 'Difference' },
];

export default function Controls(p: Props) {
  const s = p.selected;
  const set = (patch: Partial<TextLayer>) => s && p.onUpdate(s.id, patch);
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    p.registerFocus(() => { textRef.current?.focus(); textRef.current?.select(); });
  });

  return (
    <aside className="panel">
      {/* Layers */}
      <section className="layers-sec">
        <header>
          <h3>Layers</h3>
          <button className="btn chip" onClick={p.onAdd}>+ Add text</button>
        </header>
        <ul className="layers">
          {[...p.layers].reverse().map((l) => (
            <li key={l.id} className={l.id === s?.id ? 'active' : ''} onClick={() => p.onSelect(l.id)}>
              <span className="layer-name">{l.text.split('\n')[0] || 'Empty'}</span>
              <span className={`tag ${l.behind && p.hasCutout ? 'behind' : ''}`}>{l.behind && p.hasCutout ? 'Behind' : 'Front'}</span>
              <span className="layer-ops">
                <button title="Bring forward" onClick={(e) => { e.stopPropagation(); p.onMove(l.id, 1); }}>↑</button>
                <button title="Send backward" onClick={(e) => { e.stopPropagation(); p.onMove(l.id, -1); }}>↓</button>
              </span>
            </li>
          ))}
          {!p.layers.length && <li className="empty">No text yet — add one above</li>}
        </ul>
      </section>

      {!s ? (
        <div className="panel-empty">
          <div className="empty-ico">T</div>
          <p>Click a text on the photo to edit it</p>
          <button className="btn chip" onClick={p.onAdd}>+ Add text</button>
        </div>
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={p.tab === t.id} className={p.tab === t.id ? 'on' : ''} onClick={() => p.onTab(t.id)}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="tab-body" key={p.tab}>
            {p.tab === 'text' && (
              <>
                <Field label="Your text">
                  <textarea ref={textRef} value={s.text} rows={2} onChange={(e) => set({ text: e.target.value })} placeholder="Type your brand…" />
                </Field>

                <div className={`behind-card ${!p.hasCutout ? 'off' : s.behind ? 'on' : ''}`}>
                  <div>
                    <strong>Behind subject</strong>
                    <span>{p.hasCutout ? 'People & objects cover the text' : 'Needs the AI cutout first'}</span>
                  </div>
                  {p.hasCutout ? (
                    <Switch on={s.behind} onChange={(v) => set({ behind: v })} />
                  ) : (
                    <button className="btn chip on" onClick={p.onRetryCutout} disabled={p.cutoutBusy}>{p.cutoutBusy ? 'Working…' : 'Run AI'}</button>
                  )}
                </div>

                {p.hasCutout && (
                  <div className="cutout-card">
                    <div className="cutout-head">
                      <div>
                        <strong>Cutout wrong?</strong>
                        <span>AI missed a part, or picked the wrong thing</span>
                      </div>
                      <button className="btn chip on" onClick={p.onFixCutout}>Fix cutout</button>
                    </div>
                    <Slider label="Edge solidity" value={p.solidity} min={0} max={1} step={0.01}
                      fmt={(v) => (v < 0.25 ? 'Soft' : v < 0.7 ? 'Balanced' : 'Solid')} onChange={p.onSolidity} />
                  </div>
                )}

                <div className="grid2">
                  <Field label="Case">
                    <Seg options={[{ v: true, l: 'AA' }, { v: false, l: 'Aa' }]} value={s.uppercase} onChange={(v) => set({ uppercase: v })} />
                  </Field>
                  <Field label="Align">
                    <Seg options={[{ v: 'left', l: '⟸' }, { v: 'center', l: '≡' }, { v: 'right', l: '⟹' }]} value={s.align} onChange={(v) => set({ align: v as TextLayer['align'] })} />
                  </Field>
                </div>

                <Slider label="Size" value={s.size} min={0.02} max={0.6} step={0.005} fmt={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ size: v })}
                  extra={<button className="link" onClick={() => p.onFit(s.id)}>Fit width</button>} />
                <Slider label="Rotation" value={s.rotation} min={-180} max={180} step={0.5} fmt={(v) => `${v}°`} onChange={(v) => set({ rotation: v })}
                  extra={s.rotation !== 0 ? <button className="link" onClick={() => set({ rotation: 0 })}>Reset</button> : undefined} />
                <div className="grid2">
                  <Slider label="Position X" value={s.x} min={0} max={1} step={0.001} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ x: v })} />
                  <Slider label="Position Y" value={s.y} min={0} max={1} step={0.001} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ y: v })} />
                </div>

                <div className="row actions">
                  <button className="btn ghost" onClick={() => p.onDuplicate(s.id)}>Duplicate</button>
                  <button className="btn ghost danger" onClick={() => p.onRemove(s.id)}>Delete</button>
                </div>
              </>
            )}

            {p.tab === 'style' && <StyleTab layer={s} onApply={(st) => set(st)} />}

            {p.tab === 'font' && <FontTab layer={s} set={set} />}

            {p.tab === 'color' && (
              <>
                <div className="toggles">
                  <Toggle label="Fill" on={s.fillOn} onChange={(v) => set({ fillOn: v })} />
                  <Toggle label="Gradient" on={s.gradient} onChange={(v) => set({ gradient: v })} />
                </div>
                <ColorField label={s.gradient ? 'Color 1' : 'Fill color'} value={s.color} onChange={(v) => set({ color: v, fillOn: true })} />
                {s.gradient && (
                  <>
                    <ColorField label="Color 2" value={s.color2} onChange={(v) => set({ color2: v })} />
                    <Slider label="Gradient angle" value={s.gradAngle} min={0} max={180} step={1} fmt={(v) => `${v}°`} onChange={(v) => set({ gradAngle: v })} />
                  </>
                )}
                <Slider label="Opacity" value={s.opacity} min={0.05} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ opacity: v })} />
                <Field label="Blend with photo">
                  <div className="chips">
                    {BLENDS.map((b) => (
                      <button key={b.id} className={`btn chip ${s.blend === b.id ? 'on' : ''}`} onClick={() => set({ blend: b.id })}>{b.label}</button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {p.tab === 'effects' && (
              <>
                <Effect title="Outline" on={s.strokeWidth > 0} onToggle={(v) => set({ strokeWidth: v ? 0.015 : 0 })}>
                  <ColorField label="Color" value={s.strokeColor} onChange={(v) => set({ strokeColor: v })} />
                  <Slider label="Thickness" value={s.strokeWidth} min={0.002} max={0.08} step={0.001} fmt={(v) => (v * 100).toFixed(1)} onChange={(v) => set({ strokeWidth: v })} />
                </Effect>
                <Effect title="Shadow" on={s.shadow > 0} onToggle={(v) => set({ shadow: v ? 0.35 : 0 })}>
                  <ColorField label="Color" value={s.shadowColor} onChange={(v) => set({ shadowColor: v })} />
                  <Slider label="Strength" value={s.shadow} min={0.02} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ shadow: v })} />
                </Effect>
                <Effect title="Glow" on={s.glow > 0} onToggle={(v) => set({ glow: v ? 0.5 : 0 })}>
                  <ColorField label="Color" value={s.glowColor} onChange={(v) => set({ glowColor: v })} />
                  <Slider label="Strength" value={s.glow} min={0.02} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ glow: v })} />
                </Effect>
                <Effect title="3D depth" on={s.extrude > 0} onToggle={(v) => set({ extrude: v ? 0.4 : 0 })}>
                  <ColorField label="Side color" value={s.extrudeColor} onChange={(v) => set({ extrudeColor: v })} />
                  <Slider label="Depth" value={s.extrude} min={0.02} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ extrude: v })} />
                  <Slider label="Direction" value={s.extrudeAngle} min={0} max={359} step={1} fmt={(v) => `${v}°`} onChange={(v) => set({ extrudeAngle: v })} />
                </Effect>
                <Effect title="Label box" on={s.box > 0} onToggle={(v) => set({ box: v ? 1 : 0 })}>
                  <ColorField label="Box color" value={s.boxColor} onChange={(v) => set({ boxColor: v })} />
                  <Slider label="Box opacity" value={s.box} min={0.05} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ box: v })} />
                </Effect>
                <Slider label="Lean (skew)" value={s.skew} min={-30} max={30} step={0.5} fmt={(v) => `${v}°`} onChange={(v) => set({ skew: v })} />
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

/* ---------------- Styles tab: live-rendered preset thumbnails ---------------- */

function StyleTab({ layer, onApply }: { layer: TextLayer; onApply: (s: Partial<TextLayer>) => void }) {
  const [cat, setCat] = useState<Preset['cat']>('Popular');
  const [ready, setReady] = useState(0);
  const sample = (layer.text.split('\n')[0] || 'BRAND').slice(0, 9);
  const list = PRESETS.filter((pr) => pr.cat === cat);

  useEffect(() => {
    let alive = true;
    Promise.all(list.map((pr) => ensureFont({ font: pr.style.font!, weight: pr.style.weight!, italic: !!pr.style.italic }, sample)))
      .then(() => alive && setReady((r) => r + 1));
    return () => { alive = false; };
  }, [cat]); // eslint-disable-line

  return (
    <>
      <div className="chips">
        {PRESET_CATS.map((c) => (
          <button key={c} className={`btn chip ${c === cat ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="presets">
        {list.map((pr) => (
          <button key={pr.name} className="preset" onClick={() => onApply(pr.style)} title={`Apply ${pr.name}`}>
            <PresetThumb preset={pr} text={sample} tick={ready} />
            <span>{pr.name}</span>
          </button>
        ))}
      </div>
      <p className="note">Styles change the look only — your text, size and position stay.</p>
    </>
  );
}

const PresetThumb = memo(function PresetThumb({ preset, text, tick }: { preset: Preset; text: string; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 150, H = 76;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#3b2a5c'); g.addColorStop(1, '#1b3a4b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const l = newLayer({ ...preset.style, text, x: 0.5, y: 0.5, size: 0.3 });
    const m = measureLayer(ctx, l, W);
    l.size *= Math.min((W * 0.78) / m.w, (H * 0.62) / m.h);
    drawLayer(ctx, l, W, H);
  }, [preset, text, tick]);
  return <canvas ref={ref} className="thumb" />;
});

/* ---------------- Font tab: search, categories, weights ---------------- */

function FontTab({ layer: s, set }: { layer: TextLayer; set: (p: Partial<TextLayer>) => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<FontCat | 'All'>('All');
  const fontDef = FONTS.find((f) => f.family === s.font);
  const list = useMemo(
    () => FONTS.filter((f) => (cat === 'All' || f.cat === cat) && f.family.toLowerCase().includes(q.toLowerCase())),
    [q, cat],
  );

  return (
    <>
      <input className="search" placeholder="Search 55 fonts…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {(['All', ...FONT_CATS] as const).map((c) => (
          <button key={c} className={`btn chip ${c === cat ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="font-list">
        {list.map((f) => (
          <button
            key={f.family}
            className={`font ${f.family === s.font ? 'on' : ''}`}
            style={{ fontFamily: `"${f.family}"`, fontWeight: f.weights.includes(700) ? 700 : f.weights[f.weights.length - 1] }}
            onClick={() => set({
              font: f.family,
              weight: f.weights.includes(s.weight) ? s.weight : f.weights[f.weights.length - 1],
              italic: f.italic ? s.italic : false,
            })}
          >
            {f.family}
          </button>
        ))}
        {!list.length && <p className="note">No fonts match “{q}”.</p>}
      </div>
      {fontDef && (fontDef.weights.length > 1 || fontDef.italic) && (
        <Field label="Weight">
          <div className="seg">
            {fontDef.weights.map((w) => (
              <button key={w} className={w === s.weight ? 'on' : ''} onClick={() => set({ weight: w })}>{WEIGHT_NAMES[w] ?? w}</button>
            ))}
            {fontDef.italic && <button className={s.italic ? 'on' : ''} onClick={() => set({ italic: !s.italic })}><i>Italic</i></button>}
          </div>
        </Field>
      )}
      <Slider label="Letter spacing" value={s.letterSpacing} min={-0.1} max={0.5} step={0.005} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ letterSpacing: v })} />
      <Slider label="Line height" value={s.lineHeight} min={0.6} max={2} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ lineHeight: v })} />
    </>
  );
}

const WEIGHT_NAMES: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi', 700: 'Bold', 800: 'Extra', 900: 'Black' };

/* ---------------- Small building blocks ---------------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

function Effect({ title, on, onToggle, children }: { title: string; on: boolean; onToggle: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className={`effect ${on ? 'on' : ''}`}>
      <header onClick={() => onToggle(!on)}>
        <strong>{title}</strong>
        <Switch on={on} onChange={onToggle} />
      </header>
      {on && <div className="effect-body">{children}</div>}
    </div>
  );
}

function Slider(props: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void; extra?: ReactNode;
}) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <label className="slider">
      <span className="slider-top">
        <span>{props.label}</span>
        <span className="row tight">
          {props.extra}
          <output>{props.fmt(props.value)}</output>
        </span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        style={{ '--p': `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`switch ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
    >
      <span />
    </button>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="knob" />
      {label}
    </button>
  );
}

function Seg<T extends string | boolean>({ options, value, onChange }: { options: { v: T; l: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="colorfield">
      <label className="color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span>{label}</span>
        <code>{value.toUpperCase()}</code>
      </label>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button key={c} className={c.toLowerCase() === value.toLowerCase() ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} title={c} />
        ))}
      </div>
    </div>
  );
}
