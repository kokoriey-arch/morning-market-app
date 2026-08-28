import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarketItem, MorningBriefing } from '../types/market';
import { Theme } from '../theme/theme';
import { MorningBriefingHero } from '../components/MorningBriefingHero';
import { MarketCard } from '../components/MarketCard';
import { NightFuturesDetailChart } from '../components/NightFuturesDetailChart';
import { FearGreedGauge } from '../components/FearGreedGauge';

interface HomeScreenProps {
  items: MarketItem[];
  briefing: MorningBriefing;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  onNavigateTab: (tab: 'overview' | 'kospi' | 'us' | 'macro') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  items,
  briefing,
  favorites,
  onToggleFavorite,
  isRefreshing,
  onRefresh,
  onNavigateTab,
}) => {
  const kospiFutures = items.find((i) => i.id === 'kospi_night_futures');
  const usIndices = items.filter((i) => i.category === 'us_index');
  const bigTech = items.filter((i) => i.category === 'tech').slice(0, 3);
  const macros = items.filter((i) => i.category === 'macro' || i.category === 'commodity').slice(0, 3);
  const cryptos = items.filter((i) => i.category === 'crypto');

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
          colors={[Theme.colors.primary]}
        />
      }
    >
      {/* 1. Morning AI Briefing Hero */}
      <MorningBriefingHero briefing={briefing} />

      {/* 2. KOSPI Overnight Futures Section */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>🌙 새벽 코스피 야간선물</Text>
          <Text style={styles.sectionSub}>오늘 아침 06:00 최종 마감</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => onNavigateTab('kospi')}
        >
          <Text style={styles.moreButtonText}>심층 분석</Text>
          <Ionicons name="chevron-forward" size={14} color={Theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {kospiFutures && (
        <View style={styles.kospiSectionWrap}>
          <MarketCard
            item={kospiFutures}
            isFavorite={favorites.includes(kospiFutures.id)}
            onToggleFavorite={onToggleFavorite}
          />
          <View style={{ paddingHorizontal: Theme.spacing.lg }}>
            <NightFuturesDetailChart
              data={kospiFutures.history}
              previousClose={kospiFutures.previousClose}
              currentPrice={kospiFutures.price}
              high={kospiFutures.high}
              low={kospiFutures.low}
            />
          </View>
        </View>
      )}

      {/* 3. US Market & Semiconductor Highlight */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>🇺🇸 미국 증시 핵심 지수</Text>
          <Text style={styles.sectionSub}>나스닥 및 필라델피아 반도체 동향</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => onNavigateTab('us')}
        >
          <Text style={styles.moreButtonText}>전체 보기</Text>
          <Ionicons name="chevron-forward" size={14} color={Theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {usIndices.map((item) => (
        <MarketCard
          key={item.id}
          item={item}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}

      {/* 4. Top Big Tech Highlights */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>⚡ 미국 주요 빅테크 릴레이</Text>
          <Text style={styles.sectionSub}>엔비디아, 테슬라, 애플</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => onNavigateTab('us')}
        >
          <Text style={styles.moreButtonText}>더보기</Text>
          <Ionicons name="chevron-forward" size={14} color={Theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {bigTech.map((item) => (
        <MarketCard
          key={item.id}
          item={item}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}

      {/* 5. Macro FX & Yields */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>💵 환율 및 금리 지표</Text>
          <Text style={styles.sectionSub}>외인 수급 영향 요인</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => onNavigateTab('macro')}
        >
          <Text style={styles.moreButtonText}>더보기</Text>
          <Ionicons name="chevron-forward" size={14} color={Theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {macros.map((item) => (
        <MarketCard
          key={item.id}
          item={item}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}

      {/* 6. Major crypto price trends */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>₿ 주요 코인 가격 트렌드</Text>
          <Text style={styles.sectionSub}>BTC · ETH · SOL · XRP 24시간 흐름</Text>
        </View>
      </View>

      {cryptos.map((item) => (
        <MarketCard
          key={item.id}
          item={item}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
      {/* 6. Fear & Greed Sentiment Gauge */}
      <FearGreedGauge
        score={briefing.fearAndGreedIndex.score}
        rating={briefing.fearAndGreedIndex.rating}
        previousClose={briefing.fearAndGreedIndex.previousClose}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.xs,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: Theme.typography.sizes.md,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  sectionSub: {
    fontSize: 11,
    color: Theme.colors.textDim,
    marginTop: 2,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  moreButtonText: {
    fontSize: 12,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  kospiSectionWrap: {
    marginBottom: 4,
  },
  bottomSpacer: {
    height: 60,
  },
});
