import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { Cutout } from '../lib/mask';
import { prepare as samPrepare, selectAt } from '../lib/sam';
import type { Mask } from '../lib/segment';
import {
  canvasToBlob, ensureFont, fitSize, hitTest, inkBounds, newLayer, render, selectionPad, type TextLayer,
} from '../lib/render';
import Controls, { type Tab } from './Controls';
import Logo from './Logo';

type Props = {
  img: HTMLCanvasElement;
  mask: Mask | null;
  onNew: () => void;
  onRetryCutout: () => void;
  cutoutJob: { busy: boolean; msg: string } | null;
  onDone: (result: HTMLCanvasElement) => void;
};

type Drag =
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'scale'; id: string; startDist: number; startSize: number }
  | { kind: 'rotate'; id: string; startAngle: number; startRot: number };

type Tool = 'move' | 'tapAdd' | 'tapRemove' | 'restore' | 'erase';
let photoSeq = 0;

export default function Editor({ img, mask, onNew, onRetryCutout, cutoutJob, onDone }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [first] = useState(() => newLayer());
  const [layers, setLayers] = useState<TextLayer[]>(() => [first]);
  const [selectedId, setSelectedId] = useState<string | null>(first.id);
  const [tab, setTab] = useState<Tab>('text');
  const [peek, setPeek] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [view, setView] = useState({ w: 0, h: 0 }); // on-screen canvas size at 100% zoom ("Fit")
  // ---- Zoom & pan: z = zoom (1 = fit), x/y = how far the photo is moved from the centre, in screen px ----
  const [cam, setCam] = useState({ z: 1, x: 0, y: 0 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const viewRef = useRef(view);
  viewRef.current = view;
  const avail = useRef({ w: 0, h: 0 }); // space inside the stage
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; z0: number; p0: { x: number; y: number }; m0: { x: number; y: number } } | null>(null);
  const panDrag = useRef<{ sx: number; sy: number; x0: number; y0: number } | null>(null);
  const tapDown = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const didAutoFit = useRef(false);
  const textFocus = useRef<() => void>(() => {});

  // ---- Cutout: AI mask + solidity + brush fixes ----
  const [solidity, setSolidity] = useState(0.55);
  const [tool, setTool] = useState<Tool>('move');
  const [brush, setBrush] = useState(22); // radius in screen px
  const [cutTick, setCutTick] = useState(0);
  const cutout = useMemo(() => new Cutout(img, mask, solidity), [img, mask]); // eslint-disable-line
  const firstSolidity = useRef(true);
  useEffect(() => {
    if (firstSolidity.current) { firstSolidity.current = false; return; }
    cutout.setSolidity(solidity);
    setCutTick((t) => t + 1);
  }, [solidity]); // eslint-disable-line
  const fg = cutout.hasSubject() ? cutout.fg : null;
  const refining = tool !== 'move';
  const isBrush = tool === 'restore' || tool === 'erase';
  const isTap = tool === 'tapAdd' || tool === 'tapRemove';

  // ---- Tap to select (SlimSAM): read the photo once, then each tap is instant ----
  const photoKey = useMemo(() => ++photoSeq, [img]);
  const [sam, setSam] = useState<{ state: 'idle' | 'loading' | 'ready' | 'busy' | 'error'; msg?: string }>({ state: 'idle' });
  const [taps, setTaps] = useState<{ id: number; x: number; y: number; add: boolean }[]>([]);
  useEffect(() => {
    if (!isTap || sam.state === 'ready' || sam.state === 'loading' || sam.state === 'busy') return;
    setSam({ state: 'loading', msg: 'Getting tap-select ready…' });
    canvasToBlob(img, 'image/jpeg', 0.92)
      .then((b) => samPrepare(photoKey, b, (pct) => setSam({ state: 'loading', msg: `Downloading tap-select AI ${Math.round(pct)}%` })))
      .then(() => setSam({ state: 'ready' }))
      .catch((e) => setSam({ state: 'error', msg: `Tap-select failed: ${e?.message ?? e}` }));
  }, [isTap]); // eslint-disable-line

  const tapAt = async (p: { x: number; y: number }) => {
    if (sam.state !== 'ready') return;
    const add = tool === 'tapAdd';
    const id = Date.now();
    setTaps((t) => [...t, { id, x: p.x / img.width, y: p.y / img.height, add }]);
    setSam({ state: 'busy' });
    try {
      await cutout.pushUndo();
      const m = await selectAt(p.x / img.width, p.y / img.height);
      cutout.applyMask(add ? 'restore' : 'erase', m);
      setCutTick((t) => t + 1);
      setSam({ state: 'ready' });
    } catch (e: any) {
      setSam({ state: 'error', msg: `Tap-select failed: ${e?.message ?? e}` });
    } finally {
      setTimeout(() => setTaps((t) => t.filter((x) => x.id !== id)), 700);
    }
  };
  const paint = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);
  const cursor = useRef<HTMLDivElement>(null);
  const tint = useRef<HTMLCanvasElement | null>(null);

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  // ---- Fit the canvas inside the stage, keeping aspect ratio ----
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const aw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const ah = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const s = Math.min(aw / img.width, ah / img.height);
      avail.current = { w: aw, h: ah };
      setView({ w: Math.floor(img.width * s), h: Math.floor(img.height * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  // ---- Zoom helpers ----
  const MAX_ZOOM = 8;
  const clampCam = (c: { z: number; x: number; y: number }) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, c.z));
    const v = viewRef.current, a = avail.current;
    const extra = z > 1.01 ? 40 : 0; // a little breathing room at the edges when zoomed
    const mx = Math.max(0, (v.w * z - a.w) / 2 + extra), my = Math.max(0, (v.h * z - a.h) / 2 + extra);
    return { z, x: Math.min(mx, Math.max(-mx, c.x)), y: Math.min(my, Math.max(-my, c.y)) };
  };
  /** Screen point relative to the stage centre. */
  const fromCentre = (clientX: number, clientY: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) };
  };
  /** Zoom to z, keeping the photo point under (clientX, clientY) still. */
  const zoomAt = (z: number, clientX?: number, clientY?: number) => {
    const c = camRef.current;
    const m = clientX === undefined ? { x: 0, y: 0 } : fromCentre(clientX, clientY!);
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    setCam(clampCam({ z: nz, x: m.x - ((m.x - c.x) * nz) / c.z, y: m.y - ((m.y - c.y) * nz) / c.z }));
  };
  const fitView = () => setCam({ z: 1, x: 0, y: 0 });
  useEffect(fitView, [img]);
  useEffect(() => setCam((c) => clampCam(c)), [view]); // eslint-disable-line

  // Mouse wheel / trackpad pinch zooms toward the pointer
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest('.zoom-bar, .sam-status')) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const k = e.ctrlKey ? 0.01 : 0.0015; // trackpad pinch sends small ctrl+wheel steps
      zoomAt(camRef.current.z * Math.exp(-dy * k), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line

  // Hold Space to pan with the mouse (like design apps)
  useEffect(() => {
    const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, select, button');
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e.target)) { e.preventDefault(); setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Phones: the editor panel sits below the photo, so bring the photo back into view when fixing starts
  useEffect(() => {
    if (!refining || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) wrap.current.closest('.stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [refining]);

  // ---- Fonts: load every font in use before drawing ----
  const fontKey = layers.map((l) => `${l.font}|${l.weight}|${l.italic}`).join(',');
  useEffect(() => {
    let alive = true;
    Promise.all(layers.map((l) => ensureFont(l, l.text))).then(() => {
      if (!alive) return;
      setFontTick((t) => t + 1);
      if (!didAutoFit.current && canvas.current) {
        didAutoFit.current = true; // first time: size the starter text to fit the photo
        const ctx = canvas.current.getContext('2d')!;
        setLayers((ls) => ls.map((l, i) => (i === 0 ? { ...l, size: fitSize(ctx, l, img.width) } : l)));
      }
    });
    return () => { alive = false; };
  }, [fontKey]); // eslint-disable-line

  // ---- Redraw on every change (no selection marks on the image itself) ----
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    render(ctx, { img, fg, layers, peek });
    if (refining && fg) {
      // Show what the AI thinks is "subject" as a pink tint while refining
      const t = (tint.current ??= document.createElement('canvas'));
      t.width = img.width; t.height = img.height;
      const tc = t.getContext('2d')!;
      tc.drawImage(fg, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = '#ec4899';
      tc.fillRect(0, 0, t.width, t.height);
      tc.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.drawImage(t, 0, 0);
      ctx.restore();
    }
  }, [img, fg, layers, peek, fontTick, cutTick, refining]);

  // Turn "behind" on automatically once a cutout arrives
  const hadFg = useRef(!!fg);
  useEffect(() => {
    if (fg && !hadFg.current) setLayers((ls) => ls.map((l) => ({ ...l, behind: true })));
    hadFg.current = !!fg;
  }, [fg]);

  const update = useCallback((id: string, patch: Partial<TextLayer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const fitWidth = (id: string) => {
    const l = layers.find((x) => x.id === id);
    if (l && canvas.current) update(id, { size: fitSize(canvas.current.getContext('2d')!, l, img.width), x: 0.5 });
  };

  const addLayer = () => {
    const base = selected ?? first;
    const { id: _i, text: _t, x: _x, y: _y, size: _s, ...style } = base;
    const l = newLayer({ ...style, text: 'YOUR TEXT', size: 0.1, y: 0.75, rotation: 0 });
    setLayers((ls) => [...ls, l]);
    setSelectedId(l.id);
    setTab('text');
  };

  const removeLayer = (id: string) => {
    setLayers((ls) => ls.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicate = (id: string) => {
    const src = layers.find((l) => l.id === id);
    if (!src) return;
    const { id: _id, ...rest } = src;
    const copy = newLayer({ ...rest, x: Math.min(0.95, src.x + 0.03), y: Math.min(0.95, src.y + 0.03) });
    setLayers((ls) => [...ls, copy]);
    setSelectedId(copy.id);
  };

  const move = (id: string, dir: 1 | -1) => {
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // ---- Pointer helpers (screen → image pixels) ----
  const toImage = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * img.width, y: ((e.clientY - r.top) / r.height) * img.height };
  };

  // ---- Refine brush ----
  const brushImgRadius = () => (brush * img.width) / Math.max(1, view.w * cam.z); // finer when zoomed in
  const scheduleCompose = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      cutout.compose();
      setCutTick((t) => t + 1);
    });
  };
  const moveCursor = (e: { clientX: number; clientY: number }) => {
    const el = cursor.current, box = canvas.current?.getBoundingClientRect();
    if (!el || !box) return;
    el.style.transform = `translate(${e.clientX - box.left}px, ${e.clientY - box.top}px)`;
  };

  const onCanvasDown = (e: RPointerEvent) => {
    if (pinch.current || panDrag.current) return;
    const p = toImage(e);
    if (isTap) {
      tapDown.current = { ...p, cx: e.clientX, cy: e.clientY }; // fires on release, so a pinch never counts as a tap
      return;
    }
    if (isBrush) {
      cutout.pushUndo();
      cutout.stroke(tool as 'restore' | 'erase', p.x, p.y, p.x, p.y, brushImgRadius());
      paint.current = p;
      scheduleCompose();
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    const hit = hitTest(canvas.current!.getContext('2d')!, layers, img.width, img.height, p.x, p.y);
    if (!hit) {
      setSelectedId(null);
      if (camRef.current.z > 1.01) startPan(e); // zoomed in: drag the empty photo to look around
      return;
    }
    setSelectedId(hit.id);
    drag.current = { kind: 'move', id: hit.id, dx: p.x - hit.x * img.width, dy: p.y - hit.y * img.height };
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onHandleDown = (e: RPointerEvent, kind: 'scale' | 'rotate') => {
    if (!selected) return;
    e.stopPropagation();
    const p = toImage(e);
    const cx = selected.x * img.width, cy = selected.y * img.height;
    drag.current =
      kind === 'scale'
        ? { kind, id: selected.id, startDist: Math.hypot(p.x - cx, p.y - cy), startSize: selected.size }
        : { kind, id: selected.id, startAngle: Math.atan2(p.y - cy, p.x - cx), startRot: selected.rotation };
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (isTap) return;
    if (isBrush) {
      moveCursor(e);
      const last = paint.current;
      if (!last) return;
      const p = toImage(e);
      cutout.stroke(tool as 'restore' | 'erase', last.x, last.y, p.x, p.y, brushImgRadius());
      paint.current = p;
      scheduleCompose();
      return;
    }
    const d = drag.current;
    if (!d) return;
    const p = toImage(e);
    const l = layers.find((x) => x.id === d.id);
    if (!l) return;
    if (d.kind === 'move') {
      let x = (p.x - d.dx) / img.width, y = (p.y - d.dy) / img.height;
      if (Math.abs(x - 0.5) < 0.012) x = 0.5; // snap to centre
      if (Math.abs(y - 0.5) < 0.012) y = 0.5;
      update(d.id, { x, y });
    } else if (d.kind === 'scale') {
      const dist = Math.hypot(p.x - l.x * img.width, p.y - l.y * img.height);
      update(d.id, { size: Math.max(0.015, Math.min(0.8, (d.startSize * dist) / Math.max(1, d.startDist))) });
    } else {
      const a = Math.atan2(p.y - l.y * img.height, p.x - l.x * img.width);
      let rot = d.startRot + ((a - d.startAngle) * 180) / Math.PI;
      rot = ((rot + 540) % 360) - 180;
      for (const snap of [-90, -45, 0, 45, 90]) if (Math.abs(rot - snap) < 3) rot = snap;
      update(d.id, { rotation: Math.round(rot * 2) / 2 });
    }
  };

  const onPointerUp = (e: RPointerEvent) => {
    const t = tapDown.current;
    tapDown.current = null;
    if (t && isTap && e.type === 'pointerup' && Math.hypot(e.clientX - t.cx, e.clientY - t.cy) < 12) tapAt(t);
    drag.current = null; paint.current = null; setDragging(false);
  };

  // ---- Pan (one finger on empty photo, Space+drag, middle mouse) and pinch (two fingers) ----
  const startPan = (e: RPointerEvent) => {
    panDrag.current = { sx: e.clientX, sy: e.clientY, x0: camRef.current.x, y0: camRef.current.y };
    setPanning(true);
    wrap.current?.setPointerCapture(e.pointerId);
  };
  const onWrapDownCapture = (e: RPointerEvent) => {
    if ((e.target as Element).closest('.zoom-bar, .sam-status')) return;
    if (e.pointerType === 'touch') pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); // fingers only
    if (pointers.current.size === 2) {
      // Second finger: switch to pinch, and undo whatever the first finger just started
      e.stopPropagation();
      if (paint.current) { paint.current = null; cutout.undo(); setCutTick((t) => t + 1); }
      drag.current = null; tapDown.current = null; panDrag.current = null;
      setDragging(false); setPanning(false);
      const [a, b] = [...pointers.current.values()];
      const c = camRef.current;
      pinch.current = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z0: c.z, p0: { x: c.x, y: c.y }, m0: fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    if (pointers.current.size > 2 || pinch.current) { e.stopPropagation(); return; }
    if (spaceHeld || e.button === 1 || e.target === wrap.current) {
      e.stopPropagation();
      e.preventDefault();
      if (camRef.current.z > 1.01 || spaceHeld || e.button === 1) startPan(e);
    }
  };
  const onWrapMove = (e: RPointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pc = pinch.current;
    if (pc && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const z = Math.min(MAX_ZOOM, Math.max(1, (pc.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / pc.d0));
      const m = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2);
      setCam(clampCam({ z, x: m.x - ((pc.m0.x - pc.p0.x) * z) / pc.z0, y: m.y - ((pc.m0.y - pc.p0.y) * z) / pc.z0 }));
      return;
    }
    const pd = panDrag.current;
    if (pd) setCam(clampCam({ z: camRef.current.z, x: pd.x0 + e.clientX - pd.sx, y: pd.y0 + e.clientY - pd.sy }));
  };
  const onWrapUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) { panDrag.current = null; setPanning(false); }
  };

  // ---- Keyboard: arrows nudge, Delete removes, Esc deselects ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && refining) {
        e.preventDefault();
        cutout.undo();
        return setCutTick((t) => t + 1);
      }
      if (e.key === 'Escape') return refining ? setTool('move') : setSelectedId(null);
      if (refining) return;
      if (!selected) return;
      const step = e.shiftKey ? 0.02 : 0.004;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        update(selected.id, { x: selected.x + moves[e.key][0], y: selected.y + moves[e.key][1] });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeLayer(selected.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Done: build the clean final image and go to the result page ----
  const finish = () => {
    setTool('move');
    const out = document.createElement('canvas');
    out.width = img.width;
    out.height = img.height;
    render(out.getContext('2d')!, { img, fg, layers });
    onDone(out);
  };

  // ---- Selection box (HTML overlay, never painted into the image) ----
  let box: CSSProperties | null = null;
  if (selected && canvas.current && view.w && !refining) {
    const b = inkBounds(canvas.current.getContext('2d')!, selected, img.width);
    const pad = selectionPad(selected, img.width);
    const k = (view.w * cam.z) / img.width;
    // Ink box centre is offset from the layer centre; rotate that offset with the text
    const a = (selected.rotation * Math.PI) / 180;
    const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    const ox = cx * Math.cos(a) - cy * Math.sin(a), oy = cx * Math.sin(a) + cy * Math.cos(a);
    box = {
      left: (selected.x * img.width + ox) * k,
      top: (selected.y * img.height + oy) * k,
      width: (b.right - b.left + pad * 2) * k,
      height: (b.bottom - b.top + pad * 2) * k,
      transform: `translate(-50%, -50%) rotate(${selected.rotation}deg)`,
    };
  }

  return (
    <main className="editor">
      <header className="topbar">
        <Logo onClick={onNew} />
        <div className="topbar-mid">
          {!fg && (
            <button className={`pill warn ${cutoutJob?.busy ? 'busy' : ''}`} onClick={onRetryCutout} disabled={cutoutJob?.busy}>
              {cutoutJob?.busy ? <span className="spin" /> : '⚠'}
              {cutoutJob ? cutoutJob.msg : 'No cutout yet — text sits on top'}
              {!cutoutJob?.busy && <b>Run AI</b>}
            </button>
          )}
        </div>
        <div className="row">
          <button className="btn ghost hide-sm" onClick={onNew}>New photo</button>
          <button className="btn primary" onClick={finish}>
            Done
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="stage">
          <div
            className={`canvas-wrap ${spaceHeld ? 'pan-ready' : ''} ${panning ? 'panning' : ''} ${cam.z > 1.01 ? 'zoomed' : ''}`}
            ref={wrap}
            onPointerDownCapture={onWrapDownCapture}
            onPointerMoveCapture={onWrapMove}
            onPointerUp={onWrapUp}
            onPointerCancel={onWrapUp}
            onLostPointerCapture={onWrapUp}
          >
            <div
              className={`canvas-box ${dragging ? 'is-dragging' : ''} ${isBrush ? 'brushing' : ''} ${isTap ? 'tapping' : ''} ${sam.state === 'busy' ? 'busy' : ''}`}
              style={{
                width: view.w * cam.z,
                height: view.h * cam.z,
                transform: `translate(calc(-50% + ${cam.x}px), calc(-50% + ${cam.y}px))`,
              }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <canvas
                ref={canvas}
                width={img.width}
                height={img.height}
                onPointerDown={onCanvasDown}
                onDoubleClick={() => { setTab('text'); setTimeout(() => textFocus.current(), 0); }}
              />
              {isBrush && (
                <div ref={cursor} className={`brush-cursor ${tool}`} style={{ width: brush * 2, height: brush * 2, margin: -brush }} />
              )}
              {taps.map((t) => (
                <span key={t.id} className={`tap-ping ${t.add ? 'add' : 'remove'}`} style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }} />
              ))}
              {box && (
                <div className="sel" style={box}>
                  <span className="h tl" onPointerDown={(e) => onHandleDown(e, 'scale')} />
                  <span className="h tr" onPointerDown={(e) => onHandleDown(e, 'scale')} />
                  <span className="h bl" onPointerDown={(e) => onHandleDown(e, 'scale')} />
                  <span className="h br" onPointerDown={(e) => onHandleDown(e, 'scale')} />
                  <span className="rot" onPointerDown={(e) => onHandleDown(e, 'rotate')} title="Rotate">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" /></svg>
                  </span>
                </div>
              )}
            </div>
            {isTap && sam.state !== 'ready' && sam.state !== 'busy' && sam.state !== 'idle' && (
              <div className={`sam-status ${sam.state}`}>{sam.state === 'loading' && <span className="spin" />}{sam.msg}</div>
            )}
            <div className="zoom-bar" onPointerDown={(e) => e.stopPropagation()}>
              <button onClick={() => zoomAt(cam.z / 1.5)} disabled={cam.z <= 1.01} title="Zoom out" aria-label="Zoom out">−</button>
              <button className="zoom-pct" onClick={fitView} title="Fit whole photo">{Math.round(cam.z * 100)}%</button>
              <button onClick={() => zoomAt(cam.z * 1.5)} disabled={cam.z >= MAX_ZOOM - 0.01} title="Zoom in" aria-label="Zoom in">+</button>
              {cam.z > 1.01 && <button className="zoom-fit" onClick={fitView}>Fit</button>}
            </div>
          </div>
          <div className="stage-bar">
            {refining ? (
              <div className="refine-bar">
                <div className="seg tools">
                  <button className={tool === 'tapAdd' ? 'on' : ''} onClick={() => setTool('tapAdd')} title="Tap anything the AI missed">＋ Add object</button>
                  <button className={tool === 'tapRemove' ? 'on' : ''} onClick={() => setTool('tapRemove')} title="Tap anything that should NOT cover the text">－ Remove object</button>
                </div>
                <div className="seg tools small">
                  <button className={tool === 'restore' ? 'on' : ''} onClick={() => setTool('restore')} title="Paint small missed parts">Paint in</button>
                  <button className={tool === 'erase' ? 'on' : ''} onClick={() => setTool('erase')} title="Paint away small wrong parts">Paint out</button>
                </div>
                {isBrush && (
                  <label className="mini-slider">
                    <span>Size</span>
                    <input type="range" min={4} max={90} value={brush} style={{ '--p': `${((brush - 4) / 86) * 100}%` } as CSSProperties} onChange={(e) => setBrush(+e.target.value)} />
                  </label>
                )}
                <span className="refine-actions">
                  <button className="btn chip" onClick={() => { cutout.undo(); setCutTick((t) => t + 1); }}>Undo</button>
                  <button className="btn chip" onClick={() => { cutout.resetEdits(); setCutTick((t) => t + 1); }}>Reset</button>
                  <button className="btn chip on" onClick={() => setTool('move')}>Finish fixing</button>
                </span>
                <p className="refine-hint">
                  {tool === 'tapAdd' && 'Tap anything the AI missed — it will jump in front of the text.'}
                  {tool === 'tapRemove' && 'Tap anything that should NOT cover the text.'}
                  {isBrush && 'Paint over small areas. Pink = in front of the text.'}
                  {' '}<span className="zoom-hint">Zoom in for small parts: pinch, or scroll the mouse wheel.</span>
                </p>
              </div>
            ) : (
              <>
                <span className="hint">Drag to move · corners to resize · ⟳ to rotate · pinch or scroll to zoom</span>
                {fg && (
                  <button
                    className={`btn chip ${peek ? 'on' : ''}`}
                    onPointerDown={() => setPeek(true)}
                    onPointerUp={() => setPeek(false)}
                    onPointerLeave={() => setPeek(false)}
                  >
                    Hold to see hidden text
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <Controls
          layers={layers}
          selected={selected}
          hasCutout={!!fg}
          tab={tab}
          fontTick={fontTick}
          onTab={setTab}
          onSelect={setSelectedId}
          onUpdate={update}
          onAdd={addLayer}
          onRemove={removeLayer}
          onDuplicate={duplicate}
          onMove={move}
          onFit={fitWidth}
          onRetryCutout={onRetryCutout}
          cutoutBusy={!!cutoutJob?.busy}
          registerFocus={(fn) => { textFocus.current = fn; }}
          solidity={solidity}
          onSolidity={setSolidity}
          onFixCutout={() => setTool('tapAdd')}
          hasMask={!!mask}
        />
      </div>
    </main>
  );
}
