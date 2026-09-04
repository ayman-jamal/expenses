import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Banner, Button, Empty, Row } from '../components/ui';
import { useApp } from '../lib/AppContext';
import { isRTL, money, prettyDate } from '../lib/format';
import { C, F, S, seriesColor } from '../theme';
import { Entry, Pending } from '../lib/types';

type Item =
  | { kind: 'entry'; entry: Entry }
  | { kind: 'pending'; pending: Pending };

export default function HistoryScreen() {
  const {
    snapshot,
    pendingHere,
    refresh,
    refreshing,
    settings,
    discardPending,
    flush,
    error,
    removeEntries,
    removing,
    canRemove,
    activeSheet,
  } = useApp();
  const cur = settings.currency;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const selecting = selected.size > 0;

  // Row numbers only mean something for one fetch of one sheet. A refresh or a
  // sheet switch can put something else at those numbers, so never carry a
  // selection across either — that is the whole guard against deleting the
  // wrong expense.
  useEffect(() => {
    setSelected(new Set());
  }, [activeSheet?.id, snapshot?.fetchedAt]);

  const toggle = (row: number) =>
    setSelected((cur2) => {
      const next = new Set(cur2);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });

  const beginSelect = (row: number) => {
    if (!canRemove) {
      Alert.alert(
        'Update the script first',
        'Deleting entries needs a newer Code.gs than your deployment is running. Paste the current Code.gs into Apps Script, then Deploy → Manage deployments → edit → Version: New version. The /exec URL stays the same.'
      );
      return;
    }
    setSelected(new Set([row]));
  };

  const confirmDelete = () => {
    const targets = (snapshot?.entries ?? [])
      .filter((e) => selected.has(e.row))
      .map((e) => ({ row: e.row, category: e.category, cost: e.cost }));
    if (!targets.length) return;

    Alert.alert(
      targets.length === 1 ? 'Delete this entry?' : `Delete ${targets.length} entries?`,
      'This clears the cells in your sheet. Nothing shifts, so your totals stay put and a blank gap is left behind. The app cannot undo it — Google Sheets keeps its own version history if you ever need it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await removeEntries(targets);
            if (res.ok) setSelected(new Set());
            else Alert.alert('Nothing was deleted', res.message);
          },
        },
      ]
    );
  };

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
      {selecting ? (
        <Row style={[st.header, { justifyContent: 'space-between', gap: S.md }]}>
          <Pressable onPress={() => setSelected(new Set())} accessibilityRole="button">
            <Text style={{ color: C.textDim, fontSize: 15 }}>Cancel</Text>
          </Pressable>
          <Text style={F.h3}>{selected.size} selected</Text>
          <Button
            label="Delete"
            variant="danger"
            onPress={confirmDelete}
            loading={removing}
            disabled={removing}
          />
        </Row>
      ) : (
        <View style={st.header}>
          <Text style={st.title}>History</Text>
          <Text style={F.small}>
            {snapshot ? `${snapshot.entries.length} rows in "${snapshot.entryTab}"` : 'Not loaded'}
            {snapshot && canRemove ? ' · hold a row to delete' : ''}
          </Text>
        </View>
      )}

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
            <Pressable
              onPress={() => (selecting ? toggle(item.entry.row) : undefined)}
              onLongPress={() => beginSelect(item.entry.row)}
              accessibilityRole={selecting ? 'checkbox' : 'button'}
              accessibilityState={{ checked: selected.has(item.entry.row) }}
              style={[st.row, selected.has(item.entry.row) && st.rowSelected]}
            >
              {/* While selecting, a checkbox replaces the category dot so the
                  picked state is never carried by colour alone. */}
              {selecting ? (
                <View
                  style={[st.check, selected.has(item.entry.row) && st.checkOn]}
                >
                  {selected.has(item.entry.row) ? <Text style={st.checkMark}>✓</Text> : null}
                </View>
              ) : (
                <View style={[st.dot, { backgroundColor: colorFor(item.entry.category) }]} />
              )}
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
            </Pressable>
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
  rowSelected: { borderColor: C.accent, backgroundColor: C.accentSoft },
  dot: { width: 10, height: 10, borderRadius: 5 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { borderColor: C.accent, backgroundColor: C.accent },
  checkMark: { color: '#ffffff', fontSize: 12, fontWeight: '700', lineHeight: 14 },
  amount: { ...F.body, fontWeight: '700', ...F.mono },
  rowNum: { ...F.small, fontSize: 11 },
});
