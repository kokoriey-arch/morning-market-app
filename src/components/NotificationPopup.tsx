import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/theme';

export interface NotificationPopupData {
  title: string;
  body: string;
}

interface NotificationPopupProps {
  popup: NotificationPopupData | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4500;

export const NotificationPopup: React.FC<NotificationPopupProps> = ({ popup, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-120)).current;
  const isVisible = useRef(false);

  useEffect(() => {
    if (popup) {
      isVisible.current = true;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
        speed: 14,
      }).start();

      const timer = setTimeout(() => {
        hidePopup();
      }, AUTO_DISMISS_MS);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup]);

  const hidePopup = () => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      isVisible.current = false;
      onDismiss();
    });
  };

  if (!popup) return null;

  return (
    <Animated.View
      style={[styles.overlay, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={hidePopup}>
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={20} color={Theme.colors.accentAmber} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {popup.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {popup.body}
          </Text>
        </View>
        <Ionicons name="close" size={16} color={Theme.colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardElevated,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorderHighlight,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    width: '100%',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Theme.colors.textPrimary,
  },
  body: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});
