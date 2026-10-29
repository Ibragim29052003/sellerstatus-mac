import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { createAppStore } from './store';
import { readBrowserTheme, THEME_STORAGE_KEY } from './preferences';

beforeEach(() => localStorage.clear());
function setup() {
  const store = createAppStore();
  const view = render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
  return { store, view, user: userEvent.setup() };
}
describe('Theme preferences', () => {
  it('defaults to system and follows OS changes without persisting a forced theme', async () => {
    let dark = true;
    let listener: (() => void) | undefined;
    const remove = vi.fn();
    vi.mocked(window.matchMedia).mockReturnValueOnce({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, callback: () => void) => {
        listener = callback;
      },
      removeEventListener: remove,
    } as unknown as MediaQueryList);
    const { store, view } = setup();
    expect(store.getState().ui.theme).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
    act(() => {
      dark = false;
      listener?.();
    });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    view.unmount();
    expect(remove).toHaveBeenCalled();
  });
  it('persists an explicit selection and restores it for a new store', async () => {
    const { user, view } = setup();
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    await user.click(screen.getByRole('combobox', { name: 'Оформление' }));
    await user.click(screen.getByRole('option', { name: 'Тёмное' }));
    await waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    view.unmount();
    const restored = createAppStore();
    expect(restored.getState().ui.theme).toBe('dark');
  });
  it('synchronizes a theme change from another browser window', async () => {
    const { store } = setup();
    await screen.findByRole('heading', { name: 'Всё под контролем.' });
    act(() =>
      window.dispatchEvent(
        new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }),
      ),
    );
    expect(store.getState().ui.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
  it('falls back to system for unsupported saved data', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid');
    expect(readBrowserTheme()).toBe('system');
  });
});
