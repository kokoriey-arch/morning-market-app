import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/theme';
import { EconomicEvent } from '../types/market';
import {
  formatEventDateKey,
  getEconomicCalendarRange,
  getEconomicEvents,
  isEventAlertsEnabled,
  setEventAlertsEnabled,
} from '../services/economicCalendar';

interface EconomicCalendarScreenProps {
  onGoBack: () => void;
}

const IMPORTANCE_CONFIG = {
  high: { label: '중요', color: Theme.colors.bearish, bg: 'rgba(255, 66, 98, 0.12)' },
  medium: { label: '보통', color: Theme.colors.accentAmber, bg: 'rgba(245, 158, 11, 0.12)' },
  low: { label: '참고', color: Theme.colors.textMuted, bg: 'rgba(148, 163, 184, 0.10)' },
};

export const EconomicCalendarScreen: React.FC<EconomicCalendarScreenProps> = ({ onGoBack }) => {
  const events = useMemo(() => getEconomicEvents(), []);
  const range = useMemo(() => getEconomicCalendarRange(), []);
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) || [];
      list.push(event);
      map.set(event.date, list);
    }
    return Array.from(map.entries());
  }, [events]);

  const highCount = events.filter((e) => e.importance === 'high').length;

  const handleToggleAlerts = async (value: boolean) => {
    setAlertsEnabled(value);
    await setEventAlertsEnabled(value);
  };

  // Load saved toggle state
  React.useEffect(() => {
    isEventAlertsEnabled().then(setAlertsEnabled).catch(() => {});
  }, []);

  const rangeLabel = `${range.start.getMonth() + 1}/${range.start.getDate()} ~ ${range.end.getMonth() + 1}/${range.end.getDate()}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>🇺🇸 미국 경제 일정</Text>
          <Text style={styles.headerSub}>{rangeLabel} · 총 {events.length}건 (중요 {highCount}건)</Text>
        </View>
      </View>

      {/* Alert toggle card */}
      <View style={styles.alertCard}>
        <View style={styles.alertIconWrap}>
          <Ionicons name="alarm" size={20} color={Theme.colors.accentAmber} />
        </View>
        <View style={styles.alertTextWrap}>
          <Text style={styles.alertTitle}>주요 이벤트 알림</Text>
          <Text style={styles.alertSub}>중요 지표 발표 30분 전 진동 알림</Text>
        </View>
        <Switch
          value={alertsEnabled}
          onValueChange={handleToggleAlerts}
          trackColor={{ false: Theme.colors.card, true: Theme.colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Event list grouped by date */}
      {grouped.map(([dateKey, dayEvents]) => {
        const info = formatEventDateKey(dateKey);
        return (
          <View key={dateKey} style={styles.daySection}>
            <View style={[styles.dayHeader, info.isToday && styles.dayHeaderToday]}>
              <Text style={[styles.dayHeaderText, info.isToday && styles.dayHeaderTextToday]}>
                {info.monthDay} {info.dayOfWeek}
              </Text>
              {info.isToday && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>오늘</Text>
                </View>
              )}
            </View>
            {dayEvents.map((event) => {
              const cfg = IMPORTANCE_CONFIG[event.importance];
              return (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventTopRow}>
                    <Text style={styles.eventTime}>{event.time}</Text>
                    <View style={[styles.importanceBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.importanceText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{event.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.eventTitle}>{event.koreanTitle}</Text>
                  <Text style={styles.eventTitleEn}>{event.title}</Text>
                  <Text style={styles.eventDesc}>{event.description}</Text>
                  {(event.forecast || event.previous) && (
                    <View style={styles.statRow}>
                      {event.forecast ? (
                        <Text style={styles.statText}>예상: {event.forecast}</Text>
                      ) : null}
                      {event.previous ? (
                        <Text style={styles.statText}>  ·  전월: {event.previous}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    gap: Theme.spacing.sm,
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
  headerTitle: {
    fontSize: Theme.typography.sizes.lg,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: Theme.colors.textDim,
    marginTop: 2,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.lg,
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    gap: Theme.spacing.md,
  },
  alertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTextWrap: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  alertSub: {
    fontSize: 11,
    color: Theme.colors.textDim,
    marginTop: 2,
  },
  daySection: {
    marginTop: Theme.spacing.lg,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: 6,
    gap: 6,
  },
  dayHeaderToday: {
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Theme.colors.textSecondary,
  },
  dayHeaderTextToday: {
    color: Theme.colors.activeTab,
  },
  todayBadge: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  eventCard: {
    marginHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.sm,
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Theme.colors.activeTab,
  },
  importanceBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryBadge: {
    backgroundColor: Theme.colors.badgeBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  categoryText: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
    marginTop: 8,
  },
  eventTitleEn: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  eventDesc: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    lineHeight: 17,
    marginTop: 6,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  statText: {
    fontSize: 11,
    color: Theme.colors.textDim,
  },
  bottomSpacer: {
    height: 60,
  },
});
