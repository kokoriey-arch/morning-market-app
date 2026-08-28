import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { SparklinePoint } from '../types/market';
import { Theme } from '../theme/theme';
import { formatNumber } from '../utils/formatters';

interface NightFuturesDetailChartProps {
  data: SparklinePoint[];
  previousClose: number;
  currentPrice: number;
  high: number;
  low: number;
}

export const NightFuturesDetailChart: React.FC<NightFuturesDetailChartProps> = ({
  data,
  previousClose,
  currentPrice,
  high,
  low,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 48, 420);
  const chartHeight = 180;
  const paddingX = 16;
  const paddingY = 24;

  if (!data || data.length < 2) return null;

  const values = [...data.map((d) => d.value), previousClose, high, low];
  const minVal = Math.min(...values) - 0.5;
  const maxVal = Math.max(...values) + 0.5;
  const range = maxVal - minVal || 1;

  const effectiveWidth = chartWidth - paddingX * 2;
  const effectiveHeight = chartHeight - paddingY * 2;

  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * effectiveWidth;
    const y = chartHeight - paddingY - ((d.value - minVal) / range) * effectiveHeight;
    return { x, y, val: d.value, time: d.time };
  });

  // Base previous close line Y
  const prevCloseY = chartHeight - paddingY - ((previousClose - minVal) / range) * effectiveHeight;

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midX = (p1.x + p2.x) / 2;
    linePath += ` C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - 8} L ${points[0].x} ${chartHeight - 8} Z`;

  const isUp = currentPrice >= previousClose;
  const strokeColor = isUp ? Theme.colors.bullish : Theme.colors.bearish;
  const activeItem = selectedIndex !== null ? points[selectedIndex] : points[points.length - 1];

  return (
    <View style={styles.container}>
      {/* Top Header Information inside Chart */}
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.timeTag}>
            {selectedIndex !== null ? `⏰ ${activeItem.time} 체결가` : '🌙 야간장 전체 흐름 (18:00 ~ 06:00)'}
          </Text>
          <Text style={[styles.activePrice, { color: strokeColor }]}>
            {formatNumber(activeItem.val, 2)}
            <Text style={styles.unitText}> pt</Text>
          </Text>
        </View>
        <View style={styles.statsColumn}>
          <Text style={styles.statLabel}>
            최고 <Text style={{ color: Theme.colors.bullish }}>{formatNumber(high, 2)}</Text>
          </Text>
          <Text style={styles.statLabel}>
            최저 <Text style={{ color: Theme.colors.bearish }}>{formatNumber(low, 2)}</Text>
          </Text>
          <Text style={styles.statLabel}>
            기준가 <Text style={{ color: Theme.colors.textSecondary }}>{formatNumber(previousClose, 2)}</Text>
          </Text>
        </View>
      </View>

      {/* SVG Chart */}
      <View style={styles.svgContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="nightGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
              <Stop offset="70%" stopColor={strokeColor} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Reference Previous Close Line (전일 정규장 종가선) */}
          <Line
            x1={paddingX}
            y1={prevCloseY}
            x2={chartWidth - paddingX}
            y2={prevCloseY}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={1}
            strokeDasharray="4, 4"
          />

          {/* Area under curve */}
          <Path d={areaPath} fill="url(#nightGradient)" />

          {/* Main trend line */}
          <Path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Touch Point Highlights */}
          {points.map((p, idx) => {
            const isCurrentActive = (selectedIndex === null && idx === points.length - 1) || selectedIndex === idx;
            return (
              <Circle
                key={`dot_${idx}`}
                cx={p.x}
                cy={p.y}
                r={isCurrentActive ? 6 : 3}
                fill={isCurrentActive ? Theme.colors.textPrimary : strokeColor}
                stroke={strokeColor}
                strokeWidth={isCurrentActive ? 2 : 1}
              />
            );
          })}
        </Svg>
      </View>

      {/* Interactive Time Selector Buttons */}
      <View style={styles.timeLabelsRow}>
        {data.map((d, index) => (
          <TouchableOpacity
            key={`btn_${index}`}
            style={[
              styles.timeButton,
              (selectedIndex === index || (selectedIndex === null && index === data.length - 1)) &&
                styles.timeButtonActive,
            ]}
            onPress={() => setSelectedIndex(index)}
          >
            <Text
              style={[
                styles.timeLabelText,
                (selectedIndex === index || (selectedIndex === null && index === data.length - 1)) &&
                  styles.timeLabelTextActive,
              ]}
            >
              {d.time}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    marginVertical: Theme.spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.xs,
  },
  timeTag: {
    fontSize: Theme.typography.sizes.xs,
    color: Theme.colors.textMuted,
    fontWeight: '600',
  },
  activePrice: {
    fontSize: Theme.typography.sizes.xxl,
    fontWeight: 'bold',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  unitText: {
    fontSize: Theme.typography.sizes.sm,
    color: Theme.colors.textSecondary,
    fontWeight: 'normal',
  },
  statsColumn: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: Theme.typography.sizes.xs,
    color: Theme.colors.textMuted,
    marginBottom: 2,
  },
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  timeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.separator,
    paddingTop: 8,
  },
  timeButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  timeButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
  },
  timeLabelText: {
    fontSize: 11,
    color: Theme.colors.textDim,
    fontWeight: '500',
  },
  timeLabelTextActive: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
  },
});
