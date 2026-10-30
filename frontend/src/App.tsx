import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Boxes,
  CircleAlert,
  CircleHelp,
  Command,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { actions, useAppDispatch, useAppSelector } from './app/store';
import { useSnapshotQuery } from './app/api';
import { useAppearance } from './app/useAppearance';
import { isDesktop, openDetails, openPanel, closePanel } from './app/desktop';
import type { Page } from './data/types';
import { periodOptions, scenarioOptions } from './data/options';
import { Select } from './components/Select';
import { RefreshButton } from './components/RefreshButton';
import { Brand } from './components/ui';
import Overview from './features/Overview';
import Stocks from './features/Stocks';
import Finance from './features/Finance';
import Activity from './features/Activity';
import Panel from './features/Panel';
import Settings from './features/Settings';
import { canShowPrevious, toLoadIssue } from './data/loading/errors';
import { LoadNotice } from './components/LoadNotice';
import { useRetryCountdown } from './app/useRetryCountdown';
const pages = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'stocks', label: 'Остатки и склады', icon: Boxes },
  { id: 'finance', label: 'Финансы', icon: Wallet },
  { id: 'activity', label: 'Продажи и возвраты', icon: ShoppingBag },
] as const;
export default function App() {
  const dispatch = useAppDispatch();
  const ui = useAppSelector((state) => state.ui);
  const panel = new URLSearchParams(window.location.search).get('view') === 'panel';
  const {
    currentData: cachedSnapshot,
    isFetching,
    isError,
    error,
    refetch,
  } = useSnapshotQuery({ cabinetId: 'demo-store', period: ui.period, scenario: ui.scenario });
  const issue = isError && !isFetching ? toLoadIssue(error) : undefined;
  const snapshot = !issue || canShowPrevious(issue) ? cachedSnapshot : undefined;
  const fatal = !!issue && !snapshot;
  const retrySeconds = useRetryCountdown(issue?.retryAt);
  const refresh = () => {
    if (!isFetching && (issue?.retryAt ?? 0) <= Date.now()) void refetch();
  };
  const loadNotice =
    snapshot && issue ? (
      <LoadNotice
        issue={issue}
        operationsTime={snapshot.sources.operations}
        inventoryTime={snapshot.sources.inventory}
        busy={isFetching}
        retrySeconds={retrySeconds}
        onRetry={refresh}
        compact={panel}
      />
    ) : undefined;
  const [desktopError, setDesktopError] = useState<string | null>(null);
  useAppearance();
  useEffect(() => {
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || ui.settingsOpen) return;
      event.preventDefault();
      void closePanel().catch(() => setDesktopError('Не удалось закрыть панель.'));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [panel, ui.settingsOpen]);
  const open = async (page: Page) => {
    if (panel) {
      try {
        await openDetails(page, ui.period, ui.scenario);
        setDesktopError(null);
      } catch {
        setDesktopError('Не удалось открыть окно. Попробуйте ещё раз.');
      }
    } else dispatch(actions.pageChanged(page));
  };
  const content = fatal ? (
    <div className="empty-card error-card" role="alert">
      <CircleAlert size={32} />
      <h2>Не удалось загрузить сводку</h2>
      <p>{issue.message}</p>
      <small>Это проверка на демоданных. Данные реального кабинета не запрашиваются.</small>
      <button
        className="primary-button"
        onClick={() => dispatch(actions.scenarioChanged('normal'))}
      >
        Вернуться к демосводке
      </button>
      <button className="text-button" disabled={isFetching || retrySeconds > 0} onClick={refresh}>
        {retrySeconds > 0 ? `Повтор через ${retrySeconds} с` : 'Повторить загрузку'}
        <RefreshCw size={15} />
      </button>
    </div>
  ) : !snapshot ? (
    <div className="loading-state" role="status">
      <span className="loading-orbit" />
      <strong>Собираем картину магазина</strong>
      <p>Загружаем демонстрационный снимок…</p>
    </div>
  ) : panel ? (
    <Panel
      snapshot={snapshot}
      onOpen={(page) => void open(page)}
      refreshing={isFetching}
      onRefresh={refresh}
      loadNotice={loadNotice}
      retryBlocked={retrySeconds > 0}
    />
  ) : ui.page === 'stocks' ? (
    <Stocks snapshot={snapshot} />
  ) : ui.page === 'finance' ? (
    <Finance snapshot={snapshot} />
  ) : ui.page === 'activity' ? (
    <Activity snapshot={snapshot} />
  ) : (
    <Overview snapshot={snapshot} />
  );
  if (panel)
    return (
      <div className="panel-host">
        {!isDesktop() && (
          <a className="panel-demo-back" href="./">
            <ArrowLeft size={14} />
            Вернуться к обзору
          </a>
        )}
        {content}
        {fatal && (
          <button
            className="text-button panel-recovery"
            onClick={() => dispatch(actions.settingsToggled())}
          >
            Настройки
          </button>
        )}
        {desktopError && (
          <p role="alert" className="inline-warning">
            {desktopError}
          </p>
        )}
        <Settings />
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-card">
          <span className="store-avatar">S</span>
          <span>
            <strong>Studio Store</strong>
            <small>Демонстрационный кабинет</small>
          </span>
        </div>
        <div className="nav-caption">МАГАЗИН</div>
        <nav aria-label="Разделы приложения">
          {pages.map((page) => (
            <button
              key={page.id}
              className={`nav-link ${ui.page === page.id ? 'active' : ''}`}
              aria-current={ui.page === page.id ? 'page' : undefined}
              onClick={() => dispatch(actions.pageChanged(page.id))}
            >
              <page.icon size={19} />
              {page.label}
              {ui.page === page.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span className="demo-card-icon">
              <Command size={20} />
            </span>
            <strong>
              Маленькое окно.
              <br />
              Большая картина.
            </strong>
            <p>Сводка магазина всегда рядом — в строке меню Mac.</p>
            <button
              className="demo-panel-link"
              onClick={() =>
                void openPanel().catch(() => setDesktopError('Не удалось открыть мини-панель'))
              }
            >
              Открыть мини-панель
              <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="nav-link" onClick={() => dispatch(actions.settingsToggled())}>
            <Settings2 size={19} />
            Настройки
          </button>
          <div className="sidebar-version">
            <span className="status-dot" />
            Прототип 0.1<span>macOS</span>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            Магазин<span>/</span>
            <strong>{pages.find((p) => p.id === ui.page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-badge">ДЕМО · БЕЗ WB API</span>
            <RefreshButton
              label="Обновить демоданные"
              busy={isFetching}
              disabled={retrySeconds > 0}
              onClick={refresh}
            />
            <button
              className="icon-button"
              aria-label="О возможностях уведомлений"
              onClick={() => dispatch(actions.settingsToggled())}
            >
              <Bell size={18} />
            </button>
            <span className="avatar">И</span>
          </div>
        </header>
        <main id="main-content">
          <div className="context-bar">
            <span>
              <span className="live-indicator" />
              Личный кабинет продавца
            </span>
            <div className="period-tabs" role="group" aria-label="Период">
              {periodOptions.map((period) => (
                <button
                  key={period.value}
                  aria-pressed={ui.period === period.value}
                  className={ui.period === period.value ? 'selected' : ''}
                  onClick={() => dispatch(actions.periodChanged(period.value))}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          {loadNotice}
          {content}
        </main>
        <footer className="app-footer">
          <span>
            <CircleHelp size={14} />
            Реальные данные пока не подключены
          </span>
          <label>
            Демосценарий
            <Select
              label="Демосценарий"
              value={ui.scenario}
              options={scenarioOptions}
              onChange={(value) => dispatch(actions.scenarioChanged(value))}
            />
          </label>
        </footer>
      </div>
      <Settings />
      {desktopError && (
        <p role="alert" className="desktop-error">
          {desktopError}
        </p>
      )}
    </div>
  );
}
