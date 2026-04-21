import { useState, useEffect } from 'react';
import { sourcesApi, type NewsSource, type ParsedAccount } from '../api/newsletter';
import dayjs from 'dayjs';
import { useI18n } from '../i18n';

type FetchModalStatus = 'loading' | 'success' | 'error';

interface FetchFeedbackState {
  open: boolean;
  status: FetchModalStatus;
  source: NewsSource | null;
  message: string;
  details: string[];
  articlesAdded: number;
}

export default function Sources() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const text = {
    inputUrlRequired: isZh ? '请输入链接' : 'Please enter a URL',
    invalidWechatUrl: isZh ? '请输入有效的微信公众号文章链接' : 'Please enter a valid WeChat article URL',
    parseFailed: isZh ? '解析失败' : 'Failed to parse URL',
    deleteSourceConfirm: isZh ? '确定要删除这个新闻源吗？' : 'Are you sure you want to delete this source?',
    deleteFailed: isZh ? '删除失败' : 'Delete failed',
    mpHints: isZh
      ? ['请确认公众号 FakeID 是否有效且未被修改', '请确认 API 地址和认证配置可用']
      : ['Please verify the WeChat FakeID is valid and unchanged', 'Please verify API endpoint and auth configuration'],
    customHints: isZh
      ? ['请确认该源 API 地址可访问', '请确认该源的认证参数和返回格式正确']
      : ['Please verify the source API endpoint is reachable', 'Please verify auth parameters and response schema'],
    fetchingSource: isZh ? '正在抓取 {name}，请稍候...' : 'Fetching {name}, please wait...',
    sourceId: isZh ? '来源 ID' : 'Source ID',
    sourceType: isZh ? '来源类型' : 'Source Type',
    triggerTime: isZh ? '触发时间' : 'Triggered at',
    addedArticles: isZh ? '新增文章' : 'Articles added',
    fetchCompleted: isZh ? '抓取完成' : 'Fetch completed',
    fetchFailed: isZh ? '抓取失败' : 'Fetch failed',
    unknownError: isZh ? '未知错误' : 'Unknown error',
    apiResponseException: isZh ? '接口响应异常' : 'API response error',
    runtimeException: isZh ? '网络或运行时异常' : 'Network/runtime error',
    fetchFailedWithReason: isZh ? '抓取失败：{reason}' : 'Fetch failed: {reason}',
    batchCompletedWithFailures: isZh ? '批量抓取已完成（含失败项）' : 'Batch fetch completed (with failures)',
    batchCompleted: isZh ? '批量抓取已完成' : 'Batch fetch completed',
    processedSources: isZh ? '处理来源' : 'Processed sources',
    success: isZh ? '成功' : 'Success',
    failed: isZh ? '失败' : 'Failed',
    sourceManagement: isZh ? '信源管理' : 'Source Management',
    informationArchitecture: isZh ? '信息架构' : 'Information Architecture',
    crawling: isZh ? '抓取中...' : 'Crawling...',
    manualCrawlAll: isZh ? '手动抓取全部' : 'Manual Crawl All',
    addNewSource: isZh ? '添加新信源' : 'Add New Source',
    healthyLinks: isZh ? '健康连接' : 'Healthy Links',
    active: isZh ? '活跃' : 'Active',
    latency: isZh ? '延迟' : 'Latency',
    avgCrawl: isZh ? '平均抓取' : 'Avg Crawl',
    criticalIssues: isZh ? '关键问题' : 'Critical Issues',
    actionRequired: isZh ? '需要处理' : 'Action required',
    noActiveSignals: isZh ? '暂无活跃信号' : 'No Active Signals',
    noActiveSignalsHint: isZh
      ? '你的信息工作台当前较为安静。连接一个来源后，系统将开始抓取与整理。'
      : 'Your atelier is currently quiet. Connect a source to begin the curation process and receive your first briefing.',
    startConnection: isZh ? '开始连接' : 'Start Connection',
    sourceIdentity: isZh ? '来源标识' : 'Source Identity',
    type: isZh ? '类型' : 'Type',
    lastIndexed: isZh ? '最近索引' : 'Last Indexed',
    status: isZh ? '状态' : 'Status',
    actions: isZh ? '操作' : 'Actions',
    wechat: isZh ? '微信公众号' : 'WeChat',
    custom: isZh ? '自定义' : 'Custom',
    never: isZh ? '从未' : 'Never',
    healthy: isZh ? '健康' : 'Healthy',
    needsAttention: isZh ? '需关注' : 'Needs Attention',
    fetchNow: isZh ? '立即抓取' : 'Fetch Now',
    editSource: isZh ? '编辑来源' : 'Edit Source',
    deleteSource: isZh ? '删除来源' : 'Delete Source',
    ingestSignal: isZh ? '接入新信号' : 'Ingest New Signal',
    ingestHint: isZh
      ? '添加新的 URL、RSS 或社媒来源，系统会在索引前评估内容质量。'
      : 'Add a new URL, RSS feed, or social profile to your digital atelier. Our crawlers will analyze the intellectual density before indexing.',
    quickAddPlaceholder: isZh ? '粘贴微信公众号文章链接' : 'Paste a WeChat article URL',
    parsing: isZh ? '解析中...' : 'Parsing...',
    add: isZh ? '添加' : 'Add',
    suggestions: isZh ? '建议' : 'Suggestions',
  };
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [editingSource, setEditingSource] = useState<NewsSource | null>(null);
  const [fetchingId, setFetchingId] = useState<number | null>(null);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const [parsedAccountForModal, setParsedAccountForModal] = useState<ParsedAccount | null>(null);
  const [fetchFeedback, setFetchFeedback] = useState<FetchFeedbackState>({
    open: false,
    status: 'loading',
    source: null,
    message: '',
    details: [],
    articlesAdded: 0,
  });

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await sourcesApi.list();
      setSources(data);
    } catch (err) {
      console.error('Failed to load sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddUrl.trim()) {
      setQuickAddError(text.inputUrlRequired);
      return;
    }

    if (!quickAddUrl.includes('mp.weixin.qq.com')) {
      setQuickAddError(text.invalidWechatUrl);
      return;
    }

    setQuickAddLoading(true);
    setQuickAddError('');

    try {
      const account = await sourcesApi.parseUrl(quickAddUrl);
      setParsedAccountForModal(account);
      setShowUrlModal(true);
      setQuickAddUrl('');
    } catch (err) {
      setQuickAddError(err instanceof Error ? err.message : text.parseFailed);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(text.deleteSourceConfirm)) return;
    try {
      await sourcesApi.delete(id);
      setSources(sources.filter((s) => s.id !== id));
    } catch (err) {
      alert(text.deleteFailed);
    }
  };

  const getSourceDebugHints = (source: NewsSource) => {
    if (source.source_type === 'mptext') {
      return text.mpHints;
    }

    return text.customHints;
  };

  const showFetchStatusModal = ({
    status,
    source,
    message,
    details,
    articlesAdded = 0,
  }: {
    status: FetchModalStatus;
    source: NewsSource | null;
    message: string;
    details: string[];
    articlesAdded?: number;
  }) => {
    setFetchFeedback({
      open: true,
      status,
      source,
      message,
      details,
      articlesAdded,
    });
  };

  const closeFetchFeedback = () => {
    setFetchFeedback((prev) => ({ ...prev, open: false }));
  };

  const handleFetch = async (source: NewsSource) => {
    const startedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    setFetchingId(source.id);
    showFetchStatusModal({
      status: 'loading',
      source,
      message: text.fetchingSource.replace('{name}', source.name),
      details: [
        `${text.sourceId}: ${source.id}`,
        `${text.sourceType}: ${source.source_type}`,
        `${text.triggerTime}: ${startedAt}`,
      ],
    });

    try {
      const result = await sourcesApi.fetch(source.id);
      const details = [
        `${text.sourceId}: ${source.id}`,
        `${text.sourceType}: ${source.source_type}`,
        `${text.triggerTime}: ${startedAt}`,
        `${text.addedArticles}: ${result.articles_added ?? 0}`,
      ];

      if (result.success) {
        showFetchStatusModal({
          status: 'success',
          source,
          message: result.message || text.fetchCompleted,
          details,
          articlesAdded: result.articles_added ?? 0,
        });
        await loadSources();
      } else {
        showFetchStatusModal({
          status: 'error',
          source,
          message: result.message || text.fetchFailed,
          details: [...details, ...getSourceDebugHints(source)],
          articlesAdded: result.articles_added ?? 0,
        });
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : text.unknownError;
      const errorType = rawMessage.startsWith('HTTP ')
        ? text.apiResponseException
        : text.runtimeException;

      showFetchStatusModal({
        status: 'error',
        source,
        message: text.fetchFailedWithReason.replace('{reason}', rawMessage),
        details: [
          `${text.sourceId}: ${source.id}`,
          `${text.sourceType}: ${source.source_type}`,
          `${text.triggerTime}: ${startedAt}`,
          `${isZh ? '异常类型' : 'Error type'}: ${errorType}`,
          ...getSourceDebugHints(source),
        ],
      });
    } finally {
      setFetchingId(null);
    }
  };

  const handleFetchAll = async () => {
    if (!sources.length || fetchingAll) return;
    setFetchingAll(true);

    let successCount = 0;
    let failCount = 0;
    let totalAdded = 0;

    for (const source of sources) {
      try {
        const result = await sourcesApi.fetch(source.id);
        totalAdded += result.articles_added ?? 0;
        if (result.success) {
          successCount += 1;
        } else {
          failCount += 1;
        }
      } catch {
        failCount += 1;
      }
    }

    await loadSources();

    showFetchStatusModal({
      status: failCount > 0 ? 'error' : 'success',
      source: null,
      message: failCount > 0 ? text.batchCompletedWithFailures : text.batchCompleted,
      details: [
        `${text.processedSources}: ${sources.length}`,
        `${text.success}: ${successCount}`,
        `${text.failed}: ${failCount}`,
        `${text.addedArticles}: ${totalAdded}`,
      ],
      articlesAdded: totalAdded,
    });

    setFetchingAll(false);
  };

  const handleEdit = (source: NewsSource) => {
    setEditingSource(source);
    setShowModal(true);
  };

  // Calculate stats for bento grid
  const healthyCount = sources.length;
  const criticalCount = sources.filter(s => {
    if (!s.last_fetch_at) return false;
    const lastFetch = dayjs(s.last_fetch_at);
    const hoursAgo = dayjs().diff(lastFetch, 'hours');
    return hoursAgo > 24;
  }).length;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-[#0d4656]"></div>
            <span className="font-['Manrope'] uppercase tracking-widest text-[11px] text-[#5e5e5e]">{text.informationArchitecture}</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-['Newsreader'] italic leading-tight text-[#1a1c1b]">{text.sourceManagement}</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleFetchAll}
            disabled={fetchingAll || loading || sources.length === 0}
            className="flex items-center gap-2 border border-[#c0c8cb]/30 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#1a1c1b] hover:bg-[#f4f4f2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span
              className={`material-symbols-outlined text-base ${fetchingAll ? 'animate-spin' : ''}`}
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              sync
            </span>
            {fetchingAll ? text.crawling : text.manualCrawlAll}
          </button>
          <button
            onClick={() => {
              setEditingSource(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-br from-[#0d4656] to-[#2c5e6e] px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-lg hover:translate-y-[-1px] transition-all"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>add_link</span>
            {text.addNewSource}
          </button>
        </div>
      </div>

      {/* Bento Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 bg-[#f4f4f2] p-6 rounded-xl flex flex-col justify-between">
          <span className="font-['Manrope'] uppercase tracking-widest text-[10px] text-[#5e5e5e]">{text.healthyLinks}</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-['Newsreader'] italic">{healthyCount}</span>
            <span className="text-xs text-green-600 font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>arrow_upward</span>
              {text.active}
            </span>
          </div>
        </div>
        <div className="md:col-span-1 bg-[#f4f4f2] p-6 rounded-xl flex flex-col justify-between">
          <span className="font-['Manrope'] uppercase tracking-widest text-[10px] text-[#5e5e5e]">{text.latency}</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-['Newsreader'] italic">{isZh ? '0.8秒' : '0.8s'}</span>
            <span className="text-xs text-[#5e5e5e] font-medium">{text.avgCrawl}</span>
          </div>
        </div>
        <div className="md:col-span-2 bg-[#e2e3e1] p-6 rounded-xl flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <span className="font-['Manrope'] uppercase tracking-widest text-[10px] text-[#0d4656]">{text.criticalIssues}</span>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-4xl font-['Newsreader'] italic text-[#ba1a1a]">{criticalCount}</span>
              <span className="text-xs text-[#ba1a1a] font-medium">{text.actionRequired}</span>
            </div>
          </div>
          <div className="absolute right-[-10%] bottom-[-20%] opacity-10">
            <span className="material-symbols-outlined text-9xl text-[#0d4656]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>warning</span>
          </div>
        </div>
      </div>

      {/* Sources Table */}
      <div className="bg-[#f4f4f2] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#0d4656] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-[#eeeeec] rounded-full flex items-center justify-center mb-6 mx-auto">
              <span className="material-symbols-outlined text-4xl text-[#c0c8cb]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>cloud_off</span>
            </div>
            <h2 className="text-3xl font-['Newsreader'] italic mb-2 text-[#1a1c1b]">{text.noActiveSignals}</h2>
            <p className="max-w-md text-[#40484b] text-sm leading-relaxed mb-8 mx-auto">
              {text.noActiveSignalsHint}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#0d4656] text-white px-8 py-3 rounded-lg font-semibold shadow-xl hover:opacity-90 transition-opacity"
            >
              {text.startConnection}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#e8e8e6]/50 border-b border-[#c0c8cb]/10">
                  <th className="px-8 py-5 font-['Manrope'] uppercase tracking-widest text-[11px] text-[#5e5e5e]">{text.sourceIdentity}</th>
                  <th className="px-6 py-5 font-['Manrope'] uppercase tracking-widest text-[11px] text-[#5e5e5e]">{text.type}</th>
                  <th className="px-6 py-5 font-['Manrope'] uppercase tracking-widest text-[11px] text-[#5e5e5e]">{text.lastIndexed}</th>
                  <th className="px-6 py-5 font-['Manrope'] uppercase tracking-widest text-[11px] text-[#5e5e5e]">{text.status}</th>
                  <th className="px-8 py-5 text-right font-['Manrope'] uppercase tracking-widest text-[11px] text-[#5e5e5e]">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c0c8cb]/10">
                {sources.map((source) => {
                  const isHealthy = source.last_fetch_at && dayjs().diff(dayjs(source.last_fetch_at), 'hours') < 24;
                  return (
                    <tr key={source.id} className={`hover:bg-[#e2e3e1]/50 transition-colors group ${!isHealthy && source.last_fetch_at ? 'bg-[#ffdad6]/5' : ''}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-[#2c5e6e]">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>newspaper</span>
                          </div>
                          <div>
                            <div className="font-['Newsreader'] text-lg italic text-[#1a1c1b]">{source.name}</div>
                            <div className="text-xs text-[#71787c] font-medium tracking-wide">{source.api_base_url}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="px-3 py-1 bg-[#e2e3e1] text-[#5e5e5e] text-[10px] font-bold uppercase tracking-widest rounded-full">
                          {source.source_type === 'mptext' ? text.wechat : text.custom}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-sm text-[#40484b]">
                        {source.last_fetch_at ? dayjs(source.last_fetch_at).format('MM-DD HH:mm') : text.never}
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-2">
                          {isHealthy ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                              <span className="text-[11px] font-bold text-green-700 uppercase tracking-tight">{text.healthy}</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></div>
                              <span className="text-[11px] font-bold text-[#ba1a1a] uppercase tracking-tight">{text.needsAttention}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleFetch(source)}
                            disabled={fetchingId === source.id}
                            className="p-2 text-[#71787c] hover:text-[#0d4656] hover:bg-white rounded-lg transition-all disabled:opacity-50"
                            title={text.fetchNow}
                          >
                            <span
                              className={`material-symbols-outlined text-lg ${fetchingId === source.id ? 'animate-spin' : ''}`}
                              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                            >
                              sync
                            </span>
                          </button>
                          <button
                            onClick={() => handleEdit(source)}
                            className="p-2 text-[#71787c] hover:text-[#0d4656] hover:bg-white rounded-lg transition-all"
                            title={text.editSource}
                          >
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(source.id)}
                            className="p-2 text-[#71787c] hover:text-[#ba1a1a] hover:bg-white rounded-lg transition-all"
                            title={text.deleteSource}
                          >
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Add Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start border-t border-[#c0c8cb]/20 pt-12">
        <div className="md:col-span-1">
          <h3 className="text-2xl font-['Newsreader'] italic mb-2 text-[#1a1c1b]">{text.ingestSignal}</h3>
          <p className="text-sm text-[#40484b] leading-relaxed">
            {text.ingestHint}
          </p>
        </div>
        <div className="md:col-span-2">
          <div className="bg-white p-1 rounded-xl shadow-sm ring-1 ring-[#c0c8cb]/15 flex flex-col sm:flex-row gap-1">
            <input
              type="url"
              value={quickAddUrl}
              onChange={(e) => {
                setQuickAddUrl(e.target.value);
                setQuickAddError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              placeholder={text.quickAddPlaceholder}
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-sm placeholder:text-[#71787c]/50 text-[#1a1c1b]"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={handleQuickAdd}
                disabled={quickAddLoading}
                className="bg-[#0d4656] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {quickAddLoading ? text.parsing : text.add}
              </button>
            </div>
          </div>
          {quickAddError && (
            <p className="mt-2 text-sm text-red-600">{quickAddError}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[10px] text-[#71787c] font-['Manrope'] uppercase tracking-wider self-center mr-2">{text.suggestions}:</span>
            <button className="px-3 py-1 bg-[#f4f4f2] border border-[#c0c8cb]/10 rounded-full text-[10px] text-[#5e5e5e] hover:bg-[#e8e8e6] transition-colors">Aeon Magazine</button>
            <button className="px-3 py-1 bg-[#f4f4f2] border border-[#c0c8cb]/10 rounded-full text-[10px] text-[#5e5e5e] hover:bg-[#e8e8e6] transition-colors">The Browser</button>
            <button className="px-3 py-1 bg-[#f4f4f2] border border-[#c0c8cb]/10 rounded-full text-[10px] text-[#5e5e5e] hover:bg-[#e8e8e6] transition-colors">Ribbonfarm</button>
          </div>
        </div>
      </div>

      {showModal && (
        <SourceModal
          source={editingSource}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            loadSources();
          }}
        />
      )}

      {showUrlModal && (
        <AddFromUrlModal
          onClose={() => {
            setShowUrlModal(false);
            setParsedAccountForModal(null);
          }}
          onSuccess={() => {
            setShowUrlModal(false);
            setParsedAccountForModal(null);
            loadSources();
          }}
          initialAccount={parsedAccountForModal}
        />
      )}

      <FetchFeedbackModal
        open={fetchFeedback.open}
        status={fetchFeedback.status}
        source={fetchFeedback.source}
        message={fetchFeedback.message}
        details={fetchFeedback.details}
        articlesAdded={fetchFeedback.articlesAdded}
        onClose={closeFetchFeedback}
        onRetry={fetchFeedback.source ? () => void handleFetch(fetchFeedback.source!) : undefined}
      />
    </div>
  );
}

interface SourceModalProps {
  source: NewsSource | null;
  onClose: () => void;
  onSave: () => void;
}

function SourceModal({ source, onClose, onSave }: SourceModalProps) {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const [name, setName] = useState(source?.name || '');
  const [sourceType, setSourceType] = useState(source?.source_type || 'mptext');
  const [apiBaseUrl, setApiBaseUrl] = useState(source?.api_base_url || 'https://down.mptext.top');
  const [authKey, setAuthKey] = useState(source?.auth_key || '');
  const [fakeid, setFakeid] = useState<string>(source?.config?.fakeid as string || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        name,
        source_type: sourceType,
        api_base_url: apiBaseUrl,
        auth_key: authKey,
        config: { fakeid },
      };
      if (source) {
        await sourcesApi.update(source.id, data);
      } else {
        await sourcesApi.create(data);
      }
      onSave();
    } catch (err) {
      alert(source ? (isZh ? '更新失败' : 'Update failed') : (isZh ? '创建失败' : 'Create failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {source ? (isZh ? '编辑新闻源' : 'Edit Source') : (isZh ? '添加新闻源' : 'Add Source')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isZh ? '名称' : 'Name'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={isZh ? '例如：科技资讯' : 'e.g. Tech Insights'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isZh ? '类型' : 'Type'}</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
            >
              <option value="mptext">{isZh ? '微信公众号 (MPText)' : 'WeChat (MPText)'}</option>
              <option value="custom">{isZh ? '自定义 REST API' : 'Custom REST API'}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isZh ? 'API 基础 URL' : 'API Base URL'}</label>
            <input
              type="url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isZh ? '认证 Key' : 'Auth Key'}</label>
            <input
              type="password"
              value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder={isZh ? 'MPText API Key（可选）' : 'MPText API Key (optional)'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
            />
          </div>
          {sourceType === 'mptext' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isZh ? '微信公众号 Fake ID' : 'WeChat Fake ID'}</label>
              <input
                type="text"
                value={fakeid}
                onChange={(e) => setFakeid(e.target.value)}
                required
                placeholder={isZh ? '在 MPText 平台获取的 fakeid' : 'fakeid from MPText platform'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isZh ? '取消' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#0d4656] rounded-lg hover:bg-[#2c5e6e] disabled:opacity-50 transition-colors"
            >
              {saving ? (isZh ? '保存中...' : 'Saving...') : (isZh ? '保存' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddFromUrlModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialAccount?: ParsedAccount | null;
}

function AddFromUrlModal({ onClose, onSuccess, initialAccount }: AddFromUrlModalProps) {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const [url, setUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedAccount, setParsedAccount] = useState<ParsedAccount | null>(initialAccount || null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleParse = async () => {
    if (!url.trim()) {
      setError(isZh ? '请输入文章链接' : 'Please enter an article URL');
      return;
    }

    if (!url.includes('mp.weixin.qq.com')) {
      setError(isZh ? '请输入有效的微信公众号文章链接' : 'Please enter a valid WeChat article URL');
      return;
    }

    setParsing(true);
    setError('');
    setParsedAccount(null);

    try {
      const account = await sourcesApi.parseUrl(url);
      setParsedAccount(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : (isZh ? '解析失败' : 'Parse failed'));
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedAccount) return;

    setSaving(true);
    try {
      await sourcesApi.create({
        name: parsedAccount.nickname,
        source_type: 'mptext',
        api_base_url: 'https://down.mptext.top',
        auth_key: '',
        config: { fakeid: parsedAccount.fakeid },
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isZh ? '添加失败' : 'Add failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{isZh ? '从文章链接添加公众号' : 'Add account from article URL'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!initialAccount && !parsedAccount && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isZh ? '微信公众号文章链接' : 'WeChat article URL'}</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError('');
                    setParsedAccount(null);
                  }}
                  placeholder={isZh ? 'https://mp.weixin.qq.com/s/...' : 'https://mp.weixin.qq.com/s/...'}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
                />
                <button
                  onClick={handleParse}
                  disabled={parsing || !url.trim()}
                  className="px-4 py-2 bg-[#0d4656] text-white rounded-lg text-sm font-medium hover:bg-[#2c5e6e] disabled:opacity-50 transition-colors"
                >
                  {parsing ? (isZh ? '解析中...' : 'Parsing...') : (isZh ? '解析' : 'Parse')}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">{isZh ? '粘贴任意微信公众号文章链接，系统将自动识别所属公众号' : 'Paste any WeChat article URL and the system will identify the account automatically.'}</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {(parsedAccount || initialAccount) && (() => {
            const account = parsedAccount || initialAccount!;
            return (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  {account.avatar ? (
                    <img
                      src={account.avatar}
                      alt={account.nickname}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl">
                      📮
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-900">{account.nickname}</h4>
                    {account.is_verify === 2 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {isZh ? '已认证' : 'Verified'}
                      </span>
                    )}
                  </div>
                </div>

                {account.alias && (
                  <p className="text-sm text-gray-500 mb-2">{isZh ? '微信号' : 'WeChat ID'}：{account.alias}</p>
                )}

                {account.verify_info && (
                  <p className="text-sm text-gray-500 mb-2">{isZh ? '主体' : 'Entity'}：{account.verify_info}</p>
                )}

                {account.signature && (
                  <p className="text-sm text-gray-400 line-clamp-2">{account.signature}</p>
                )}

                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-xs text-gray-500 mb-1">Fake ID：{account.fakeid}</p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isZh ? '取消' : 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!parsedAccount || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0d4656] rounded-lg hover:bg-[#2c5e6e] disabled:opacity-50 transition-colors"
          >
            {saving ? (isZh ? '添加中...' : 'Adding...') : (isZh ? '确认添加' : 'Confirm Add')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FetchFeedbackModalProps {
  open: boolean;
  status: FetchModalStatus;
  source: NewsSource | null;
  message: string;
  details: string[];
  articlesAdded: number;
  onClose: () => void;
  onRetry?: () => void;
}

function FetchFeedbackModal({
  open,
  status,
  source,
  message,
  details,
  articlesAdded,
  onClose,
  onRetry,
}: FetchFeedbackModalProps) {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  if (!open) return null;

  const statusLabel = status === 'loading' ? (isZh ? '进行中' : 'Running') : status === 'success' ? (isZh ? '已完成' : 'Completed') : (isZh ? '失败' : 'Failed');
  const statusClassName =
    status === 'loading'
      ? 'bg-[#e8f1f3] text-[#0d4656]'
      : status === 'success'
        ? 'bg-[#e8f3ec] text-[#2f6f4f]'
        : 'bg-[#ffe9e7] text-[#ba1a1a]';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#101819]/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#c0c8cb]/25 bg-[#f4f4f2] shadow-[0_40px_90px_rgba(9,24,29,0.35)]">
        <div className="flex items-start justify-between border-b border-[#c0c8cb]/15 px-6 py-5">
          <div className="pr-6">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-[#0d4656]" />
              <p className="font-['Manrope'] text-[11px] uppercase tracking-widest text-[#5e5e5e]">
                {isZh ? '抓取状态' : 'Fetch Status'}
              </p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClassName}`}>
                {statusLabel}
              </span>
            </div>
            <h3 className="font-['Newsreader'] text-3xl italic leading-tight text-[#1a1c1b]">
              {source ? source.name : (isZh ? '手动抓取全部' : 'Manual Crawl All')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#71787c] transition-colors hover:bg-white hover:text-[#1a1c1b]"
            aria-label={isZh ? '关闭' : 'Close'}
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
              close
            </span>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-start gap-3 rounded-xl border border-[#c0c8cb]/20 bg-white px-4 py-3">
            <span
              className={`material-symbols-outlined mt-0.5 text-lg ${
                status === 'loading'
                  ? 'animate-spin text-[#0d4656]'
                  : status === 'success'
                    ? 'text-[#2f6f4f]'
                    : 'text-[#ba1a1a]'
              }`}
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
            >
              {status === 'loading' ? 'progress_activity' : status === 'success' ? 'task_alt' : 'error'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1a1c1b]">{message}</p>
              {status !== 'loading' && (
                <p className="mt-1 text-xs text-[#5e5e5e]">{isZh ? '本次新增文章' : 'Articles added'}：{articlesAdded}</p>
              )}
            </div>
          </div>

          {details.length > 0 && (
            <div className="rounded-xl border border-[#c0c8cb]/20 bg-[#fdfdfc] px-4 py-3">
              <p className="mb-2 font-['Manrope'] text-[10px] uppercase tracking-widest text-[#5e5e5e]">{isZh ? '详情' : 'Details'}</p>
              <ul className="space-y-1.5 text-sm text-[#40484b]">
                {details.map((detail) => (
                  <li key={detail} className="flex items-start gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#9ca5a9]" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#c0c8cb]/15 px-6 py-4">
          {status === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="rounded-lg border border-[#c0c8cb]/30 px-4 py-2 text-sm font-semibold text-[#1a1c1b] transition-colors hover:bg-white"
            >
              {isZh ? '重试' : 'Retry'}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-[#0d4656] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2c5e6e]"
          >
            {status === 'loading' ? (isZh ? '后台运行' : 'Background Run') : (isZh ? '关闭' : 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
