import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarketItem, MorningBriefing } from '../types/market';
import { Theme } from '../theme/theme';
import { MarketCard } from '../components/MarketCard';
import { FearGreedGauge } from '../components/FearGreedGauge';
import * as Haptics from 'expo-haptics';

interface MacroScreenProps {
  items: MarketItem[];
  briefing: MorningBriefing;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  onGoBack?: () => void;
}

export const MacroScreen: React.FC<MacroScreenProps> = ({
  items,
  briefing,
  favorites,
  onToggleFavorite,
  isRefreshing,
  onRefresh,
  onGoBack,
}) => {
  const macros = items.filter((i) => i.category === 'macro' || i.category === 'commodity');

  const handleBack = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    if (onGoBack) onGoBack();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={Theme.colors.primary}
        />
      }
    >
      {/* Back Navigation Bar */}
      {onGoBack && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Theme.colors.primary} />
          <Text style={styles.backButtonText}>모닝 브리핑(홈)으로 돌아가기</Text>
        </TouchableOpacity>
      )}

      {/* Top Banner */}
      <View style={styles.bannerContainer}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>글로벌 매크로 환경 종합</Text>
        </View>
        <Text style={styles.title}>환율 · 금리 · 원자재 & 심리</Text>
        <Text style={styles.subtitle}>
          외국인 투자자들의 한국 시장 유입 여부를 결정하는 핵심 거시경제 지표입니다.
        </Text>
      </View>

      {/* Macro Indicators List */}
      {macros.map((item) => (
        <MarketCard
          key={item.id}
          item={item}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}

      {/* Sentiment Gauges (Stock + Crypto) */}
      <FearGreedGauge
        title="글로벌 투자 심리 (Stock Fear & Greed)"
        badge="주식"
        score={briefing.fearAndGreedIndex.score}
        rating={briefing.fearAndGreedIndex.rating}
        previousClose={briefing.fearAndGreedIndex.previousClose}
      />
      <FearGreedGauge
        title="코인 투자 심리 (Crypto Fear & Greed)"
        badge="코인"
        score={briefing.cryptoFearAndGreedIndex.score}
        rating={briefing.cryptoFearAndGreedIndex.rating}
        previousClose={briefing.cryptoFearAndGreedIndex.previousClose}
      />

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.cardBorder,
  },
  backButtonText: {
    fontSize: 13,
    color: Theme.colors.primary,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  bannerContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: 'bold',
  },
  title: {
    fontSize: Theme.typography.sizes.xl,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 60,
  },
});
