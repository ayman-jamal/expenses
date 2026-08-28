import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Banner, Button, Card, Chip, HScroll, Row, SectionTitle } from '../components/ui';
import { useApp } from '../lib/AppContext';
import { fromISO, isRTL, money, prettyDate, todayISO, toISO } from '../lib/format';
import { C, F, S, seriesColor } from '../theme';

const FALLBACK_CATEGORIES = [
  'fast food',
  'market',
  'Transportation',
  'others',
  'clothes',
  'gift',
  'SADAQA',
  'MOM',
  'Family Support',
  'Saving',
  'Monthly Instalment',
];

export default function AddScreen({ goSettings }: { goSettings: () => void }) {
  const {
    snapshot,
    activeSheet,
    settings,
    addEntry,
    favorites,
    addFavorite,
    online,
    pendingHere,
    configured,
    error,
    syncing,
  } = useApp();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [showPicker, setShowPicker] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (snapshot?.categories?.length) return snapshot.categories;
    return FALLBACK_CATEGORIES.map((name) => ({ name, bucket: null }));
  }, [snapshot]);

  const colorFor = (name: string) => {
    const i = categories.findIndex((c) => c.name === name);
    return seriesColor(i % 6);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof categories>();
    categories.forEach((c) => {
      const key = c.bucket || 'Other categories';
      map.set(key, [...(map.get(key) || []), c]);
    });
    return Array.from(map.entries());
  }, [categories]);

  const value = Number(String(amount).replace(',', '.'));
  const valid = !!category && isFinite(value) && value > 0;

  const reset = () => {
    setAmount('');
    setNote('');
    setCategory(null);
    setDate(todayISO());
  };

  const submit = async (payload?: { category: string; cost: number; note?: string }) => {
    const entry = payload
      ? { date, category: payload.category, cost: payload.cost, note: payload.note || '' }
      : { date, category: category!, cost: value, note: note.trim() };

    const okToSave = await addEntry(entry);
    if (!okToSave) {
      Alert.alert('No sheet selected', 'Add your month sheet link in Settings first.');
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setJustSaved(`${entry.category} · ${money(entry.cost, settings.currency)}`);
    setTimeout(() => setJustSaved(null), 2600);
    reset();
  };

  const saveFavorite = () => {
    if (!valid) return;
    void addFavorite({
      label: `${category} ${amount}`,
      category: category!,
      cost: value,
      note: note.trim(),
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!configured) {
    return (
      <ScrollView contentContainerStyle={st.page}>
        <Text style={st.title}>Masareef</Text>
        <Card>
          <Text style={F.h3}>Let's connect your sheet</Text>
          <Text style={[F.small, { marginTop: 6, lineHeight: 18 }]}>
            You need two things: the script URL you deployed from your sheet, and the share
            link of the month you're recording. Both live in Settings.
          </Text>
          <Button label="Open Settings" onPress={goSettings} style={{ marginTop: S.lg }} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
        <Row style={{ justifyContent: 'space-between', marginBottom: S.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>Add expense</Text>
            <Text style={F.small} numberOfLines={1}>
              {activeSheet?.label} · {snapshot?.entryTab ? `tab "${snapshot.entryTab}"` : 'not synced yet'}
            </Text>
          </View>
          <StatusPill
            online={online}
            syncing={syncing}
            pending={pendingHere.length}
          />
        </Row>

        {justSaved ? <Banner tone="info" text={`Saved — ${justSaved}`} /> : null}
        {error && pendingHere.length > 0 ? <Banner tone="warn" text={error} /> : null}

        <Card>
          <Text style={F.small}>Amount</Text>
          <Row style={{ alignItems: 'baseline', gap: S.sm }}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={C.textMuted}
              keyboardType="decimal-pad"
              style={st.amount}
              accessibilityLabel="Expense amount"
            />
            <Text style={st.currency}>{settings.currency}</Text>
          </Row>

          <Row style={{ gap: S.sm, marginTop: S.md }}>
            <DateChip label="Today" active={date === todayISO()} onPress={() => setDate(todayISO())} />
            <DateChip
              label="Yesterday"
              active={date === yesterday()}
              onPress={() => setDate(yesterday())}
            />
            <Pressable onPress={() => setShowPicker(true)} style={st.dateBtn}>
              <Text style={{ color: C.textDim, fontSize: 13 }}>{prettyDate(date)} ▾</Text>
            </Pressable>
          </Row>

          {showPicker ? (
            <DateTimePicker
              value={fromISO(date)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, d) => {
                setShowPicker(Platform.OS === 'ios');
                if (d) setDate(toISO(d));
              }}
            />
          ) : null}
        </Card>

        <SectionTitle title="Category" />
        {grouped.map(([bucket, items]) => (
          <View key={bucket} style={{ marginBottom: S.md }}>
            <Text style={st.groupLabel}>{bucket}</Text>
            <View style={st.chipWrap}>
              {items.map((c) => (
                <Chip
                  key={c.name}
                  label={c.name}
                  color={colorFor(c.name)}
                  selected={category === c.name}
                  onPress={() => {
                    setCategory(c.name);
                    void Haptics.selectionAsync();
                  }}
                />
              ))}
            </View>
          </View>
        ))}

        <SectionTitle title="Note" />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional — e.g. شاورما أبو زاد"
          placeholderTextColor={C.textMuted}
          style={[st.note, isRTL(note) && { textAlign: 'right' }]}
          multiline
        />

        {favorites.length > 0 ? (
          <>
            <SectionTitle title="Quick add" />
            <HScroll>
              {favorites.map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  color={colorFor(f.category)}
                  sub={f.cost != null ? money(f.cost, '') : undefined}
                  onPress={() => {
                    setCategory(f.category);
                    if (f.cost != null) setAmount(String(f.cost));
                    if (f.note) setNote(f.note);
                    void Haptics.selectionAsync();
                  }}
                  onLongPress={() => {
                    if (f.cost == null) return;
                    void submit({ category: f.category, cost: f.cost, note: f.note });
                  }}
                />
              ))}
            </HScroll>
            <Text style={[F.small, { marginTop: 6 }]}>
              Tap to fill the form · hold to record it straight away
            </Text>
          </>
        ) : null}

        <View style={{ height: S.lg }} />
        <Button label="Save to sheet" onPress={() => submit()} disabled={!valid} />
        <Button
          label="Save this as a quick-add"
          variant="ghost"
          onPress={saveFavorite}
          disabled={!valid}
          style={{ marginTop: S.sm }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISO(d);
}

function DateChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        st.dateBtn,
        active && { borderColor: C.accent, backgroundColor: C.accentSoft },
      ]}
    >
      <Text style={{ color: active ? C.text : C.textDim, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({
  online,
  syncing,
  pending,
}: {
  online: boolean;
  syncing: boolean;
  pending: number;
}) {
  const tone = !online ? C.warning : pending > 0 ? C.serious : C.good;
  const text = syncing
    ? 'Syncing…'
    : !online
    ? pending > 0
      ? `Offline · ${pending}`
      : 'Offline'
    : pending > 0
    ? `${pending} queued`
    : 'Synced';
  return (
    <View style={[st.pill, { borderColor: tone }]}>
      <View style={[st.pillDot, { backgroundColor: tone }]} />
      <Text style={{ color: C.textDim, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  page: { padding: S.lg, paddingTop: S.sm },
  title: { ...F.h1, marginBottom: 2 },
  amount: {
    flex: 1,
    color: C.text,
    fontSize: 44,
    fontWeight: '700',
    paddingVertical: 4,
  },
  currency: { color: C.textMuted, fontSize: 18, fontWeight: '600' },
  dateBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: C.surfaceAlt,
  },
  groupLabel: { ...F.small, marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  note: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: S.radiusSm,
    padding: S.md,
    color: C.text,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
});
