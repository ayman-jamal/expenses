import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import TabIcon, { TabName } from './src/components/TabIcon';
import { AppProvider, useApp } from './src/lib/AppContext';
import AddScreen from './src/screens/AddScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import ConsScreen from './src/screens/ConsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { C, F } from './src/theme';

const TABS: { key: TabName; label: string }[] = [
  { key: 'add', label: 'Add' },
  { key: 'budget', label: 'Budget' },
  { key: 'history', label: 'History' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'cons', label: 'Cons' },
  { key: 'settings', label: 'Settings' },
];

function Shell() {
  const [tab, setTab] = useState<TabName>('add');
  const { ready, queue } = useApp();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View style={[st.root, st.center]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={{ flex: 1 }}>
        {tab === 'add' && <AddScreen goSettings={() => setTab('settings')} />}
        {tab === 'budget' && <BudgetScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'analysis' && <AnalysisScreen />}
        {tab === 'cons' && <ConsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      <View style={[st.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const badge = t.key === 'history' && queue.length > 0 ? queue.length : null;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={st.tab}
            >
              <View>
                <TabIcon name={t.key} color={active ? C.accent : C.textMuted} />
                {badge ? (
                  <View style={st.badge}>
                    <Text style={st.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[st.tabLabel, active && { color: C.accent }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { ...F.small, fontSize: 11 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: C.serious,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#0d0d0d', fontSize: 10, fontWeight: '700' },
});
