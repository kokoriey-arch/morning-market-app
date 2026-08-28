import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/theme';
import { UserPreferences } from '../types/market';
import * as Haptics from 'expo-haptics';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (newPrefs: UserPreferences) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  preferences,
  onUpdatePreferences,
}) => {
  const alertTimes = ['06:30', '07:00', '07:30', '08:00', '08:30'];

  const toggleAlert = (val: boolean) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    onUpdatePreferences({ ...preferences, morningAlertEnabled: val });
  };

  const toggleHaptics = (val: boolean) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    onUpdatePreferences({ ...preferences, enableHaptics: val });
  };

  const selectTime = (time: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onUpdatePreferences({ ...preferences, morningAlertTime: time });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>앱 설정 및 모닝 알림</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Morning Alert Setting */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>⏰ 매일 아침 브리핑 알림</Text>

              <View style={styles.rowItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>아침 개장전 알림 받기</Text>
                  <Text style={styles.rowSub}>야간선물 및 미국 증시 마감 종합 요약</Text>
                </View>
                <Switch
                  value={preferences.morningAlertEnabled}
                  onValueChange={toggleAlert}
                  trackColor={{ false: '#334155', true: Theme.colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {preferences.morningAlertEnabled && (
                <View style={styles.timeSelectorContainer}>
                  <Text style={styles.timeSelectLabel}>알림 수신 시간 선택:</Text>
                  <View style={styles.timePillRow}>
                    {alertTimes.map((time) => {
                      const isSelected = preferences.morningAlertTime === time;
                      return (
                        <TouchableOpacity
                          key={time}
                          style={[styles.timePill, isSelected && styles.timePillActive]}
                          onPress={() => selectTime(time)}
                        >
                          <Text style={[styles.timePillText, isSelected && styles.timePillTextActive]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Interaction Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>📳 피드백 설정</Text>
              <View style={styles.rowItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>진동(햅틱) 피드백</Text>
                  <Text style={styles.rowSub}>버튼 및 관심종목 터치 시 진동 효과</Text>
                </View>
                <Switch
                  value={preferences.enableHaptics}
                  onValueChange={toggleHaptics}
                  trackColor={{ false: '#334155', true: Theme.colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Data Source & Info */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>ℹ️ 시세 데이터 제공처 안내</Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoLine}>• 코스피 200 야간선물: KRX/Eurex 연계 야간거래 (18:00~06:00)</Text>
                <Text style={styles.infoLine}>• 미국 정규 증시 & 지수: NASDAQ / NYSE 마감 집계</Text>
                <Text style={styles.infoLine}>• 역외 NDF 환율: CME / 서울외환시장 야간 연동</Text>
                <Text style={styles.infoLine}>• 버전: 1.0.0 (Expo Mobile Client)</Text>
              </View>
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity style={styles.saveButton} onPress={onClose}>
            <Text style={styles.saveButtonText}>완료</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    maxHeight: '82%',
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.cardBorder,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.separator,
  },
  sheetTitle: {
    fontSize: Theme.typography.sizes.md,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: Theme.spacing.lg,
  },
  section: {
    marginBottom: Theme.spacing.xl,
  },
  sectionHeader: {
    fontSize: Theme.typography.sizes.sm,
    color: Theme.colors.textSecondary,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.md,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    padding: 12,
    borderRadius: Theme.borderRadius.md,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: Theme.typography.sizes.sm,
    color: Theme.colors.textPrimary,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 11,
    color: Theme.colors.textDim,
    marginTop: 2,
  },
  timeSelectorContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    padding: 12,
    borderRadius: Theme.borderRadius.md,
    marginTop: 8,
  },
  timeSelectLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  timePillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  timePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  timePillActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  timePillText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  timePillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: Theme.colors.card,
    padding: 12,
    borderRadius: Theme.borderRadius.md,
    gap: 6,
  },
  infoLine: {
    fontSize: 11,
    color: Theme.colors.textDim,
    lineHeight: 16,
  },
  saveButton: {
    backgroundColor: Theme.colors.primary,
    marginHorizontal: Theme.spacing.lg,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: Theme.typography.sizes.base,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
