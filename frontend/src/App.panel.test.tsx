import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createAppStore } from './app/store';
import { closePanel, openDetails } from './app/desktop';
vi.mock('./app/desktop', () => ({
  isDesktop: () => true,
  closePanel: vi.fn().mockResolvedValue(undefined),
  openPanel: vi.fn(),
  openDetails: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./app/preferences', () => ({
  readBrowserTheme: () => 'system',
  saveTheme: vi.fn(),
  readTheme: async () => 'system',
  subscribeTheme: async () => () => {},
}));
afterEach(() => window.history.replaceState(null, '', '/'));
function setup() {
  window.history.replaceState(null, '', '/?view=panel');
  const store = createAppStore();
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
  return userEvent.setup();
}
describe('Desktop summary', () => {
  it('closes with Escape, but leaves Escape to an open settings dialog', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Пульс магазина' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closePanel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Открыть настройки' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closePanel).toHaveBeenCalledTimes(1);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closePanel).toHaveBeenCalledTimes(2);
  });
  it('passes selected period and scenario into the native detail window', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Пульс магазина' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Период' }), 'week');
    await screen.findByRole('button', { name: /Выкупы.*756/ });
    await user.click(screen.getByRole('button', { name: 'Открыть подробности' }));
    expect(openDetails).toHaveBeenCalledWith('overview', 'week', 'normal');
  });
});
