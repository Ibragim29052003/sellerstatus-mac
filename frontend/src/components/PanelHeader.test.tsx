import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../app/store';
import { isDesktop } from '../app/desktop';
import { PanelHeader } from './PanelHeader';
import { Call, Events } from '@wailsio/runtime';
import { CancellablePromise } from '@wailsio/runtime/cancellable';
vi.mock('../app/desktop', () => ({ isDesktop: vi.fn(() => false) }));
vi.mock('@wailsio/runtime', () => ({ Call: { ByName: vi.fn() }, Events: { On: vi.fn() } }));
beforeEach(() => vi.mocked(isDesktop).mockReturnValue(false));
function setup() {
  return render(
    <Provider store={createAppStore()}>
      <PanelHeader />
    </Provider>,
  );
}
describe('Integrated panel header', () => {
  it('uses an ordinary header without a native bridge in browser mode', () => {
    setup();
    expect(screen.getByRole('banner').style.getPropertyValue('--panel-cutout-width')).toBe('0px');
    expect(Call.ByName).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Открыть настройки' })).toBeInTheDocument();
  });
  it('keeps the latest display metrics when a delayed initial read arrives', async () => {
    vi.mocked(isDesktop).mockReturnValue(true);
    let receive: Parameters<typeof Events.On>[1] = () => {};
    const stop = vi.fn();
    vi.mocked(Events.On).mockImplementation((_name, callback) => {
      receive = callback;
      return stop;
    });
    let finish: (value: unknown) => void = () => {};
    vi.mocked(Call.ByName).mockReturnValue(
      new CancellablePromise((resolve) => {
        finish = resolve;
      }),
    );
    const view = setup();
    await waitFor(() =>
      expect(Call.ByName).toHaveBeenCalledWith('main.DesktopService.GetPanelLayout'),
    );
    act(() =>
      receive({ name: 'sellerstatus:panel-layout', data: { cutoutWidth: 188, headerHeight: 38 } }),
    );
    expect(screen.getByRole('banner').style.getPropertyValue('--panel-cutout-width')).toBe('212px');
    await act(async () => finish({ cutoutWidth: 0, headerHeight: 36 }));
    expect(screen.getByRole('banner').style.getPropertyValue('--panel-cutout-width')).toBe('212px');
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});
