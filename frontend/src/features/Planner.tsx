import {
  ArrowUpRight,
  Calculator,
  FolderHeart,
  HardDrive,
  Import,
  LoaderCircle,
} from 'lucide-react';
import { isDesktop } from '../app/desktop';
export default function Planner({
  busy,
  error,
  onOpen,
}: {
  busy: boolean;
  error: string | null;
  onOpen: () => void;
}) {
  return (
    <section className="planner-launcher">
      <span className="planner-symbol">
        <Calculator size={30} />
      </span>
      <span className="eyebrow">ПОСТАВКИ · ЛОКАЛЬНЫЙ МОДУЛЬ</span>
      <h1>От остатков — к плану поставки</h1>
      <p className="planner-intro">
        Рассчитайте потребность, учтите товары в пути и сравните сценарии. Знакомый планировщик
        открывается в отдельном окне внутри SellerStatus.
      </p>
      <button
        className="primary-button"
        disabled={busy || !isDesktop()}
        aria-busy={busy}
        onClick={onOpen}
      >
        {busy ? <LoaderCircle size={18} className="spinning" /> : <Calculator size={18} />}
        {busy ? 'Запускаем планировщик…' : 'Открыть планировщик'}
        {!busy && <ArrowUpRight size={17} />}
      </button>
      <div aria-live="polite">
        {busy && (
          <p className="planner-launch-status">Первый запуск может занять несколько секунд.</p>
        )}
      </div>
      {error && (
        <p className="inline-warning" role="alert">
          {error}
        </p>
      )}
      {!isDesktop() && (
        <p className="inline-warning">
          Откройте приложение для Mac, чтобы пользоваться локальным планировщиком.
        </p>
      )}
      <div className="planner-explainer">
        <article>
          <FolderHeart size={21} />
          <h2>Сценарии под рукой</h2>
          <p>
            Закрытие окна сохраняет текущий расчёт. Сценарии доступны после перезапуска приложения.
          </p>
        </article>
        <article>
          <Import size={21} />
          <h2>Перенос через JSON</h2>
          <p>
            Экспортируйте сценарий в браузерной версии и импортируйте его здесь. Исходный проект
            остаётся на месте.
          </p>
        </article>
        <article>
          <HardDrive size={21} />
          <h2>Данные на вашем Mac</h2>
          <p>
            Собственное локальное хранилище. Сводка магазина пока демонстрационная и автоматически в
            расчёты не переносится.
          </p>
        </article>
      </div>
    </section>
  );
}
