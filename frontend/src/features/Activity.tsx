import { CircleCheck, CircleHelp, ShoppingBag } from 'lucide-react';
import type { Snapshot } from '../data/types';
import { count, money } from '../data/selectors';
export default function Activity({ snapshot: s }: { snapshot: Snapshot }) {
  const rows = [
    {
      label: 'Созданные заказы',
      count: s.operations.orders,
      amount: s.operations.orderAmount,
      description: 'Количество заказанных единиц и сумма заказов за выбранный период.',
    },
    {
      label: 'Выкупленные товары',
      count: s.operations.sales,
      amount: s.operations.revenue,
      description:
        'Выкупы за период до вычета возвратов. Заказ и выкуп могут относиться к разным дням.',
    },
    {
      label: 'Возвраты покупателей',
      count: s.operations.returns,
      amount: s.operations.returnAmount,
      description:
        'Зарегистрированные возвраты за период. Это не количество всех товаров в обратном пути.',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ОПЕРАЦИИ ЗА ПЕРИОД</div>
          <h1>
            Движение продаж<span className="heading-dot">.</span>
          </h1>
          <p>Заказы, выкупы и возвраты — отдельно.</p>
        </div>
      </div>
      <div className="activity-list">
        {rows.map((row) => (
          <section className="surface activity-card" key={row.label}>
            <span className="flow-icon purple">
              <ShoppingBag size={22} />
            </span>
            <div>
              <h2>{row.label}</h2>
              <p>{row.description}</p>
            </div>
            <div className="activity-value">
              <strong>{count(row.count)} шт.</strong>
              <span>{money(row.amount)}</span>
            </div>
          </section>
        ))}
      </div>
      <div className="surface explanation">
        <h2>
          <CircleHelp size={20} /> Что доступно сейчас
        </h2>
        <p>
          В прототипе показаны агрегаты на вымышленных данных. Построчный список реальных операций
          будет доступен после подключения API SellerStatus.
        </p>
        <p>
          <CircleCheck size={16} /> Переключение периода меняет операции, но не текущий снимок
          остатков.
        </p>
      </div>
    </>
  );
}
