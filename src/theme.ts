/**
 * Dark chart-surface palette, validated with the data-viz palette validator:
 * all six categorical slots pass the lightness band, chroma floor, adjacent
 * CVD separation (worst ΔE 8.4), normal-vision floor (19.3) and 3:1 contrast
 * against the #1a1a19 surface.
 */
export const C = {
  bg: '#0d0d0d',
  surface: '#1a1a19',
  surfaceAlt: '#232320',
  surfaceHi: '#2c2c2a',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',

  text: '#ffffff',
  textDim: '#c3c2b7',
  textMuted: '#898781',

  grid: '#2c2c2a',
  axis: '#383835',

  accent: '#3987e5',
  accentSoft: 'rgba(57,135,229,0.16)',

  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',

  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
  other: '#6a6a66',
};

export const seriesColor = (i: number) =>
  i < C.series.length ? C.series[i] : C.other;

export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  radius: 14,
  radiusSm: 10,
};

export const F = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: C.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: C.text },
  h3: { fontSize: 16, fontWeight: '600' as const, color: C.text },
  body: { fontSize: 15, color: C.text },
  dim: { fontSize: 14, color: C.textDim },
  small: { fontSize: 12, color: C.textMuted },
  mono: { fontVariant: ['tabular-nums' as const] },
};
