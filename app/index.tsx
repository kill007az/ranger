import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getStartDate, getNotionKey } from '../lib/storage';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasSetup, setHasSetup] = useState(false);

  useEffect(() => {
    Promise.all([getStartDate(), getNotionKey()]).then(([start, notion]) => {
      setHasSetup(!!start && !!notion);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator color="#00ff9f" size="large" />
      </View>
    );
  }

  return <Redirect href={hasSetup ? '/(tabs)' : '/setup'} />;
}
