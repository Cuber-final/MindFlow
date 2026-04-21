import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import type { NowDetail } from '../../api/newsletter';
import { useI18n } from '../../i18n';

interface NowDetailPaneProps {
  detail: NowDetail | null;
  loading: boolean;
  pendingAction: 'read' | 'processed' | null;
  onMarkRead: () => void;
  onMarkProcessed: () => void;
}

function formatPublishedAt(value: string | null | undefined, unknownLabel: string) {
  if (!value) return unknownLabel;
  return dayjs(value).format('MMMM D, YYYY · HH:mm');
}

export default function NowDetailPane({
  detail,
  loading,
  pendingAction,
  onMarkRead,
  onMarkProcessed,
}: NowDetailPaneProps) {
  const { t } = useI18n();
  const zoneLabel = (zone: string) => {
    if (zone === 'main') return t('now.zones.main');
    if (zone === 'explore') return t('now.zones.explore');
    if (zone === 'discover' || zone === 'surprise') return t('now.zones.discover');
    return zone;
  };

  if (loading) {
    return (
      <section className="rounded-[32px] border border-[#c0c8cb]/15 bg-white p-8 shadow-[0_20px_60px_rgba(26,28,27,0.03)]">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded bg-[#e8e8e6]" />
          <div className="h-10 w-2/3 rounded bg-[#e8e8e6]" />
          <div className="h-24 rounded-2xl bg-[#e8e8e6]" />
          <div className="h-72 rounded-2xl bg-[#f4f4f2]" />
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="rounded-[32px] border border-dashed border-[#c0c8cb]/20 bg-white p-12 text-center shadow-[0_20px_60px_rgba(26,28,27,0.03)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5e5e5e]">{t('now.detail.title')}</p>
        <h3 className="mt-4 font-headline text-3xl text-[#1a1c1b]">{t('now.detail.chooseItem')}</h3>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#5e5e5e]">
          {t('now.detail.chooseItemHint')}
        </p>
      </section>
    );
  }

  const sourceUrl = detail.source_article_link || detail.article_link || null;

  return (
    <article className="rounded-[32px] border border-[#c0c8cb]/15 bg-white shadow-[0_20px_60px_rgba(26,28,27,0.03)]">
      <div className="border-b border-[#c0c8cb]/12 px-8 py-8">
        <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#5e5e5e]">
          <span>{detail.source_name}</span>
          <span>·</span>
          <span>{formatPublishedAt(detail.published_at, t('now.detail.unknownPublicationTime'))}</span>
          <span>·</span>
          <span>{zoneLabel(detail.zone)}</span>
        </div>

        <h1 className="mt-5 font-headline text-4xl leading-tight text-[#1a1c1b] md:text-5xl">{detail.title}</h1>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#0d4656]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0d4656]">
            {detail.priority_reason}
          </span>
          <span className="rounded-full bg-[#f4f4f2] px-3 py-1 text-[11px] text-[#5e5e5e]">
            {t('now.labels.score')} {detail.priority_score.toFixed(2)}
          </span>
          {detail.is_read && (
            <span className="rounded-full bg-[#dce8eb] px-3 py-1 text-[11px] text-[#0d4656]">{t('now.labels.read')}</span>
          )}
          {detail.is_processed && (
            <span className="rounded-full bg-[#efe7dc] px-3 py-1 text-[11px] text-[#784f28]">{t('now.labels.processed')}</span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onMarkRead}
            disabled={detail.is_read || pendingAction !== null}
            className="inline-flex items-center gap-2 rounded-full border border-[#0d4656]/18 px-5 py-3 text-sm font-semibold text-[#0d4656] transition-colors hover:bg-[#0d4656]/6 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">mark_email_read</span>
            {pendingAction === 'read' ? t('now.actions.updating') : detail.is_read ? t('now.actions.markedRead') : t('now.actions.markRead')}
          </button>
          <button
            type="button"
            onClick={onMarkProcessed}
            disabled={detail.is_processed || pendingAction !== null}
            className="inline-flex items-center gap-2 rounded-full bg-[#0d4656] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b3f4d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">done_all</span>
            {pendingAction === 'processed' ? t('now.actions.updating') : detail.is_processed ? t('now.labels.processed') : t('now.actions.markProcessed')}
          </button>
         {sourceUrl ? (
           <a
             href={sourceUrl}
             target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-2 rounded-full border border-[#c0c8cb]/20 px-5 py-3 text-sm font-semibold text-[#40484b] transition-colors hover:border-[#0d4656]/20 hover:text-[#0d4656]"
           >
             <span className="material-symbols-outlined text-base">arrow_outward</span>
             {t('now.actions.readSource')}
           </a>
         ) : (
           <span className="inline-flex items-center gap-2 rounded-full border border-[#c0c8cb]/12 px-5 py-3 text-sm text-[#8a8f92]">
             <span className="material-symbols-outlined text-base">link_off</span>
             {t('now.actions.sourceUnavailable')}
           </span>
         )}
       </div>
     </div>

      <div className="space-y-8 px-8 py-8">
        <section className="rounded-[28px] bg-[#f7f5ef] px-6 py-6">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.detail.aiSummary')}</p>
          <p className="mt-4 text-lg leading-8 text-[#1a1c1b]">{detail.ai_summary}</p>
        </section>

        {detail.dialectical_analysis && (
          <section className="rounded-[28px] border border-[#c0c8cb]/12 bg-white px-6 py-6">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{t('now.detail.dialecticalAnalysis')}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#40484b]">{detail.dialectical_analysis}</p>
          </section>
        )}

        <section className="rounded-[28px] border border-[#c0c8cb]/12 bg-white px-6 py-6">
          <div className="mb-5 flex flex-wrap gap-2">
            {detail.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#f4f4f2] px-3 py-1 text-[11px] text-[#40484b]">
                {tag}
              </span>
            ))}
          </div>

          <div className="space-y-6 text-[#1a1c1b]">
            <ReactMarkdown
              components={{
                h2: ({ children }) => <h2 className="mt-8 text-2xl font-semibold text-[#1a1c1b] first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="mt-6 text-xl font-semibold text-[#1a1c1b]">{children}</h3>,
                p: ({ children }) => <p className="text-base leading-8 text-[#40484b]">{children}</p>,
                ul: ({ children }) => <ul className="list-disc space-y-2 pl-5 text-base leading-8 text-[#40484b]">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5 text-base leading-8 text-[#40484b]">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0d4656] underline underline-offset-4">
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[#0d4656]/20 pl-4 italic text-[#40484b]">{children}</blockquote>
                ),
                code: ({ children }) => <code className="rounded bg-[#f4f4f2] px-1.5 py-0.5 text-sm">{children}</code>,
              }}
            >
              {detail.body_markdown}
            </ReactMarkdown>
          </div>
        </section>
      </div>
    </article>
  );
}
