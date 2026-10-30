import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createAppStore } from './app/store';
import { SourceError } from './data/loading/errors';
import { closePanel, openDetails, openPlanner } from './app/desktop';
vi.mock('./app/desktop', () => ({
  isDesktop: () => true,
  closePanel: vi.fn().mockResolvedValue(undefined),
  openPanel: vi.fn(),
  openPlanner: vi.fn().mockResolvedValue(undefined),
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
  it('opens the independent planner even if the summary cannot load', async () => {
    window.history.replaceState(null, '', '/');
    render(
      <Provider
        store={createAppStore({
          read: async () => {
            throw new SourceError('unauthorized');
          },
        })}
      >
        <App />
      </Provider>,
    );
    await screen.findByRole('heading', { name: 'Не удалось загрузить сводку' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Планировщик поставок' }));
    expect(openPlanner).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('heading', { name: 'От остатков — к плану поставки' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Не удалось загрузить сводку' }),
    ).not.toBeInTheDocument();
  });
  it('opens the planner directly, blocks duplicate clicks, and allows retry after failure', async () => {
    let reject: (error: Error) => void = () => {};
    vi.mocked(openPlanner).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const user = setup();
    await screen.findByRole('button', { name: 'Планировщик' });
    await user.click(screen.getByRole('button', { name: 'Планировщик' }));
    expect(screen.getByRole('button', { name: 'Открываем…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Открываем…' }));
    expect(openPlanner).toHaveBeenCalledOnce();
    expect(openDetails).not.toHaveBeenCalled();
    reject(new Error('unavailable'));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Планировщик' }));
    expect(openPlanner).toHaveBeenCalledTimes(2);
  });
  it('focuses the settings title rather than the close button and distinguishes pointer from keyboard input', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Пульс магазина' });
    await user.click(screen.getByRole('button', { name: 'Открыть настройки' }));
    expect(screen.getByRole('heading', { name: 'Настройки прототипа' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Закрыть настройки' })).not.toHaveFocus();
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Закрыть настройки' })).toHaveFocus();
    expect(document.documentElement.dataset.inputModality).toBe('keyboard');
    await user.click(screen.getByRole('combobox', { name: 'Оформление' }));
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
  });
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
    await user.click(screen.getByRole('combobox', { name: 'Период' }));
    await user.click(screen.getByRole('option', { name: '7 дней' }));
    await screen.findByRole('button', { name: /Выкупы.*756/ });
    await user.click(screen.getByRole('button', { name: 'Открыть подробности' }));
    expect(openDetails).toHaveBeenCalledWith('overview', 'week', 'normal');
  });
  it('leaves the summary open when Escape cancels the period list', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Пульс магазина' });
    await user.click(screen.getByRole('combobox', { name: 'Период' }));
    await user.keyboard('{End}{Escape}');
    expect(screen.getByRole('combobox', { name: 'Период' })).toHaveTextContent('Сегодня');
    expect(closePanel).not.toHaveBeenCalled();
  });
  it('blocks repeated refreshes while retaining the current snapshot', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Пульс магазина' });
    await user.click(screen.getByRole('button', { name: 'Перезагрузить демоснимок' }));
    expect(await screen.findByRole('button', { name: 'Обновление…' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Пульс магазина' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Выкупы.*126/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Перезагрузить демоснимок' })).toBeEnabled();
  });
});
