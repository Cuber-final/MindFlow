import dayjs from 'dayjs';
import type { NowItem } from '../../api/newsletter';
import { useI18n } from '../../i18n';

interface NowQueueListProps {
  items: NowItem[];
  activeAnchorId?: number | null;
  collapsed: boolean;
  disabled: boolean;
  loading: boolean;
  onToggleCollapsed: () => void;
  onSelectAnchor: (anchorId: number) => void;
}

function formatPublishedAt(value: string | null | undefined, noDateLabel: string) {
  if (!value) return noDateLabel;
  return dayjs(value).format('MMM D · HH:mm');
}

export default function NowQueueList({
  items,
  activeAnchorId,
  collapsed,
  disabled,
  loading,
  onToggleCollapsed,
  onSelectAnchor,
}: NowQueueListProps) {
  const { t } = useI18n();
  const zoneLabel = (zone: string) => {
    if (zone === 'main') return t('now.zones.main');
    if (zone === 'explore') return t('now.zones.explore');
    if (zone === 'discover' || zone === 'surprise') return t('now.zones.discover');
    return zone;
  };

  if (collapsed) {
    return (
      <div className="rounded-[28px] border border-[#c0c8cb]/15 bg-white p-4 shadow-[0_16px_40px_rgba(26,28,27,0.03)] xl:sticky xl:top-28 xl:self-start">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex w-full items-center justify-between rounded-2xl bg-[#f4f4f2] px-4 py-5 text-left text-sm text-[#40484b] transition-colors hover:bg-[#ecebe7]"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.queue.title')}</p>
            <p className="mt-2 text-2xl font-semibold text-[#1a1c1b]">{items.length}</p>
          </div>
          <span className="material-symbols-outlined text-[#0d4656]">right_panel_open</span>
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-[28px] border border-[#c0c8cb]/15 bg-white shadow-[0_16px_40px_rgba(26,28,27,0.03)] xl:sticky xl:top-28 xl:self-start">
      <div className="flex items-center justify-between border-b border-[#c0c8cb]/12 px-5 py-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.queue.title')}</p>
          <h3 className="mt-2 font-headline text-2xl text-[#1a1c1b]">{t('now.queue.priorityStack')}</h3>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-full border border-[#c0c8cb]/15 p-2 text-[#40484b] transition-colors hover:border-[#0d4656]/20 hover:text-[#0d4656]"
          aria-label={t('now.actions.collapseQueue')}
        >
          <span className="material-symbols-outlined">left_panel_close</span>
        </button>
      </div>

      <div className="max-h-[72vh] space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl bg-[#f4f4f2] px-4 py-5">
              <div className="h-3 w-24 rounded bg-[#e6e4de]" />
              <div className="mt-4 h-5 w-5/6 rounded bg-[#e6e4de]" />
              <div className="mt-3 h-16 rounded bg-[#e6e4de]" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#c0c8cb]/20 px-4 py-8 text-center text-sm leading-7 text-[#5e5e5e]">
            {t('now.queue.empty')}
          </div>
        ) : (
          items.map((item, index) => {
            const isActive = activeAnchorId === item.anchor_id;
            return (
              <button
                key={item.anchor_id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectAnchor(item.anchor_id)}
                className={`w-full rounded-[24px] border px-4 py-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive
                    ? 'border-[#0d4656]/18 bg-[#0d4656] text-white shadow-[0_20px_40px_rgba(13,70,86,0.15)]'
                    : 'border-[#c0c8cb]/12 bg-[#faf9f5] text-[#1a1c1b] hover:border-[#0d4656]/12 hover:bg-[#f1efea]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[10px] uppercase tracking-[0.24em] ${isActive ? 'text-white/70' : 'text-[#5e5e5e]'}`}>
                    #{String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.is_read && (
                      <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${isActive ? 'bg-white/12 text-white' : 'bg-[#dce8eb] text-[#0d4656]'}`}>
                        {t('now.labels.read')}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${isActive ? 'bg-white/12 text-white' : 'bg-[#f3ece4] text-[#784f28]'}`}>
                      {zoneLabel(item.zone)}
                    </span>
                  </div>
                </div>

                <h4 className="mt-4 text-lg font-semibold leading-7">{item.title}</h4>
                <p className={`mt-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 ${isActive ? 'text-white/78' : 'text-[#40484b]'}`}>
                  {item.excerpt || item.ai_summary}
                </p>

                <div className={`mt-4 flex flex-wrap items-center gap-2 text-[11px] ${isActive ? 'text-white/70' : 'text-[#5e5e5e]'}`}>
                  <span>{item.source_name}</span>
                  <span>·</span>
                  <span>{formatPublishedAt(item.published_at, t('now.queue.noDate'))}</span>
                  <span>·</span>
                  <span>{t('now.labels.score')} {item.priority_score.toFixed(2)}</span>
                </div>

                <p className={`mt-3 text-xs font-medium ${isActive ? 'text-[#d4edf4]' : 'text-[#0d4656]'}`}>
                  {item.priority_reason}
                </p>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
