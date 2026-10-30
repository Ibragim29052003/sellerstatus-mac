import { useEffect, useId, useRef } from 'react';
import { Monitor, X } from 'lucide-react';
import { actions, useAppDispatch, useAppSelector } from '../app/store';
import { scenarioOptions, themeOptions } from '../data/options';
import { Select } from '../components/Select';

export default function Settings() {
  const dispatch = useAppDispatch();
  const { settingsOpen, theme, scenario, themeError } = useAppSelector((state) => state.ui);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (settingsOpen) {
      dialog.current?.showModal();
      heading.current?.focus({ preventScroll: true });
    } else dialog.current?.close();
  }, [settingsOpen]);
  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      aria-labelledby={titleId}
      onCancel={() => dispatch(actions.settingsToggled())}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        )
          dispatch(actions.settingsToggled());
      }}
    >
      <div className="modal-heading">
        <h2 ref={heading} id={titleId} tabIndex={-1}>
          Настройки прототипа
        </h2>
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
        <Select
          label="Оформление"
          value={theme}
          options={themeOptions}
          onChange={(value) => dispatch(actions.themeChanged(value))}
        />
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
        <Select
          label="Демонстрационный сценарий"
          value={scenario}
          options={scenarioOptions}
          onChange={(value) => dispatch(actions.scenarioChanged(value))}
        />
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
