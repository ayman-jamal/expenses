import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Bars, { Bar } from '../components/charts/Bars';
import Donut, { Slice } from '../components/charts/Donut';
import { Card, Chip, Empty, Row, SectionTitle, StatTile } from '../components/ui';
import { useApp } from '../lib/AppContext';
import { fromISO, money, prettyDate, toISO } from '../lib/format';
import { C, F, S, seriesColor } from '../theme';

type RangeKey = 'sheet' | 'month' | 'last14';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'sheet', label: 'Whole sheet' },
  { key: 'month', label: 'This month' },
  { key: 'last14', label: 'Last 14 days' },
];

export default function AnalysisScreen() {
  const { snapshot, refresh, refreshing, settings } = useApp();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<RangeKey>('sheet');
  const cur = settings.currency;
  const chartWidth = Math.max(width - S.lg * 2 - S.lg * 2, 220);

  const entries = useMemo(() => {
    const all = (snapshot?.entries ?? []).filter((e) => e.cost > 0 && e.date);
    if (range === 'sheet') return all;
    const now = new Date();
    if (range === 'month') {
      const prefix = toISO(now).slice(0, 7);
      return all.filter((e) => (e.date || '').startsWith(prefix));
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 13);
    const c = toISO(cutoff);
    return all.filter((e) => (e.date || '') >= c);
  }, [snapshot, range]);

  const total = entries.reduce((s, e) => s + e.cost, 0);

  /* ---- category shares: top 5 by value, everything else folded to Other ---- */
  const slices: Slice[] = useMemo(() => {
    const byCat = new Map<string, number>();
    entries.forEach((e) => byCat.set(e.category || '—', (byCat.get(e.category || '—') || 0) + e.cost));
    const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([label, value], i) => ({
      label,
      value,
      color: seriesColor(i),
    }));
    const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    return rest > 0 ? [...top, { label: `Other (${sorted.length - 5})`, value: rest, color: C.other }] : top;
  }, [entries]);

  /* ---- daily totals across the covered span ---- */
  const daily: Bar[] = useMemo(() => {
    if (!entries.length) return [];
    const dates = entries.map((e) => e.date!).sort();
    const start = fromISO(dates[0]);
    const end = fromISO(dates[dates.length - 1]);
    const byDay = new Map<string, number>();
    entries.forEach((e) => byDay.set(e.date!, (byDay.get(e.date!) || 0) + e.cost));

    const out: Bar[] = [];
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= end && guard++ < 400) {
      const iso = toISO(cursor);
      out.push({
        label: String(cursor.getDate()),
        value: byDay.get(iso) || 0,
        sub: prettyDate(iso),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [entries]);

  const activeDays = daily.filter((d) => d.value > 0).length;
  const biggest = entries.reduce(
    (best, e) => (e.cost > (best?.cost ?? 0) ? e : best),
    null as (typeof entries)[number] | null
  );

  /* ---- budget vs actual, straight from the BUCKETS tab ---- */
  const budgetBars = (snapshot?.buckets ?? []).filter((b) => b.budget > 0);

  return (
    <ScrollView
      contentContainerStyle={st.page}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.textDim} />
      }
    >
      <Text style={st.title}>Analysis</Text>
      <Text style={[F.small, { marginBottom: S.md }]}>
        {snapshot ? snapshot.spreadsheetTitle : 'Pull down to load'}
      </Text>

      <Row style={{ gap: S.sm, marginBottom: S.lg }}>
        {RANGES.map((r) => (
          <Chip
            key={r.key}
            label={r.label}
            selected={range === r.key}
            onPress={() => setRange(r.key)}
          />
        ))}
      </Row>

      {!entries.length ? (
        <Empty
          title="No spending in this range"
          body="Try a wider range, or pull down to refresh from the sheet."
        />
      ) : (
        <>
          <Row style={{ gap: S.sm, marginBottom: S.md }}>
            <StatTile label="Total" value={money(total, cur)} />
            <StatTile
              label="Per active day"
              value={money(activeDays ? total / activeDays : 0, cur)}
              sub={`${activeDays} day${activeDays === 1 ? '' : 's'}`}
            />
            <StatTile label="Entries" value={String(entries.length)} />
          </Row>

          <Card>
            <SectionTitle title="Where it goes" />
            <Donut data={slices} currency={cur} caption="Total" />
          </Card>

          <Card>
            <SectionTitle title="Daily spending" />
            <Bars data={daily} width={chartWidth} currency={cur} />
          </Card>

          {budgetBars.length > 0 ? (
            <Card>
              <SectionTitle title="Budget vs actual" />
              <Bars
                data={budgetBars.map((b) => ({
                  label: b.name.length > 6 ? b.name.slice(0, 6) : b.name,
                  value: b.spent,
                  sub: `${b.name} — budget ${money(b.budget, cur)}`,
                }))}
                width={chartWidth}
                currency={cur}
                color={C.series[2]}
                everyNthLabel={1}
              />
              <View style={{ marginTop: S.md, gap: 6 }}>
                {budgetBars.map((b) => {
                  const over = b.spent > b.budget;
                  return (
                    <Row key={b.name} style={{ justifyContent: 'space-between' }}>
                      <Text style={F.small} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text
                        style={[
                          st.delta,
                          { color: over ? C.critical : C.good },
                        ]}
                      >
                        {over
                          ? `over by ${money(b.spent - b.budget, cur)}`
                          : `${money(b.budget - b.spent, cur)} left`}
                      </Text>
                    </Row>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {biggest ? (
            <Card>
              <SectionTitle title="Biggest single expense" />
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={F.h3}>{biggest.category}</Text>
                  <Text style={F.small}>
                    {prettyDate(biggest.date)}
                    {biggest.note ? ` · ${biggest.note}` : ''}
                  </Text>
                </View>
                <Text style={st.big}>{money(biggest.cost, cur)}</Text>
              </Row>
            </Card>
          ) : null}

          {/* The table view — the numbers behind every chart above. */}
          <Card>
            <SectionTitle title="By category" />
            {slices.map((s) => (
              <Row key={s.label} style={st.tableRow}>
                <View style={[st.swatch, { backgroundColor: s.color }]} />
                <Text style={[F.dim, { flex: 1 }]} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={st.tablePct}>{((s.value / total) * 100).toFixed(0)}%</Text>
                <Text style={st.tableValue}>{money(s.value, cur)}</Text>
              </Row>
            ))}
            <Row style={[st.tableRow, { borderTopWidth: 1, borderTopColor: C.axis, marginTop: 4 }]}>
              <View style={{ width: 10 }} />
              <Text style={[F.body, { flex: 1, fontWeight: '600' }]}>Total</Text>
              <Text style={st.tableValue}>{money(total, cur)}</Text>
            </Row>
          </Card>
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: S.lg, paddingTop: S.sm },
  title: { ...F.h1 },
  delta: { fontSize: 12, fontWeight: '600' },
  big: { fontSize: 20, fontWeight: '700', color: C.text },
  tableRow: { paddingVertical: 7, gap: S.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  tablePct: { ...F.small, width: 38, textAlign: 'right' },
  tableValue: { ...F.body, fontWeight: '600', width: 90, textAlign: 'right' },
});
