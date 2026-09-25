import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]')];
    (ref.current?.querySelector<HTMLElement>('[autofocus], input') ?? focusables()[0])?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } if (event.key === 'Tab') { const items = focusables(); const first = items[0], last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } };
    const element = ref.current!; element.addEventListener('keydown', key);
    return () => { element.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="dialog" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}><header><h2 id={id}>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20}/></button></header>{children}</div></div>;
}
