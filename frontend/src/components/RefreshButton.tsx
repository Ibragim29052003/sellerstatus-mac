import { RefreshCw } from 'lucide-react';

export function RefreshButton({
  busy,
  onClick,
  label,
}: {
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="icon-button refresh-button"
      aria-label={busy ? 'Обновление…' : label}
      aria-busy={busy}
      disabled={busy}
      onClick={onClick}
      title={busy ? 'Обновление…' : label}
    >
      <RefreshCw size={17} className={busy ? 'spinning' : ''} aria-hidden="true" />
    </button>
  );
}
