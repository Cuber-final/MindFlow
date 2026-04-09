import { useEffect } from 'react';
import { useBehaviorCollector } from '../hooks/useBehaviorCollector';
import type { InsightRef } from '../api/newsletter';

interface InsightCardProps {
  insight: InsightRef;
  onTagClick?: (tag: string) => void;
  digestId: number;
}

export function InsightCard({ insight, onTagClick, digestId }: InsightCardProps) {
  const { recordShow, recordClick } = useBehaviorCollector({
    digestId,
    anchorId: insight.anchor_id,
    tag: insight.tags[0] || 'general',
    enabled: true,
  });

  // Report show on mount
  useEffect(() => {
    recordShow();
  }, [recordShow]);

  const handleClick = () => {
    recordClick();
  };

  return (
    <article
      className="group relative pl-6 border-l-2 border-border hover:border-accent transition-colors duration-200"
      onClick={handleClick}
    >
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
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              className="text-xs px-2 py-0.5 bg-bg-sunken text-text-secondary rounded hover:bg-accent-soft hover:text-accent transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
        <a
          href={insight.source_article_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {insight.source_name} →
        </a>
      </div>
    </article>
  );
}

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
