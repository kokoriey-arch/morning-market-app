import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import { Theme } from './src/theme/theme';
import { MarketItem, MorningBriefing, UserPreferences } from './src/types/market';
import { getUsMarketTag, INITIAL_MARKET_ITEMS, INITIAL_MORNING_BRIEFING, MarketService } from './src/services/marketData';
import { syncMorningBriefingNotification } from './src/services/morningNotifications';

import { Header } from './src/components/Header';
import { SettingsModal } from './src/components/SettingsModal';

import { HomeScreen } from './src/screens/HomeScreen';
import { UsMarketScreen } from './src/screens/UsMarketScreen';
import { MacroScreen } from './src/screens/MacroScreen';
import { EconomicCalendarScreen } from './src/screens/EconomicCalendarScreen';
import { NotificationPopup, NotificationPopupData } from './src/components/NotificationPopup';

type TabType = 'overview' | 'kospi' | 'us' | 'macro' | 'events';

const AUTO_REFRESH_INTERVAL_MS = 60_000; // 60 seconds

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // 커스텀 NotificationPopup이 이미 동일 알림을 표시하므로 기본 배너는 숨김 처리
    // (중복 팝업 방지 — 알림 자체/사운드/목록 표시는 유지)
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


function MainApp() {
  const insets = useSafeAreaInsets();
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [items, setItems] = useState<MarketItem[]>(INITIAL_MARKET_ITEMS);
  const [briefing, setBriefing] = useState<MorningBriefing>(INITIAL_MORNING_BRIEFING);
  const [preferences, setPreferences] = useState<UserPreferences>({
    morningAlertEnabled: true,
    morningAlertTime: '07:30',
    enableHaptics: true,
    favorites: ['kospi_night_futures', 'nasdaq_comp', 'phil_semiconductor', 'tech_nvda', 'fx_usdkrw'],
    defaultTab: 'overview',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [popup, setPopup] = useState<NotificationPopupData | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [dataFetchError, setDataFetchError] = useState(false);

  // Refs for interval + in-flight guard
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);
  // Keep a ref to the latest items so the auto-refresh closure always sees current data
  const itemsRef = useRef<MarketItem[]>(INITIAL_MARKET_ITEMS);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // ── Refresh logic ──────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return; // prevent concurrent calls
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      const result = await MarketService.refreshData(itemsRef.current);
      setItems(result.items);
      setBriefing(result.briefing);

      if (result.fetchedAt) {
        const d = new Date(result.fetchedAt);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        setLastUpdatedAt(`${hh}:${mm}:${ss}`);
        setDataFetchError(false);
      } else {
        // fetchedAt null means provider fell back to cache
        setDataFetchError(true);
      }
    } catch (e) {
      console.warn('[App] handleRefresh error:', e);
      setDataFetchError(true);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  // ── US market tag updater (keeps tag labels current every minute) ──────────
  useEffect(() => {
    const timer = setInterval(() => {
      const tag = getUsMarketTag();
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.category === 'us_index' ? { ...item, tag } : item,
        ),
      );
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // ── Auto-refresh interval (60 s) ───────────────────────────────────────────
  const startInterval = useCallback(() => {
    if (refreshIntervalRef.current) return; // already running
    refreshIntervalRef.current = setInterval(() => {
      handleRefresh();
    }, AUTO_REFRESH_INTERVAL_MS);
  }, [handleRefresh]);

  const stopInterval = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  // ── AppState: pause polling in background, resume + immediate refresh in foreground ──
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Back to foreground: refresh immediately then restart interval
        handleRefresh();
        startInterval();
      } else {
        // Background / inactive: pause polling
        stopInterval();
      }
    });
    return () => subscription.remove();
  }, [handleRefresh, startInterval, stopInterval]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // 1. Load preferences and cache simultaneously
      const [prefs, cachedItems, cachedBriefing] = await Promise.all([
        MarketService.getUserPreferences(),
        MarketService.getMarketItems(),
        MarketService.getMorningBriefing(),
      ]);

      setPreferences(prefs);
      setItems(cachedItems);
      setBriefing(cachedBriefing);
      syncMorningBriefingNotification(prefs).catch(() => {});

      if (prefs.defaultTab) setCurrentTab(prefs.defaultTab);

      // 2. Fetch live data in background
      await handleRefresh();

      // 3. Start polling
      startInterval();
    };

    init();

    // Cleanup on unmount
    return () => stopInterval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── In-app notification popup + vibration ────────────────────────────────
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      if (preferences.enableHaptics) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
      setPopup({
        title: notification.request.content.title ?? '알림',
        body: notification.request.content.body ?? '',
      });
    });
    return () => receivedSubscription.remove();
  }, [preferences.enableHaptics]);

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleToggleFavorite = async (id: string) => {
    const currentFavs = preferences.favorites;
    const nextFavs = currentFavs.includes(id)
      ? currentFavs.filter((favId) => favId !== id)
      : [...currentFavs, id];
    const newPrefs = { ...preferences, favorites: nextFavs };
    setPreferences(newPrefs);
    await MarketService.saveUserPreferences(newPrefs);
  };

  const handleTabPress = (tab: TabType) => {
    if (preferences.enableHaptics) {
      try { Haptics.selectionAsync(); } catch {}
    }
    setCurrentTab(tab);
  };

  const handleGoBack = () => {
    if (preferences.enableHaptics) {
      try { Haptics.selectionAsync(); } catch {}
    }
    setCurrentTab('overview');
  };

  const handleUpdatePreferences = async (newPrefs: UserPreferences) => {
    await syncMorningBriefingNotification(newPrefs);
    setPreferences(newPrefs);
    await MarketService.saveUserPreferences(newPrefs);
  };

  // ── Layout ─────────────────────────────────────────────────────────────────
  const bottomInsetPadding = Math.max(insets.bottom + 8, Platform.OS === 'android' ? 32 : 24);
  const topInsetPadding = Math.max(insets.top, Platform.OS === 'android' ? 12 : 0);

  return (
    <View style={[styles.container, { paddingTop: topInsetPadding }]}>
      <StatusBar style="light" />

      {/* Global Header */}
      <Header
        onRefresh={handleRefresh}
        onOpenSettings={() => setSettingsVisible(true)}
        isRefreshing={isRefreshing}
        lastUpdatedAt={lastUpdatedAt}
        dataFetchError={dataFetchError}
      />

      {/* Screen Content based on Active Tab */}
      <View style={styles.screenContainer}>
        {currentTab === 'overview' && (
          <HomeScreen
            items={items}
            briefing={briefing}
            favorites={preferences.favorites}
            onToggleFavorite={handleToggleFavorite}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            onNavigateTab={handleTabPress}
          />
        )}

        {currentTab === 'us' && (
          <UsMarketScreen
            items={items}
            briefing={briefing}
            favorites={preferences.favorites}
            onToggleFavorite={handleToggleFavorite}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            onGoBack={handleGoBack}
          />
        )}

        {currentTab === 'macro' && (
          <MacroScreen
            items={items}
            briefing={briefing}
            favorites={preferences.favorites}
            onToggleFavorite={handleToggleFavorite}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            onGoBack={handleGoBack}
          />
        )}

        {currentTab === 'events' && (
          <EconomicCalendarScreen onGoBack={handleGoBack} />
        )}
      </View>

      {/* Bottom Tab Bar Navigation */}
      <View style={[styles.tabBar, { paddingBottom: bottomInsetPadding }]}>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'overview' && styles.tabItemActive]}
          onPress={() => handleTabPress('overview')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'overview' ? 'sunny' : 'sunny-outline'}
            size={20}
            color={currentTab === 'overview' ? Theme.colors.activeTab : Theme.colors.inactiveTab}
          />
          <Text style={[styles.tabLabel, currentTab === 'overview' && styles.tabLabelActive]}>
            모닝 브리핑
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'us' && styles.tabItemActive]}
          onPress={() => handleTabPress('us')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'us' ? 'trending-up' : 'trending-up-outline'}
            size={20}
            color={currentTab === 'us' ? Theme.colors.activeTab : Theme.colors.inactiveTab}
          />
          <Text style={[styles.tabLabel, currentTab === 'us' && styles.tabLabelActive]}>
            미국 증시
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'macro' && styles.tabItemActive]}
          onPress={() => handleTabPress('macro')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'macro' ? 'globe' : 'globe-outline'}
            size={20}
            color={currentTab === 'macro' ? Theme.colors.activeTab : Theme.colors.inactiveTab}
          />
          <Text style={[styles.tabLabel, currentTab === 'macro' && styles.tabLabelActive]}>
            환율·매크로
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'events' && styles.tabItemActive]}
          onPress={() => handleTabPress('events')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'events' ? 'calendar' : 'calendar-outline'}
            size={20}
            color={currentTab === 'events' ? Theme.colors.activeTab : Theme.colors.inactiveTab}
          />
          <Text style={[styles.tabLabel, currentTab === 'events' && styles.tabLabelActive]}>
            경제 일정
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
      />

      {/* In-app notification popup */}
      <NotificationPopup popup={popup} onDismiss={() => setPopup(null)} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.tabBarBackground,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.tabBarBorder,
    paddingTop: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    transform: [{ scale: 1.06 }],
  },
  tabLabel: {
    fontSize: 11,
    color: Theme.colors.inactiveTab,
    marginTop: 4,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: Theme.colors.activeTab,
    fontWeight: 'bold',
  },
});
