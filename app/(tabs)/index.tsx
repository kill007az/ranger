import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { runAgent, type ChatMessage } from '../../lib/agent';
import { getStartDate } from '../../lib/storage';
import { getCurrentWeek, getDayType, todayISO } from '../../lib/weekTracker';
import { queryWeekEntries, queryRecentEntries } from '../../lib/notion';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const QUICK_ACTIONS = [
  'What week am I on?',
  "Show this week's stats",
  'Log today: gym done, DSA 3 problems',
  'What should I focus on this week?',
];

interface Stats {
  week: number;
  adherence: number;
  streak: number;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'model', text: 'Ready. Log a day, check your stats, or ask anything about the plan.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const listRef = useRef<FlatList>(null);

  const loadStats = useCallback(async () => {
    const start = await getStartDate();
    if (!start) return;
    const week = getCurrentWeek(start);
    try {
      const [weekData, recent] = await Promise.all([
        queryWeekEntries(week),
        queryRecentEntries(60),
      ]);
      const weekPages = (weekData.results ?? []) as any[];
      const adherence =
        weekPages.length > 0
          ? Math.round(
              weekPages.reduce((s, p) => s + (p.properties?.['Score %']?.formula?.number ?? 0), 0) /
                weekPages.length
            )
          : 0;
      const byDate = new Map<string, any>();
      for (const p of (recent.results ?? []) as any[]) {
        const d = p.properties?.Date?.date?.start;
        if (d) byDate.set(d, p);
      }
      let streak = 0;
      const cursor = new Date();
      for (let i = 0; i < 60; i++) {
        const iso = cursor.toISOString().split('T')[0];
        if (getDayType(iso) === 'sunday') {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        const page = byDate.get(iso);
        const count = page?.properties?.['DSA Count']?.number ?? 0;
        const dsa = page?.properties?.['DSA Completed']?.checkbox ?? false;
        if (count >= 1 || dsa) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
      setStats({ week, adherence, streak });
    } catch {
      setStats({ week, adherence: 0, streak: 0 });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = { id: Date.now().toString(), role: 'user', text: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      historyRef.current.push({ role: 'user', parts: [{ text: trimmed }] });

      try {
        const reply = await runAgent(trimmed, historyRef.current.slice(0, -1));
        historyRef.current.push({ role: 'model', parts: [{ text: reply }] });
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: reply }]);
        loadStats();
      } catch (e: any) {
        const errMsg = e?.message ?? 'Something went wrong.';
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: `Error: ${errMsg}` }]);
        historyRef.current.pop();
      } finally {
        setLoading(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [loading, loadStats]
  );

  const adherenceColor = !stats
    ? '#555'
    : stats.adherence >= 80
    ? '#00ff9f'
    : stats.adherence >= 50
    ? '#ffcc00'
    : '#ff6b6b';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <View style={s.container}>
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={s.headerTitle}>RANGER</Text>
            <Text style={s.headerDate}>{todayISO()}</Text>
          </View>
          <View style={s.statsRow}>
            <Stat label="WEEK" value={stats ? `${stats.week}/24` : '—'} color="#00ff9f" />
            <Stat label="ADHERENCE" value={stats ? `${stats.adherence}%` : '—'} color={adherenceColor} />
            <Stat label="STREAK" value={stats ? `${stats.streak}d` : '—'} color="#7a9aff" />
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.msgList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View style={[s.bubble, item.role === 'user' ? s.userBubble : s.modelBubble]}>
              <Text style={[s.bubbleText, item.role === 'user' ? s.userText : s.modelText]}>
                {item.text}
              </Text>
            </View>
          )}
        />

        {loading && (
          <View style={s.loadingRow}>
            <ActivityIndicator color="#00ff9f" size="small" />
            <Text style={s.loadingText}>thinking...</Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chips}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity key={a} style={s.chip} onPress={() => send(a)}>
              <Text style={s.chipText}>{a}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything..."
            placeholderTextColor="#444"
            multiline
            maxLength={500}
            onSubmitEditing={() => send(input)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            <Text style={s.sendText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  headerTitle: { color: '#00ff9f', fontSize: 16, fontWeight: '700', letterSpacing: 3 },
  headerDate: { color: '#444', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statsRow: { flexDirection: 'row', marginTop: 12, gap: 20 },
  stat: { flex: 1 },
  statLabel: { color: '#444', fontSize: 9, letterSpacing: 1.5, fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  msgList: { padding: 16, gap: 10 },
  bubble: { maxWidth: '82%', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#1a1a2e' },
  modelBubble: { alignSelf: 'flex-start', backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#e0e0ff' },
  modelText: { color: '#d0d0d0' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  loadingText: { color: '#555', fontSize: 12 },
  chips: { maxHeight: 44, marginBottom: 4 },
  chip: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: '#888', fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  input: { flex: 1, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 22, color: '#fff', paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00ff9f', justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { backgroundColor: '#1a1a1a' },
  sendText: { color: '#000', fontSize: 18, fontWeight: '700' },
});
