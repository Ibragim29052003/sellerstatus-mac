import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  CircleAlert,
  Clock3,
  Package,
  ShoppingBag,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { actions, useAppDispatch } from '../app/store';
import {
  buildAlerts,
  count,
  coverOf,
  estimatedProfit,
  isLowStock,
  money,
  sourceTime,
  stockOf,
  stockTotals,
} from '../data/selectors';
import type { Page, Snapshot } from '../data/types';
import {
  ProductTile,
  Quantity,
  SectionTitle,
  Sparkline,
  StatCard,
  TextButton,
} from '../components/ui';
export default function Overview({ snapshot: s }: { snapshot: Snapshot }) {
  const dispatch = useAppDispatch();
  const go = (page: Page) => dispatch(actions.pageChanged(page));
  const totals = stockTotals(s.products);
  const profit = estimatedProfit(s);
  const alerts = buildAlerts(s);
  const low = s.products.filter(isLowStock);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ВАШ МАГАЗИН В ОДНОМ ОКНЕ</div>
          <h1>
            Всё под контролем<span className="heading-dot">.</span>
          </h1>
          <p>Главные цифры и то, что требует внимания.</p>
        </div>
        <span className="date-chip">
          <Clock3 size={15} />
          29 октября · демоснимок
        </span>
      </div>
      {alerts.length > 0 && (
        <section className="attention">
          <div className="attention-label">
            <CircleAlert size={18} />
            <strong>Важное</strong>
            <span className="small-badge">{alerts.length}</span>
          </div>
          {alerts.slice(0, 2).map((alert) => (
            <button
              key={alert.id}
              className="attention-item"
              onClick={() => {
                if (alert.id === 'low') dispatch(actions.stockFilterChanged('low'));
                go(alert.target);
              }}
            >
              <span>
                <strong>{alert.title}</strong>
                <small>{alert.description}</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </section>
      )}
      {!s.products.length && (
        <div className="empty-card">
          <Package size={32} />
          <h2>Начнём с чистого листа</h2>
          <p>В этом демонстрационном кабинете пока нет товаров и операций.</p>
        </div>
      )}
      <div className="metrics-grid">
        <StatCard
          label="Заказы"
          value={count(s.operations.orders)}
          detail={`${money(s.operations.orderAmount)} · сумма заказов`}
          icon={<ShoppingBag size={19} />}
          onClick={() => go('activity')}
        />
        <StatCard
          label="Выкупы"
          value={count(s.operations.sales)}
          detail={`${money(s.operations.revenue)} · до возвратов`}
          icon={<TrendingUp size={19} />}
          onClick={() => go('activity')}
        />
        <StatCard
          label="Возвраты покупателей"
          value={count(s.operations.returns)}
          detail={`${money(s.operations.returnAmount)} · за период`}
          icon={<ArrowDownLeft size={19} />}
          onClick={() => go('activity')}
        />
      </div>
      <div className="overview-columns">
        <section className={`profit-card ${profit !== null && profit < 0 ? 'loss' : ''}`}>
          <div className="profit-head">
            <span>Расчётный результат</span>
            <span className="estimate-pill">Предварительно</span>
          </div>
          <button className="profit-value" onClick={() => go('finance')}>
            {profit === null ? 'Недостаточно данных' : `${profit > 0 ? '+' : ''}${money(profit)}`}
            <ArrowUpRight size={22} />
          </button>
          <p>
            {profit === null
              ? 'Заполните себестоимость, чтобы увидеть итог.'
              : 'По оперативной выплате и учтённым затратам.'}
          </p>
          <span className="chart-caption">Накопленный результат · демо</span>
          <Sparkline values={s.trend} />
          <div className="profit-footer">
            <span>Все расходы ещё не подтверждены</span>
            <button onClick={() => go('finance')}>
              Как посчитано
              <ChevronRight size={14} />
            </button>
          </div>
        </section>
        <section className="surface flow-card">
          <SectionTitle
            title="Где сейчас товары"
            action={
              <button
                className="icon-button"
                aria-label="Открыть остатки"
                onClick={() => go('stocks')}
              >
                <ArrowUpRight size={18} />
              </button>
            }
          />
          <button
            className="flow-row"
            onClick={() => {
              dispatch(actions.stockFilterChanged('all'));
              go('stocks');
            }}
          >
            <span className="flow-icon purple">
              <Boxes size={18} />
            </span>
            <span>На складах WB</span>
            <strong>
              <Quantity value={totals.stock} />
            </strong>
            <ChevronRight size={15} />
          </button>
          <button
            className="flow-row"
            onClick={() => {
              dispatch(actions.stockFilterChanged('inTransit'));
              go('stocks');
            }}
          >
            <span className="flow-icon blue">
              <Truck size={18} />
            </span>
            <span>К покупателям</span>
            <strong>
              <Quantity value={totals.toBuyer} />
            </strong>
            <ChevronRight size={15} />
          </button>
          <button
            className="flow-row"
            onClick={() => {
              dispatch(actions.stockFilterChanged('inTransit'));
              go('stocks');
            }}
          >
            <span className="flow-icon peach">
              <ArrowDownLeft size={18} />
            </span>
            <span>Обратно на WB</span>
            <strong>
              <Quantity value={totals.fromBuyer} />
            </strong>
            <ChevronRight size={15} />
          </button>
          <div className="flow-row unavailable">
            <span className="flow-icon neutral">
              <Package size={18} />
            </span>
            <span>
              Возвращается мне<small>Источник ещё не подключён</small>
            </span>
            <strong>—</strong>
          </div>
        </section>
      </div>
      <section className="surface">
        <SectionTitle
          title="Запас под вниманием"
          subtitle="Порог демоправила — менее 7 дней запаса"
          action={<TextButton onClick={() => go('stocks')}>Все товары</TextButton>}
        />
        {low.length ? (
          <div className="low-list">
            {low.map((p) => (
              <button
                key={p.id}
                className="low-item"
                onClick={() => {
                  go('stocks');
                  dispatch(actions.productSelected(p.id));
                }}
              >
                <ProductTile product={p} />
                <span className="product-name">
                  <strong>{p.name}</strong>
                  <small>{p.article}</small>
                </span>
                <span className="low-stock">
                  <Quantity value={stockOf(p)} />
                  <small>остаток</small>
                </span>
                <span className="cover-badge">
                  ~ {coverOf(p)?.toFixed(1).replace('.', ',')} дн.
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-inline">Товаров с низким запасом в этом снимке нет.</p>
        )}
      </section>
      <footer className="source-footer">
        <span
          className={s.sources.inventoryStatus === 'stale' ? 'status-dot warning' : 'status-dot'}
        />
        <span>
          Операции: {sourceTime(s.sources.operations)} МСК · остатки:{' '}
          {sourceTime(s.sources.inventory)}
        </span>
        <span className="demo-foot">Только демонстрационные данные</span>
      </footer>
    </>
  );
}
