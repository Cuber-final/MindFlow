import { useState, useEffect } from 'react';
import { interestsApi, type UserInterestTag, type TagCandidate } from '../api/newsletter';
import { useI18n } from '../i18n';

export default function InterestSettings() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const text = {
    deleteConfirm: isZh ? '确定要删除这个兴趣标签吗？' : 'Are you sure you want to delete this interest tag?',
    title: isZh ? '兴趣管理' : 'Interest Management',
    subtitle: isZh
      ? '微调你的 Daily Digest 核心偏好，强化真正重要的主题，减少噪声。'
      : 'Refine the architectural core of your daily digest. Weight your passions, adopt new perspectives, and prune the noise.',
    weeklyFocus: isZh ? '本周焦点' : 'Weekly Focus',
    deepResonance: isZh ? '深度共振' : 'Deep Resonance',
    frozen: isZh ? '冻结' : 'Frozen',
    strength: isZh ? '强度' : 'Strength',
    noActiveInterests: isZh ? '暂无活跃兴趣标签' : 'No active interests yet',
    inputPlaceholder: isZh ? '输入兴趣标签名称...' : 'Enter interest name...',
    adding: isZh ? '添加中...' : 'Adding...',
    addInterest: isZh ? '添加兴趣' : 'Add Interest',
    activeInterests: isZh ? '活跃兴趣标签' : 'Active Interests',
    noInterests: isZh ? '还没有兴趣标签' : 'No interests yet',
    noInterestsHint: isZh ? '添加兴趣后可定制你的简报内容' : 'Add interests to personalize your digest',
    thaw: isZh ? '解冻' : 'Thaw',
    freeze: isZh ? '冻结' : 'Freeze',
    delete: isZh ? '删除' : 'Delete',
    mainChannel: isZh ? '主频道' : 'Main Channel',
    dailyPriority: isZh ? '日常优先' : 'Daily Priority',
    background: isZh ? '背景关注' : 'Background',
    emergentPatterns: isZh ? '涌现模式' : 'Emergent Patterns',
    emergentHint: isZh
      ? 'AI 发现你近期阅读中反复出现这些主题，是否提升为兴趣标签？'
      : 'AI detected these recurring themes in your reading history. Should we elevate them?',
    appearedIn: isZh ? '出现在 {count} 篇文章中' : 'Appeared in {count} articles',
    adopt: isZh ? '采纳' : 'Adopt',
    globalWeighting: isZh ? '全局权重策略' : 'Global Weighting',
    globalWeightingHint: isZh
      ? '调整系统探索新主题与强化既有兴趣之间的平衡强度。'
      : 'Adjust how aggressive the AI is in finding new topics versus reinforcing existing ones.',
    evolutionHistory: isZh ? '兴趣演化历史' : 'Evolution History',
    evolutionHistoryHint: isZh
      ? '查看最近 6 个月兴趣分布变化与偏好迁移。'
      : 'See how your interests have shifted over the last 6 months.',
    dataPortability: isZh ? '数据可迁移性' : 'Data Portability',
    dataPortabilityHint: isZh
      ? '导出语义画像，供其他研究或分析工具使用。'
      : 'Download your semantic profile for use in other research tools.',
    imageAlt: isZh ? '抽象神经连接可视化图像' : 'Abstract digital visualization of neural connections',
  };

  const [tags, setTags] = useState<UserInterestTag[]>([]);
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
      const [tagsData, , candidatesData] = await Promise.all([
        interestsApi.listTags().catch(() => []),
        interestsApi.getStats().catch(() => null),
        interestsApi.getCandidates(5).catch(() => []),
      ]);
      setTags(tagsData);
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
    if (!confirm(text.deleteConfirm)) return;
    try {
      await interestsApi.deleteTag(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  // Helper to get status label
  const getStatusLabel = (tag: UserInterestTag): string => {
    if (tag.status === 'frozen') return text.frozen;
    const strength = Math.round((tag.weight / 2.5) * 100);
    if (strength >= 70) return text.mainChannel;
    if (strength >= 30) return text.dailyPriority;
    return text.background;
  };

  // Helper to get strength percentage
  const getStrengthPercent = (tag: UserInterestTag): number => {
    if (tag.status === 'frozen') return 0;
    return Math.min(100, Math.round((tag.weight / 2.5) * 100));
  };

  // Get top interests for the "Deep Resonance" panel
  const topInterests = [...tags]
    .filter(t => t.status === 'active')
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
      {/* Hero Header */}
      <div className="mb-10 sm:mb-12 lg:mb-16">
        <h2 className="mb-3 font-serif text-3xl text-on-surface sm:text-4xl lg:mb-4 lg:text-5xl xl:text-6xl">{text.title}</h2>
        <p className="max-w-2xl font-sans leading-relaxed text-secondary text-sm sm:text-base">
          {text.subtitle}
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-12">
        {/* Analytics Summary (4 Columns) */}
        <div className="md:col-span-4 rounded-xl bg-surface-container-low p-5 sm:p-6 lg:p-8 flex flex-col justify-between">
          <div>
            <span className="font-sans text-[11px] uppercase tracking-widest text-secondary">{text.weeklyFocus}</span>
            <h3 className="font-serif text-2xl sm:text-3xl mt-4 mb-6 sm:mb-8">{text.deepResonance}</h3>
            <div className="space-y-4 sm:space-y-6">
              {topInterests.length > 0 ? (
                topInterests.map((tag, index) => {
                  const icons = ['psychology', 'eco', 'biotech'];
                  const colors = [
                    'bg-primary-container/10 text-primary',
                    'bg-tertiary-container/10 text-tertiary',
                    'bg-secondary-container/20 text-secondary'
                  ];
                  return (
                    <div key={tag.id} className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full ${colors[index % 3]} flex items-center justify-center`}>
                        <span className="material-symbols-outlined">{icons[index % 3]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold break-words">{tag.tag}</p>
                        <p className="text-xs text-secondary">
                          {tag.status === 'frozen' ? text.frozen : `${text.strength}: ${getStrengthPercent(tag)}%`}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-secondary text-sm">{text.noActiveInterests}</p>
              )}
            </div>
          </div>
          <div className="mt-8 sm:mt-12">
            <img
              className="w-full h-24 sm:h-28 lg:h-32 object-cover rounded-lg img-grayscale"
              alt={text.imageAlt}
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6xqMZq_WT0WAAL0fPZbCyJSpQzcHO87aIKjw_r1m-Ye15pPrZbjlMmV5mciuh4v8SAvAc2pLL_yX9YSLdsqSummCGsGSFviYBVNCyfGa-O3RWBJlGhLUc2Xdtnao4RIar1-aHTh2ACw3Q34cnEFn9NRWzIaEYilh617oal_c54NEuxq69-TnuCqe0MvIdzXgUscDks1nGUds2sjO4HCncoaQg2IFBUK-9aUAZzoMAXyaJdSy-ERQ8v98YO4yMSF0ABp5-JEKZenpJ"
            />
          </div>
        </div>

        {/* Active Interests Cloud (8 Columns) */}
        <div className="md:col-span-8 space-y-8">
          {/* Add New Interest */}
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                id="interest-input"
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag(newTag)}
                placeholder={text.inputPlaceholder}
                className="flex-1 px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={() => handleAddTag(newTag)}
                disabled={adding || !newTag.trim()}
                className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap sm:self-auto self-stretch"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                {adding ? text.adding : text.addInterest}
              </button>
            </div>
          </div>

          {/* Active Interests Cards */}
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 sm:p-6 lg:p-8">
            <div className="mb-6 sm:mb-8">
              <h3 className="font-serif text-2xl">{text.activeInterests}</h3>
            </div>

            {tags.length === 0 ? (
              <div className="text-center py-12 text-secondary">
                <span className="material-symbols-outlined block text-4xl mb-4">label_important</span>
                <p>{text.noInterests}</p>
                <p className="text-sm mt-1">{text.noInterestsHint}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {tags.map((tag) => {
                  const isFrozen = tag.status === 'frozen';
                  const strength = getStrengthPercent(tag);
                  const statusLabel = getStatusLabel(tag);

                  return (
                    <div
                      key={tag.id}
                      className={`group rounded-lg bg-surface p-4 transition-colors hover:bg-surface-container-high ${isFrozen ? 'bg-surface-container-highest/50 border border-dashed border-outline-variant opacity-60' : ''} ${!isFrozen && strength >= 70 ? 'border-l-4 border-primary' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className={`font-bold text-sm break-words pr-2 ${isFrozen ? 'italic' : ''}`}>{tag.tag}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isFrozen ? (
                            <span
                              className="material-symbols-outlined text-sm cursor-pointer text-primary"
                              onClick={() => handleStatusChange(tag.id, 'active')}
                              title={text.thaw}
                            >
                              ac_unit
                            </span>
                          ) : (
                            <>
                              <span
                                className="material-symbols-outlined text-sm cursor-pointer text-secondary hover:text-tertiary"
                                onClick={() => handleStatusChange(tag.id, 'frozen')}
                                title={text.freeze}
                              >
                                ac_unit
                              </span>
                              <span
                                className="material-symbols-outlined text-sm cursor-pointer text-secondary hover:text-error"
                                onClick={() => handleDelete(tag.id)}
                                title={text.delete}
                              >
                                delete
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isFrozen ? 'bg-secondary' : 'bg-primary'}`}
                          style={{ width: `${strength}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px] text-secondary uppercase tracking-tighter">
                          {text.strength}: {strength}%
                        </span>
                        <span className="text-[10px] text-secondary uppercase tracking-tighter">
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* System Suggestions / Emergent Patterns */}
          {candidates.length > 0 && (
            <div className="relative overflow-hidden rounded-xl border border-tertiary/10 bg-tertiary-container/5 p-5 sm:p-6 lg:p-8">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="material-symbols-outlined text-6xl">auto_awesome</span>
              </div>
              <h3 className="font-serif text-2xl mb-2 text-tertiary">{text.emergentPatterns}</h3>
              <p className="text-sm text-on-surface-variant mb-6">
                {text.emergentHint}
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.tag}
                    className="flex w-full items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-sm transition-shadow hover:shadow-md sm:w-auto sm:max-w-full"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm break-words">{candidate.tag}</span>
                      <span className="text-[10px] text-secondary">
                        {text.appearedIn.replace('{count}', String(candidate.count))}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAddCandidate(candidate.tag)}
                      className="ml-auto rounded bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-primary"
                    >
                      {text.adopt}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Control Section */}
      <div className="mt-10 grid grid-cols-1 gap-6 border-t border-outline-variant/10 pt-8 sm:mt-12 sm:pt-10 lg:mt-16 lg:grid-cols-3 lg:gap-8 lg:pt-12">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-primary">tune</span>
          <div>
            <h4 className="font-bold text-sm mb-1">{text.globalWeighting}</h4>
            <p className="text-xs text-secondary">
              {text.globalWeightingHint}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-primary">history</span>
          <div>
            <h4 className="font-bold text-sm mb-1">{text.evolutionHistory}</h4>
            <p className="text-xs text-secondary">
              {text.evolutionHistoryHint}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-primary">export_notes</span>
          <div>
            <h4 className="font-bold text-sm mb-1">{text.dataPortability}</h4>
            <p className="text-xs text-secondary">
              {text.dataPortabilityHint}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
