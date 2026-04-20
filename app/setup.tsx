import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { setGeminiKey, setNotionKey, setStartDate } from '../lib/storage';

export default function Setup() {
  const [geminiKey, setGeminiKeyInput] = useState('');
  const [notionKey, setNotionKeyInput] = useState('');
  const [startDate, setStartDateValue] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const startDateStr = startDate.toISOString().split('T')[0];

  async function save() {
    if (!notionKey.trim()) {
      Alert.alert('Missing field', 'Notion API key is required.');
      return;
    }
    setSaving(true);
    try {
      const tasks: Promise<any>[] = [
        setNotionKey(notionKey.trim()),
        setStartDate(startDateStr),
      ];
      if (geminiKey.trim()) tasks.push(setGeminiKey(geminiKey.trim()));
      await Promise.all(tasks);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function onDateChange(_: any, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setStartDateValue(selected);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.title}>RANGER</Text>
        <Text style={s.subtitle}>MAANG Prep Assistant</Text>
        <Text style={s.section}>Initial Setup</Text>

        <Label>Gemini API Key (optional — reads from .env)</Label>
        <TextInput
          style={s.input}
          value={geminiKey}
          onChangeText={setGeminiKeyInput}
          placeholder="AIza..."
          placeholderTextColor="#555"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={s.hint}>Leave blank if using .env. Free tier at aistudio.google.com.</Text>

        <Label>Notion API Key</Label>
        <TextInput
          style={s.input}
          value={notionKey}
          onChangeText={setNotionKeyInput}
          placeholder="secret_..."
          placeholderTextColor="#555"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={s.hint}>Internal integration token from notion.so/my-integrations</Text>

        <Label>Prep Start Date</Label>
        <TouchableOpacity style={s.input} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
          <Text style={s.dateText}>{startDateStr}</Text>
        </TouchableOpacity>
        <Text style={s.hint}>Locked once you save. Used to calculate week 1–24.</Text>

        {showPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={save} disabled={saving}>
          <Text style={s.btnText}>{saving ? 'SAVING...' : 'START →'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ color: '#888', fontSize: 11, letterSpacing: 1.5, marginBottom: 6, marginTop: 20 }}>{children.toUpperCase()}</Text>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 28, paddingTop: 80 },
  title: { color: '#00ff9f', fontSize: 28, fontWeight: '700', letterSpacing: 4 },
  subtitle: { color: '#555', fontSize: 12, letterSpacing: 2, marginTop: 4, marginBottom: 40 },
  section: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  input: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    justifyContent: 'center',
    minHeight: 44,
  },
  dateText: { color: '#fff', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  hint: { color: '#444', fontSize: 11, marginTop: 5 },
  btn: {
    backgroundColor: '#00ff9f',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 40,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 14, letterSpacing: 2 },
});
