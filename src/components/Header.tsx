import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/theme';
import { getCurrentMorningDateString, getRemainingTimeUntilOpen } from '../utils/formatters';
import * as Haptics from 'expo-haptics';

interface HeaderProps {
  onRefresh: () => Promise<void>;
  onOpenSettings: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, onOpenSettings, isRefreshing }) => {
  const [spinAnim] = useState(new Animated.Value(0));
  const [countdown, setCountdown] = useState(getRemainingTimeUntilOpen());
  const { dateString, dayString } = getCurrentMorningDateString();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getRemainingTimeUntilOpen());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      spinAnim.setValue(0);
    });

    await onRefresh();
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{dateString} ({dayString})</Text>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>실시간</Text>
          </View>
          <Text style={styles.appTitle}>모닝 마켓 브리핑</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="reload" size={18} color={Theme.colors.textPrimary} />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={19} color={Theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Countdown & Market Open Status Banner */}
      <View style={styles.countdownBanner}>
        <Ionicons
          name={countdown.isRegularOpen ? 'time' : 'alarm-outline'}
          size={14}
          color={countdown.isRegularOpen ? Theme.colors.bullish : Theme.colors.accentCyan}
          style={{ marginRight: 6 }}
        />
        <Text style={styles.countdownText}>{countdown.statusText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateText: {
    fontSize: Theme.typography.sizes.xs,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.bullish,
    marginHorizontal: 6,
  },
  liveText: {
    fontSize: 11,
    color: Theme.colors.bullish,
    fontWeight: 'bold',
  },
  appTitle: {
    fontSize: Theme.typography.sizes.xl,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.25)',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: Theme.spacing.sm,
  },
  countdownText: {
    fontSize: Theme.typography.sizes.xs,
    color: Theme.colors.textPrimary,
    fontWeight: '600',
  },
});
