import { useEffect } from 'react';
import { actions, useAppDispatch, useAppSelector } from './store';
import { readTheme, subscribeTheme } from './preferences';
import { isDesktop } from './desktop';
export function useAppearance() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.ui.theme);
  useEffect(() => {
    let cancelled = false;
    let changed = false;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const stop = await subscribeTheme((value) => {
        changed = true;
        if (!cancelled) dispatch(actions.themeReceived(value));
      });
      if (cancelled) {
        stop();
        return;
      }
      unsubscribe = stop;
      const saved = await readTheme();
      if (!cancelled && !changed) dispatch(actions.themeReceived(saved));
    })().catch(() => {
      if (!cancelled) dispatch(actions.themeSaveFailed('Не удалось прочитать настройки темы.'));
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [dispatch]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.desktop = String(isDesktop());
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
