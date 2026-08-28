import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Text as SvgText } from 'react-native-svg';
import { SparklinePoint } from '../types/market';
import { Theme } from '../theme/theme';

interface SparklineChartProps {
  data: SparklinePoint[];
  color?: string;
  height?: number;
  width?: number;
  showGradient?: boolean;
  showPoints?: boolean;
  strokeWidth?: number;
}

export const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  color = Theme.colors.bullish,
  height = 54,
  width = 120,
  showGradient = true,
  showPoints = false,
  strokeWidth = 2,
}) => {
  if (!data || data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const paddingY = 6;
  const paddingX = 4;
  const chartHeight = height - paddingY * 2;
  const chartWidth = width - paddingX * 2;

  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * chartWidth;
    const y = height - paddingY - ((d.value - minVal) / range) * chartHeight;
    return { x, y, val: d.value };
  });

  // Construct SVG Path (Catmull-Rom or simple smooth Bezier line)
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i != points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const lastPoint = points[points.length - 1];

  const gradientId = `grad_${Math.abs(color.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}_${height}`;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {showGradient && <Path d={areaPath} fill={`url(#${gradientId})`} />}

        <Path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pulse / Glowing Dot on Last Point */}
        <Circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} />
        <Circle cx={lastPoint.x} cy={lastPoint.y} r={7} fill={color} opacity={0.3} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
