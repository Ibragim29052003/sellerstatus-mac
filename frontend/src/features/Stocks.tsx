import {
  ArrowDownLeft,
  ArrowLeft,
  Boxes,
  ChevronRight,
  Filter,
  Package,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { actions, useAppDispatch, useAppSelector } from '../app/store';
import {
  count,
  coverOf,
  filterProducts,
  isLowStock,
  money,
  sourceTime,
  stockOf,
  stockTotals,
} from '../data/selectors';
import type { Snapshot } from '../data/types';
import { Select } from '../components/Select';
import { stockOptions } from '../data/options';
import { ProductTile, Quantity, SectionTitle } from '../components/ui';
export default function Stocks({ snapshot: s }: { snapshot: Snapshot }) {
  const ui = useAppSelector((state) => state.ui);
  const dispatch = useAppDispatch();
  const products = filterProducts(s.products, ui.query, ui.warehouse, ui.stockFilter);
  const selected = s.products.find((p) => p.id === ui.productId);
  const totals = stockTotals(s.products);
  const filtered = !!ui.query || ui.warehouse !== 'all' || ui.stockFilter !== 'all';
  if (selected)
    return (
      <>
        <button className="back-button" onClick={() => dispatch(actions.productSelected(null))}>
          <ArrowLeft size={17} />К списку товаров
        </button>
        <div className="product-detail-title">
          <ProductTile product={selected} />
          <div>
            <div className="eyebrow">
              {selected.article} · АРТИКУЛ WB {selected.id}
            </div>
            <h1>{selected.name}</h1>
            <p>{selected.category} · демонстрационный товар</p>
          </div>
        </div>
        <div className="metrics-grid">
          <div className="number-card">
            <Boxes />
            <span>На складах</span>
            <strong>
              <Quantity value={stockOf(selected)} />
            </strong>
          </div>
          <div className="number-card">
            <Truck />
            <span>К покупателям</span>
            <strong>
              <Quantity value={selected.toBuyer} />
            </strong>
          </div>
          <div className="number-card">
            <ArrowDownLeft />
            <span>Обратно на WB</span>
            <strong>
              <Quantity value={selected.fromBuyer} />
            </strong>
          </div>
        </div>
        <section className="surface">
          <SectionTitle
            title="Распределение запаса"
            subtitle={`Снимок: ${sourceTime(s.sources.inventory)} МСК`}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Склад / группа</th>
                  <th>Размер</th>
                  <th>Баркод</th>
                  <th className="numeric">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {selected.positions.map((p) => (
                  <tr key={`${p.warehouseId}-${p.barcode}`}>
                    <td>{s.warehouses.find((w) => w.id === p.warehouseId)?.name}</td>
                    <td>{p.size}</td>
                    <td className="mono">{p.barcode}</td>
                    <td className="numeric">
                      <Quantity value={p.quantity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-note">
            «Склад WB РФ» — обобщённая группа, а не отдельный физический склад.
          </p>
        </section>
        <div className="surface explanation">
          <h2>Что это значит</h2>
          <p>
            Запаса примерно на {coverOf(selected)?.toFixed(1).replace('.', ',') ?? '—'} дня при
            демонстрационном спросе {selected.dailyDemand} шт./день. Это ориентир по текущему запасу
            без ожидаемых поставок.
          </p>
          <p>
            Себестоимость единицы:{' '}
            <strong>
              {selected.unitCost === null ? 'Не заполнена' : money(selected.unitCost)}
            </strong>
            .
          </p>
        </div>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ТОВАРЫ И ДВИЖЕНИЕ</div>
          <h1>
            Остатки<span className="heading-dot">.</span>
          </h1>
          <p>От общей картины — к каждому размеру.</p>
        </div>
        <span className="date-chip">
          <Boxes size={16} />
          <Quantity value={totals.stock} />
        </span>
      </div>
      {s.sources.inventoryStatus === 'stale' && (
        <div className="inline-warning" role="status">
          Остатки устарели. Показан снимок от {sourceTime(s.sources.inventory)} МСК.
        </div>
      )}
      <div className="warehouse-grid">
        <button
          className={`warehouse-card ${ui.warehouse === 'all' ? 'selected' : ''}`}
          onClick={() => dispatch(actions.warehouseChanged('all'))}
        >
          <span className="warehouse-symbol">
            <Boxes size={21} />
          </span>
          <strong>Все склады</strong>
          <small>{s.warehouses.length} группы источника</small>
          <b>
            <Quantity value={totals.stock} />
          </b>
        </button>
        {s.warehouses.map((w) => (
          <button
            key={w.id}
            className={`warehouse-card ${ui.warehouse === w.id ? 'selected' : ''}`}
            onClick={() => dispatch(actions.warehouseChanged(w.id))}
          >
            <span className="warehouse-symbol">
              <Package size={21} />
            </span>
            <strong>{w.name}</strong>
            <small>{w.description}</small>
            <b>
              <Quantity value={s.products.reduce((sum, p) => sum + stockOf(p, w.id), 0)} />
            </b>
          </button>
        ))}
      </div>
      <section className="surface stock-table">
        <SectionTitle
          title={
            ui.warehouse === 'all'
              ? 'Все товары'
              : (s.warehouses.find((w) => w.id === ui.warehouse)?.name ?? 'Товары')
          }
          subtitle="В пути — по товару в целом, без распределения по складам"
        />
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Поиск товаров"
              value={ui.query}
              placeholder="Название, артикул или баркод"
              onChange={(e) => dispatch(actions.queryChanged(e.target.value))}
            />
            {ui.query && (
              <button
                aria-label="Очистить поиск"
                onClick={() => dispatch(actions.queryChanged(''))}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <label className="filter-select">
            <Filter size={16} />
            <Select
              label="Фильтр запаса"
              value={ui.stockFilter}
              options={stockOptions}
              onChange={(value) => dispatch(actions.stockFilterChanged(value))}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th className="numeric">На складе</th>
                <th className="numeric">К покупателю</th>
                <th className="numeric">Обратно на WB</th>
                <th>Запас в целом</th>
                <th>
                  <span className="sr-only">Подробнее</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="product-cell"
                      onClick={() => dispatch(actions.productSelected(p.id))}
                    >
                      <ProductTile product={p} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.article}</small>
                      </span>
                    </button>
                  </td>
                  <td className="numeric">{count(stockOf(p, ui.warehouse))}</td>
                  <td className="numeric">{p.toBuyer}</td>
                  <td className="numeric">{p.fromBuyer}</td>
                  <td>
                    <span className={`cover-badge ${isLowStock(p) ? '' : 'healthy'}`}>
                      {coverOf(p) === null
                        ? 'Нет спроса'
                        : `~ ${coverOf(p)!.toFixed(1).replace('.', ',')} дн.`}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Подробнее: ${p.name}`}
                      onClick={() => dispatch(actions.productSelected(p.id))}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && (
          <div className="empty-card">
            <Search size={28} />
            <h3>Ничего не найдено</h3>
            <p>Попробуйте другой запрос или сбросьте фильтры.</p>
          </div>
        )}
        <div className="table-bottom">
          <span>Найдено товаров: {products.length}</span>
          {filtered && (
            <button className="text-button" onClick={() => dispatch(actions.filtersReset())}>
              Сбросить фильтры
              <X size={13} />
            </button>
          )}
        </div>
      </section>
      <p className="footnote">
        Складские группы показаны в доступной детализации источника. Не распределяем обобщённый
        остаток по предполагаемым складам.
      </p>
    </>
  );
}
