import type { UserInterestTag } from '../api/newsletter';

interface InterestTagItemProps {
  tag: UserInterestTag;
  onStatusChange: (id: number, status: 'active' | 'frozen') => void;
  onDelete: (id: number) => void;
}

export function InterestTagItem({ tag, onStatusChange, onDelete }: InterestTagItemProps) {
  const zone =
    tag.weight >= 1.3 ? 'main' : tag.weight >= 0.7 ? 'explore' : 'surprise';

  const zoneConfig = {
    main: { label: '主航道', bg: 'bg-zinc-900', text: 'text-white' },
    explore: { label: '探索区', bg: 'bg-amber-100', text: 'text-amber-800' },
    surprise: { label: '惊喜箱', bg: 'bg-violet-100', text: 'text-violet-800' },
  };

  const config = zoneConfig[zone as keyof typeof zoneConfig];

  // Calculate engagement rate
  const totalSignals = tag.show_count + tag.hide_count + tag.click_count;
  const engagementRate = totalSignals > 0
    ? ((tag.show_count + tag.click_count) / totalSignals * 100).toFixed(0)
    : '0';

  return (
    <div className="group bg-white rounded-lg border border-border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-text-primary truncate">{tag.tag}</h4>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
              {config.label}
            </span>
            {tag.status === 'frozen' && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                已冻结
              </span>
            )}
          </div>

          {/* Weight bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>权重</span>
              <span className="font-mono">{tag.weight.toFixed(2)}</span>
            </div>
            <div className="h-1.5 bg-bg-sunken rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${Math.min(100, (tag.weight / 2.5) * 100)}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center p-2 bg-bg-sunken rounded">
              <div className="font-mono text-text-primary">{tag.show_count}</div>
              <div className="text-text-muted">展示</div>
            </div>
            <div className="text-center p-2 bg-bg-sunken rounded">
              <div className="font-mono text-text-primary">{tag.click_count}</div>
              <div className="text-text-muted">点击</div>
            </div>
            <div className="text-center p-2 bg-bg-sunken rounded">
              <div className="font-mono text-text-primary">
                {tag.total_time_spent > 60
                  ? `${(tag.total_time_spent / 60).toFixed(1)}m`
                  : `${tag.total_time_spent.toFixed(0)}s`}
              </div>
              <div className="text-text-muted">阅读</div>
            </div>
            <div className="text-center p-2 bg-bg-sunken rounded">
              <div className="font-mono text-text-primary">{engagementRate}%</div>
              <div className="text-text-muted">互动</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onStatusChange(tag.id, tag.status === 'frozen' ? 'active' : 'frozen')}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-sunken rounded transition-colors"
            title={tag.status === 'frozen' ? '激活' : '冻结'}
          >
            {tag.status === 'frozen' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onDelete(tag.id)}
            className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="删除"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
