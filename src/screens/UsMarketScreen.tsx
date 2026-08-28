import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarketItem, MorningBriefing } from '../types/market';
import { Theme } from '../theme/theme';
import { MarketCard } from '../components/MarketCard';
import { getUsMarketTag } from '../services/marketData';
import * as Haptics from 'expo-haptics';

interface UsMarketScreenProps {
  items: MarketItem[];
  briefing: MorningBriefing;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  onGoBack?: () => void;
}

export const UsMarketScreen: React.FC<UsMarketScreenProps> = ({
  items,
  briefing,
  favorites,
  onToggleFavorite,
  isRefreshing,
  onRefresh,
  onGoBack,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'index' | 'tech'>('all');

  const handleBack = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    if (onGoBack) onGoBack();
  };

  const usIndices = items.filter((i) => i.category === 'us_index');
  const bigTech = items.filter((i) => i.category === 'tech');

  const filteredItems =
    selectedFilter === 'index'
      ? usIndices
      : selectedFilter === 'tech'
      ? bigTech
      : [...usIndices, ...bigTech];

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

      {/* Header Banner */}
      <View style={styles.bannerContainer}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🇺🇸 {getUsMarketTag()}</Text>
        </View>
        <Text style={styles.title}>미국 뉴욕 증시 & 빅테크</Text>
        <Text style={styles.subtitle}>
          {briefing.summaryBullets[1] ?? '나스닥 및 반도체 지수 실시간 시황 반영 중입니다.'}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterButtonText, selectedFilter === 'all' && styles.filterButtonTextActive]}>
            전체 보기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'index' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('index')}
        >
          <Text style={[styles.filterButtonText, selectedFilter === 'index' && styles.filterButtonTextActive]}>
            주요 지수 (4)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, selectedFilter === 'tech' && styles.filterButtonActive]}
          onPress={() => setSelectedFilter('tech')}
        >
          <Text style={[styles.filterButtonText, selectedFilter === 'tech' && styles.filterButtonTextActive]}>
            빅테크 릴레이 (5)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Market Cards */}
      {filteredItems.map((item) => (
        <MarketCard
          key={item.id}
          item={item}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}

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
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#60A5FA',
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.lg,
    marginVertical: Theme.spacing.sm,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  filterButtonActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 60,
  },
});
