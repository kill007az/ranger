import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f0f0f',
          borderTopColor: '#1e1e1e',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#00ff9f',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 1, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'CHAT',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>◎</Text>,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'LOG DAY',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>✦</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⚙</Text>,
        }}
      />
    </Tabs>
  );
}
