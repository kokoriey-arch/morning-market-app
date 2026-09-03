import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/theme';
import { UnifiedMarketData } from '../types/aiAnalysis';
import { getUnifiedMarketData } from '../services/ai/aiAnalysisService';
import { formatNumber, formatPercent } from '../utils/formatters';
import * as Haptics from 'expo-haptics';

interface AiAnalysisScreenProps {
  onGoBack?: () => void;
}

export const AiAnalysisScreen: React.FC<AiAnalysisScreenProps> = ({ onGoBack }) => {
  const [data, setData] = useState<UnifiedMarketData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStockCode, setSelectedStockCode] = useState<string>('005930'); // default Samsung

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (force = false) => {
    setIsRefreshing(true);
    try {
      const res = await getUnifiedMarketData(force);
      setData(res);
    } catch (e) {
      console.warn('Failed to load unified AI data:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    await loadData(true);
  };

  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>AI 수급 및 시장 데이터 분석 중...</Text>
      </View>
    );
  }

  const { signals, vix, us_etf, stocks, kospi, sourceLabel, lastUpdated } = data;
  const currentStock = stocks[selectedStockCode] || Object.values(stocks)[0];

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH':
      case 'BUY':
      case 'UP':
        return { text: '강세 / 매수', color: Theme.colors.bullish, bg: 'rgba(0, 229, 153, 0.12)' };
      case 'BEARISH':
      case 'SELL':
      case 'DOWN':
      case 'HIGH':
        return { text: '약세 / 주의', color: Theme.colors.bearish, bg: 'rgba(255, 66, 98, 0.12)' };
      default:
        return { text: '중립 / 안정', color: Theme.colors.accentAmber, bg: 'rgba(245, 158, 11, 0.12)' };
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={Theme.colors.primary}
        />
      }
    >
      {/* 1. Header Banner */}
      <View style={styles.header}>
        {onGoBack && (
          <TouchableOpacity style={styles.backButton} onPress={onGoBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={Theme.colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleWrap}>
          <View style={styles.badgeRow}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
              <Text style={styles.aiBadgeText}>AI 시장 레이더</Text>
            </View>
            <Text style={styles.liveTag}>
              {sourceLabel}
            </Text>
          </View>
          <Text style={styles.headerTitle}>주식 AI 통합 수급 분석</Text>
          <Text style={styles.headerSub}>업데이트: {lastUpdated} · KIWOOM + Yahoo + 미국 ETF</Text>
        </View>
      </View>

      {/* 2. AI Overall Judgment Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Ionicons name="analytics" size={20} color={Theme.colors.primary} />
          <Text style={styles.heroTitle}>오늘 시장 종합 판단</Text>
          <View style={[styles.signalPill, { backgroundColor: getSentimentBadge(signals.nasdaq_signal).bg }]}>
            <Text style={[styles.signalPillText, { color: getSentimentBadge(signals.nasdaq_signal).color }]}>
              {signals.nasdaq_signal}
            </Text>
          </View>
        </View>
        <Text style={styles.heroJudgmentText}>{signals.overall_judgment}</Text>

        {/* 7-Factor Signal Matrix */}
        <View style={styles.factorGrid}>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>KOSPI 추세</Text>
            <Text style={[styles.factorValue, { color: signals.kospi_trend === 'UP' ? Theme.colors.bullish : signals.kospi_trend === 'DOWN' ? Theme.colors.bearish : Theme.colors.neutral }]}>
              {signals.kospi_trend} ({formatPercent(kospi.changeRate)})
            </Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>VIX 위험도</Text>
            <Text style={[styles.factorValue, { color: signals.vix_level === 'LOW' ? Theme.colors.bullish : signals.vix_level === 'HIGH' ? Theme.colors.bearish : Theme.colors.accentAmber }]}>
              {signals.vix_level} ({vix.price}pt)
            </Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>외인 수급</Text>
            <Text style={[styles.factorValue, { color: signals.foreign_flow === 'BUY' ? Theme.colors.bullish : signals.foreign_flow === 'SELL' ? Theme.colors.bearish : Theme.colors.neutral }]}>
              {signals.foreign_flow}
            </Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>기관 수급</Text>
            <Text style={[styles.factorValue, { color: signals.institution_flow === 'BUY' ? Theme.colors.bullish : signals.institution_flow === 'SELL' ? Theme.colors.bearish : Theme.colors.neutral }]}>
              {signals.institution_flow}
            </Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>프로그램 매매</Text>
            <Text style={[styles.factorValue, { color: signals.program_flow === 'BUY' ? Theme.colors.bullish : signals.program_flow === 'SELL' ? Theme.colors.bearish : Theme.colors.neutral }]}>
              {signals.program_flow}
            </Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>반도체 섹터</Text>
            <Text style={[styles.factorValue, { color: signals.semiconductor_signal === 'BULLISH' ? Theme.colors.bullish : signals.semiconductor_signal === 'BEARISH' ? Theme.colors.bearish : Theme.colors.neutral }]}>
              {signals.semiconductor_signal}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. AI Detailed Commentary Section */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>💡 7대 핵심 분석 브리핑</Text>
        <View style={styles.commentaryCard}>
          <View style={styles.commentaryRow}>
            <Text style={styles.commentaryHeader}>• 외국인 수급 분석</Text>
            <Text style={styles.commentaryBody}>{signals.foreign_commentary}</Text>
          </View>
          <View style={styles.commentaryRow}>
            <Text style={styles.commentaryHeader}>• 기관 수급 분석</Text>
            <Text style={styles.commentaryBody}>{signals.institution_commentary}</Text>
          </View>
          <View style={styles.commentaryRow}>
            <Text style={styles.commentaryHeader}>• 프로그램 수급 동향</Text>
            <Text style={styles.commentaryBody}>{signals.program_commentary}</Text>
          </View>
          <View style={styles.commentaryRow}>
            <Text style={styles.commentaryHeader}>• 미국 기술주 영향 (QQQ/XLK)</Text>
            <Text style={styles.commentaryBody}>{signals.us_tech_impact}</Text>
          </View>
          <View style={styles.commentaryRow}>
            <Text style={styles.commentaryHeader}>• 반도체 섹터 영향 (SOXX/SMH)</Text>
            <Text style={styles.commentaryBody}>{signals.semiconductor_impact}</Text>
          </View>
          <View style={styles.commentaryRow}>
            <Text style={styles.commentaryHeader}>• VIX 위험도 평가</Text>
            <Text style={styles.commentaryBody}>{signals.vix_risk}</Text>
          </View>
        </View>
      </View>

      {/* 4. Domestic Target Stocks (Kiwoom) */}
      <View style={styles.sectionWrap}>
        <View style={styles.stockSectionHeader}>
          <Text style={styles.sectionTitle}>🇰🇷 국내 주요 종목 심층 수급 (KIWOOM)</Text>
          <Text style={styles.sectionSubTitle}>5대 핵심 종목 선택</Text>
        </View>

        {/* Stock Selector Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stockTabs}>
          {Object.values(stocks).map((stk) => {
            const isSelected = stk.code === selectedStockCode;
            return (
              <TouchableOpacity
                key={stk.code}
                style={[styles.stockTabPill, isSelected && styles.stockTabPillActive]}
                onPress={() => setSelectedStockCode(stk.code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.stockTabPillText, isSelected && styles.stockTabPillTextActive]}>
                  {stk.name}
                </Text>
                <Text style={[styles.stockTabPillCode, isSelected && styles.stockTabPillCodeActive]}>
                  {formatPercent(stk.price.changeRate)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Stock Detail Card */}
        {currentStock && (
          <View style={styles.stockDetailCard}>
            <View style={styles.stockTopRow}>
              <View>
                <Text style={styles.stockDetailName}>{currentStock.name} ({currentStock.code})</Text>
                <Text style={styles.stockDetailMarket}>{currentStock.info?.sector || '전기전자 / 반도체'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.stockDetailPrice}>{formatNumber(currentStock.price.price, 0)}원</Text>
                <Text style={[styles.stockDetailChange, { color: currentStock.price.change >= 0 ? Theme.colors.bullish : Theme.colors.bearish }]}>
                  {currentStock.price.change >= 0 ? '+' : ''}{formatNumber(currentStock.price.change, 0)} ({formatPercent(currentStock.price.changeRate)})
                </Text>
              </View>
            </View>

            {/* Valuation Stats */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>시가총액</Text>
                <Text style={styles.metricValue}>{(currentStock.price.marketCap / 100_000_000).toFixed(0)}억</Text>
              </View>
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>PER / PBR</Text>
                <Text style={styles.metricValue}>{currentStock.price.per}배 / {currentStock.price.pbr}배</Text>
              </View>
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>외인보유율</Text>
                <Text style={styles.metricValue}>{currentStock.price.foreignHoldingRate.toFixed(1)}%</Text>
              </View>
            </View>

            {/* Flow & Investor Trends */}
            <View style={styles.flowCardSection}>
              <Text style={styles.flowCardTitle}>📊 투자자별 매매동향 (전일 확정치)</Text>
              <View style={styles.flowGrid}>
                <View style={styles.flowItem}>
                  <Text style={styles.flowLabel}>개인</Text>
                  <Text style={[styles.flowValue, { color: (currentStock.investor?.individualNetBuy ?? 0) >= 0 ? Theme.colors.bullish : Theme.colors.bearish }]}>
                    {(currentStock.investor?.individualNetBuy ?? 0) > 0 ? '+' : ''}{formatNumber(currentStock.investor?.individualNetBuy ?? 0, 0)}주
                  </Text>
                </View>
                <View style={styles.flowItem}>
                  <Text style={styles.flowLabel}>외국인</Text>
                  <Text style={[styles.flowValue, { color: (currentStock.investor?.foreignNetBuy ?? 0) >= 0 ? Theme.colors.bullish : Theme.colors.bearish }]}>
                    {(currentStock.investor?.foreignNetBuy ?? 0) > 0 ? '+' : ''}{formatNumber(currentStock.investor?.foreignNetBuy ?? 0, 0)}주
                  </Text>
                </View>
                <View style={styles.flowItem}>
                  <Text style={styles.flowLabel}>기관</Text>
                  <Text style={[styles.flowValue, { color: (currentStock.investor?.institutionNetBuy ?? 0) >= 0 ? Theme.colors.bullish : Theme.colors.bearish }]}>
                    {(currentStock.investor?.institutionNetBuy ?? 0) > 0 ? '+' : ''}{formatNumber(currentStock.investor?.institutionNetBuy ?? 0, 0)}주
                  </Text>
                </View>
              </View>

              {/* Estimate & Program Flow */}
              <View style={styles.subFlowRow}>
                <View style={styles.subFlowCol}>
                  <Text style={styles.subFlowTitle}>⚡ 장중 추정 수급 ({currentStock.investorEstimate?.time || '실시간'})</Text>
                  <Text style={styles.subFlowText}>
                    외인: <Text style={{ color: (currentStock.investorEstimate?.foreignEstimateNetBuy ?? 0) >= 0 ? Theme.colors.bullish : Theme.colors.bearish }}>
                      {(currentStock.investorEstimate?.foreignEstimateNetBuy ?? 0) > 0 ? '+' : ''}{formatNumber(currentStock.investorEstimate?.foreignEstimateNetBuy ?? 0, 0)}주
                    </Text>
                    {' · '}
                    기관: <Text style={{ color: (currentStock.investorEstimate?.institutionEstimateNetBuy ?? 0) >= 0 ? Theme.colors.bullish : Theme.colors.bearish }}>
                      {(currentStock.investorEstimate?.institutionEstimateNetBuy ?? 0) > 0 ? '+' : ''}{formatNumber(currentStock.investorEstimate?.institutionEstimateNetBuy ?? 0, 0)}주
                    </Text>
                  </Text>
                </View>
                <View style={styles.subFlowCol}>
                  <Text style={styles.subFlowTitle}>🤖 프로그램 순매매</Text>
                  <Text style={[styles.subFlowText, { color: (currentStock.program?.programNetBuy ?? 0) >= 0 ? Theme.colors.bullish : Theme.colors.bearish }]}>
                    {(currentStock.program?.programNetBuy ?? 0) > 0 ? '+' : ''}{formatNumber(currentStock.program?.programNetBuy ?? 0, 0)}주
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 5. US ETFs & VIX Matrix (Yahoo) */}
      <View style={styles.sectionWrap}>
        <View style={styles.stockSectionHeader}>
          <Text style={styles.sectionTitle}>🇺🇸 미국 주요 ETF & VIX 매트릭스</Text>
          <Text style={styles.sectionSubTitle}>기술주/반도체/지수 흐름</Text>
        </View>

        <View style={styles.etfGrid}>
          {Object.values(us_etf).map((etf) => (
            <View key={etf.symbol} style={styles.etfCard}>
              <View style={styles.etfTopRow}>
                <Text style={styles.etfSymbol}>{etf.symbol}</Text>
                <Text style={[styles.etfChange, { color: etf.changeRate >= 0 ? Theme.colors.bullish : Theme.colors.bearish }]}>
                  {formatPercent(etf.changeRate)}
                </Text>
              </View>
              <Text style={styles.etfName} numberOfLines={1}>{etf.name}</Text>
              <Text style={styles.etfPrice}>${etf.price.toFixed(2)}</Text>
              <View style={styles.etfReturnsRow}>
                <Text style={styles.returnChip}>1D {formatPercent(etf.return1D)}</Text>
                <Text style={styles.returnChip}>5D {formatPercent(etf.return5D)}</Text>
                <Text style={styles.returnChip}>20D {formatPercent(etf.return20D)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  contentContainer: {
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.typography.sizes.sm,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  liveTag: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  headerTitle: {
    fontSize: Theme.typography.sizes.xl,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: Theme.colors.textDim,
    marginTop: 2,
  },
  heroCard: {
    marginHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.cardElevated,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorderHighlight,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
    flex: 1,
  },
  signalPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  signalPillText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  heroJudgmentText: {
    fontSize: 13,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    marginBottom: 14,
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.separator,
  },
  factorItem: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 8,
  },
  factorLabel: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginBottom: 2,
  },
  factorValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionWrap: {
    marginTop: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  sectionSubTitle: {
    fontSize: 11,
    color: Theme.colors.textDim,
  },
  commentaryCard: {
    marginTop: Theme.spacing.sm,
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    gap: 12,
  },
  commentaryRow: {
    gap: 2,
  },
  commentaryHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Theme.colors.activeTab,
  },
  commentaryBody: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },
  stockSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Theme.spacing.sm,
  },
  stockTabs: {
    marginBottom: Theme.spacing.sm,
  },
  stockTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    alignItems: 'center',
  },
  stockTabPillActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: Theme.colors.primary,
  },
  stockTabPillText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  stockTabPillTextActive: {
    color: Theme.colors.textPrimary,
    fontWeight: 'bold',
  },
  stockTabPillCode: {
    fontSize: 10,
    color: Theme.colors.textDim,
    marginTop: 2,
  },
  stockTabPillCodeActive: {
    color: Theme.colors.activeTab,
    fontWeight: 'bold',
  },
  stockDetailCard: {
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  stockTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.separator,
  },
  stockDetailName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  stockDetailMarket: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  stockDetailPrice: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  stockDetailChange: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.separator,
  },
  metricCol: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  flowCardSection: {
    marginTop: 10,
  },
  flowCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Theme.colors.textSecondary,
    marginBottom: 8,
  },
  flowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  flowItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  flowLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  flowValue: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  subFlowRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.separator,
    flexDirection: 'row',
    gap: 8,
  },
  subFlowCol: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 8,
    borderRadius: 6,
  },
  subFlowTitle: {
    fontSize: 10,
    color: Theme.colors.accentAmber,
    fontWeight: '600',
  },
  subFlowText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  etfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Theme.spacing.sm,
  },
  etfCard: {
    width: '48.5%',
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  etfTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  etfSymbol: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  etfChange: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  etfName: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  etfPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
    marginTop: 4,
  },
  etfReturnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.separator,
  },
  returnChip: {
    fontSize: 9,
    color: Theme.colors.textSecondary,
  },
});
