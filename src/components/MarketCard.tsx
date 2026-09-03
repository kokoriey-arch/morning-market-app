import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarketItem } from '../types/market';
import { Theme } from '../theme/theme';
import { formatChange, formatNumber, formatPercent, getPriceColor } from '../utils/formatters';
import { SparklineChart } from './SparklineChart';
import * as Haptics from 'expo-haptics';

interface MarketCardProps {
  item: MarketItem;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  showSparkline?: boolean;
}

export const MarketCard: React.FC<MarketCardProps> = ({
  item,
  isFavorite = false,
  onToggleFavorite,
  showSparkline = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const color = getPriceColor(item.change);
  const isUp = item.change > 0;

  const handleFavoritePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (onToggleFavorite) {
      onToggleFavorite(item.id);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => setIsExpanded(!isExpanded)}
      style={[
        styles.card,
        item.isNightFutures && styles.nightFuturesCard,
      ]}
    >
      {/* Top row: Name, Symbol, Tag, Favorite */}
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <View style={styles.symbolRow}>
            <Text style={styles.koreanName}>{item.koreanName}</Text>
            <Text style={styles.symbolText}>{item.symbol}</Text>
          </View>
          {item.tag && (
            <View style={[styles.tagBadge, item.isNightFutures && styles.nightTagBadge]}>
              <Text style={[styles.tagText, item.isNightFutures && styles.nightTagText]}>
                {item.tag}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={handleFavoritePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.favoriteButton}
        >
          <Ionicons
            name={isFavorite ? 'star' : 'star-outline'}
            size={18}
            color={isFavorite ? Theme.colors.accentGold : Theme.colors.textDim}
          />
        </TouchableOpacity>
      </View>

      {/* Center row: Price, Change & Sparkline */}
      <View style={styles.centerRow}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>
            {item.price > 0 ? (
              <>
                {item.prefix ? item.prefix : ''}
                {formatNumber(item.price, item.category === 'macro' && item.unit === '%' ? 3 : 2)}
                <Text style={styles.unitText}> {item.unit}</Text>
              </>
            ) : '데이터 없음'}
          </Text>

          {item.price > 0 && (
            <View style={[styles.changePill, { backgroundColor: `${color}18` }]}>
              <Ionicons
                name={isUp ? 'arrow-up' : item.change < 0 ? 'arrow-down' : 'remove'}
                size={12}
                color={color}
                style={{ marginRight: 2 }}
              />
              <Text style={[styles.changePercentText, { color }]}>
                {formatPercent(item.changePercent)}
              </Text>
              <Text style={[styles.changeAmountText, { color }]}>
                ({formatChange(item.change, false)})
              </Text>
            </View>
          )}
        </View>

        {showSparkline && item.history && item.history.length > 0 && (
          <View style={styles.chartWrapper}>
            <SparklineChart data={item.history} color={color} height={46} width={105} />
          </View>
        )}
      </View>

      {/* High / Low / Open Stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statMini}>
          시가 <Text style={styles.statMiniVal}>{formatNumber(item.open)}</Text>
        </Text>
        <Text style={styles.statMini}>
          고가 <Text style={[styles.statMiniVal, { color: Theme.colors.bullish }]}>{formatNumber(item.high)}</Text>
        </Text>
        <Text style={styles.statMini}>
          저가 <Text style={[styles.statMiniVal, { color: Theme.colors.bearish }]}>{formatNumber(item.low)}</Text>
        </Text>
        {item.volume && (
          <Text style={styles.statMini}>
            거래량 <Text style={styles.statMiniVal}>{item.volume}</Text>
          </Text>
        )}
      </View>

      {/* Expanded Commentary Section */}
      {isExpanded && item.description && (
        <View style={styles.expandedBox}>
          <Ionicons name="information-circle-outline" size={14} color={Theme.colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.expandedText}>{item.description}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.lg,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  nightFuturesCard: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
    backgroundColor: '#121C33',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  titleArea: {
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  koreanName: {
    fontSize: Theme.typography.sizes.base,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  symbolText: {
    fontSize: 11,
    color: Theme.colors.textDim,
    fontWeight: '600',
  },
  tagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  nightTagBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  tagText: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  nightTagText: {
    color: '#60A5FA',
    fontWeight: 'bold',
  },
  favoriteButton: {
    padding: 4,
  },
  centerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  priceContainer: {
    flex: 1,
  },
  priceText: {
    fontSize: Theme.typography.sizes.xl,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  unitText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: 'normal',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  changePercentText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  },
  changeAmountText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chartWrapper: {
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.separator,
    paddingTop: 8,
    marginTop: 6,
  },
  statMini: {
    fontSize: 10,
    color: Theme.colors.textDim,
  },
  statMiniVal: {
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  expandedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: Theme.colors.primary,
  },
  expandedText: {
    flex: 1,
    fontSize: 11,
    color: Theme.colors.textSecondary,
    lineHeight: 16,
  },
});
