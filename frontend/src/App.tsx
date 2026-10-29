import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Boxes,
  CircleAlert,
  CircleHelp,
  Command,
  LayoutDashboard,
  Monitor,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react';
import { actions, useAppDispatch, useAppSelector } from './app/store';
import { useSnapshotQuery } from './app/api';
import { useAppearance } from './app/useAppearance';
import { isDesktop, openDetails, openPanel, closePanel } from './app/desktop';
import type { Page, Period, Scenario, Theme } from './data/types';
import { Brand } from './components/ui';
import Overview from './features/Overview';
import Stocks from './features/Stocks';
import Finance from './features/Finance';
import Activity from './features/Activity';
import Panel from './features/Panel';
const pages = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'stocks', label: 'Остатки и склады', icon: Boxes },
  { id: 'finance', label: 'Финансы', icon: Wallet },
  { id: 'activity', label: 'Продажи и возвраты', icon: ShoppingBag },
] as const;
const scenarios: { id: Scenario; label: string }[] = [
  { id: 'normal', label: 'Обычный день' },
  { id: 'loss', label: 'Убыток' },
  { id: 'partial', label: 'Неполные данные' },
  { id: 'stale', label: 'Устаревшие остатки' },
  { id: 'empty', label: 'Пустой кабинет' },
  { id: 'error', label: 'Ошибка сервера' },
];
function Settings() {
  const dispatch = useAppDispatch();
  const { settingsOpen, theme, scenario, themeError } = useAppSelector((state) => state.ui);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (settingsOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [settingsOpen]);
  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      onCancel={() => dispatch(actions.settingsToggled())}
      onClick={(e) => {
        if (e.target === e.currentTarget) dispatch(actions.settingsToggled());
      }}
    >
      <div className="modal-heading">
        <h2>Настройки прототипа</h2>
        <button
          className="icon-button"
          aria-label="Закрыть настройки"
          onClick={() => dispatch(actions.settingsToggled())}
        >
          <X size={20} />
        </button>
      </div>
      <label className="settings-field">
        Оформление
        <select
          value={theme}
          onChange={(e) => dispatch(actions.themeChanged(e.target.value as Theme))}
        >
          <option value="light">Светлое</option>
          <option value="dark">Тёмное</option>
          <option value="system">Как в системе</option>
        </select>
      </label>
      {themeError && (
        <p role="alert" className="inline-warning">
          {themeError}
        </p>
      )}
      <p className="settings-hint">
        По умолчанию — тема macOS. Выбор сохраняется и применяется к обоим окнам.
      </p>
      <label className="settings-field">
        Демонстрационный сценарий
        <select
          value={scenario}
          onChange={(e) => dispatch(actions.scenarioChanged(e.target.value as Scenario))}
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="settings-info">
        <Monitor size={20} />
        <p>
          Сейчас приложение работает на вымышленных данных. Авторизация SellerStatus, уведомления и
          автозапуск ещё не подключены.
        </p>
      </div>
      <button className="primary-button" onClick={() => dispatch(actions.settingsToggled())}>
        Готово
      </button>
    </dialog>
  );
}
export default function App() {
  const dispatch = useAppDispatch();
  const ui = useAppSelector((state) => state.ui);
  const panel = new URLSearchParams(window.location.search).get('view') === 'panel';
  const {
    currentData: snapshot,
    isFetching,
    isError,
    refetch,
  } = useSnapshotQuery({ period: ui.period, scenario: ui.scenario });
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
  const content = isError ? (
    <div className="empty-card error-card" role="alert">
      <CircleAlert size={32} />
      <h2>Не удалось загрузить сводку</h2>
      <p>Это сценарий ошибки на демоданных. Выберите другой сценарий, чтобы продолжить.</p>
      <button
        className="primary-button"
        onClick={() => dispatch(actions.scenarioChanged('normal'))}
      >
        Вернуться к демосводке
      </button>
      <button className="text-button" onClick={() => void refetch()}>
        Повторить загрузку
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
      onRefresh={() => void refetch()}
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
        {isError && (
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
            <button
              className="icon-button"
              aria-label="Обновить демоданные"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw size={17} className={isFetching ? 'spinning' : ''} />
            </button>
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
              {(
                [
                  { id: 'today', label: 'Сегодня' },
                  { id: 'yesterday', label: 'Вчера' },
                  { id: 'week', label: '7 дней' },
                ] satisfies { id: Period; label: string }[]
              ).map((period) => (
                <button
                  key={period.id}
                  aria-pressed={ui.period === period.id}
                  className={ui.period === period.id ? 'selected' : ''}
                  onClick={() => dispatch(actions.periodChanged(period.id))}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          {content}
        </main>
        <footer className="app-footer">
          <span>
            <CircleHelp size={14} />
            Реальные данные пока не подключены
          </span>
          <label>
            Демосценарий
            <select
              aria-label="Демосценарий"
              value={ui.scenario}
              onChange={(e) => dispatch(actions.scenarioChanged(e.target.value as Scenario))}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
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
