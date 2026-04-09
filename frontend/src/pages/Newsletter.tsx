import { useState, useEffect } from 'react';
import { digestsApi, interestsApi, type DailyDigest, type InsightRef, type UserInterestTag } from '../api/newsletter';
import dayjs from 'dayjs';

// Zone badge component
function ZoneBadge({ zone }: { zone: string }) {
  const styles = {
    main: 'bg-zinc-900 text-white',
    explore: 'bg-amber-100 text-amber-800 border border-amber-200',
    surprise: 'bg-violet-100 text-violet-800 border border-violet-200',
  };
  const labels = { main: '主航道', explore: '探索区', surprise: '惊喜箱' };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${styles[zone as keyof typeof styles] || styles.explore}`}>
      {labels[zone as keyof typeof labels] || zone}
    </span>
  );
}

// Insight card component
function InsightCard({ insight, onTagClick }: { insight: InsightRef; onTagClick?: (tag: string) => void }) {
  return (
    <article className="group relative pl-6 border-l-2 border-border hover:border-accent transition-colors duration-200">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-text-primary leading-snug group-hover:text-accent transition-colors">
          {insight.title}
        </h3>
        <ZoneBadge zone={insight.zone} />
      </div>

      <p className="text-text-secondary text-sm leading-relaxed mb-3">
        {insight.content.length > 200 ? `${insight.content.slice(0, 200)}...` : insight.content}
      </p>

      {insight.dialectical_analysis && (
        <div className="mb-3 p-3 bg-bg-sunken rounded-lg border-l-4 border-accent/30">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">辩证分析</p>
          <p className="text-sm text-text-secondary italic">{insight.dialectical_analysis}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {insight.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick?.(tag)}
              className="text-xs px-2 py-0.5 bg-bg-sunken text-text-secondary rounded hover:bg-accent-soft hover:text-accent transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
        <span className="text-xs text-text-muted">{insight.source_name}</span>
      </div>
    </article>
  );
}

// Section group component
function SectionGroup({
  section,
  onTagClick
}: {
  section: { domain: string; domain_icon: string; insights: InsightRef[] };
  onTagClick?: (tag: string) => void;
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{section.domain_icon}</span>
        <h2 className="font-display text-xl font-bold text-text-primary">{section.domain}</h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="space-y-8">
        {section.insights.map((insight) => (
          <InsightCard key={insight.anchor_id} insight={insight} onTagClick={onTagClick} />
        ))}
      </div>
    </section>
  );
}

// Interest sidebar component
function InterestSidebar({
  tags,
  selectedTag,
  onTagSelect
}: {
  tags: UserInterestTag[];
  selectedTag?: string;
  onTagSelect?: (tag: string) => void;
}) {
  return (
    <aside className="w-56 shrink-0">
      <h3 className="font-display text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">
        兴趣标签
      </h3>
      <div className="space-y-1">
        {tags.map((tag) => {
          const zone = tag.weight >= 1.3 ? 'main' : tag.weight >= 0.7 ? 'explore' : 'surprise';
          return (
            <button
              key={tag.id}
              onClick={() => onTagSelect?.(tag.tag)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedTag === tag.tag
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-sunken'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{tag.tag}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  zone === 'main' ? 'bg-zinc-900 text-white' :
                  zone === 'explore' ? 'bg-amber-100 text-amber-700' :
                  'bg-violet-100 text-violet-700'
                }`}>
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

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-6 w-32 bg-bg-sunken rounded mb-6" />
          <div className="space-y-6">
            {[1, 2].map((j) => (
              <div key={j} className="pl-6 border-l-2 border-border space-y-3">
                <div className="h-5 w-3/4 bg-bg-sunken rounded" />
                <div className="h-4 w-full bg-bg-sunken rounded" />
                <div className="h-4 w-2/3 bg-bg-sunken rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Date selector component
function DateSelector({
  selectedDate,
  onDateChange
}: {
  selectedDate: string;
  onDateChange: (date: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    // Fetch available dates
    digestsApi.list({ limit: 30 }).then((res) => {
      setDates(res.items.map((d) => d.date));
    }).catch(() => {});
  }, []);

  const displayDate = selectedDate || dayjs().format('YYYY-MM-DD');
  const formattedDisplay = dayjs(displayDate).format('YYYY年MM月DD日');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-sunken rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{formattedDisplay}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
            <button
              onClick={() => {
                onDateChange(dayjs().format('YYYY-MM-DD'));
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-bg-sunken"
            >
              今天
            </button>
            {dates.map((date) => (
              <button
                key={date}
                onClick={() => {
                  onDateChange(date);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-sunken ${
                  date === selectedDate ? 'text-accent font-medium' : ''
                }`}
              >
                {dayjs(date).format('YYYY-MM-DD')}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Newsletter() {
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [tags, setTags] = useState<UserInterestTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  useEffect(() => {
    Promise.all([
      interestsApi.listTags().catch(() => []),
    ]).then(([tagsData]) => {
      setTags(tagsData);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedDate) {
      digestsApi.getByDate(selectedDate).then(setDigest).catch(() => setDigest(null));
    } else {
      digestsApi.latest().then(setDigest).catch(() => setDigest(null));
    }
  }, [selectedDate]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(selectedTag === tag ? undefined : tag);
  };

  // Filter insights by selected tag
  const filteredSections = digest?.sections.map((section) => ({
    ...section,
    insights: selectedTag
      ? section.insights.filter((insight) => insight.tags.includes(selectedTag))
      : section.insights,
  })).filter((section) => section.insights.length > 0) || [];

  if (loading) {
    return (
      <div className="flex gap-12">
        <main className="flex-1">
          <div className="mb-10">
            <div className="h-8 w-64 bg-bg-sunken rounded mb-2" />
            <div className="h-4 w-96 bg-bg-sunken rounded" />
          </div>
          <LoadingSkeleton />
        </main>
        <InterestSidebar tags={[]} />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted text-lg mb-4">
          暂无简报数据
        </p>
        <p className="text-text-muted text-sm">
          后端运行中，将在每日9:00自动生成
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-12">
      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Header */}
        <header className="mb-10 flex items-start justify-between">
          <div>
          <p className="text-sm text-text-muted mb-2">{digest.date}</p>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-3">
            {digest.title}
          </h1>
          {digest.overview && (
            <p className="text-text-secondary leading-relaxed max-w-2xl">
              {digest.overview}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4 text-xs text-text-muted">
            <span>{digest.total_articles_processed} 篇文章</span>
            <span>·</span>
            <span>{digest.anchor_count} 个锚点</span>
          </div>
          <DateSelector selectedDate={selectedDate || (digest?.date)} onDateChange={handleDateChange} />
          </div>
        </header>

        {/* Sections */}
        {filteredSections.length > 0 ? (
          filteredSections.map((section) => (
            <SectionGroup key={section.domain} section={section} onTagClick={handleTagClick} />
          ))
        ) : (
          <p className="text-text-muted text-center py-8">没有找到匹配的锚点</p>
        )}
      </main>

      {/* Sidebar */}
      <InterestSidebar
        tags={tags}
        selectedTag={selectedTag}
        onTagSelect={setSelectedTag}
      />
    </div>
  );
}
