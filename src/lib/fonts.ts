import { BASE_STYLE, type StyleFields } from './render';

export type FontCat = 'Bold' | 'Sans' | 'Serif' | 'Script' | 'Fun';
export type FontDef = { family: string; weights: number[]; italic?: boolean; cat: FontCat };

// Every font here is free on Google Fonts (SIL Open Font License or Apache-2.0) — OK for commercial ads.
export const FONTS: FontDef[] = [
  // Bold / display — the classic "text behind subject" look
  { family: 'Anton', weights: [400], cat: 'Bold' },
  { family: 'Bebas Neue', weights: [400], cat: 'Bold' },
  { family: 'Archivo Black', weights: [400], cat: 'Bold' },
  { family: 'Oswald', weights: [400, 700], cat: 'Bold' },
  { family: 'Big Shoulders Display', weights: [400, 900], cat: 'Bold' },
  { family: 'Teko', weights: [400, 700], cat: 'Bold' },
  { family: 'Staatliches', weights: [400], cat: 'Bold' },
  { family: 'Fjalla One', weights: [400], cat: 'Bold' },
  { family: 'Passion One', weights: [400, 700, 900], cat: 'Bold' },
  { family: 'Alfa Slab One', weights: [400], cat: 'Bold' },
  { family: 'Russo One', weights: [400], cat: 'Bold' },
  { family: 'Bowlby One', weights: [400], cat: 'Bold' },
  { family: 'Titan One', weights: [400], cat: 'Bold' },
  { family: 'Dela Gothic One', weights: [400], cat: 'Bold' },
  { family: 'Rubik Mono One', weights: [400], cat: 'Bold' },
  { family: 'Ultra', weights: [400], cat: 'Bold' },
  // Sans
  { family: 'Montserrat', weights: [400, 700, 900], italic: true, cat: 'Sans' },
  { family: 'Poppins', weights: [400, 700, 900], italic: true, cat: 'Sans' },
  { family: 'Inter', weights: [400, 700, 900], cat: 'Sans' },
  { family: 'Outfit', weights: [300, 600, 900], cat: 'Sans' },
  { family: 'Raleway', weights: [300, 700, 900], italic: true, cat: 'Sans' },
  { family: 'Unbounded', weights: [400, 700, 900], cat: 'Sans' },
  { family: 'Syne', weights: [400, 800], cat: 'Sans' },
  { family: 'Space Grotesk', weights: [400, 700], cat: 'Sans' },
  { family: 'Orbitron', weights: [400, 900], cat: 'Sans' },
  { family: 'Audiowide', weights: [400], cat: 'Sans' },
  // Serif
  { family: 'Playfair Display', weights: [400, 700, 900], italic: true, cat: 'Serif' },
  { family: 'DM Serif Display', weights: [400], italic: true, cat: 'Serif' },
  { family: 'Abril Fatface', weights: [400], cat: 'Serif' },
  { family: 'Cinzel', weights: [400, 700, 900], cat: 'Serif' },
  { family: 'Bodoni Moda', weights: [400, 700, 900], italic: true, cat: 'Serif' },
  { family: 'Cormorant Garamond', weights: [400, 700], italic: true, cat: 'Serif' },
  { family: 'Prata', weights: [400], cat: 'Serif' },
  { family: 'Yeseva One', weights: [400], cat: 'Serif' },
  // Script & handwritten
  { family: 'Pacifico', weights: [400], cat: 'Script' },
  { family: 'Lobster', weights: [400], cat: 'Script' },
  { family: 'Dancing Script', weights: [400, 700], cat: 'Script' },
  { family: 'Great Vibes', weights: [400], cat: 'Script' },
  { family: 'Satisfy', weights: [400], cat: 'Script' },
  { family: 'Kaushan Script', weights: [400], cat: 'Script' },
  { family: 'Yellowtail', weights: [400], cat: 'Script' },
  { family: 'Sacramento', weights: [400], cat: 'Script' },
  { family: 'Permanent Marker', weights: [400], cat: 'Script' },
  { family: 'Caveat', weights: [400, 700], cat: 'Script' },
  // Fun / retro
  { family: 'Bangers', weights: [400], cat: 'Fun' },
  { family: 'Luckiest Guy', weights: [400], cat: 'Fun' },
  { family: 'Bungee', weights: [400], cat: 'Fun' },
  { family: 'Righteous', weights: [400], cat: 'Fun' },
  { family: 'Monoton', weights: [400], cat: 'Fun' },
  { family: 'Press Start 2P', weights: [400], cat: 'Fun' },
  { family: 'Black Ops One', weights: [400], cat: 'Fun' },
  { family: 'Creepster', weights: [400], cat: 'Fun' },
  { family: 'Rampart One', weights: [400], cat: 'Fun' },
  { family: 'Faster One', weights: [400], cat: 'Fun' },
];

export const FONT_CATS: FontCat[] = ['Bold', 'Sans', 'Serif', 'Script', 'Fun'];

/** Add one <link> per family, so one bad family can't break the rest. */
let injected = false;
export function loadFontCss() {
  if (injected) return;
  injected = true;
  for (const f of FONTS) {
    const fam = f.family.replace(/ /g, '+');
    const ws = [...f.weights].sort((a, b) => a - b);
    let spec: string;
    if (f.italic) spec = `:ital,wght@${[...ws.map((w) => `0,${w}`), ...ws.map((w) => `1,${w}`)].join(';')}`;
    else if (ws.length > 1 || ws[0] !== 400) spec = `:wght@${ws.join(';')}`;
    else spec = '';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fam}${spec}&display=swap`;
    document.head.appendChild(link);
  }
}

export type Preset = { name: string; cat: 'Popular' | 'Glow' | '3D' | 'Luxury' | 'Fun'; style: Partial<StyleFields> };

// Each preset starts from BASE_STYLE, so switching fully replaces the look.
const P = (name: string, cat: Preset['cat'], style: Partial<StyleFields>): Preset => ({ name, cat, style: { ...BASE_STYLE, ...style } });

export const PRESETS: Preset[] = [
  P('Classic', 'Popular', { font: 'Anton', color: '#ffffff', shadow: 0.25 }),
  P('Bold Black', 'Popular', { font: 'Archivo Black', color: '#0b0b0f', shadow: 0 }),
  P('Sunset', 'Popular', { font: 'Montserrat', weight: 900, color: '#fde047', color2: '#f472b6', gradient: true, shadow: 0.3, letterSpacing: 0 }),
  P('Ocean', 'Popular', { font: 'Bebas Neue', color: '#67e8f9', color2: '#6366f1', gradient: true, shadow: 0.2, letterSpacing: 0.05 }),
  P('Outline', 'Popular', { font: 'Archivo Black', fillOn: false, strokeWidth: 0.02, strokeColor: '#ffffff', shadow: 0 }),
  P('Ghost', 'Popular', { font: 'Montserrat', weight: 900, color: '#ffffff', opacity: 0.45, shadow: 0 }),
  P('Blend', 'Popular', { font: 'Anton', color: '#ffffff', blend: 'overlay', shadow: 0 }),
  P('Label', 'Popular', { font: 'Oswald', weight: 700, color: '#0b0b0f', box: 1, boxColor: '#facc15', shadow: 0, letterSpacing: 0.04 }),

  P('Neon Pink', 'Glow', { font: 'Righteous', color: '#fff1f7', glow: 0.8, glowColor: '#ec4899', shadow: 0, uppercase: false }),
  P('Neon Blue', 'Glow', { font: 'Orbitron', weight: 900, color: '#e0faff', glow: 0.8, glowColor: '#06b6d4', shadow: 0, letterSpacing: 0.08 }),
  P('Neon Tube', 'Glow', { font: 'Monoton', color: '#fef08a', glow: 0.7, glowColor: '#f59e0b', shadow: 0 }),
  P('Fire', 'Glow', { font: 'Anton', color: '#fde047', color2: '#dc2626', gradient: true, glow: 0.55, glowColor: '#f97316', shadow: 0 }),
  P('Ice', 'Glow', { font: 'Bebas Neue', color: '#ffffff', color2: '#7dd3fc', gradient: true, glow: 0.45, glowColor: '#38bdf8', shadow: 0, letterSpacing: 0.06 }),
  P('Halo', 'Glow', { font: 'Cinzel', weight: 900, color: '#ffffff', glow: 0.5, glowColor: '#ffffff', shadow: 0, letterSpacing: 0.12 }),

  P('3D Block', '3D', { font: 'Bungee', color: '#facc15', extrude: 0.55, extrudeColor: '#b91c1c', extrudeAngle: 45, shadow: 0.3 }),
  P('Retro Pop', '3D', { font: 'Bangers', color: '#f472b6', strokeWidth: 0.03, strokeColor: '#0b0b0f', extrude: 0.35, extrudeColor: '#0b0b0f', shadow: 0, letterSpacing: 0.04 }),
  P('Long Shadow', '3D', { font: 'Anton', color: '#ffffff', extrude: 1, extrudeColor: '#0f172a', extrudeAngle: 45, shadow: 0 }),
  P('Chrome', '3D', { font: 'Russo One', color: '#ffffff', color2: '#64748b', gradient: true, gradAngle: 75, strokeWidth: 0.01, strokeColor: '#1e293b', extrude: 0.2, extrudeColor: '#334155', shadow: 0.4 }),
  P('Arcade', '3D', { font: 'Press Start 2P', color: '#4ade80', extrude: 0.3, extrudeColor: '#14532d', shadow: 0 }),
  P('Comic', '3D', { font: 'Luckiest Guy', color: '#fde047', strokeWidth: 0.035, strokeColor: '#1e1b4b', extrude: 0.25, extrudeColor: '#1e1b4b', extrudeAngle: 60, shadow: 0 }),

  P('Gold', 'Luxury', { font: 'Playfair Display', weight: 900, color: '#fef3c7', color2: '#d97706', gradient: true, shadow: 0.4, uppercase: false, letterSpacing: 0.01 }),
  P('Magazine', 'Luxury', { font: 'Playfair Display', weight: 900, italic: true, color: '#ffffff', shadow: 0.2, uppercase: false, letterSpacing: -0.02 }),
  P('Couture', 'Luxury', { font: 'Cinzel', weight: 400, color: '#ffffff', shadow: 0.15, letterSpacing: 0.3 }),
  P('Didone', 'Luxury', { font: 'Bodoni Moda', weight: 900, color: '#ffffff', shadow: 0.2, uppercase: false }),
  P('Rose Gold', 'Luxury', { font: 'DM Serif Display', color: '#fecdd3', color2: '#be7c6b', gradient: true, shadow: 0.3, uppercase: false }),
  P('Signature', 'Luxury', { font: 'Great Vibes', color: '#ffffff', shadow: 0.35, uppercase: false, letterSpacing: 0 }),

  P('Script', 'Fun', { font: 'Pacifico', color: '#ffffff', shadow: 0.35, uppercase: false, letterSpacing: 0 }),
  P('Marker', 'Fun', { font: 'Permanent Marker', color: '#fde047', shadow: 0.3, uppercase: false, letterSpacing: 0 }),
  P('Graffiti', 'Fun', { font: 'Kaushan Script', color: '#a3e635', color2: '#22d3ee', gradient: true, gradAngle: 0, strokeWidth: 0.02, strokeColor: '#0b0b0f', shadow: 0.2, uppercase: false, skew: 8 }),
  P('Horror', 'Fun', { font: 'Creepster', color: '#dc2626', glow: 0.3, glowColor: '#7f1d1d', shadow: 0.4, letterSpacing: 0.04 }),
  P('Speed', 'Fun', { font: 'Faster One', color: '#ffffff', skew: 12, shadow: 0.2 }),
  P('Military', 'Fun', { font: 'Black Ops One', color: '#d9f99d', blend: 'overlay', shadow: 0.2, letterSpacing: 0.06 }),
];

export const PRESET_CATS: Preset['cat'][] = ['Popular', 'Glow', '3D', 'Luxury', 'Fun'];
