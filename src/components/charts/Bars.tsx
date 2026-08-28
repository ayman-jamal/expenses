import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { money } from '../../lib/format';
import { C, F, S } from '../../theme';

export type Bar = { label: string; value: number; sub?: string };

/** Bar with 4px rounded data-end, square where it meets the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, Math.max(h, 0));
  if (h <= 0.5) return `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + h} Z`;
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

export default function Bars({
  data,
  width,
  height = 170,
  currency,
  color = C.accent,
  everyNthLabel,
}: {
  data: Bar[];
  width: number;
  height?: number;
  currency: string;
  color?: string;
  everyNthLabel?: number;
}) {
  const [active, setActive] = useState<number | null>(null);

  if (!data.length) {
    return (
      <View style={{ paddingVertical: S.xl, alignItems: 'center' }}>
        <Text style={F.small}>No data in this range.</Text>
      </View>
    );
  }

  const padL = 4;
  const padR = 4;
  const padT = 14;
  const axisH = 18;
  const plotW = Math.max(width - padL - padR, 40);
  const plotH = height - padT - axisH;

  const max = Math.max(...data.map((d) => d.value), 0.0001);
  const step = plotW / data.length;
  const barW = Math.max(Math.min(step - 2, 22), 3); // 2px surface gap between bars

  const nth = everyNthLabel ?? Math.max(1, Math.ceil(data.length / 8));
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const shown = active !== null ? data[active] : null;

  const ticks = [0, 0.5, 1].map((t) => ({ t, y: padT + plotH - t * plotH, v: max * t }));

  return (
    <View>
      <View style={st.readout}>
        <Text style={st.readoutLabel}>
          {shown ? shown.sub || shown.label : 'Tap a bar for detail'}
        </Text>
        <Text style={st.readoutValue}>{shown ? money(shown.value, currency) : ' '}</Text>
      </View>

      <Svg width={width} height={height}>
        {ticks.map((tk, i) => (
          <React.Fragment key={i}>
            <Line
              x1={padL}
              y1={tk.y}
              x2={width - padR}
              y2={tk.y}
              stroke={i === 0 ? C.axis : C.grid}
              strokeWidth={1}
            />
            {i > 0 ? (
              <SvgText x={padL} y={tk.y - 4} fill={C.textMuted} fontSize={9}>
                {money(tk.v, '')}
              </SvgText>
            ) : null}
          </React.Fragment>
        ))}

        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          const x = padL + i * step + (step - barW) / 2;
          const y = padT + plotH - h;
          const dim = active !== null && active !== i;
          return (
            <React.Fragment key={i}>
              {/* Hit target is taller than the mark. */}
              <Rect
                x={padL + i * step}
                y={padT}
                width={step}
                height={plotH + axisH}
                fill="transparent"
                onPress={() => setActive(active === i ? null : i)}
              />
              <Path
                d={barPath(x, y, barW, h)}
                fill={d.value > 0 ? color : C.grid}
                opacity={dim ? 0.35 : 1}
                onPress={() => setActive(active === i ? null : i)}
              />
              {i % nth === 0 || i === data.length - 1 ? (
                <SvgText
                  x={x + barW / 2}
                  y={height - 5}
                  fill={C.textMuted}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              ) : null}
              {/* Selective direct label: only the peak. */}
              {i === maxIndex && active === null && d.value > 0 ? (
                <SvgText
                  x={x + barW / 2}
                  y={y - 4}
                  fill={C.textDim}
                  fontSize={10}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {money(d.value, '')}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const st = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: S.sm,
    minHeight: 20,
  },
  readoutLabel: { ...F.small },
  readoutValue: { color: C.text, fontSize: 15, fontWeight: '700', ...F.mono },
});
