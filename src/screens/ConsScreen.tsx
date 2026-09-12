import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Bars from '../components/charts/Bars';
import LineChart from '../components/charts/Line';
import { Banner, Card, Chip, Empty, Row, SectionTitle, StatTile } from '../components/ui';
import { MIN_CONS_VERSION } from '../lib/api';
import { useApp } from '../lib/AppContext';
import { fromISO, money, prettyDate } from '../lib/format';
import { fuelTotals, Refill, refillsFrom } from '../lib/fuel';
import { C, F, S } from '../theme';

const num = (v: number, digits = 1) =>
  v.toLocaleString(undefined, { maximumFractionDigits: digits });

const day = (iso: string | null) => (iso ? String(fromISO(iso).getDate()) : '—');

export default function ConsScreen() {
  const { snapshot, refresh, refreshing, settings } = useApp();
  const { width } = useWindowDimensions();
  const [amountKind, setAmountKind] = useState<'liters' | 'cost'>('liters');
  const cur = settings.currency;
  const chartWidth = Math.max(width - S.lg * 2 - S.lg * 2, 220);

  const refills = useMemo(() => refillsFrom(snapshot?.entries ?? []), [snapshot]);
  const measured = useMemo(() => refills.filter((r) => r.km != null), [refills]);
  const totals = useMemo(() => fuelTotals(refills), [refills]);
  const outdated = !!snapshot && (snapshot.scriptVersion ?? 0) < MIN_CONS_VERSION;

  const reading = (r: Refill) =>
    r.liters != null && r.km != null ? `${num(r.liters, 2)} L · ${num(r.km)} km` : 'no reading';
  const sub = (r: Refill) => `${prettyDate(r.date)} · ${reading(r)}`;

  return (
    <ScrollView
      contentContainerStyle={st.page}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.textDim} />
      }
    >
      <Text style={st.title}>Consumption</Text>
      <Text style={[F.small, { marginBottom: S.md }]}>
        {snapshot ? snapshot.spreadsheetTitle : 'Pull down to load'}
      </Text>

      {outdated ? (
        <Banner
          tone="warn"
          text="Your Apps Script is older than this page. Paste the current Code.gs in, then Deploy → Manage deployments → edit → Version: New version, so the Cons column is read straight from the sheet."
        />
      ) : null}

      {!refills.length ? (
        <Empty
          title="No refills yet"
          body={'Add a Transportation expense with liters and km — its consumption shows up here.'}
        />
      ) : (
        <>
          <Row style={{ gap: S.sm, marginBottom: S.sm }}>
            <StatTile
              label="Average"
              value={totals.avgKmPerL != null ? num(totals.avgKmPerL) : '—'}
              sub="km/L"
            />
            <StatTile
              label="Distance"
              value={num(totals.km)}
              sub={`km · ${totals.measured} reading${totals.measured === 1 ? '' : 's'}`}
            />
            <StatTile label="Fuel" value={num(totals.liters, 2)} sub="liters" />
          </Row>
          <Row style={{ gap: S.sm, marginBottom: S.md }}>
            <StatTile
              label="Spent on fuel"
              value={money(totals.cost, cur)}
              sub={`${refills.length} refill${refills.length === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Cost per km"
              value={totals.costPerKm != null ? totals.costPerKm.toFixed(3) : '—'}
              sub={`${cur}/km`}
            />
          </Row>

          <Card>
            <SectionTitle title="km/L per refill" />
            <LineChart
              data={measured.map((r) => ({ label: day(r.date), value: r.kmPerL, sub: sub(r) }))}
              width={chartWidth}
              format={(v) => `${num(v)} km/L`}
              tickFormat={(v) => num(v)}
              reference={
                totals.avgKmPerL != null
                  ? { value: totals.avgKmPerL, label: `avg ${num(totals.avgKmPerL)}` }
                  : undefined
              }
            />
          </Card>

          <Card>
            <SectionTitle title="Km driven per refill" />
            <Bars
              data={measured.map((r) => ({ label: day(r.date), value: r.km!, sub: sub(r) }))}
              width={chartWidth}
              currency={cur}
              color={C.series[2]}
              format={(v) => `${num(v)} km`}
            />
          </Card>

          <Card>
            <SectionTitle
              title="Per refill"
              right={
                <Row style={{ gap: S.xs }}>
                  <Chip
                    label="Liters"
                    compact
                    selected={amountKind === 'liters'}
                    onPress={() => setAmountKind('liters')}
                  />
                  <Chip
                    label="Cost"
                    compact
                    selected={amountKind === 'cost'}
                    onPress={() => setAmountKind('cost')}
                  />
                </Row>
              }
            />
            {amountKind === 'liters' ? (
              <Bars
                key="liters"
                data={measured.map((r) => ({ label: day(r.date), value: r.liters!, sub: sub(r) }))}
                width={chartWidth}
                currency={cur}
                color={C.series[3]}
                format={(v) => `${num(v, 2)} L`}
              />
            ) : (
              <Bars
                key="cost"
                data={refills.map((r) => ({ label: day(r.date), value: r.cost, sub: sub(r) }))}
                width={chartWidth}
                currency={cur}
                color={C.series[1]}
              />
            )}
          </Card>

          <Card>
            <SectionTitle title="Cost per km" />
            <LineChart
              data={measured.map((r) => ({ label: day(r.date), value: r.costPerKm, sub: sub(r) }))}
              width={chartWidth}
              color={C.series[4]}
              format={(v) => `${v.toFixed(3)} ${cur}/km`}
              tickFormat={(v) => v.toFixed(3)}
            />
          </Card>

          {/* The table behind the charts; km/L comes from the sheet's Cons column. */}
          <Card>
            <SectionTitle title="Refills" />
            {[...refills].reverse().map((r) => (
              <Row key={r.row} style={st.refillRow}>
                <View style={{ flex: 1 }}>
                  <Text style={F.body}>{prettyDate(r.date)}</Text>
                  <Text style={F.small}>
                    {reading(r)} · {money(r.cost, cur)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.cons}>{r.kmPerL != null ? num(r.kmPerL) : '—'}</Text>
                  <Text style={F.small}>km/L</Text>
                </View>
              </Row>
            ))}
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
  refillRow: {
    paddingVertical: S.sm,
    gap: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.grid,
  },
  cons: { fontSize: 20, fontWeight: '700', color: C.text, ...F.mono },
});
