import { useState, useEffect } from 'react';
import { interestsApi, type UserInterestTag, type InterestStats, type TagCandidate } from '../api/newsletter';
import { InterestTagItem } from '../components/InterestTagItem';

export default function InterestSettings() {
  const [tags, setTags] = useState<UserInterestTag[]>([]);
  const [stats, setStats] = useState<InterestStats | null>(null);
  const [candidates, setCandidates] = useState<TagCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tagsData, statsData, candidatesData] = await Promise.all([
        interestsApi.listTags().catch(() => []),
        interestsApi.getStats().catch(() => null),
        interestsApi.getCandidates(5).catch(() => []),
      ]);
      setTags(tagsData);
      setStats(statsData);
      setCandidates(candidatesData);
    } catch (err) {
      console.error('Failed to load interest data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return;
    setAdding(true);
    try {
      await interestsApi.createTag(tagName.trim());
      setNewTag('');
      loadData();
    } catch (err) {
      console.error('Failed to add tag:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleAddCandidate = async (tagName: string) => {
    await handleAddTag(tagName);
  };

  const handleStatusChange = async (id: number, status: 'active' | 'frozen') => {
    try {
      await interestsApi.updateTag(id, { status });
      loadData();
    } catch (err) {
      console.error('Failed to update tag status:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个兴趣标签吗？')) return;
    try {
      await interestsApi.deleteTag(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary mb-2">兴趣标签管理</h1>
        <p className="text-text-secondary">管理你的兴趣标签，系统会根据标签权重为你推荐内容</p>
      </div>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-bold text-text-primary">{stats.total_tags}</div>
            <div className="text-sm text-text-muted">全部标签</div>
          </div>
          <div className="bg-white rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-bold text-zinc-900">{stats.active_tags}</div>
            <div className="text-sm text-text-muted">主航道</div>
          </div>
          <div className="bg-white rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-bold text-amber-700">{stats.frozen_tags}</div>
            <div className="text-sm text-text-muted">已冻结</div>
          </div>
          <div className="bg-white rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-bold text-violet-700">{stats.candidate_tags}</div>
            <div className="text-sm text-text-muted">候选</div>
          </div>
        </div>
      )}

      {/* Add new tag */}
      <section className="bg-white rounded-lg border border-border p-6">
        <h2 className="font-medium text-text-primary mb-4">添加兴趣标签</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag(newTag)}
            placeholder="输入标签名称..."
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            onClick={() => handleAddTag(newTag)}
            disabled={adding || !newTag.trim()}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {adding ? '添加中...' : '添加'}
          </button>
        </div>
      </section>

      {/* Candidate tags */}
      {candidates.length > 0 && (
        <section className="bg-bg-sunken rounded-lg p-6">
          <h2 className="font-medium text-text-primary mb-3">推荐标签</h2>
          <p className="text-sm text-text-muted mb-3">从最近内容中发现的新标签</p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c.tag}
                onClick={() => handleAddCandidate(c.tag)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-full text-sm hover:border-accent hover:text-accent transition-colors"
              >
                <span>{c.tag}</span>
                <span className="text-xs text-text-muted">({c.count})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tag list */}
      <section>
        <h2 className="font-medium text-text-primary mb-4">我的标签</h2>
        {tags.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p>还没有兴趣标签</p>
            <p className="text-sm mt-1">添加标签开始个性化你的资讯体验</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tags.map((tag) => (
              <InterestTagItem
                key={tag.id}
                tag={tag}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
