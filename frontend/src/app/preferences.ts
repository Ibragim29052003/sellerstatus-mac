import type { Theme } from '../data/types';
import { isDesktop } from './desktop';
export const THEME_STORAGE_KEY = 'sellerstatus:theme';
export const isTheme = (value: unknown): value is Theme =>
  ['system', 'light', 'dark'].includes(value as string);
export function readBrowserTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : 'system';
  } catch {
    return 'system';
  }
}
export async function readTheme(): Promise<Theme> {
  if (!isDesktop()) return readBrowserTheme();
  const { Call } = await import('@wailsio/runtime');
  const value: unknown = await Call.ByName('main.DesktopService.GetTheme');
  return isTheme(value) ? value : 'system';
}
export async function saveTheme(theme: Theme): Promise<void> {
  if (!isDesktop()) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    return;
  }
  const { Call } = await import('@wailsio/runtime');
  await Call.ByName('main.DesktopService.SetTheme', theme);
}
export async function subscribeTheme(onChange: (theme: Theme) => void): Promise<() => void> {
  if (!isDesktop()) {
    const listener = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY)
        onChange(isTheme(event.newValue) ? event.newValue : 'system');
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }
  const { Events } = await import('@wailsio/runtime');
  return Events.On('sellerstatus:theme', (event) => {
    if (isTheme(event.data)) onChange(event.data);
  });
}
