import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MorningBriefing } from '../types/market';
import { Theme } from '../theme/theme';

interface MorningBriefingHeroProps {
  briefing: MorningBriefing;
}

export const MorningBriefingHero: React.FC<MorningBriefingHeroProps> = ({ briefing }) => {
  const isBullish = briefing.marketTone === 'bullish';
  const toneColor = isBullish ? Theme.colors.bullish : Theme.colors.bearish;

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['rgba(21, 28, 48, 0.95)', 'rgba(15, 20, 34, 0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Glow Top Accent Bar */}
        <View style={[styles.glowBar, { backgroundColor: toneColor }]} />

        {/* Header with Market Tone Badge */}
        <View style={styles.headerRow}>
          <View style={[styles.badge, { borderColor: `${toneColor}40`, backgroundColor: `${toneColor}15` }]}>
            <Text style={[styles.badgeText, { color: toneColor }]}>{briefing.marketToneBadge}</Text>
          </View>
          <Text style={styles.updateTime}>{briefing.updatedAt}</Text>
        </View>

        {/* Main Headline */}
        <Text style={styles.headline}>{briefing.marketToneHeadline}</Text>

        {/* Expected KOSPI Open Range Banner */}
        <View style={styles.expectedBox}>
          <View style={styles.expectedLeft}>
            <Text style={styles.expectedLabel}>🎯 오늘 코스피 예상 시초가</Text>
            <Text style={styles.expectedRange}>{briefing.expectedKospiOpen}</Text>
            <Text style={styles.expectedRangeHint}>{briefing.expectedKospiOpenRange}</Text>
          </View>
          <View style={styles.expectedRight}>
            <Text style={[styles.expectedDelta, { color: toneColor }]}>
              {briefing.expectedKospiChange}
            </Text>
            <Text style={styles.confidenceText}>신뢰도 {briefing.confidenceRate}%</Text>
          </View>
        </View>

        {/* 3-Bullet Summary Points */}
        <View style={styles.summaryList}>
          {briefing.summaryBullets.map((bullet, idx) => (
            <View key={`bullet_${idx}`} style={styles.bulletRow}>
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>

        {/* Key Driver Tags */}
        <View style={styles.driversContainer}>
          <Text style={styles.driversTitle}>핵심 시황 모멘텀</Text>
          <View style={styles.driversRow}>
            {briefing.keyDrivers.map((driver, idx) => {
              const isPositive = driver.impact === 'positive';
              const iconName = isPositive ? 'trending-up' : 'trending-down';
              const color = isPositive ? Theme.colors.bullish : Theme.colors.bearish;

              return (
                <View key={`driver_${idx}`} style={styles.driverPill}>
                  <Ionicons name={iconName} size={13} color={color} style={{ marginRight: 4 }} />
                  <Text style={styles.driverName}>{driver.title}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: Theme.spacing.lg,
    marginVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  card: {
    padding: Theme.spacing.lg,
  },
  glowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: Theme.typography.sizes.xs,
    fontWeight: 'bold',
  },
  updateTime: {
    fontSize: 11,
    color: Theme.colors.textDim,
  },
  headline: {
    fontSize: Theme.typography.sizes.md,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
    lineHeight: 23,
    marginBottom: Theme.spacing.md,
  },
  expectedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  expectedLeft: {
    flex: 1,
  },
  expectedLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginBottom: 2,
    fontWeight: '500',
  },
  expectedRange: {
    fontSize: Theme.typography.sizes.md,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  expectedRangeHint: {
    fontSize: 10,
    color: Theme.colors.textDim,
    marginTop: 3,
  },
  expectedRight: {
    alignItems: 'flex-end',
  },
  expectedDelta: {
    fontSize: Theme.typography.sizes.sm,
    fontWeight: 'bold',
  },
  confidenceText: {
    fontSize: 10,
    color: Theme.colors.textDim,
    marginTop: 2,
  },
  summaryList: {
    gap: 8,
    marginBottom: Theme.spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 8,
  },
  bulletText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },
  driversContainer: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.separator,
    paddingTop: Theme.spacing.sm,
  },
  driversTitle: {
    fontSize: 11,
    color: Theme.colors.textDim,
    marginBottom: 6,
    fontWeight: '600',
  },
  driversRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  driverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  driverName: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
});
