import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  behaviorApi,
  digestsApi,
  interestsApi,
  type DailyDigest,
  type InsightRef,
  type UserInterestTag,
} from '../api/newsletter';

function getWeekStart(value: string) {
  const date = dayjs(value);
  const day = date.day();
  const diff = day === 0 ? -6 : 1 - day;
  return date.add(diff, 'day').format('YYYY-MM-DD');
}

function getWeekEnd(weekStart: string) {
  return dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');
}

function getWeekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => dayjs(weekStart).add(index, 'day'));
}

function getLatestDate(dates: string[]) {
  return [...dates].sort((a, b) => dayjs(b).valueOf() - dayjs(a).valueOf())[0] || null;
}

function InterestSidebar({
  tags,
  selectedTag,
  onTagSelect,
}: {
  tags: UserInterestTag[];
  selectedTag?: string;
  onTagSelect: (tag?: string) => void;
}) {
  return (
    <aside className="w-56 shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-label text-sm font-semibold text-[#5e5e5e] uppercase tracking-widest">兴趣标签</h3>
        {selectedTag && (
          <button className="text-xs text-[#0d4656] hover:underline" onClick={() => onTagSelect(undefined)}>
            清除
          </button>
        )}
      </div>
      <div className="space-y-1">
        {tags.map((tag) => {
          const zone = tag.weight >= 1.3 ? 'main' : tag.weight >= 0.7 ? 'explore' : 'surprise';
          return (
            <button
              key={tag.id}
              onClick={() => onTagSelect(tag.tag)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedTag === tag.tag
                  ? 'bg-[#2c5e6e]/10 text-[#0d4656] font-medium'
                  : 'text-[#5e5e5e] hover:bg-[#e8e8e6]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{tag.tag}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    zone === 'main'
                      ? 'bg-[#0d4656] text-white'
                      : zone === 'explore'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-violet-100 text-violet-700'
                  }`}
                >
                  {tag.weight.toFixed(1)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {[1, 2].map((index) => (
        <div key={index} className="rounded-xl bg-[#f4f4f2] p-8 space-y-4">
          <div className="h-4 w-32 bg-[#e8e8e6] rounded" />
          <div className="h-10 w-2/3 bg-[#e8e8e6] rounded" />
          <div className="h-4 w-full bg-[#e8e8e6] rounded" />
          <div className="h-4 w-4/5 bg-[#e8e8e6] rounded" />
        </div>
      ))}
    </div>
  );
}

function WeekDatePanel({
  selectedDate,
  weekStart,
  availableDates,
  loading,
  canGoNext,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
}: {
  selectedDate: string;
  weekStart: string;
  availableDates: Set<string>;
  loading: boolean;
  canGoNext: boolean;
  onSelectDate: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  const [open, setOpen] = useState(false);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekLabel = `${dayjs(weekStart).format('MMM D')} - ${dayjs(getWeekEnd(weekStart)).format('MMM D')}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-[#c0c8cb]/20 bg-[#f4f4f2] px-5 py-3 text-sm text-[#40484b] hover:bg-[#e8e8e6]"
      >
        <span className="material-symbols-outlined text-base">calendar_today</span>
        <span className="font-bold text-xs uppercase tracking-widest">{dayjs(selectedDate).format('MMM D')}</span>
        <span className={`material-symbols-outlined text-base transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-3 w-[360px] rounded-2xl border border-[#c0c8cb]/20 bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={onPrevWeek}
                className="rounded-full p-2 text-[#40484b] hover:bg-[#f4f4f2]"
                aria-label="上一周"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-widest text-[#5e5e5e]">Week</p>
                <p className="font-semibold text-[#1a1c1b]">{weekLabel}</p>
              </div>
              <button
                onClick={onNextWeek}
                disabled={!canGoNext}
                className="rounded-full p-2 text-[#40484b] hover:bg-[#f4f4f2] disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="下一周"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>

            {loading && <p className="mb-3 text-xs text-[#5e5e5e]">正在加载本周简报...</p>}

            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const isoDate = day.format('YYYY-MM-DD');
                const isAvailable = availableDates.has(isoDate);
                const isSelected = selectedDate === isoDate;
                return (
                  <button
                    key={isoDate}
                    onClick={() => {
                      if (!isAvailable) return;
                      onSelectDate(isoDate);
                      setOpen(false);
                    }}
                    disabled={!isAvailable}
                    className={`rounded-xl border px-2 py-3 text-center transition-colors ${
                      isSelected
                        ? 'border-[#0d4656] bg-[#0d4656] text-white'
                        : isAvailable
                          ? 'border-[#c0c8cb]/20 bg-[#f8f8f6] text-[#1a1c1b] hover:bg-[#e8e8e6]'
                          : 'border-[#ececeb] bg-[#f5f5f4] text-[#b0b5b8] cursor-not-allowed'
                    }`}
                  >
                    <span className="block text-[10px] uppercase tracking-widest">{day.format('dd')}</span>
                    <span className="mt-1 block text-sm font-semibold">{day.format('D')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MainChannelArticle({
  insight,
  badge,
  readTime,
  dismissing,
  feedbackDisabled,
  onFeedback,
  onReadSource,
}: {
  insight: InsightRef;
  badge: string;
  readTime: string;
  dismissing: boolean;
  feedbackDisabled: boolean;
  onFeedback: (insight: InsightRef) => void;
  onReadSource: (insight: InsightRef) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={`group relative rounded-xl border border-[#c0c8cb]/5 bg-[#f4f4f2] p-8 shadow-[0_12px_40px_rgba(26,28,27,0.03)] transition-all duration-300 hover:bg-[#e8e8e6] ${
        dismissing ? 'pointer-events-none translate-y-2 scale-[0.98] opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col gap-10 lg:flex-row">
        <div className="flex-1">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-full bg-[#0d4656]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0d4656]">
              {badge}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[#40484b]">{readTime}</span>
          </div>
          <h4 className="mb-6 font-headline text-4xl leading-tight transition-colors group-hover:text-[#0d4656]">
            {insight.title}
          </h4>
          <p className="mb-8 text-lg leading-relaxed text-[#40484b]">{insight.content}</p>
          <div className="rounded-lg border border-[#c0c8cb]/10 bg-white/50 p-6">
            <details className="group/dialectical" open={expanded} onToggle={(event) => setExpanded((event.target as HTMLDetailsElement).open)}>
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#0d4656]">
                  <span className="material-symbols-outlined text-sm">psychology</span>
                  Dialectical Analysis
                </span>
                <span className="material-symbols-outlined transition-transform group-open/dialectical:rotate-180">expand_more</span>
              </summary>
              <div className="mt-6 grid grid-cols-1 gap-8 text-sm md:grid-cols-3">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#0d4656]">Thesis (Pros)</p>
                  <p className="text-[#40484b]">{insight.dialectical_analysis || 'Insightful analysis pending.'}</p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#ba1a1a]">Antithesis (Cons)</p>
                  <p className="text-[#40484b]">Considerations and counterpoints to explore further.</p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#784f28]">Synthesis (Extensions)</p>
                  <p className="text-[#40484b]">Broader implications and interconnected possibilities.</p>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="lg:w-[280px]">
          <div className="flex h-64 items-center justify-center rounded border-2 border-dashed bg-[#e8e8e6] text-sm text-[#5e5e5e]">
            {insight.source_name}
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <button
              onClick={() => onFeedback(insight)}
              disabled={feedbackDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#c0c8cb]/20 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#40484b] transition-colors hover:border-[#0d4656]/30 hover:text-[#0d4656] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">thumb_down</span>
              减少这类话题内容
            </button>
            <a
              className="inline-flex items-center gap-1 border-b border-[#5e5e5e]/20 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#5e5e5e] transition-colors hover:border-[#0d4656]/40 hover:text-[#0d4656]"
              href={insight.source_article_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onReadSource(insight)}
            >
              Read Source
              <span className="material-symbols-outlined text-xs">arrow_outward</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function ExplorationCard({
  category,
  title,
  content,
  meta,
}: {
  category: 'Emerging Match' | 'Tangent' | 'Speculative';
  title: string;
  content: string;
  meta: string;
}) {
  const categoryStyles = {
    'Emerging Match': 'bg-[#ffdcc0] text-[#784f28]',
    Tangent: 'bg-[#f3bb8b] text-[#5d3813]',
    Speculative: 'bg-[#e4e2e2] text-[#5e5e5e]',
  };

  return (
    <div className="rounded border border-[#c0c8cb]/10 bg-[#f4f4f2] p-6 transition-transform hover:-translate-y-1">
      <span className={`mb-4 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${categoryStyles[category]}`}>
        {category}
      </span>
      <h5 className="mb-3 font-headline text-xl">{title}</h5>
      <p className="mb-6 line-clamp-3 text-sm text-[#40484b]">{content}</p>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-[#5e5e5e]">{meta}</span>
        <span className="material-symbols-outlined text-[#5e5e5e]">add_circle</span>
      </div>
    </div>
  );
}

function SurpriseItem({ number, title }: { number: number; title: string }) {
  return (
    <div className="cursor-pointer rounded border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-colors hover:bg-white/10">
      <h6 className="mb-2 font-headline text-lg">{title}</h6>
      <p className="mb-4 text-xs uppercase tracking-widest opacity-70">Serendipity #{String(number).padStart(2, '0')}</p>
      <span className="material-symbols-outlined">arrow_forward</span>
    </div>
  );
}

function Snackbar({
  message,
  variant,
  onUndo,
}: {
  message: string;
  variant: 'info' | 'error';
  onUndo?: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-full bg-[#1a1c1b] px-5 py-3 text-sm text-white shadow-xl">
      <span className={variant === 'error' ? 'text-[#ffb4ab]' : 'text-white'}>{message}</span>
      {onUndo && (
        <button className="text-xs font-bold uppercase tracking-widest text-[#9bd1df] hover:text-white" onClick={onUndo}>
          Undo
        </button>
      )}
    </div>
  );
}

export default function Newsletter() {
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const currentWeekStart = useMemo(() => getWeekStart(today), [today]);

  const [tags, setTags] = useState<UserInterestTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [weekDigests, setWeekDigests] = useState<DailyDigest[]>([]);
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [latestDigest, setLatestDigest] = useState<DailyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [hiddenAnchorIds, setHiddenAnchorIds] = useState<number[]>([]);
  const [dismissingAnchorId, setDismissingAnchorId] = useState<number | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<{ digestId: number; insight: InsightRef } | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; variant: 'info' | 'error'; undo: boolean } | null>(null);

  const animationTimerRef = useRef<number | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      interestsApi.listTags().catch(() => []),
      digestsApi.latest().catch(() => null),
    ]).then(([tagsData, latest]) => {
      setTags(tagsData);
      setLatestDigest(latest);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void loadWeek(weekStart);
  }, [weekStart]);

  useEffect(() => {
    if (pendingFeedback) {
      commitFeedback(pendingFeedback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    setDigestLoading(true);
    digestsApi
      .getByDate(selectedDate)
      .then((data) => {
        setDigest(data);
        setHiddenAnchorIds([]);
      })
      .catch(() => {
        setDigest(null);
        setHiddenAnchorIds([]);
      })
      .finally(() => setDigestLoading(false));
  }, [selectedDate]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
      if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
      if (snackbarTimerRef.current) window.clearTimeout(snackbarTimerRef.current);
    };
  }, []);

  async function loadWeek(targetWeekStart: string) {
    setWeekLoading(true);
    try {
      const response = await digestsApi.list({
        limit: 7,
        offset: 0,
        week_start: targetWeekStart,
        week_end: getWeekEnd(targetWeekStart),
      });

      setWeekDigests(response.items);
      const availableDates = response.items.map((item) => item.date);
      if (availableDates.includes(selectedDate)) {
        return;
      }

      if (targetWeekStart === currentWeekStart) {
        setSelectedDate(today);
        return;
      }

      const fallbackDate = getLatestDate(availableDates) ?? getWeekEnd(targetWeekStart);
      setSelectedDate(fallbackDate);
    } catch {
      setWeekDigests([]);
    } finally {
      setWeekLoading(false);
    }
  }

  function clearTimers() {
    if (animationTimerRef.current) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (snackbarTimerRef.current) {
      window.clearTimeout(snackbarTimerRef.current);
      snackbarTimerRef.current = null;
    }
  }

  function showTimedSnackbar(message: string, variant: 'info' | 'error', duration = 3000) {
    if (snackbarTimerRef.current) {
      window.clearTimeout(snackbarTimerRef.current);
    }
    setSnackbar({ message, variant, undo: false });
    snackbarTimerRef.current = window.setTimeout(() => setSnackbar(null), duration);
  }

  function commitFeedback(target: { digestId: number; insight: InsightRef }) {
    clearTimers();
    setPendingFeedback(null);
    setSnackbar(null);

    void behaviorApi
      .recordFeedback({
        digest_id: target.digestId,
        anchor_id: target.insight.anchor_id,
        action: 'hide',
      })
      .catch(() => {
        setHiddenAnchorIds((prev) => prev.filter((id) => id !== target.insight.anchor_id));
        showTimedSnackbar('操作失败，已恢复当前内容', 'error', 4000);
      });
  }

  function handleUndo() {
    if (!pendingFeedback) {
      return;
    }

    clearTimers();
    setHiddenAnchorIds((prev) => prev.filter((id) => id !== pendingFeedback.insight.anchor_id));
    setDismissingAnchorId(null);
    setPendingFeedback(null);
    showTimedSnackbar('已撤销本次调整', 'info');
  }

  function handleNegativeFeedback(insight: InsightRef) {
    if (!digest || pendingFeedback || dismissingAnchorId !== null) {
      return;
    }

    clearTimers();
    setPendingFeedback({ digestId: digest.id, insight });
    setDismissingAnchorId(insight.anchor_id);

    animationTimerRef.current = window.setTimeout(() => {
      setHiddenAnchorIds((prev) => [...prev, insight.anchor_id]);
      setDismissingAnchorId(null);
      setSnackbar({ message: '已减少类似内容', variant: 'info', undo: true });
      commitTimerRef.current = window.setTimeout(() => commitFeedback({ digestId: digest.id, insight }), 6000);
    }, 220);
  }

  function handleReadSource(insight: InsightRef) {
    if (!digest) {
      return;
    }

    void behaviorApi.recordLog({
      digest_id: digest.id,
      anchor_id: insight.anchor_id,
      tag: insight.tags[0] || 'general',
      signal_type: 'implicit',
      action: 'click',
      value: 1,
    }).catch(() => {
      // non-blocking best effort
    });
  }

  const availableDates = useMemo(() => new Set(weekDigests.map((item) => item.date)), [weekDigests]);
  const canGoNext = weekStart !== currentWeekStart;
  const isTodaySelected = selectedDate === today;
  const latestDigestDate = latestDigest?.date;

  const filteredSections = useMemo(
    () => {
      const sections = Array.isArray(digest?.sections) ? digest.sections : [];

      return sections
        .map((section) => {
          const insights = Array.isArray(section?.insights) ? section.insights : [];
          return {
            ...section,
            insights: selectedTag
              ? insights.filter((insight) => Array.isArray(insight.tags) && insight.tags.includes(selectedTag))
              : insights,
          };
        })
        .filter((section) => section.insights.length > 0);
    },
    [digest, selectedTag]
  );

  const mainInsights = useMemo(() => {
    const insights = filteredSections[0]?.insights ?? [];
    return insights.filter((insight) => !hiddenAnchorIds.includes(insight.anchor_id)).slice(0, 2);
  }, [filteredSections, hiddenAnchorIds]);

  if (loading) {
    return (
      <div className="flex gap-12">
        <main className="flex-1">
          <div className="mb-10">
            <div className="mb-2 h-8 w-64 rounded bg-[#e8e8e6]" />
            <div className="h-4 w-96 rounded bg-[#e8e8e6]" />
          </div>
          <LoadingSkeleton />
        </main>
        <InterestSidebar tags={[]} onTagSelect={setSelectedTag} />
      </div>
    );
  }

  const noDigestSelected = !digestLoading && !digest;
  const formattedDate = dayjs(digest?.date || selectedDate).format('dddd, MMMM D, YYYY');

  return (
    <div className="flex gap-12">
      <main className="min-w-0 flex-1">
        <header className="mb-16">
          <div className="flex flex-col gap-6 border-b border-[#c0c8cb]/15 pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-4 font-label text-xs uppercase tracking-[0.2em] text-[#5e5e5e]">{formattedDate}</p>
              <h2 className="mb-6 font-headline text-6xl leading-none tracking-tight md:text-8xl">
                The Morning <br />
                <span className="italic text-[#0d4656]">Briefing</span>
              </h2>
              <p className="max-w-xl text-lg leading-relaxed text-[#40484b]">
                {digest?.overview || 'Your digital atelier has synthesized sources into core insights.'}
              </p>
              {digest && (
                <div className="mt-4 flex items-center gap-4 text-xs text-[#5e5e5e]">
                  <span>{digest.total_articles_processed} articles processed</span>
                  <span>·</span>
                  <span>{digest.anchor_count} anchors</span>
                </div>
              )}
            </div>

            <WeekDatePanel
              selectedDate={selectedDate}
              weekStart={weekStart}
              availableDates={availableDates}
              loading={weekLoading}
              canGoNext={canGoNext}
              onSelectDate={setSelectedDate}
              onPrevWeek={() => setWeekStart(dayjs(weekStart).subtract(7, 'day').format('YYYY-MM-DD'))}
              onNextWeek={() => {
                if (!canGoNext) return;
                setWeekStart(dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD'));
              }}
            />
          </div>
        </header>

        {digestLoading ? (
          <LoadingSkeleton />
        ) : noDigestSelected ? (
          <section className="rounded-xl border border-[#c0c8cb]/20 bg-white p-10 text-center">
            <h3 className="mb-3 font-headline text-3xl text-[#1a1c1b]">
              {isTodaySelected ? '今日暂无简报' : '所选日期暂无简报'}
            </h3>
            <p className="mx-auto max-w-xl text-sm leading-6 text-[#5e5e5e]">
              {isTodaySelected
                ? '今天的日报还没有生成。你可以稍后再来查看，或者先阅读最近一次已生成的简报。'
                : '这个日期目前没有可展示的日报，请从周面板里选择其他高亮日期。'}
            </p>
            {isTodaySelected && latestDigestDate && latestDigestDate !== selectedDate && (
              <button
                className="mt-6 text-sm font-semibold text-[#0d4656] hover:underline"
                onClick={() => {
                  setWeekStart(getWeekStart(latestDigestDate));
                  setSelectedDate(latestDigestDate);
                }}
              >
                查看最近一份简报（{dayjs(latestDigestDate).format('MM/DD')}）
              </button>
            )}
          </section>
        ) : (
          <>
            {filteredSections.length > 0 && (
              <section className="mb-24">
                <div className="mb-12 flex items-center gap-4">
                  <div className="h-8 w-1 bg-[#0d4656]" />
                  <h3 className="font-headline text-3xl italic">Main Channel</h3>
                </div>
                <div className="grid grid-cols-1 gap-12">
                  {mainInsights.map((insight, index) => (
                    <MainChannelArticle
                      key={insight.anchor_id}
                      insight={insight}
                      badge={index === 0 ? 'Core Insight' : 'Societal Shift'}
                      readTime={`${8 + index * 4} min read`}
                      dismissing={dismissingAnchorId === insight.anchor_id}
                      feedbackDisabled={Boolean(pendingFeedback) || dismissingAnchorId !== null}
                      onFeedback={handleNegativeFeedback}
                      onReadSource={handleReadSource}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredSections.length > 1 && (
              <section className="mb-24">
                <div className="mb-12 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-[#5e5e5e]">explore</span>
                    <h3 className="font-headline text-3xl italic">Exploration Zone</h3>
                  </div>
                  <button className="border-b border-[#5e5e5e]/20 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#5e5e5e] transition-colors hover:text-[#0d4656]">
                    View All Matches
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSections.slice(1, 3).map((section, sectionIndex) =>
                    section.insights.slice(0, 2).map((insight, insightIndex) => (
                      <ExplorationCard
                        key={insight.anchor_id}
                        category={['Emerging Match', 'Tangent', 'Speculative'][(sectionIndex * 2 + insightIndex) % 3] as 'Emerging Match' | 'Tangent' | 'Speculative'}
                        title={insight.title}
                        content={insight.content}
                        meta={`${section.domain} · ${5 + insightIndex * 2}m read`}
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            <section className="mb-32">
              <div className="relative overflow-hidden rounded-xl bg-[#784f28] p-12 text-white">
                <div className="absolute right-0 top-0 h-64 w-64 translate-x-32 -translate-y-8 rounded-full bg-[#5d3813] opacity-10" />
                <div className="relative z-10">
                  <div className="mb-8 flex items-center gap-4">
                    <span className="material-symbols-outlined text-[#fcc493]">auto_fix_high</span>
                    <h3 className="font-headline text-3xl italic">Surprise Box</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <SurpriseItem number={1} title="Ikigai in the Age of AI" />
                    <SurpriseItem number={2} title="The Aesthetics of Brutalism" />
                    <SurpriseItem number={3} title="Music Theory in Fractals" />
                    <SurpriseItem number={4} title="Ancient Fermentation Rituals" />
                  </div>
                  <div className="mt-12 text-center">
                    <p className="font-label text-[10px] uppercase tracking-[0.3em] opacity-60">
                      Randomly selected from non-matched interests
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <InterestSidebar tags={tags} selectedTag={selectedTag} onTagSelect={setSelectedTag} />

      {snackbar && <Snackbar message={snackbar.message} variant={snackbar.variant} onUndo={snackbar.undo ? handleUndo : undefined} />}
    </div>
  );
}
