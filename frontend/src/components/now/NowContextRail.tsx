import dayjs from 'dayjs';
import type { NowDetail, NowItem } from '../../api/newsletter';
import { useI18n } from '../../i18n';

interface NowContextRailProps {
  items: NowItem[];
  detail: NowDetail | null;
  fromDigestDate?: string | null;
  generatedAt?: string | null;
}

function formatTimestamp(value: string | null | undefined, unknownLabel: string) {
  if (!value) return unknownLabel;
  return dayjs(value).format('MMM D · HH:mm');
}

export default function NowContextRail({
  items,
  detail,
  fromDigestDate,
  generatedAt,
}: NowContextRailProps) {
  const { t } = useI18n();
  const unreadCount = items.filter((item) => !item.is_read).length;
  const topTags = Array.from(new Set(items.flatMap((item) => item.tags))).slice(0, 5);

  return (
    <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
      <section className="rounded-[28px] border border-[#c0c8cb]/15 bg-[#f7f5ef] p-6 shadow-[0_20px_60px_rgba(26,28,27,0.04)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5e5e5e]">{t('now.context.posture')}</p>
        <h2 className="mt-4 font-headline text-3xl leading-none text-[#1a1c1b]">{t('now.context.title')}</h2>
        <p className="mt-4 text-sm leading-7 text-[#40484b]">
          {t('now.context.description')}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/80 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.context.queue')}</p>
            <p className="mt-3 text-3xl font-semibold text-[#1a1c1b]">{items.length}</p>
            <p className="mt-1 text-xs text-[#5e5e5e]">{t('now.context.activeItems')}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.context.unread')}</p>
            <p className="mt-3 text-3xl font-semibold text-[#0d4656]">{unreadCount}</p>
            <p className="mt-1 text-xs text-[#5e5e5e]">{t('now.context.notMarkedRead')}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#c0c8cb]/12 bg-white/60 px-4 py-4 text-sm text-[#40484b]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.context.lastRefresh')}</p>
          <p className="mt-2 font-medium text-[#1a1c1b]">{formatTimestamp(generatedAt, t('now.context.unknown'))}</p>
        </div>
      </section>

      {fromDigestDate && (
        <section className="rounded-[28px] border border-[#c0c8cb]/15 bg-white px-6 py-5 shadow-[0_16px_40px_rgba(26,28,27,0.03)]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.context.arrivalContext')}</p>
          <p className="mt-3 text-sm leading-7 text-[#40484b]">
            {t('now.context.openedFromPrefix')} <span className="font-semibold text-[#1a1c1b]">{t('nav.dailyDigest')}</span> {t('now.context.openedFromSuffix')}{' '}
            {dayjs(fromDigestDate).format('MMMM D, YYYY')}.
          </p>
        </section>
      )}

      <section className="rounded-[28px] border border-[#c0c8cb]/15 bg-white px-6 py-5 shadow-[0_16px_40px_rgba(26,28,27,0.03)]">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.context.signalMap')}</p>
        {detail ? (
          <>
            <h3 className="mt-4 text-lg font-semibold leading-7 text-[#1a1c1b]">{detail.source_name}</h3>
            <p className="mt-2 text-sm leading-7 text-[#40484b]">{detail.priority_reason}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#0d4656]/12 bg-[#0d4656]/6 px-3 py-1 text-[11px] font-medium text-[#0d4656]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm leading-7 text-[#40484b]">{t('now.context.selectItemHint')}</p>
        )}
      </section>

      <section className="rounded-[28px] border border-[#c0c8cb]/15 bg-white px-6 py-5 shadow-[0_16px_40px_rgba(26,28,27,0.03)]">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.context.topTags')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {topTags.length > 0 ? (
            topTags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#f4f4f2] px-3 py-1 text-[11px] text-[#40484b]">
                {tag}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#5e5e5e]">{t('now.context.noTags')}</span>
          )}
        </div>
      </section>
    </aside>
  );
}
