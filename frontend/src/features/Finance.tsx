import { ArrowDownLeft, ArrowRight, CircleHelp, Receipt, Wallet } from 'lucide-react';
import { estimatedProfit, money } from '../data/selectors';
import type { Snapshot } from '../data/types';
import { SectionTitle, Sparkline } from '../components/ui';
export default function Finance({ snapshot: s }: { snapshot: Snapshot }) {
  const profit = estimatedProfit(s);
  const rows = [
    {
      label: 'Оперативная выплата за товары',
      value: s.finance.payout,
      note: 'После возвратов и товарных удержаний; предварительно',
    },
    {
      label: 'Себестоимость проданного',
      value: -s.finance.cogs,
      note: `Покрытие операций: ${s.finance.costCoverage}%`,
    },
    {
      label: 'Учтённые расходы',
      value: -s.finance.expenses,
      note: 'Демонстрационный журнал расходов',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ДОХОДЫ И РАСХОДЫ</div>
          <h1>
            Финансовая картина<span className="heading-dot">.</span>
          </h1>
          <p>Понятный расчёт с открытыми ограничениями.</p>
        </div>
      </div>
      <div className="inline-warning">
        <CircleHelp size={18} />
        Расчёт предварительный. Полнота расходов не подтверждена; это не сумма к выводу с WB.
      </div>
      <div className="overview-columns">
        <section className={`profit-card ${profit !== null && profit < 0 ? 'loss' : ''}`}>
          <div className="profit-head">
            <Wallet size={20} />
            <span className="estimate-pill">Расчёт</span>
          </div>
          <h2>Результат за период</h2>
          <div className="finance-result">{profit === null ? 'Не определён' : money(profit)}</div>
          <p>
            {profit === null
              ? 'Сначала заполните недостающую себестоимость.'
              : 'По известным выплатам, себестоимости и журналу.'}
          </p>
          <span className="chart-caption">Накопленный результат · демо</span>
          <Sparkline values={s.trend} />
        </section>
        <section className="surface">
          <SectionTitle title="Состав расчёта" />
          {rows.map((row) => (
            <div className="finance-row" key={row.label}>
              <span>
                <strong>{row.label}</strong>
                <small>{row.note}</small>
              </span>
              <b>{money(row.value)}</b>
            </div>
          ))}
          <div className="finance-row total">
            <strong>Расчётный результат</strong>
            <b>{profit === null ? '—' : money(profit)}</b>
          </div>
        </section>
      </div>
      <div className="metrics-grid">
        <div className="surface finance-mini">
          <Receipt />
          <span>Выкупы до возвратов</span>
          <strong>{money(s.operations.revenue)}</strong>
        </div>
        <div className="surface finance-mini">
          <ArrowDownLeft />
          <span>Возвраты покупателей</span>
          <strong>{money(s.operations.returnAmount)}</strong>
        </div>
        <div className="surface finance-mini">
          <Wallet />
          <span>Финансовая сверка WB</span>
          <strong className="unconnected">Не подключена</strong>
        </div>
      </div>
      <section className="surface explanation">
        <h2>Как читать эти цифры</h2>
        <p>
          Расчётный результат = оперативная выплата − известная себестоимость − учтённые расходы.
          Выплата WB уже используется в формуле; комиссию из неё повторно не вычитаем.
        </p>
        <p>
          Финансовые отчёты могут уточнить начисления. Незаполненные расходы не означают отсутствие
          расходов, а неизвестная себестоимость не считается нулевой.
        </p>
        <div className="contract-note">
          <ArrowRight size={17} />
          Следующий этап: сверить расчёт с контрактом SellerStatus и подключить реальные данные.
        </div>
      </section>
    </>
  );
}
