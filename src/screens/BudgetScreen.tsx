import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Card, Empty, ProgressBar, Row, SectionTitle, StatTile } from '../components/ui';
import { useApp } from '../lib/AppContext';
import { money } from '../lib/format';
import { C, F, S, seriesColor } from '../theme';

export default function BudgetScreen() {
  const { snapshot, refresh, refreshing, settings, error, pendingHere } = useApp();
  const cur = settings.currency;

  const buckets = snapshot?.buckets ?? [];
  const budgeted = buckets.filter((b) => b.budget > 0);
  const tracked = buckets.filter((b) => b.budget <= 0);

  const totalBudget = budgeted.reduce((s, b) => s + b.budget, 0);
  const totalSpent = budgeted.reduce((s, b) => s + b.spent, 0);
  const salary = snapshot?.summary?.salary ?? null;
  const remain = snapshot?.summary?.remain ?? null;

  return (
    <ScrollView
      contentContainerStyle={st.page}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.textDim} />
      }
    >
      <Text style={st.title}>Budget</Text>
      <Text style={[F.small, { marginBottom: S.lg }]}>
        {snapshot
          ? `${snapshot.spreadsheetTitle} · updated ${new Date(snapshot.fetchedAt).toLocaleTimeString()}`
          : 'Pull down to load from your sheet'}
      </Text>

      {error ? <Banner tone="error" text={error} /> : null}
      {pendingHere.length > 0 ? (
        <Banner
          tone="warn"
          text={`${pendingHere.length} entr${pendingHere.length === 1 ? 'y is' : 'ies are'} still waiting to sync, so these totals don't include them yet.`}
        />
      ) : null}

      {!snapshot ? (
        <Empty title="Nothing loaded yet" body="Pull down to fetch your buckets from the sheet." />
      ) : (
        <>
          <Row style={{ gap: S.sm, marginBottom: S.md }}>
            <StatTile label="Income" value={money(salary, cur)} />
            <StatTile
              label="Spent"
              value={money(snapshot.summary.totalExpenses, cur)}
            />
            <StatTile
              label="Remaining"
              value={money(remain, cur)}
              tone={remain != null && remain < 0 ? 'critical' : 'good'}
            />
          </Row>

          <Card>
            <Row style={{ justifyContent: 'space-between', marginBottom: S.sm }}>
              <Text style={F.h3}>All budgets</Text>
              <Text style={st.ratio}>
                {money(totalSpent, '')} / {money(totalBudget, cur)}
              </Text>
            </Row>
            <ProgressBar value={totalSpent} max={totalBudget} />
            <Text style={[F.small, { marginTop: S.sm }]}>
              {totalBudget > 0
                ? totalSpent > totalBudget
                  ? `Over by ${money(totalSpent - totalBudget, cur)}`
                  : `${money(totalBudget - totalSpent, cur)} left across all buckets`
                : 'No budgets set in the BUCKETS tab'}
            </Text>
          </Card>

          <SectionTitle title="By bucket" />
          {budgeted.map((b, i) => (
            <BucketRow key={b.name} bucket={b} color={seriesColor(i % 6)} currency={cur} />
          ))}

          {tracked.length > 0 ? (
            <>
              <SectionTitle title="Tracked, no budget set" />
              {tracked.map((b) => (
                <Card key={b.name} style={{ paddingVertical: S.md }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={F.body}>{b.name}</Text>
                    <Text style={st.value}>{money(b.spent, cur)}</Text>
                  </Row>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function BucketRow({
  bucket,
  color,
  currency,
}: {
  bucket: { name: string; budget: number; spent: number; categories: string[] };
  color: string;
  currency: string;
}) {
  const left = bucket.budget - bucket.spent;
  const over = left < 0;
  const ratio = bucket.budget > 0 ? bucket.spent / bucket.budget : 0;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <Row style={{ gap: S.sm, flex: 1 }}>
          <View style={[st.dot, { backgroundColor: over ? C.critical : color }]} />
          <Text style={F.h3} numberOfLines={1}>
            {bucket.name}
          </Text>
        </Row>
        <Text style={st.ratio}>
          {money(bucket.spent, '')} / {money(bucket.budget, currency)}
        </Text>
      </Row>

      <ProgressBar value={bucket.spent} max={bucket.budget} color={color} />

      <Row style={{ justifyContent: 'space-between', marginTop: S.sm }}>
        {/* State is labelled, never carried by colour alone. */}
        <Text style={[F.small, over && { color: C.critical, fontWeight: '600' }]}>
          {over ? `Over budget by ${money(-left, currency)}` : `${money(left, currency)} left`}
        </Text>
        <Text style={F.small}>{(ratio * 100).toFixed(0)}% used</Text>
      </Row>

      {bucket.categories.length > 1 ? (
        <Text style={[F.small, { marginTop: S.sm }]} numberOfLines={2}>
          Feeds from: {bucket.categories.join(', ')}
        </Text>
      ) : null}
    </Card>
  );
}

const st = StyleSheet.create({
  page: { padding: S.lg, paddingTop: S.sm },
  title: { ...F.h1 },
  ratio: { ...F.small, ...F.mono },
  value: { ...F.body, fontWeight: '600', ...F.mono },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
