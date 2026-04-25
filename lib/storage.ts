import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const K = {
  GEMINI_KEY: 'gemini_api_key',
  NOTION_KEY: 'notion_api_key',
  START_DATE: 'start_date',
} as const;

const isWeb = Platform.OS === 'web';

function getItem(key: string): Promise<string | null> {
  if (isWeb) return Promise.resolve(localStorage.getItem(key));
  return SecureStore.getItemAsync(key);
}

function setItem(key: string, value: string): Promise<void> {
  if (isWeb) { localStorage.setItem(key, value); return Promise.resolve(); }
  return SecureStore.setItemAsync(key, value);
}

function deleteItem(key: string): Promise<void> {
  if (isWeb) { localStorage.removeItem(key); return Promise.resolve(); }
  return SecureStore.deleteItemAsync(key);
}

export const getGeminiKey = () => getItem(K.GEMINI_KEY);
export const setGeminiKey = (v: string) => setItem(K.GEMINI_KEY, v);

export const getNotionKey = () => getItem(K.NOTION_KEY);
export const setNotionKey = (v: string) => setItem(K.NOTION_KEY, v);

export const getStartDate = () => getItem(K.START_DATE);
export const setStartDate = (v: string) => setItem(K.START_DATE, v);

export async function clearAll() {
  await Promise.all(Object.values(K).map(k => deleteItem(k)));
}
