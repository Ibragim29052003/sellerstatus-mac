import type { Page, Period, Scenario } from '../data/types';
export const isDesktop = () => '_wails' in window;
export async function openDetails(page: Page, period: Period, scenario: Scenario): Promise<void> {
  if (isDesktop()) {
    const { Call } = await import('@wailsio/runtime');
    await Call.ByName('main.DesktopService.OpenDetails', page, period, scenario);
  } else {
    window.location.assign(`?page=${page}&period=${period}&scenario=${scenario}`);
  }
}

export async function openPanel(): Promise<void> {
  if (isDesktop()) {
    const { Call } = await import('@wailsio/runtime');
    await Call.ByName('main.DesktopService.OpenPanel');
  } else window.location.assign('?view=panel');
}

export async function closePanel(): Promise<void> {
  if (isDesktop()) {
    const { Call } = await import('@wailsio/runtime');
    await Call.ByName('main.DesktopService.ClosePanel');
  }
}

export async function openPlanner(): Promise<void> {
  if (!isDesktop()) throw new Error('Планировщик открывается в приложении для Mac.');
  const { Call } = await import('@wailsio/runtime');
  await Call.ByName('main.DesktopService.OpenPlanner');
}
