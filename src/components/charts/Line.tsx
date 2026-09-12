import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line as SvgLine, Path, Rect, Text as SvgText } from 'react-native-svg';
import { money } from '../../lib/format';
import { C, F, S } from '../../theme';

/** A null value leaves a gap in the line (e.g. a refill with no reading). */
export type Point = { label: string; value: number | null; sub?: string };

export default function LineChart({
  data,
  width,
  height = 170,
  format,
  tickFormat = (v) => money(v, ''),
  color = C.accent,
  reference,
  everyNthLabel,
}: {
  data: Point[];
  width: number;
  height?: number;
  format: (v: number) => string;
  tickFormat?: (v: number) => string;
  color?: string;
  /** A dashed horizontal guide, e.g. the month average. */
  reference?: { value: number; label: string };
  everyNthLabel?: number;
}) {
  const [active, setActive] = useState<number | null>(null);

  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  if (!values.length) {
    return (
      <View style={{ paddingVertical: S.xl, alignItems: 'center' }}>
        <Text style={F.small}>No readings yet.</Text>
      </View>
    );
  }

  const padL = 10;
  const padR = 10;
  const padT = 18;
  const axisH = 18;
  const plotW = Math.max(width - padL - padR, 40);
  const plotH = height - padT - axisH;

  const max = Math.max(...values, reference?.value ?? 0, 0.0001);
  const step = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const xAt = (i: number) => (data.length > 1 ? padL + i * step : padL + plotW / 2);
  const yAt = (v: number) => padT + plotH - (v / max) * plotH;

  let path = '';
  let penDown = false;
  data.forEach((d, i) => {
    if (d.value == null) {
      penDown = false;
      return;
    }
    path += `${penDown ? 'L' : 'M'} ${xAt(i)} ${yAt(d.value)} `;
    penDown = true;
  });

  const nth = everyNthLabel ?? Math.max(1, Math.ceil(data.length / 8));
  const maxIndex = data.reduce(
    (best, d, i) => ((d.value ?? -Infinity) > (data[best].value ?? -Infinity) ? i : best),
    0
  );
  const shown = active !== null ? data[active] : null;
  const ticks = [0, 0.5, 1].map((t) => ({ y: padT + plotH - t * plotH, v: max * t }));

  return (
    <View>
      <View style={st.readout}>
        <Text style={st.readoutLabel}>
          {shown ? shown.sub || shown.label : 'Tap a point for detail'}
        </Text>
        <Text style={st.readoutValue}>
          {shown ? (shown.value == null ? '—' : format(shown.value)) : ' '}
        </Text>
      </View>

      <Svg width={width} height={height}>
        {ticks.map((tk, i) => (
          <React.Fragment key={i}>
            <SvgLine
              x1={padL}
              y1={tk.y}
              x2={width - padR}
              y2={tk.y}
              stroke={i === 0 ? C.axis : C.grid}
              strokeWidth={1}
            />
            {i > 0 ? (
              <SvgText x={padL} y={tk.y - 4} fill={C.textMuted} fontSize={9}>
                {tickFormat(tk.v)}
              </SvgText>
            ) : null}
          </React.Fragment>
        ))}

        {reference ? (
          <>
            <SvgLine
              x1={padL}
              y1={yAt(reference.value)}
              x2={width - padR}
              y2={yAt(reference.value)}
              stroke={C.textMuted}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <SvgText
              x={width - padR}
              y={yAt(reference.value) - 4}
              fill={C.textDim}
              fontSize={9}
              textAnchor="end"
            >
              {reference.label}
            </SvgText>
          </>
        ) : null}

        <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />

        {data.map((d, i) => {
          const x = xAt(i);
          const dim = active !== null && active !== i;
          return (
            <React.Fragment key={i}>
              {d.value != null ? (
                <Circle
                  cx={x}
                  cy={yAt(d.value)}
                  r={active === i ? 5 : 3.5}
                  fill={active === i ? color : C.surface}
                  stroke={color}
                  strokeWidth={2}
                  opacity={dim ? 0.35 : 1}
                />
              ) : null}
              {i % nth === 0 || i === data.length - 1 ? (
                <SvgText
                  x={x}
                  y={height - 5}
                  fill={C.textMuted}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              ) : null}
              {/* Selective direct label: only the peak. */}
              {i === maxIndex && active === null && d.value != null ? (
                <SvgText
                  x={x}
                  y={yAt(d.value) - 8}
                  fill={C.textDim}
                  fontSize={10}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {tickFormat(d.value)}
                </SvgText>
              ) : null}
              {/* Hit target spans the whole column, not just the dot. */}
              <Rect
                x={x - (data.length > 1 ? step : plotW) / 2}
                y={padT}
                width={data.length > 1 ? step : plotW}
                height={plotH + axisH}
                fill="transparent"
                onPress={() => setActive(active === i ? null : i)}
              />
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
