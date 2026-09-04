import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { C, F, S } from '../theme';

export const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[st.card, style]}>{children}</View>;

export const SectionTitle = ({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) => (
  <View style={st.sectionRow}>
    <Text style={st.sectionTitle}>{title}</Text>
    {right}
  </View>
);

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const bg =
    variant === 'primary' ? C.accent : variant === 'danger' ? 'transparent' : 'transparent';
  const border =
    variant === 'primary' ? C.accent : variant === 'danger' ? C.critical : C.borderStrong;
  const fg = variant === 'primary' ? '#ffffff' : variant === 'danger' ? C.critical : C.textDim;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        st.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[st.btnText, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
};

/**
 * `compact` shrinks the chip so a full category list fits on one screen. The
 * hitSlop puts the touch target back to ~40px; 4px top/bottom is deliberate —
 * it exactly consumes `Wrap`'s 8px row gap, so chips on adjacent rows never
 * overlap each other's target and steal taps.
 */
export const Chip = ({
  label,
  selected,
  onPress,
  onLongPress,
  color,
  sub,
  compact,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  color?: string;
  sub?: string;
  compact?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: !!selected }}
    onPress={onPress}
    onLongPress={onLongPress}
    hitSlop={compact ? { top: 4, bottom: 4, left: 2, right: 2 } : undefined}
    style={({ pressed }) => [
      st.chip,
      compact && st.chipCompact,
      {
        backgroundColor: selected ? C.accentSoft : C.surfaceAlt,
        borderColor: selected ? C.accent : C.border,
        opacity: pressed ? 0.7 : 1,
      },
    ]}
  >
    {color ? (
      <View style={[st.dot, compact && st.dotCompact, { backgroundColor: color }]} />
    ) : null}
    <Text
      style={[st.chipText, compact && st.chipTextCompact, { color: selected ? C.text : C.textDim }]}
      numberOfLines={1}
    >
      {label}
    </Text>
    {sub ? <Text style={st.chipSub}>{sub}</Text> : null}
  </Pressable>
);

export const Field = ({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) => (
  <View style={{ marginBottom: S.md }}>
    <Text style={st.label}>{label}</Text>
    <TextInput
      placeholderTextColor={C.textMuted}
      {...props}
      style={[st.input, props.style]}
    />
    {hint ? <Text style={st.hint}>{hint}</Text> : null}
  </View>
);

/** Budget progress. Over-budget switches to the reserved critical color AND
 *  gains an explicit "over" label, so state is never carried by color alone. */
export const ProgressBar = ({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color?: string;
}) => {
  const ratio = max > 0 ? value / max : value > 0 ? 1 : 0;
  const over = ratio > 1;
  const fill = Math.max(0, Math.min(1, ratio));
  return (
    <View style={st.track}>
      <View
        style={[
          st.fill,
          { width: `${fill * 100}%`, backgroundColor: over ? C.critical : color || C.accent },
        ]}
      />
    </View>
  );
};

export const StatTile = ({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'critical' | 'neutral';
  sub?: string;
}) => (
  <View style={st.tile}>
    <Text style={st.tileLabel}>{label}</Text>
    <Text
      style={[
        st.tileValue,
        tone === 'good' && { color: C.good },
        tone === 'critical' && { color: C.critical },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
    {sub ? <Text style={st.tileSub}>{sub}</Text> : null}
  </View>
);

export const Banner = ({
  tone,
  text,
  action,
}: {
  tone: 'info' | 'warn' | 'error';
  text: string;
  action?: React.ReactNode;
}) => {
  const border = tone === 'error' ? C.critical : tone === 'warn' ? C.warning : C.accent;
  const icon = tone === 'error' ? '!' : tone === 'warn' ? '!' : 'i';
  return (
    <View style={[st.banner, { borderColor: border }]}>
      <View style={[st.bannerIcon, { borderColor: border }]}>
        <Text style={{ color: border, fontWeight: '700', fontSize: 12 }}>{icon}</Text>
      </View>
      <Text style={st.bannerText}>{text}</Text>
      {action}
    </View>
  );
};

export const Empty = ({ title, body }: { title: string; body?: string }) => (
  <View style={st.empty}>
    <Text style={st.emptyTitle}>{title}</Text>
    {body ? <Text style={st.emptyBody}>{body}</Text> : null}
  </View>
);

export const Row = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;

export const Wrap = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>{children}</View>
);

export const HScroll = ({ children }: { children: React.ReactNode }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ gap: S.sm, paddingRight: S.lg }}
  >
    {children}
  </ScrollView>
);

const st = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.lg,
    marginBottom: S.md,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.sm,
    marginTop: S.xs,
  },
  sectionTitle: { ...F.h3, letterSpacing: 0.2 },
  btn: {
    borderRadius: S.radiusSm,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: S.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipCompact: { gap: 5, paddingVertical: 6, paddingHorizontal: 11 },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipTextCompact: { fontSize: 13 },
  chipSub: { fontSize: 12, color: C.textMuted, ...F.mono },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotCompact: { width: 7, height: 7, borderRadius: 3.5 },
  label: { ...F.small, marginBottom: 6, color: C.textDim },
  hint: { ...F.small, marginTop: 5 },
  input: {
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: S.radiusSm,
    paddingHorizontal: S.md,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.surfaceHi,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  tile: {
    flex: 1,
    backgroundColor: C.surfaceAlt,
    borderRadius: S.radiusSm,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  tileLabel: { ...F.small, marginBottom: 4 },
  tileValue: { fontSize: 19, fontWeight: '700', color: C.text },
  tileSub: { ...F.small, marginTop: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    borderWidth: 1,
    borderRadius: S.radiusSm,
    padding: S.md,
    marginBottom: S.md,
    backgroundColor: C.surface,
  },
  bannerIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1, color: C.textDim, fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: S.xxl, paddingHorizontal: S.lg },
  emptyTitle: { ...F.h3, marginBottom: 6, textAlign: 'center' },
  emptyBody: { ...F.small, textAlign: 'center', lineHeight: 18 },
});
