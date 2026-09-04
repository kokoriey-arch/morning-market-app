import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { Theme } from '../theme/theme';

interface FearGreedGaugeProps {
  score: number;
  rating: string;
  previousClose: number;
  title?: string;
  /** Accent label shown next to the title, e.g. "주식" / "코인" */
  badge?: string;
}

export const FearGreedGauge: React.FC<FearGreedGaugeProps> = ({ score, rating, previousClose, title, badge }) => {
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Semicircle arc from 180 deg to 0 deg
  const needleAngle = 180 + (score / 100) * 180;
  const angleRad = (needleAngle * Math.PI) / 180;
  const needleLength = radius - 8;
  const needleX = center + needleLength * Math.cos(angleRad);
  const needleY = center + needleLength * Math.sin(angleRad);

  const getScoreColor = (val: number) => {
    if (val >= 75) return '#10B981'; // Extreme Greed
    if (val >= 55) return '#00E599'; // Greed
    if (val >= 45) return '#F59E0B'; // Neutral
    if (val >= 25) return '#F97316'; // Fear
    return '#EF4444'; // Extreme Fear
  };

  const scoreColor = getScoreColor(score);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{title ?? '글로벌 투자 심리 (Fear & Greed Index)'}</Text>
        {badge ? (
          <View style={styles.badgeWrap}>
            <Text style={styles.badge}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.gaugeWrapper}>
        <Svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
          <Defs>
            <LinearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#EF4444" />
              <Stop offset="30%" stopColor="#F97316" />
              <Stop offset="50%" stopColor="#F59E0B" />
              <Stop offset="70%" stopColor="#00E599" />
              <Stop offset="100%" stopColor="#10B981" />
            </LinearGradient>
          </Defs>

          {/* Background Track */}
          <Path
            d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Needle Pointer */}
          <Line
            x1={center}
            y1={center}
            x2={needleX}
            y2={needleY}
            stroke={Theme.colors.textPrimary}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Circle cx={center} cy={center} r={6} fill={Theme.colors.textPrimary} />
          <Circle cx={center} cy={center} r={3} fill={scoreColor} />
        </Svg>

        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
          <Text style={styles.scoreRating}>{rating}</Text>
          <Text style={styles.prevText}>전일 수치: {previousClose} pt</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        <Text style={[styles.legendText, { color: '#EF4444' }]}>0 극단적 공포</Text>
        <Text style={[styles.legendText, { color: '#F59E0B' }]}>50 중립</Text>
        <Text style={[styles.legendText, { color: '#10B981' }]}>100 극단적 탐욕</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.lg,
    marginVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
  },
  badgeWrap: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badge: {
    fontSize: 10,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  title: {
    fontSize: Theme.typography.sizes.xs,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  gaugeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  scoreContainer: {
    alignItems: 'center',
    marginTop: -10,
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  scoreRating: {
    fontSize: 13,
    color: Theme.colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  prevText: {
    fontSize: 10,
    color: Theme.colors.textDim,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.separator,
    paddingTop: 8,
    marginTop: 8,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
