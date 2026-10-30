import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { createAppStore } from './app/store';
import { sellerApi } from './app/api';
import { createDemoSnapshot } from './data/demo';
import { SourceError } from './data/loading/errors';
import type { SnapshotSource } from './data/loading/source';
import type { Snapshot, SnapshotRequest } from './data/types';
function setup(source: SnapshotSource) {
  render(
    <Provider store={createAppStore(source)}>
      <App />
    </Provider>,
  );
  return userEvent.setup();
}
describe('Loading and recovery in the interface', () => {
  it('blocks both manual refresh paths during a long rate-limit cooldown', async () => {
    const read = vi
      .fn<SnapshotSource['read']>()
      .mockRejectedValue(new SourceError('rateLimit', 60_000));
    setup({ read });
    expect(await screen.findByRole('button', { name: /Повтор через \d+ с/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Обновить демоданные' })).toBeDisabled();
    expect(read).toHaveBeenCalledOnce();
  });
  it('keeps the same-period snapshot on a temporary refresh failure and clears the warning after recovery', async () => {
    let fail = false;
    const read = vi.fn<SnapshotSource['read']>().mockImplementation(async (request) => {
      if (fail) throw new SourceError('server');
      return createDemoSnapshot(request);
    });
    const user = setup({ read });
    await screen.findByRole('button', { name: /Выкупы.*126/ });
    fail = true;
    await user.click(screen.getByRole('button', { name: 'Обновить демоданные' }));
    await screen.findByText(
      'Не удалось обновить. Показан предыдущий снимок.',
      {},
      { timeout: 4000 },
    );
    expect(screen.getByRole('button', { name: /Выкупы.*126/ })).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(4);
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Повторить обновление' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Не удалось обновить. Показан предыдущий снимок.'),
      ).not.toBeInTheDocument(),
    );
    expect(read).toHaveBeenCalledTimes(5);
  });
  it.each(['unauthorized', 'forbidden', 'contract'] as const)(
    'hides the previous snapshot on %s instead of presenting it as current',
    async (code) => {
      let fail = false;
      const read = vi.fn<SnapshotSource['read']>().mockImplementation(async (request) => {
        if (fail) throw new SourceError(code);
        return createDemoSnapshot(request);
      });
      const user = setup({ read });
      await screen.findByRole('button', { name: /Выкупы.*126/ });
      fail = true;
      await user.click(screen.getByRole('button', { name: 'Обновить демоданные' }));
      await screen.findByRole('heading', { name: 'Не удалось загрузить сводку' });
      expect(screen.queryByRole('button', { name: /Выкупы.*126/ })).not.toBeInTheDocument();
      expect(read).toHaveBeenCalledTimes(2);
    },
  );
  it('does not replace a new period with a late response from the previous one', async () => {
    let resolveToday: (snapshot: Snapshot) => void = () => {};
    const read = vi.fn<SnapshotSource['read']>().mockImplementation((request) =>
      request.period === 'today'
        ? new Promise<Snapshot>((resolve) => {
            resolveToday = resolve;
          })
        : Promise.resolve(createDemoSnapshot(request)),
    );
    const user = setup({ read });
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: '7 дней' }));
    await screen.findByRole('button', { name: /Выкупы.*756/ });
    await act(async () => {
      resolveToday(createDemoSnapshot({ period: 'today', scenario: 'normal' }));
    });
    expect(screen.getByRole('button', { name: /Выкупы.*756/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Выкупы.*126/ })).not.toBeInTheDocument();
  });
});
describe('Query cache boundaries', () => {
  it('combines concurrent reads of the same snapshot but isolates cabinets', async () => {
    const read = vi.fn<SnapshotSource['read']>().mockImplementation(async (request) => {
      const data = createDemoSnapshot(request);
      data.cabinet.id = request.cabinetId;
      return data;
    });
    const store = createAppStore({ read });
    const request: SnapshotRequest = {
      cabinetId: 'demo-store',
      period: 'today',
      scenario: 'normal',
    };
    const first = store.dispatch(sellerApi.endpoints.snapshot.initiate(request));
    const second = store.dispatch(sellerApi.endpoints.snapshot.initiate(request));
    await Promise.all([first, second]);
    expect(read).toHaveBeenCalledOnce();
    const other = store.dispatch(
      sellerApi.endpoints.snapshot.initiate({ ...request, cabinetId: 'other-store' }),
    );
    expect((await other).data?.cabinet.id).toBe('other-store');
    expect(sellerApi.endpoints.snapshot.select(request)(store.getState()).data?.cabinet.id).toBe(
      'demo-store',
    );
    first.unsubscribe();
    second.unsubscribe();
    other.unsubscribe();
    store.dispatch(sellerApi.util.resetApiState());
  });
});
