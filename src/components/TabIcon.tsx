import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type TabName = 'add' | 'budget' | 'history' | 'analysis' | 'settings';

/** Small geometric icons drawn inline — no icon font to load. */
export default function TabIcon({
  name,
  color,
  size = 22,
}: {
  name: TabName;
  color: string;
  size?: number;
}) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, fill: 'none' };

  switch (name) {
    case 'add':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} {...p} />
          <Line x1={12} y1={8} x2={12} y2={16} {...p} />
          <Line x1={8} y1={12} x2={16} y2={12} {...p} />
        </Svg>
      );
    case 'budget':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x={3} y={6} width={18} height={4} rx={2} {...p} />
          <Rect x={3} y={14} width={12} height={4} rx={2} {...p} />
        </Svg>
      );
    case 'history':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1={4} y1={7} x2={20} y2={7} {...p} />
          <Line x1={4} y1={12} x2={20} y2={12} {...p} />
          <Line x1={4} y1={17} x2={14} y2={17} {...p} />
        </Svg>
      );
    case 'analysis':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1={5} y1={19} x2={5} y2={12} {...p} />
          <Line x1={12} y1={19} x2={12} y2={6} {...p} />
          <Line x1={19} y1={19} x2={19} y2={15} {...p} />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={3} {...p} />
          <Path
            d="M12 3v2M12 19v2M4.2 7.5l1.7 1M18.1 15.5l1.7 1M4.2 16.5l1.7-1M18.1 8.5l1.7-1"
            {...p}
          />
        </Svg>
      );
  }
}
