import { useEffect, useState } from 'react';
import { isDesktop } from './desktop';

interface PanelLayout {
  cutoutWidth: number;
  headerHeight: number;
}
function parseLayout(value: unknown): PanelLayout | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('cutoutWidth' in value) ||
    !('headerHeight' in value)
  )
    return;
  if (
    typeof value.cutoutWidth !== 'number' ||
    !Number.isFinite(value.cutoutWidth) ||
    value.cutoutWidth < 0 ||
    value.cutoutWidth > 600
  )
    return;
  if (
    typeof value.headerHeight !== 'number' ||
    !Number.isFinite(value.headerHeight) ||
    value.headerHeight < 32 ||
    value.headerHeight > 100
  )
    return;
  return { cutoutWidth: value.cutoutWidth, headerHeight: value.headerHeight };
}
export function usePanelLayout() {
  const [layout, setLayout] = useState<PanelLayout>(() =>
    isDesktop() ? { cutoutWidth: 200, headerHeight: 36 } : { cutoutWidth: 0, headerHeight: 36 },
  );
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    let changed = false;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const { Call, Events } = await import('@wailsio/runtime');
      const receive = (value: unknown) => {
        const next = parseLayout(value);
        if (next && !cancelled) setLayout(next);
      };
      const stop = Events.On('sellerstatus:panel-layout', (event) => {
        changed = true;
        receive(event.data);
      });
      if (cancelled) {
        stop();
        return;
      }
      unsubscribe = stop;
      const value: unknown = await Call.ByName('main.DesktopService.GetPanelLayout');
      if (!changed) receive(value);
    })().catch(() => {
      /* Keep a safe central gap if the native bridge is not ready. */
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
  return layout;
}
