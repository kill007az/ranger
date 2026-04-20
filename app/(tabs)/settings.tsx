import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import {
  getStartDate,
  setStartDate,
  setNotionKey,
  setGeminiKey,
  clearAll,
} from '../../lib/storage';

export default function SettingsScreen() {
  const [startDate, setStartDateState] = useState<string>('');
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [newNotionKey, setNewNotionKey] = useState('');
  const [newGeminiKey, setNewGeminiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStartDate().then((d) => {
      if (d) {
        setStartDateState(d);
        setPickedDate(new Date(d));
      }
    });
  }, []);

  async function saveDate() {
    if (!pickedDate) return;
    const newStr = pickedDate.toISOString().split('T')[0];
    if (newStr === startDate) {
      setEditingDate(false);
      return;
    }
    Alert.alert(
      'Change start date?',
      `Week numbers will recalculate from ${newStr}. Existing log entries keep their stored week numbers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change it',
          style: 'destructive',
          onPress: async () => {
            await setStartDate(newStr);
            setStartDateState(newStr);
            setEditingDate(false);
          },
        },
      ]
    );
  }

  async function rotateNotion() {
    if (!newNotionKey.trim()) return;
    setSaving(true);
    try {
      await setNotionKey(newNotionKey.trim());
      setNewNotionKey('');
      Alert.alert('Updated', 'Notion API key rotated.');
    } finally {
      setSaving(false);
    }
  }

  async function rotateGemini() {
    if (!newGeminiKey.trim()) return;
    setSaving(true);
    try {
      await setGeminiKey(newGeminiKey.trim());
      setNewGeminiKey('');
      Alert.alert('Updated', 'Gemini API key saved (overrides .env).');
    } finally {
      setSaving(false);
    }
  }

  function wipeAll() {
    Alert.alert(
      'Clear all data?',
      'Removes API keys and start date from this device. Notion logs are not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            router.replace('/setup');
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>SETTINGS</Text>

      <Text style={s.sectionLabel}>PREP START DATE</Text>
      <View style={s.card}>
        {!editingDate ? (
          <View style={s.row}>
            <Text style={s.value}>{startDate || 'not set'}</Text>
            <TouchableOpacity style={s.editBtn} onPress={() => setEditingDate(true)}>
              <Text style={s.editBtnText}>EDIT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={s.dateRow}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={s.value}>
                {pickedDate ? pickedDate.toISOString().split('T')[0] : 'pick a date'}
              </Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={pickedDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setShowPicker(false);
                  if (d) setPickedDate(d);
                }}
              />
            )}
            <View style={s.btnGroup}>
              <TouchableOpacity style={[s.btn, s.btnOutline]} onPress={() => setEditingDate(false)}>
                <Text style={s.btnOutlineText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={saveDate}>
                <Text style={s.btnPrimaryText}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <Text style={s.sectionLabel}>ROTATE NOTION KEY</Text>
      <View style={s.card}>
        <TextInput
          style={s.input}
          value={newNotionKey}
          onChangeText={setNewNotionKey}
          placeholder="secret_..."
          placeholderTextColor="#555"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[s.btn, s.btnPrimary, { marginTop: 10 }, (!newNotionKey.trim() || saving) && s.btnDisabled]}
          disabled={!newNotionKey.trim() || saving}
          onPress={rotateNotion}
        >
          <Text style={s.btnPrimaryText}>UPDATE NOTION KEY</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>OVERRIDE GEMINI KEY</Text>
      <View style={s.card}>
        <Text style={s.hint}>Defaults to .env. Set here only to override.</Text>
        <TextInput
          style={[s.input, { marginTop: 8 }]}
          value={newGeminiKey}
          onChangeText={setNewGeminiKey}
          placeholder="AIza..."
          placeholderTextColor="#555"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[s.btn, s.btnPrimary, { marginTop: 10 }, (!newGeminiKey.trim() || saving) && s.btnDisabled]}
          disabled={!newGeminiKey.trim() || saving}
          onPress={rotateGemini}
        >
          <Text style={s.btnPrimaryText}>SAVE GEMINI KEY</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>DANGER</Text>
      <View style={s.card}>
        <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={wipeAll}>
          <Text style={s.btnDangerText}>CLEAR ALL LOCAL DATA</Text>
        </TouchableOpacity>
        <Text style={[s.hint, { marginTop: 8 }]}>
          Removes stored keys and start date. Notion logs are preserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { color: '#00ff9f', fontSize: 22, fontWeight: '700', letterSpacing: 3, marginBottom: 24 },
  sectionLabel: { color: '#666', fontSize: 11, letterSpacing: 1.5, marginTop: 20, marginBottom: 8 },
  card: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 10,
    padding: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateRow: { paddingVertical: 8 },
  value: { color: '#fff', fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  editBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#1e1e1e', borderRadius: 6 },
  editBtnText: { color: '#00ff9f', fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 6,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hint: { color: '#555', fontSize: 11 },
  btn: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnGroup: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnPrimary: { backgroundColor: '#00ff9f', flex: 1 },
  btnPrimaryText: { color: '#000', fontWeight: '700', fontSize: 12, letterSpacing: 1.5 },
  btnOutline: { backgroundColor: '#1a1a1a', flex: 1 },
  btnOutlineText: { color: '#888', fontWeight: '600', fontSize: 12, letterSpacing: 1.5 },
  btnDanger: { backgroundColor: '#2a0e0e', borderWidth: 1, borderColor: '#552222' },
  btnDangerText: { color: '#ff6b6b', fontWeight: '700', fontSize: 12, letterSpacing: 1.5 },
  btnDisabled: { opacity: 0.4 },
});
