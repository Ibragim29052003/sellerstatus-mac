import { Settings2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { actions, useAppDispatch } from '../app/store';
import { usePanelLayout } from '../app/usePanelLayout';
import { Brand } from './ui';

export function PanelHeader() {
  const dispatch = useAppDispatch();
  const layout = usePanelLayout();
  const style = {
    '--panel-cutout-width': `${layout.cutoutWidth > 0 ? layout.cutoutWidth + 24 : 0}px`,
    '--panel-header-height': `${layout.headerHeight}px`,
  } as CSSProperties;
  return (
    <header className="panel-header integrated-header" style={style}>
      <Brand compact />
      <span aria-hidden="true" />
      <button
        className="icon-button"
        aria-label="Открыть настройки"
        title="Настройки"
        onClick={() => dispatch(actions.settingsToggled())}
      >
        <Settings2 size={17} aria-hidden="true" />
      </button>
    </header>
  );
}
