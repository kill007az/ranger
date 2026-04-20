import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { upsertDailyLogEntry, getEntryByDate } from '../../lib/notion';
import { getStartDate } from '../../lib/storage';
import { getCurrentWeek, getDayType, isBeforeStart, todayISO } from '../../lib/weekTracker';

export default function LogScreen() {
  const today = todayISO();
  const dayType = getDayType(today);

  const [startDate, setStartDateState] = useState<string | null>(null);
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  const [gym, setGym] = useState(false);
  const [gymNotes, setGymNotes] = useState('');
  const [dsa, setDsa] = useState(false);
  const [dsaCount, setDsaCount] = useState('');
  const [dsaNotes, setDsaNotes] = useState('');
  const [systemDesign, setSystemDesign] = useState(false);
  const [sdNotes, setSdNotes] = useState('');
  const [mock, setMock] = useState(false);
  const [aiCourse, setAiCourse] = useState(false);
  const [aiCourseNotes, setAiCourseNotes] = useState('');
  const [assignments, setAssignments] = useState(false);
  const [assignmentsNotes, setAssignmentsNotes] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ score: number; summary: string } | null>(null);
  const [confirmSunday, setConfirmSunday] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await getStartDate();
      setStartDateState(d);
      if (d) setWeek(getCurrentWeek(d));
      const existing = await getEntryByDate(today).catch(() => null);
      if (existing) {
        const p = existing.properties ?? {};
        setGym(p.Gym?.checkbox ?? false);
        setGymNotes(p['Gym Notes']?.rich_text?.[0]?.plain_text ?? '');
        setDsa(p['DSA Completed']?.checkbox ?? false);
        const c = p['DSA Count']?.number;
        setDsaCount(c != null ? String(c) : '');
        setDsaNotes(p['DSA Notes']?.rich_text?.[0]?.plain_text ?? '');
        setSystemDesign(p['System Design']?.checkbox ?? false);
        setSdNotes(p['SD Notes']?.rich_text?.[0]?.plain_text ?? '');
        setMock(p['Mock Interview']?.checkbox ?? false);
        setAiCourse(p['AI Course']?.checkbox ?? false);
        setAiCourseNotes(p['AI Course Notes']?.rich_text?.[0]?.plain_text ?? '');
        setAssignments(p.Assignments?.checkbox ?? false);
        setAssignmentsNotes(p['Assignments Notes']?.rich_text?.[0]?.plain_text ?? '');
        setNotes(p.Notes?.rich_text?.[0]?.plain_text ?? '');
      }
      setLoading(false);
    })();
  }, []);

  const beforeStart = startDate && isBeforeStart(startDate, today);

  function calcScore(): { score: number; summary: string } {
    if (dayType === 'sunday') return { score: 0, summary: 'Rest day · no score' };
    if (dayType === 'saturday') {
      const completed = [dsa, aiCourse, assignments].filter(Boolean).length;
      return { score: Math.round((completed / 3) * 100), summary: `${completed}/3 (Sat)` };
    }
    const completed = [gym, dsa].filter(Boolean).length;
    return { score: Math.round((completed / 2) * 100), summary: `${completed}/2 (weekday)` };
  }

  async function submit() {
    if (beforeStart) {
      Alert.alert('Cannot log', `Today is before your prep start date (${startDate}).`);
      return;
    }
    if (dayType === 'sunday' && !confirmSunday) {
      Alert.alert(
        'Sunday — rest day',
        'The plan marks Sunday as completely OFF. Log anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log anyway', onPress: () => { setConfirmSunday(true); submit(); } },
        ]
      );
      return;
    }
    setSubmitting(true);
    try {
      await upsertDailyLogEntry({
        day: today,
        date: today,
        week,
        gym: dayType === 'weekday' ? gym : false,
        gymNotes,
        dsa,
        dsaCount: dsaCount ? Number(dsaCount) : 0,
        dsaNotes,
        systemDesign,
        sdNotes,
        mockInterview: mock,
        aiCourse: dayType === 'saturday' ? aiCourse : false,
        aiCourseNotes,
        assignments: dayType === 'saturday' ? assignments : false,
        assignmentsNotes,
        notes,
      });
      setSubmitted(calcScore());
    } catch (e: any) {
      Alert.alert('Failed to log', e?.message ?? 'Check your Notion API key and connection.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#555' }}>loading...</Text>
      </View>
    );
  }

  if (beforeStart) {
    return (
      <View style={[s.container, s.center]}>
        <Text style={s.lockedTitle}>LOGGING LOCKED</Text>
        <Text style={s.lockedBody}>Today is {today}.</Text>
        <Text style={s.lockedBody}>Your prep starts {startDate}.</Text>
        <Text style={s.lockedHint}>Logging unlocks on start date.</Text>
      </View>
    );
  }

  if (submitted) {
    const { score, summary } = submitted;
    const color = score === 100 ? '#00ff9f' : score >= 67 ? '#ffcc00' : score > 0 ? '#ff6b6b' : '#888';
    return (
      <View style={[s.container, s.center, { padding: 40 }]}>
        <Text style={{ color, fontSize: 64, fontWeight: '700' }}>{score}%</Text>
        <Text style={{ color: '#888', fontSize: 13, marginTop: 8, letterSpacing: 1 }}>
          {summary.toUpperCase()} · WEEK {week}
        </Text>
        <Text style={{ color: '#555', fontSize: 12, marginTop: 4 }}>{dayMessage(score, dayType)}</Text>
        <Text style={{ color: '#444', fontSize: 11, marginTop: 4 }}>{today}</Text>
        <TouchableOpacity style={[s.btn, { marginTop: 40, backgroundColor: '#1a1a1a' }]} onPress={() => setSubmitted(null)}>
          <Text style={[s.btnText, { color: '#888' }]}>EDIT TODAY'S LOG</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { score, summary } = calcScore();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>LOG DAY</Text>
      <Text style={s.sub}>{today} · {dayType.toUpperCase()} · Week {week}</Text>

      {dayType === 'sunday' && (
        <View style={s.restBanner}>
          <Text style={s.restBannerTitle}>🔴 SUNDAY — REST DAY</Text>
          <Text style={s.restBannerBody}>Plan says: completely off. Rest. Game. No guilt.</Text>
          <Text style={s.restBannerBody}>You can still log if you did something.</Text>
        </View>
      )}

      {dayType === 'weekday' && (
        <ActivitySection
          label="Gym"
          done={gym}
          onToggle={setGym}
          notes={gymNotes}
          onNotesChange={setGymNotes}
          placeholder="chest/back, 5x5, felt tight..."
        />
      )}

      <ActivitySection
        label="DSA Practice"
        done={dsa}
        onToggle={setDsa}
        notes={dsaNotes}
        onNotesChange={setDsaNotes}
        placeholder="topics, patterns, stuck points..."
      >
        <View style={s.inlineRow}>
          <Text style={s.inlineLabel}>Problems solved</Text>
          <TextInput
            style={s.countInput}
            value={dsaCount}
            onChangeText={(t) => setDsaCount(t.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor="#444"
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </ActivitySection>

      {dayType === 'saturday' && (
        <>
          <ActivitySection
            label="AI Course"
            done={aiCourse}
            onToggle={setAiCourse}
            notes={aiCourseNotes}
            onNotesChange={setAiCourseNotes}
            placeholder="module, concept, lab..."
          />
          <ActivitySection
            label="Assignments"
            done={assignments}
            onToggle={setAssignments}
            notes={assignmentsNotes}
            onNotesChange={setAssignmentsNotes}
            placeholder="what you worked on..."
          />
        </>
      )}

      <ActivitySection
        label="System Design"
        optional
        done={systemDesign}
        onToggle={setSystemDesign}
        notes={sdNotes}
        onNotesChange={setSdNotes}
        placeholder="topic, references read..."
      />

      <View style={s.mockRow}>
        <Text style={s.rowLabel}>Mock Interview</Text>
        <Switch
          value={mock}
          onValueChange={setMock}
          trackColor={{ false: '#2a2a2a', true: '#4a66cc' }}
          thumbColor={mock ? '#7a9aff' : '#555'}
        />
      </View>

      <Text style={s.scorePreview}>
        Score preview:{' '}
        <Text style={{ color: dayType === 'sunday' ? '#888' : '#00ff9f' }}>
          {summary} · {score}%
        </Text>
      </Text>

      <Text style={s.label}>OVERALL REFLECTION</Text>
      <TextInput
        style={s.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything else about today..."
        placeholderTextColor="#444"
        multiline
        numberOfLines={3}
        maxLength={500}
      />

      <TouchableOpacity style={[s.btn, submitting && s.btnDisabled]} onPress={submit} disabled={submitting}>
        <Text style={s.btnText}>{submitting ? 'LOGGING...' : 'SUBMIT DAY →'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function dayMessage(score: number, dayType: string): string {
  if (dayType === 'sunday') return 'Sundays are sacred. Back tomorrow.';
  if (score === 100) return 'Perfect day. Keep it up.';
  if (score >= 67) return 'Solid. Hit everything tomorrow.';
  if (score > 0) return 'Minimum met. Tomorrow, more.';
  return 'Zero day. Reset and rebuild.';
}

function ActivitySection({
  label,
  done,
  onToggle,
  notes,
  onNotesChange,
  placeholder,
  optional,
  children,
}: {
  label: string;
  done: boolean;
  onToggle: (v: boolean) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  placeholder: string;
  optional?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>{label}</Text>
          {optional && <Text style={s.rowHint}>optional · unweighted</Text>}
        </View>
        <Switch
          value={done}
          onValueChange={onToggle}
          trackColor={{ false: '#2a2a2a', true: '#00cc7a' }}
          thumbColor={done ? '#00ff9f' : '#555'}
        />
      </View>
      {children}
      <TextInput
        style={s.sectionNotes}
        value={notes}
        onChangeText={onNotesChange}
        placeholder={placeholder}
        placeholderTextColor="#444"
        multiline
        maxLength={300}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { color: '#00ff9f', fontSize: 22, fontWeight: '700', letterSpacing: 3 },
  sub: { color: '#555', fontSize: 12, letterSpacing: 1, marginTop: 4, marginBottom: 20 },
  restBanner: {
    backgroundColor: '#1a0e0e',
    borderWidth: 1,
    borderColor: '#3a1a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  restBannerTitle: { color: '#ff6b6b', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  restBannerBody: { color: '#888', fontSize: 12, marginTop: 2 },
  section: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionNotes: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    color: '#ccc',
    padding: 10,
    fontSize: 13,
    minHeight: 44,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  inlineLabel: { color: '#888', fontSize: 12 },
  countInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 6,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    width: 70,
    textAlign: 'center',
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  rowLabel: { color: '#e0e0e0', fontSize: 15, fontWeight: '500', flex: 1 },
  rowHint: { color: '#555', fontSize: 11, marginTop: 2 },
  scorePreview: { color: '#666', fontSize: 12, marginBottom: 20 },
  label: { color: '#555', fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  notesInput: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    color: '#ccc',
    padding: 14,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 24,
  },
  btn: {
    backgroundColor: '#00ff9f',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 13, letterSpacing: 2 },
  lockedTitle: { color: '#ff6b6b', fontSize: 14, fontWeight: '700', letterSpacing: 3, marginBottom: 20 },
  lockedBody: { color: '#888', fontSize: 14, marginTop: 4 },
  lockedHint: { color: '#555', fontSize: 12, marginTop: 24 },
});
