import * as SecureStore from 'expo-secure-store';

const K = {
  GEMINI_KEY: 'gemini_api_key',
  NOTION_KEY: 'notion_api_key',
  START_DATE: 'start_date',
} as const;

export const getGeminiKey = () => SecureStore.getItemAsync(K.GEMINI_KEY);
export const setGeminiKey = (v: string) => SecureStore.setItemAsync(K.GEMINI_KEY, v);

export const getNotionKey = () => SecureStore.getItemAsync(K.NOTION_KEY);
export const setNotionKey = (v: string) => SecureStore.setItemAsync(K.NOTION_KEY, v);

export const getStartDate = () => SecureStore.getItemAsync(K.START_DATE);
export const setStartDate = (v: string) => SecureStore.setItemAsync(K.START_DATE, v);

export async function clearAll() {
  await Promise.all(Object.values(K).map(k => SecureStore.deleteItemAsync(k)));
}
