import React, { useMemo } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Banner, Empty, Row } from '../components/ui';
import { useApp } from '../lib/AppContext';
import { isRTL, money, prettyDate } from '../lib/format';
import { C, F, S, seriesColor } from '../theme';
import { Entry, Pending } from '../lib/types';

type Item =
  | { kind: 'entry'; entry: Entry }
  | { kind: 'pending'; pending: Pending };

export default function HistoryScreen() {
  const { snapshot, pendingHere, refresh, refreshing, settings, discardPending, flush, error } =
    useApp();
  const cur = settings.currency;

  const colorFor = (name: string) => {
    const list = snapshot?.categories ?? [];
    const i = list.findIndex((c) => c.name === name);
    return i >= 0 ? seriesColor(i % 6) : C.other;
  };

  const sections = useMemo(() => {
    const out: { title: string; data: Item[] }[] = [];

    if (pendingHere.length) {
      out.push({
        title: `Waiting to sync (${pendingHere.length})`,
        data: pendingHere.map((p) => ({ kind: 'pending' as const, pending: p })),
      });
    }

    const entries = [...(snapshot?.entries ?? [])].reverse();
    const byDate = new Map<string, Item[]>();
    entries.forEach((e) => {
      const key = e.date || 'No date';
      byDate.set(key, [...(byDate.get(key) || []), { kind: 'entry', entry: e }]);
    });
    byDate.forEach((data, key) =>
      out.push({ title: key === 'No date' ? 'No date' : prettyDate(key), data })
    );

    return out;
  }, [snapshot, pendingHere]);

  return (
    <View style={{ flex: 1 }}>
      <View style={st.header}>
        <Text style={st.title}>History</Text>
        <Text style={F.small}>
          {snapshot ? `${snapshot.entries.length} rows in "${snapshot.entryTab}"` : 'Not loaded'}
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, i) =>
          item.kind === 'pending' ? item.pending.clientId : `r${item.entry.row}-${i}`
        }
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.textDim} />
        }
        ListHeaderComponent={
          error && pendingHere.length > 0 ? (
            <Banner
              tone="warn"
              text={error}
              action={
                <Pressable onPress={flush}>
                  <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>Retry</Text>
                </Pressable>
              }
            />
          ) : null
        }
        ListEmptyComponent={
          <Empty
            title="No entries yet"
            body="Anything you add will show up here, newest first."
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={st.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) =>
          item.kind === 'pending' ? (
            <Pressable
              onLongPress={() =>
                Alert.alert(
                  'Discard this entry?',
                  `${item.pending.category} · ${money(item.pending.cost, cur)} — it has not reached the sheet.`,
                  [
                    { text: 'Keep', style: 'cancel' },
                    {
                      text: 'Discard',
                      style: 'destructive',
                      onPress: () => discardPending(item.pending.clientId),
                    },
                  ]
                )
              }
              style={[st.row, st.pendingRow]}
            >
              <View style={[st.dot, { backgroundColor: C.serious }]} />
              <View style={{ flex: 1 }}>
                <Text style={F.body}>{item.pending.category}</Text>
                <Text style={F.small}>
                  {prettyDate(item.pending.date)} · queued
                  {item.pending.lastError ? ' · failed, will retry' : ''}
                </Text>
              </View>
              <Text style={st.amount}>{money(item.pending.cost, cur)}</Text>
            </Pressable>
          ) : (
            <View style={st.row}>
              <View style={[st.dot, { backgroundColor: colorFor(item.entry.category) }]} />
              <View style={{ flex: 1 }}>
                <Text style={F.body}>{item.entry.category || '—'}</Text>
                {item.entry.note ? (
                  <Text
                    style={[F.small, isRTL(item.entry.note) && { textAlign: 'right' }]}
                    numberOfLines={2}
                  >
                    {item.entry.note}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={st.amount}>{money(item.entry.cost, cur)}</Text>
                <Text style={st.rowNum}>row {item.entry.row}</Text>
              </View>
            </View>
          )
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  header: { paddingHorizontal: S.lg, paddingBottom: S.md, paddingTop: S.sm },
  title: { ...F.h1 },
  sectionHeader: {
    ...F.small,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: S.lg,
    marginBottom: S.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: S.radiusSm,
    padding: S.md,
    marginTop: 6,
  },
  pendingRow: { borderColor: C.serious, borderStyle: 'dashed' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  amount: { ...F.body, fontWeight: '700', ...F.mono },
  rowNum: { ...F.small, fontSize: 11 },
});
