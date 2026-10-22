/** Named looks for the background effects; the picker grid shows these. */
export interface BackgroundPreset {
  id: string;
  name: string;
  effect: string | null;
  params: Record<string, unknown>;
  color?: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'blurred-summer', name: 'Blurred summer', effect: 'blurred-summer', params: {} },
  {
    id: 'golden-hour',
    name: 'Golden hour',
    effect: 'blurred-summer',
    params: { skyTop: '#e98a6b', skyBottom: '#f6c9a0', cloudColor: '#fff1dc', flowerColor: '#ff4f6d', flowerGlow: '#ffc08a', background: '#f6c9a0' },
  },
  {
    id: 'lilac-breeze',
    name: 'Lilac breeze',
    effect: 'blurred-summer',
    params: { skyTop: '#7b8ee0', skyBottom: '#c9c4f0', cloudColor: '#f4e9ff', flowerColor: '#f9a8d4', flowerGlow: '#fde68a', flowers: 9, wind: 0.6, background: '#c9c4f0' },
  },
  { id: 'nebula', name: 'Nebula', effect: 'mesh-gradient', params: {} },
  {
    id: 'sunset',
    name: 'Sunset',
    effect: 'mesh-gradient',
    params: { colorA: '#f97316', colorB: '#db2777', colorC: '#facc15', colorD: '#7c3aed', background: '#1a0710' },
  },
  {
    id: 'mint',
    name: 'Mint',
    effect: 'mesh-gradient',
    params: { colorA: '#10b981', colorB: '#0ea5e9', colorC: '#84cc16', colorD: '#14b8a6', background: '#03140f' },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    effect: 'mesh-gradient',
    params: { colorA: '#c7d2fe', colorB: '#fbcfe8', colorC: '#bae6fd', colorD: '#ddd6fe', background: '#f8fafc', grain: 0.02, vignette: 0, intensity: 1 },
  },
  { id: 'grid', name: 'Horizon grid', effect: 'perspective-grid', params: {} },
  {
    id: 'synthwave',
    name: 'Synthwave',
    effect: 'perspective-grid',
    params: {
      lineColor: '#ff4fd8',
      lineOpacity: 0.5,
      glow: 0.7,
      backgroundMode: 'gradient',
      background: '#0d0221',
      background2: '#2a0845',
      gradientAngle: 180,
    },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    effect: 'perspective-grid',
    params: { lineColor: '#7dd3fc', lineOpacity: 0.35, background: '#061a33', curveDepth: 0, waveAmount: 0 },
  },
  { id: 'cove', name: 'Infinity cove', effect: 'infinity-cove', params: {} },
  { id: 'cove-night', name: 'Cove night', effect: 'infinity-cove', params: { background: '#060b1a', lineColor: '#8ab4ff', lineOpacity: 0.3 } },
  { id: 'aurora', name: 'Aurora', effect: 'aurora-flow', params: {} },
  {
    id: 'ember',
    name: 'Ember',
    effect: 'aurora-flow',
    params: { colorA: '#f97316', colorB: '#db2777', colorC: '#facc15', background: '#0a0505', background2: '#140808' },
  },
  { id: 'waves', name: 'Wave lines', effect: 'wave-lines', params: {} },
  { id: 'ocean', name: 'Ocean', effect: 'wave-lines', params: { colorTop: '#22d3ee', colorBottom: '#3b82f6', background: '#020617' } },
  { id: 'dots', name: 'Dot grid', effect: 'dot-grid', params: {} },
  {
    id: 'dots-light',
    name: 'Canvas',
    effect: 'dot-grid',
    params: { background: '#f4f4f7', dotColor: '#c9cbd6', glowColor: '#6366f1', halo: 0.12, vignette: 0 },
  },
  { id: 'clouds', name: 'Clouds', effect: 'drifting-clouds', params: {} },
  { id: 'ink', name: 'Solid ink', effect: null, params: {}, color: '#0c0d14' },
  { id: 'paper', name: 'Solid paper', effect: null, params: {}, color: '#f4f3ef' },
];
