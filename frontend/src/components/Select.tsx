import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

// Focus stays on the trigger; the active descendant is announced in the listbox.
// A portal within the nearest dialog keeps options inside its modal focus scope.
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    above: boolean;
    container: HTMLElement;
  } | null>(null);
  const [active, setActive] = useState(0);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const open = position !== null;
  const close = () => setPosition(null);
  const expand = () => {
    const rect = trigger.current!.getBoundingClientRect();
    const desired = Math.min(options.length * 40 + 12, 280);
    const above =
      window.innerHeight - rect.bottom - 12 < desired &&
      rect.top > window.innerHeight - rect.bottom;
    const height = Math.min(
      desired,
      Math.max(80, above ? rect.top - 12 : window.innerHeight - rect.bottom - 12),
    );
    const width = Math.min(Math.max(rect.width, 204), window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: above ? rect.top - height - 6 : rect.bottom + 6,
      width,
      height,
      above,
      container: trigger.current?.closest('dialog') ?? document.body,
    });
    setActive(selected);
    search.current = { text: '', time: 0 };
  };
  const choose = (index: number) => {
    onChange(options[index].value);
    close();
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popup.current?.contains(target)) close();
    };
    const onScroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, id, open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className={`select-trigger ${className}`}
        onClick={() => {
          trigger.current?.focus();
          if (open) close();
          else expand();
        }}
        onBlur={(event) => {
          if (!popup.current?.contains(event.relatedTarget as Node)) close();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === 'Tab') {
            close();
          } else if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (!open) {
              expand();
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') choose(active);
            else
              setActive((current) =>
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? options.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          options.length - 1,
                          current + (event.key === 'ArrowDown' ? 1 : -1),
                        ),
                      ),
              );
          } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            if (!open) expand();
            const now = Date.now();
            const text =
              (now - search.current.time < 600 ? search.current.text : '') +
              event.key.toLocaleLowerCase();
            search.current = { text, time: now };
            const index = options.findIndex((option) =>
              option.label.toLocaleLowerCase().startsWith(text),
            );
            if (index >= 0) setActive(index);
          }
        }}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {position &&
        createPortal(
          <div
            ref={popup}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className={`select-popup ${position.above ? 'above' : ''}`}
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.height,
            }}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                id={`${id}-${index}`}
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                className={`select-option ${index === active ? 'active' : ''}`}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {value === option.value && <Check size={15} aria-hidden="true" />}
              </div>
            ))}
          </div>,
          position.container,
        )}
    </>
  );
}
