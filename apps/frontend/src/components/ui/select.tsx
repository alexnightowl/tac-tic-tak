'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  /** Override the search-input placeholder. Defaults to "Search…". */
  searchPlaceholder?: string;
  /** Override the empty-state label. Defaults to "No results". */
  noResultsLabel?: string;
  className?: string;
};

/**
 * Custom searchable single-select. Native <select> looks different
 * on every device and doesn't fit the dark-glass theme; this one is
 * fully painted by us and behaves the same on desktop and mobile.
 *
 * Two layouts driven by a viewport-width media query:
 *   - desktop (>640px): floating dropdown anchored under the trigger
 *     via fixed positioning so parent overflow can't clip it; flips
 *     above when there isn't enough room below.
 *   - mobile (≤640px): full-width bottom sheet with a backdrop, so
 *     the keyboard gets room and tap targets are big enough.
 *
 * Search filters by label substring (locale-aware via toLowerCase),
 * keyboard nav is ↑/↓/Enter/Esc.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Search…',
  noResultsLabel = 'No results',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Track viewport size to switch dropdown vs bottom-sheet layout.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Reset query + highlight when the popover opens, focus the
  // search input, and try to scroll the currently selected option
  // into view. requestAnimationFrame waits a frame so the layout
  // settles before we measure / focus.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      const list = listRef.current;
      if (idx >= 0 && list) {
        const target = list.children.item(idx) as HTMLElement | null;
        target?.scrollIntoView({ block: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open, options, value]);

  // Keyboard navigation. Listen on window so it works regardless of
  // which child has focus (input vs an option button).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(filtered.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = filtered[highlight];
        if (pick) {
          onChange(pick.value);
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, highlight, onChange]);

  // Close on outside click. The trigger toggles via its own onClick
  // so we explicitly ignore clicks on it here to avoid open→close→
  // open flicker.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // Position the desktop dropdown under the trigger using fixed
  // coordinates so the surrounding card's overflow can't clip it.
  // Flip above when there isn't enough room below.
  const [pos, setPos] = useState<{ top: number; left: number; width: number; placement: 'below' | 'above' } | null>(null);
  useLayoutEffect(() => {
    if (!open || isMobile) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const spaceBelow = window.innerHeight - r.bottom;
      const placement: 'below' | 'above' = spaceBelow < 280 && r.top > spaceBelow ? 'above' : 'below';
      setPos({
        top: placement === 'below' ? r.bottom + 4 : r.top - 4,
        left: r.left,
        width: r.width,
        placement,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, isMobile]);

  // Keep the highlighted row scrolled into view as the user
  // arrows through the list.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const item = list?.children.item(highlight) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'h-11 w-full flex items-center justify-between gap-2 rounded-xl bg-white/5 border pl-3 pr-3 text-sm text-white transition-colors',
          'hover:bg-white/[0.07] focus:outline-none focus-visible:border-[var(--accent)]',
          open ? 'border-[var(--accent)]' : 'border-[var(--border)]',
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-zinc-500')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn('text-zinc-400 shrink-0 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <>
          {/* Backdrop. Mobile uses a real dim+blur so the sheet stands
              out; desktop uses a transparent layer that only catches
              taps for outside-close (kept as a div so Safari behaves
              consistently with mousedown listener above). */}
          <div
            className={cn(
              'fixed inset-0 z-50',
              isMobile ? 'bg-black/60 backdrop-blur-sm' : 'pointer-events-none',
            )}
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div
            ref={popoverRef}
            role="listbox"
            className={cn(
              'fixed z-[60] glass border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden',
              isMobile
                ? 'left-3 right-3 bottom-3 max-h-[70dvh] rounded-2xl'
                : 'rounded-xl max-h-[60dvh]',
            )}
            style={
              !isMobile && pos
                ? {
                    top: pos.placement === 'below' ? pos.top : undefined,
                    bottom: pos.placement === 'above' ? window.innerHeight - pos.top : undefined,
                    left: pos.left,
                    width: pos.width,
                  }
                : isMobile
                  ? { paddingBottom: 'env(safe-area-inset-bottom)' }
                  : undefined
            }
          >
            <div className="p-2 border-b border-[var(--border-soft)]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlight(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full h-9 rounded-lg bg-white/5 border border-[var(--border-soft)] pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <ul ref={listRef} className="overflow-y-auto py-1 flex-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-xs text-zinc-500 text-center">{noResultsLabel}</li>
              ) : (
                filtered.map((o, i) => {
                  const active = o.value === value;
                  const high = i === highlight;
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        onMouseEnter={() => setHighlight(i)}
                        className={cn(
                          'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors',
                          active
                            ? 'text-[var(--accent)] font-medium bg-[var(--accent)]/10'
                            : 'text-zinc-200',
                          high && !active && 'bg-white/[0.06]',
                        )}
                      >
                        <span className="truncate">{o.label}</span>
                        {active && <Check size={14} className="shrink-0" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
