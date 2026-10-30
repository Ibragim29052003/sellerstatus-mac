import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Calculator,
  LoaderCircle,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Truck,
} from 'lucide-react';
import { Select } from '../components/Select';
import { RefreshButton } from '../components/RefreshButton';
import { periodOptions } from '../data/options';
import { PanelHeader } from '../components/PanelHeader';
import {
  buildAlerts,
  count,
  estimatedProfit,
  money,
  sourceTime,
  stockTotals,
} from '../data/selectors';
import type { Page, Snapshot } from '../data/types';
import { actions, useAppDispatch, useAppSelector } from '../app/store';
import type { ReactNode } from 'react';
export default function Panel({
  snapshot: s,
  onOpen,
  refreshing,
  onRefresh,
  loadNotice,
  retryBlocked = false,
  onPlanner,
  plannerBusy = false,
  plannerError,
}: {
  snapshot: Snapshot;
  onOpen: (page: Page) => void;
  refreshing: boolean;
  onRefresh: () => void;
  loadNotice?: ReactNode;
  retryBlocked?: boolean;
  onPlanner: () => void;
  plannerBusy?: boolean;
  plannerError?: string | null;
}) {
  const dispatch = useAppDispatch();
  const period = useAppSelector((state) => state.ui.period);
  const totals = stockTotals(s.products);
  const alerts = buildAlerts(s);
  const profit = estimatedProfit(s);
  return (
    <div className="tray-panel">
      <PanelHeader />
      <div className="panel-body">
        <div className="panel-store">
          <span className="store-dot" />
          <strong>{s.cabinet.name}</strong>
          <span className="demo-badge">ДЕМО</span>
        </div>
        <div className="panel-period">
          <h1>Пульс магазина</h1>
          <Select
            label="Период"
            value={period}
            options={periodOptions}
            onChange={(value) => dispatch(actions.periodChanged(value))}
          />
        </div>
        <p className="panel-date">Вымышленные данные · 29 октября 2026</p>
        {loadNotice ??
          (alerts.length > 0 && (
            <button className="panel-alert" onClick={() => onOpen(alerts[0].target)}>
              <CircleAlert size={19} />
              <span>
                <small>ВАЖНОЕ · {alerts.length}</small>
                <strong>{alerts[0].title}</strong>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
        <div className="panel-metrics">
          {[
            { label: 'Заказы', value: s.operations.orders },
            { label: 'Выкупы', value: s.operations.sales },
            { label: 'Возвраты', value: s.operations.returns },
          ].map((m) => (
            <button key={m.label} onClick={() => onOpen('activity')}>
              <span>{m.label}</span>
              <strong>{count(m.value)}</strong>
              <small>шт. за период</small>
            </button>
          ))}
        </div>
        <button
          className={`panel-profit ${profit !== null && profit < 0 ? 'negative' : ''}`}
          onClick={() => onOpen('finance')}
        >
          <span>
            Расчётный результат<small>Предварительно · расходы неполные</small>
          </span>
          <strong>{profit === null ? '—' : `${profit > 0 ? '+' : ''}${money(profit)}`}</strong>
          <ArrowUpRight size={18} />
        </button>
        <div className="panel-flows">
          {[
            { label: 'На складах WB', value: totals.stock, icon: Boxes },
            { label: 'К покупателям', value: totals.toBuyer, icon: Truck },
            { label: 'Обратно на WB', value: totals.fromBuyer, icon: ArrowDownLeft },
          ].map((row) => (
            <button key={row.label} onClick={() => onOpen('stocks')}>
              <row.icon size={17} />
              <span>{row.label}</span>
              <strong>
                {count(row.value)} <small>шт.</small>
              </strong>
              <ChevronRight size={14} />
            </button>
          ))}
          <div className="panel-unavailable">
            <span>Возвращается мне</span>
            <small>Источник не подключён</small>
          </div>
        </div>
        <footer className="panel-footer">
          <span>
            <i
              className={
                s.sources.inventoryStatus === 'stale' ? 'status-dot warning' : 'status-dot'
              }
            />
            {sourceTime(s.sources.operations)} МСК
          </span>
          <RefreshButton
            label="Перезагрузить демоснимок"
            busy={refreshing}
            onClick={onRefresh}
            disabled={retryBlocked}
          />
        </footer>
        {plannerError && (
          <p className="inline-warning" role="alert">
            {plannerError}
          </p>
        )}
        <div className="panel-launch-actions">
          <button
            className="primary-button panel-open"
            aria-label="Открыть подробности"
            onClick={() => onOpen('overview')}
          >
            Подробнее
            <ExternalLink size={16} />
          </button>
          <button
            className="secondary-button"
            onClick={onPlanner}
            disabled={plannerBusy}
            aria-busy={plannerBusy}
          >
            {plannerBusy ? (
              <LoaderCircle size={16} className="spinning" />
            ) : (
              <Calculator size={16} />
            )}
            {plannerBusy ? 'Открываем…' : 'Планировщик'}
          </button>
        </div>
      </div>
    </div>
  );
}
