import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Theme } from './src/theme/theme';
import { MarketItem, MorningBriefing, UserPreferences } from './src/types/market';
import { getUsMarketTag, INITIAL_MARKET_ITEMS, INITIAL_MORNING_BRIEFING, MarketService } from './src/services/marketData';

import { Header } from './src/components/Header';
import { SettingsModal } from './src/components/SettingsModal';

import { HomeScreen } from './src/screens/HomeScreen';
import { KospiScreen } from './src/screens/KospiScreen';
import { UsMarketScreen } from './src/screens/UsMarketScreen';
import { MacroScreen } from './src/screens/MacroScreen';

type TabType = 'overview' | 'kospi' | 'us' | 'macro';

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

  useEffect(() => {
    loadInitialData();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const tag = getUsMarketTag();
      setItems((currentItems) => currentItems.map((item) => (
        item.category === 'us_index' ? { ...item, tag } : item
      )));
    }, 60_000);

    return () => clearInterval(timer);
  }, []);


  const loadInitialData = async () => {
    const [prefs, cachedItems, cachedBriefing] = await Promise.all([
      MarketService.getUserPreferences(),
      MarketService.getMarketItems(),
      MarketService.getMorningBriefing(),
    ]);
    setPreferences(prefs);
    setItems(cachedItems);
    setBriefing(cachedBriefing);
    if (prefs.defaultTab) {
      setCurrentTab(prefs.defaultTab);
    }
    // Fetch live market data on launch
    handleRefresh();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await MarketService.refreshData();
      setItems(result.items);
      setBriefing(result.briefing);
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

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
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setCurrentTab(tab);
  };

  const handleGoBack = () => {
    if (preferences.enableHaptics) {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setCurrentTab('overview');
  };

  const handleUpdatePreferences = async (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    await MarketService.saveUserPreferences(newPrefs);
  };

  // Dynamic bottom padding ensuring full clearance over Galaxy navigation bar (Home key/Gesture bar)
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

        {currentTab === 'kospi' && (
          <KospiScreen
            items={items}
            briefing={briefing}
            favorites={preferences.favorites}
            onToggleFavorite={handleToggleFavorite}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            onGoBack={handleGoBack}
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
      </View>

      {/* Bottom Tab Bar Navigation with Safe Margin */}
      <View style={[styles.tabBar, { paddingBottom: bottomInsetPadding }]}>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'overview' && styles.tabItemActive]}
          onPress={() => handleTabPress('overview')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'overview' ? 'sunny' : 'sunny-outline'}
            size={22}
            color={currentTab === 'overview' ? Theme.colors.activeTab : Theme.colors.inactiveTab}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'overview' && styles.tabLabelActive,
            ]}
          >
            모닝 브리핑
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'kospi' && styles.tabItemActive]}
          onPress={() => handleTabPress('kospi')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'kospi' ? 'moon' : 'moon-outline'}
            size={22}
            color={currentTab === 'kospi' ? Theme.colors.activeTab : Theme.colors.inactiveTab}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'kospi' && styles.tabLabelActive,
            ]}
          >
            코스피 야간
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'us' && styles.tabItemActive]}
          onPress={() => handleTabPress('us')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'us' ? 'trending-up' : 'trending-up-outline'}
            size={22}
            color={currentTab === 'us' ? Theme.colors.activeTab : Theme.colors.inactiveTab}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'us' && styles.tabLabelActive,
            ]}
          >
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
            size={22}
            color={currentTab === 'macro' ? Theme.colors.activeTab : Theme.colors.inactiveTab}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'macro' && styles.tabLabelActive,
            ]}
          >
            환율·매크로
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
