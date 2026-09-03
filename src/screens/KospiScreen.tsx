import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarketItem, MorningBriefing } from '../types/market';
import { Theme } from '../theme/theme';
import { NightFuturesDetailChart } from '../components/NightFuturesDetailChart';
import { MarketCard } from '../components/MarketCard';
import { formatNumber } from '../utils/formatters';
import * as Haptics from 'expo-haptics';

interface KospiScreenProps {
  items: MarketItem[];
  briefing: MorningBriefing;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  onGoBack?: () => void;
}

export const KospiScreen: React.FC<KospiScreenProps> = ({
  items,
  briefing,
  favorites,
  onToggleFavorite,
  isRefreshing,
  onRefresh,
  onGoBack,
}) => {
  const kospiFutures = items.find((i) => i.id === 'kospi_night_futures');
  const fxUsdKrw = items.find((i) => i.id === 'fx_usdkrw');

  const handleBack = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    if (onGoBack) onGoBack();
  };

  const sectorForecasts = [
    {
      name: '반도체 / IT 대형주',
      badge: '🚀 최우선 수혜',
      color: Theme.colors.bullish,
      comment: '필라델피아 반도체(+2.35%) 및 엔비디아 급등으로 삼성전자·SK하이닉스 시초가 갭상승 주도 전망',
      tickers: '삼성전자, SK하이닉스, 한미반도체',
    },
    {
      name: '2차전지 / 전기차',
      badge: '📈 반등 기대',
      color: Theme.colors.primary,
      comment: '테슬라(+4.16%) 급등에 힘입어 전일 낙폭 과대 인식 속 저가 매수세 유입 가능성',
      tickers: 'LG에너지솔루션, POSCO홀딩스, 삼성SDI',
    },
    {
      name: '외환 / 금융 (밸류업)',
      badge: '💵 외인 매수 우호',
      color: Theme.colors.accentCyan,
      comment: '원/달러 야간 환율 1,381원대 하락으로 외국인 선물 매수 및 대형 금융주 안정적 지지',
      tickers: 'KB금융, 신한지주, 삼성물산',
    },
  ];

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

      {/* Top Header Card */}
      <View style={styles.topBanner}>
        <View style={styles.bannerBadge}>
          <Text style={styles.bannerBadgeText}>KRX / Eurex 야간 거래 최종 분석</Text>
        </View>
        <Text style={styles.bannerTitle}>코스피 200 야간선물 리포트</Text>
        <Text style={styles.bannerDesc}>
          오늘 정규장 개장(09:00)의 방향성을 결정짓는 새벽 거래량과 외국인 수급 통계입니다.
        </Text>
      </View>

      {/* Main KOSPI Futures Card (hidden while no live data — stub notice instead) */}
      {kospiFutures && kospiFutures.price > 0 ? (
        <>
          <MarketCard
            item={kospiFutures}
            isFavorite={favorites.includes(kospiFutures.id)}
            onToggleFavorite={onToggleFavorite}
          />

          {/* Night Session Detail Chart */}
          <View style={{ paddingHorizontal: Theme.spacing.lg }}>
            <NightFuturesDetailChart
              data={kospiFutures.history}
              previousClose={kospiFutures.previousClose}
              currentPrice={kospiFutures.price}
              high={kospiFutures.high}
              low={kospiFutures.low}
            />
          </View>
        </>
      ) : (
        <View style={styles.futuresStubNotice}>
          <View style={styles.futuresStubIconRow}>
            <Ionicons name="moon-outline" size={18} color={Theme.colors.textDim} style={{ marginRight: 6 }} />
            <Text style={styles.futuresStubTitle}>야간선물 시세 준비 중</Text>
          </View>
          <Text style={styles.futuresStubText}>
            코스피 200 야간선물(KM200N) 실시간 시세는 승인된 공식 시세 제공처(키움 REST API) 연동 후 제공될
            예정입니다. 연결되면 야간선물 카드, 상세 차트 및 수급 통계가 표시됩니다.
          </Text>
        </View>
      )}

      {/* Night Trading Stats Grid */}
      <View style={styles.statsCard}>
        <Text style={styles.statsHeader}>📊 야간 세션 핵심 수급 통계</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>총 거래량</Text>
            <Text style={styles.statBoxVal}>{briefing.nightSessionStats.volumeContracts}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>외국인 순매수</Text>
            <Text style={[styles.statBoxVal, { color: Theme.colors.bullish }]}>
              {briefing.nightSessionStats.foreignBuyingNet}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>시장 베이시스</Text>
            <Text style={[styles.statBoxVal, { color: Theme.colors.accentCyan }]}>+1.85 pt (콘탱고)</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>예상 코스피 시초</Text>
            <Text style={[styles.statBoxVal, { color: Theme.colors.bullish }]}>
              {briefing.expectedKospiOpen}
            </Text>
          </View>
        </View>
      </View>

      {/* USD / KRW Night FX correlation */}
      {fxUsdKrw && (
        <View style={styles.fxCard}>
          <View style={styles.fxTopRow}>
            <Ionicons name="cash-outline" size={16} color={Theme.colors.accentCyan} style={{ marginRight: 6 }} />
            <Text style={styles.fxTitle}>야간 역외 환율 연동 분석</Text>
          </View>
          <Text style={styles.fxText}>
            현재 야간 NDF 환율은 <Text style={{ color: Theme.colors.bullish, fontWeight: 'bold' }}>{formatNumber(fxUsdKrw.price)}원 ({fxUsdKrw.change}원)</Text>으로
            원화 강세를 보이며, 개장 초 외국인 선물 환매수 및 현물 바스켓 매수 유입에 매우 우호적입니다.
          </Text>
        </View>
      )}

      {/* Sector by Sector Impact */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>🎯 섹터별 시초가 영향 분석</Text>
      </View>

      {sectorForecasts.map((sec, idx) => (
        <View key={`sec_${idx}`} style={styles.sectorCard}>
          <View style={styles.sectorTop}>
            <Text style={styles.sectorName}>{sec.name}</Text>
            <View style={[styles.sectorBadge, { backgroundColor: `${sec.color}15`, borderColor: `${sec.color}40` }]}>
              <Text style={[styles.sectorBadgeText, { color: sec.color }]}>{sec.badge}</Text>
            </View>
          </View>
          <Text style={styles.sectorComment}>{sec.comment}</Text>
          <View style={styles.tickerRow}>
            <Text style={styles.tickerLabel}>관련 대표주: </Text>
            <Text style={styles.tickerNames}>{sec.tickers}</Text>
          </View>
        </View>
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
  topBanner: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  bannerBadgeText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: 'bold',
  },
  bannerTitle: {
    fontSize: Theme.typography.sizes.xl,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  bannerDesc: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  statsCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.lg,
    marginVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  statsHeader: {
    fontSize: Theme.typography.sizes.sm,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: Theme.colors.card,
    padding: 10,
    borderRadius: 8,
  },
  statBoxLabel: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginBottom: 4,
  },
  statBoxVal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  fxCard: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.25)',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.lg,
    marginVertical: Theme.spacing.sm,
  },
  fxTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fxTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Theme.colors.accentCyan,
  },
  fxText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.xs,
  },
  sectionTitle: {
    fontSize: Theme.typography.sizes.md,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  sectorCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.lg,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  sectorTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectorName: {
    fontSize: Theme.typography.sizes.base,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  sectorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  sectorBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectorComment: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  tickerRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.separator,
    paddingTop: 6,
  },
  tickerLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  tickerNames: {
    fontSize: 11,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 60,
  },
  futuresStubNotice: {
    marginHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.sm,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    backgroundColor: Theme.colors.surface,
  },
  futuresStubIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  futuresStubTitle: {
    fontSize: Theme.typography.sizes.sm,
    fontWeight: 'bold',
    color: Theme.colors.textSecondary,
  },
  futuresStubText: {
    fontSize: 12,
    color: Theme.colors.textDim,
    lineHeight: 18,
  },
});
