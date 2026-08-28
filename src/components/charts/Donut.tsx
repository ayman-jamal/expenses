import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { money } from '../../lib/format';
import { C, F, S } from '../../theme';

export type Slice = { label: string; value: number; color: string };

const TAU = Math.PI * 2;

/** Annular sector path. Angles in radians, 0 = 12 o'clock, clockwise. */
function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number
) {
  const sweep = end - start;
  const large = sweep > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => [
    cx + r * Math.sin(a),
    cy - r * Math.cos(a),
  ];
  const [x1, y1] = p(rOuter, start);
  const [x2, y2] = p(rOuter, end);
  const [x3, y3] = p(rInner, end);
  const [x4, y4] = p(rInner, start);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

export default function Donut({
  data,
  currency,
  size = 190,
  caption,
}: {
  data: Slice[];
  currency: string;
  size?: number;
  caption?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (!slices.length || total <= 0) {
    return (
      <View style={{ paddingVertical: S.xl, alignItems: 'center' }}>
        <Text style={F.small}>Nothing to chart yet.</Text>
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter * 0.62;
  // A 2px surface gap between neighbouring fills.
  const gap = slices.length > 1 ? 2 / rOuter : 0;

  let cursor = 0;
  const paths = slices.map((s, i) => {
    const sweep = (s.value / total) * TAU;
    const start = cursor + gap / 2;
    const end = cursor + Math.max(sweep - gap / 2, gap / 2 + 0.001);
    cursor += sweep;
    return { d: arcPath(cx, cy, rOuter, rInner, start, Math.min(end, TAU)), slice: s, i };
  });

  const shown = active !== null ? slices[active] : null;

  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Svg width={size} height={size}>
          <G>
            {paths.map(({ d, slice, i }) => (
              <Path
                key={slice.label + i}
                d={d}
                fill={slice.color}
                opacity={active === null || active === i ? 1 : 0.35}
                onPress={() => setActive(active === i ? null : i)}
              />
            ))}
          </G>
        </Svg>
        <View style={[st.center, { width: size, height: size }]} pointerEvents="none">
          <Text style={st.centerLabel} numberOfLines={1}>
            {shown ? shown.label : caption || 'Total'}
          </Text>
          <Text style={st.centerValue} numberOfLines={1} adjustsFontSizeToFit>
            {money(shown ? shown.value : total, currency)}
          </Text>
          {shown ? (
            <Text style={st.centerSub}>
              {((shown.value / total) * 100).toFixed(0)}% of total
            </Text>
          ) : null}
        </View>
      </View>

      {/* Legend is always present, and every slice is direct-labelled with its
          value — identity never depends on color alone. */}
      <View style={st.legend}>
        {slices.map((s, i) => (
          <Pressable
            key={s.label + i}
            onPress={() => setActive(active === i ? null : i)}
            style={({ pressed }) => [st.legendRow, pressed && { opacity: 0.6 }]}
          >
            <View style={[st.swatch, { backgroundColor: s.color }]} />
            <Text style={st.legendLabel} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={st.legendPct}>{((s.value / total) * 100).toFixed(0)}%</Text>
            <Text style={st.legendValue}>{money(s.value, currency)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  centerLabel: { ...F.small, marginBottom: 2, textAlign: 'center' },
  centerValue: { fontSize: 22, fontWeight: '700', color: C.text },
  centerSub: { ...F.small, marginTop: 2 },
  legend: { marginTop: S.lg, gap: 2 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingVertical: 7,
  },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, color: C.textDim, fontSize: 14 },
  legendPct: { color: C.textMuted, fontSize: 12, width: 40, textAlign: 'right', ...F.mono },
  legendValue: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    width: 82,
    textAlign: 'right',
    ...F.mono,
  },
});
