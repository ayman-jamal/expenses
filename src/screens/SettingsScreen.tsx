import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Banner, Button, Card, Chip, Field, Row, SectionTitle } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useApp } from '../lib/AppContext';
import { money } from '../lib/format';
import { C, F, S } from '../theme';

export default function SettingsScreen() {
  const {
    settings,
    saveSettings,
    addSheet,
    updateSheet,
    removeSheet,
    setActiveSheet,
    refresh,
    queue,
    flush,
    syncing,
    favorites,
    removeFavorite,
    snapshot,
  } = useApp();

  const [scriptUrl, setScriptUrl] = useState(settings.scriptUrl);
  const [token, setToken] = useState(settings.token);
  const [currency, setCurrency] = useState(settings.currency);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setScriptUrl(settings.scriptUrl);
    setToken(settings.token);
    setCurrency(settings.currency);
  }, [settings.scriptUrl, settings.token, settings.currency]);

  const saveConnection = async () => {
    await saveSettings({
      scriptUrl: scriptUrl.trim(),
      token: token.trim(),
      currency: currency.trim(),
    });
    setTestResult(null);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await saveConnection();
      const res = await api.ping(scriptUrl.trim(), token.trim());
      setTestResult({
        ok: true,
        text: `Connected${res.user ? ` as ${res.user}` : ''}. The script is answering.`,
      });
    } catch (e: any) {
      setTestResult({
        ok: false,
        text: e instanceof ApiError ? e.message : String(e?.message || e),
      });
    } finally {
      setTesting(false);
    }
  };

  const onAddSheet = async () => {
    if (!newUrl.trim()) {
      Alert.alert('Paste a link', 'Copy the share link of the month sheet and paste it here.');
      return;
    }
    await addSheet(newLabel || guessLabel(newUrl), newUrl);
    setNewLabel('');
    setNewUrl('');
    void refresh();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
        <Text style={st.title}>Settings</Text>

        {/* ------------------------- connection ------------------------- */}
        <SectionTitle
          title="Connection"
          right={
            <Pressable onPress={() => setShowHelp((v) => !v)}>
              <Text style={st.link}>{showHelp ? 'Hide setup' : 'How do I set this up?'}</Text>
            </Pressable>
          }
        />

        {showHelp ? (
          <Card>
            <Text style={st.step}>
              <Text style={st.stepNum}>1. </Text>Open any of your expense sheets in Google Sheets
              on a computer, then Extensions → Apps Script.
            </Text>
            <Text style={st.step}>
              <Text style={st.stepNum}>2. </Text>Delete whatever is in the editor, paste in the
              Code.gs that came with this app, and change the TOKEN line at the top to a long
              random password of your choosing.
            </Text>
            <Text style={st.step}>
              <Text style={st.stepNum}>3. </Text>Deploy → New deployment → type "Web app". Set
              "Execute as: Me" and "Who has access: Anyone". Authorise it when Google asks.
            </Text>
            <Text style={st.step}>
              <Text style={st.stepNum}>4. </Text>Copy the deployment URL (it ends in /exec) and
              paste it below, along with the same token.
            </Text>
            <Text style={[F.small, { marginTop: S.sm, lineHeight: 18 }]}>
              "Anyone" only means the script's address is reachable — the token is what actually
              lets anything through, and the script can only ever touch sheets your own Google
              account can already open.
            </Text>
          </Card>
        ) : null}

        <Card>
          <Field
            label="Apps Script web app URL"
            value={scriptUrl}
            onChangeText={setScriptUrl}
            placeholder="https://script.google.com/macros/s/…/exec"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Token"
            value={token}
            onChangeText={setToken}
            placeholder="The TOKEN value from Code.gs"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Field
            label="Currency label"
            value={currency}
            onChangeText={setCurrency}
            placeholder="JD"
            autoCapitalize="characters"
            hint="Only a label shown in the app — your sheet keeps plain numbers."
          />
          <Row style={{ gap: S.sm }}>
            <Button label="Save" onPress={saveConnection} style={{ flex: 1 }} />
            <Button
              label="Test connection"
              variant="ghost"
              onPress={test}
              loading={testing}
              style={{ flex: 1 }}
            />
          </Row>
          {testResult ? (
            <View style={{ marginTop: S.md }}>
              <Banner tone={testResult.ok ? 'info' : 'error'} text={testResult.text} />
            </View>
          ) : null}
        </Card>

        {/* --------------------------- sheets --------------------------- */}
        <SectionTitle title="Month sheets" />
        <Text style={[F.small, { marginBottom: S.sm, lineHeight: 18 }]}>
          Add one link per month. Whichever is selected is where new entries go.
        </Text>

        {settings.sheets.map((s) => {
          const active = s.id === settings.activeSheetId;
          return (
            <Card key={s.id} style={active ? { borderColor: C.accent } : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Pressable style={{ flex: 1 }} onPress={() => setActiveSheet(s.id)}>
                  <Row style={{ gap: S.sm }}>
                    <View
                      style={[
                        st.radio,
                        active && { borderColor: C.accent, backgroundColor: C.accent },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={F.h3}>{s.label}</Text>
                      <Text style={F.small} numberOfLines={1}>
                        {active && snapshot ? `tab "${snapshot.entryTab}" · ` : ''}
                        {shortUrl(s.url)}
                      </Text>
                    </View>
                  </Row>
                </Pressable>
              </Row>
              <Row style={{ gap: S.sm, marginTop: S.md }}>
                <Button
                  label="Rename"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() =>
                    Alert.prompt
                      ? Alert.prompt('Rename sheet', undefined, (v) =>
                          v ? updateSheet(s.id, { label: v }) : undefined
                        )
                      : Alert.alert('Rename', 'Long-press the label field below to edit it.')
                  }
                />
                <Button
                  label="Open"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => Linking.openURL(s.url)}
                />
                <Button
                  label="Remove"
                  variant="danger"
                  style={{ flex: 1 }}
                  onPress={() =>
                    Alert.alert('Remove this sheet?', 'The Google Sheet itself is not touched.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeSheet(s.id) },
                    ])
                  }
                />
              </Row>
            </Card>
          );
        })}

        <Card>
          <Field
            label="Name"
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder="August 2026"
          />
          <Field
            label="Share link"
            value={newUrl}
            onChangeText={setNewUrl}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Row style={{ gap: S.sm }}>
            <Button
              label="Paste"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={async () => setNewUrl((await Clipboard.getStringAsync()) || '')}
            />
            <Button label="Add sheet" onPress={onAddSheet} style={{ flex: 2 }} />
          </Row>
        </Card>

        {/* ---------------------------- sync ---------------------------- */}
        <SectionTitle title="Sync" />
        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: S.md }}>
            <Text style={F.body}>Waiting to be written</Text>
            <Text style={[F.body, { fontWeight: '700' }]}>{queue.length}</Text>
          </Row>
          <Row style={{ gap: S.sm }}>
            <Button
              label="Sync now"
              onPress={flush}
              loading={syncing}
              disabled={queue.length === 0}
              style={{ flex: 1 }}
            />
            <Button label="Reload sheet" variant="ghost" onPress={refresh} style={{ flex: 1 }} />
          </Row>
        </Card>

        {/* -------------------------- favorites ------------------------- */}
        {favorites.length > 0 ? (
          <>
            <SectionTitle title="Quick-add buttons" />
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                {favorites.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.label}
                    sub={f.cost != null ? money(f.cost, '') : undefined}
                    onPress={() =>
                      Alert.alert('Remove quick-add?', f.label, [
                        { text: 'Keep', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => removeFavorite(f.id),
                        },
                      ])
                    }
                  />
                ))}
              </View>
              <Text style={[F.small, { marginTop: S.md }]}>Tap one to remove it.</Text>
            </Card>
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const guessLabel = (url: string) => {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]{6})/);
  return m ? `Sheet ${m[1]}` : 'Sheet';
};

const shortUrl = (url: string) => {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? `…/${m[1].slice(0, 10)}…` : url;
};

const st = StyleSheet.create({
  page: { padding: S.lg, paddingTop: S.sm },
  title: { ...F.h1, marginBottom: S.md },
  link: { color: C.accent, fontSize: 13, fontWeight: '600' },
  step: { ...F.dim, lineHeight: 20, marginBottom: S.sm },
  stepNum: { color: C.text, fontWeight: '700' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.borderStrong,
  },
});
