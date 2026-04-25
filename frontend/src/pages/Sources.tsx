import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import {
  sourcesApi,
  type NewsSource,
  type SourceFetchResult,
  type WeMpRssAuthConfig,
  type WeMpRssAuthTemplate,
} from '../api/newsletter';
import { useI18n } from '../i18n';

type FetchModalStatus = 'loading' | 'success' | 'error';
type SourceType = 'native_rss' | 'we_mp_rss';

interface FetchFeedbackState {
  open: boolean;
  status: FetchModalStatus;
  source: NewsSource | null;
  message: string;
  details: string[];
  articlesAdded: number;
}

const SUPPORTED_SOURCE_TYPES: SourceType[] = ['native_rss', 'we_mp_rss'];
const MASKED_PASSWORD_PLACEHOLDER = '••••••••';

function isSupportedSourceType(value: string | null | undefined): value is SourceType {
  return SUPPORTED_SOURCE_TYPES.includes((value ?? '') as SourceType);
}

function normalizeFrontendSourceType(value: string | null | undefined): SourceType {
  return value === 'we_mp_rss' ? 'we_mp_rss' : 'native_rss';
}

function getWeMpRssAuth(config: Record<string, unknown> | null | undefined): WeMpRssAuthConfig | null {
  const auth = config?.we_mprss_auth;
  return auth && typeof auth === 'object' ? (auth as WeMpRssAuthConfig) : null;
}

function inferQuickAddName(feedUrl: string) {
  try {
    const url = new URL(feedUrl);
    return url.hostname.replace(/^www\./, '') || 'Feed';
  } catch {
    return 'Feed';
  }
}

function sourceTypeLabel(sourceType: string, isZh: boolean) {
  if (sourceType === 'we_mp_rss') return isZh ? '微信公众号' : 'We-MP-RSS';
  if (sourceType === 'native_rss' || sourceType === 'rsshub') return isZh ? '通用 RSS' : 'Generic RSS';
  return sourceType;
}

export default function Sources() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const text = {
    inputUrlRequired: isZh ? '请输入有效的 Feed URL' : 'Please enter a valid feed URL',
    invalidFeedUrl: isZh ? '请输入 http:// 或 https:// 开头的 Feed URL' : 'Please enter a feed URL starting with http:// or https://',
    createFailed: isZh ? '创建失败' : 'Create failed',
    deleteSourceConfirm: isZh ? '确定要删除这个新闻源吗？' : 'Are you sure you want to delete this source?',
    deleteFailed: isZh ? '删除失败' : 'Delete failed',
    nativeHints: isZh
      ? ['请确认该源返回 RSS / Atom / JSON Feed', '请确认目标站点没有拦截服务端请求']
      : ['Please verify the source returns RSS / Atom / JSON Feed', 'Please verify the site does not block server-side requests'],
    genericHints: isZh
      ? ['请确认该源返回 RSS / Atom / JSON Feed', 'RSSHub 等 feed 地址也按通用 RSS 录入']
      : ['Please verify the source returns RSS / Atom / JSON Feed', 'RSSHub routes should also be entered as Generic RSS feeds'],
    weMpRssHints: isZh
      ? ['请确认 we-mp-rss 服务和对应 /feed/... 路径可访问', '请确认本地部署生成的 feed 已有文章数据']
      : ['Please verify the we-mp-rss service and /feed/... endpoint are reachable', 'Please verify the local deployment already has article data'],
    fetchingSource: isZh ? '正在抓取 {name}，请稍候...' : 'Fetching {name}, please wait...',
    sourceId: isZh ? '来源 ID' : 'Source ID',
    providerSourceId: isZh ? 'Provider ID' : 'Provider ID',
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
      ? '当前只保留两类输入源：通用 RSS 和微信公众号。连接 feed 后，系统将开始抓取与整理。'
      : 'Only two source families remain here: Generic RSS and We-MP-RSS. Connect a feed and MindFlow will start ingestion.',
    startConnection: isZh ? '开始连接' : 'Start Connection',
    sourceIdentity: isZh ? '来源标识' : 'Source Identity',
    type: isZh ? '类型' : 'Type',
    lastIndexed: isZh ? '最近索引' : 'Last Indexed',
    status: isZh ? '状态' : 'Status',
    actions: isZh ? '操作' : 'Actions',
    never: isZh ? '从未' : 'Never',
    healthy: isZh ? '健康' : 'Healthy',
    needsAttention: isZh ? '需关注' : 'Needs Attention',
    fetchNow: isZh ? '立即抓取' : 'Fetch Now',
    editSource: isZh ? '编辑来源' : 'Edit Source',
    deleteSource: isZh ? '删除来源' : 'Delete Source',
    ingestSignal: isZh ? '接入新信号' : 'Ingest New Signal',
    ingestHint: isZh
      ? '快速添加会默认创建通用 RSS 源；如果是微信公众号 feed，请使用上方弹窗补充认证信息。'
      : 'Quick Add creates a Generic RSS source by default. Use the modal for We-MP-RSS feeds that need credentials.',
    quickAddPlaceholder: isZh ? '粘贴 Feed URL，例如 https://example.com/feed.xml' : 'Paste a feed URL, e.g. https://example.com/feed.xml',
    parsing: isZh ? '添加中...' : 'Adding...',
    add: isZh ? '快速添加 RSS' : 'Quick Add RSS',
    suggestions: isZh ? '建议类型' : 'Suggested Types',
    authConfigured: isZh ? '已配置认证' : 'Auth configured',
  };

  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<NewsSource | null>(null);
  const [fetchingId, setFetchingId] = useState<number | null>(null);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const [fetchFeedback, setFetchFeedback] = useState<FetchFeedbackState>({
    open: false,
    status: 'loading',
    source: null,
    message: '',
    details: [],
    articlesAdded: 0,
  });

  useEffect(() => {
    void loadSources();
  }, []);

  const sourceHints = useMemo(
    () => ({
      native_rss: text.genericHints,
      we_mp_rss: text.weMpRssHints,
    }),
    [text.genericHints, text.weMpRssHints]
  );

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await sourcesApi.list();
      setSources(data);
    } catch (error) {
      console.error('Failed to load sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async () => {
    const value = quickAddUrl.trim();
    if (!value) {
      setQuickAddError(text.inputUrlRequired);
      return;
    }

    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(text.invalidFeedUrl);
      }
    } catch {
      setQuickAddError(text.invalidFeedUrl);
      return;
    }

    setQuickAddLoading(true);
    setQuickAddError('');

    try {
      await sourcesApi.create({
        name: inferQuickAddName(value),
        source_type: 'native_rss',
        api_base_url: value,
        auth_key: '',
        config: { feed_url: value },
      });
      setQuickAddUrl('');
      await loadSources();
    } catch (error) {
      setQuickAddError(error instanceof Error ? error.message : text.createFailed);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(text.deleteSourceConfirm)) return;
    try {
      await sourcesApi.delete(id);
      setSources((current) => current.filter((source) => source.id !== id));
    } catch {
      alert(text.deleteFailed);
    }
  };

  const getSourceDebugHints = (source: NewsSource) => {
    if (isSupportedSourceType(source.source_type)) {
      return sourceHints[source.source_type];
    }
    return text.genericHints;
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
        ...(source.provider_source_id ? [`${text.providerSourceId}: ${source.provider_source_id}`] : []),
        `${text.sourceType}: ${sourceTypeLabel(source.source_type, isZh)}`,
        `${text.triggerTime}: ${startedAt}`,
      ],
    });

    try {
      const result = await sourcesApi.fetch(source.id);
      const details = [
        `${text.sourceId}: ${source.id}`,
        ...(source.provider_source_id ? [`${text.providerSourceId}: ${source.provider_source_id}`] : []),
        `${text.sourceType}: ${sourceTypeLabel(source.source_type, isZh)}`,
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
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : text.unknownError;
      const errorType = rawMessage.startsWith('HTTP ')
        ? text.apiResponseException
        : text.runtimeException;

      showFetchStatusModal({
        status: 'error',
        source,
        message: text.fetchFailedWithReason.replace('{reason}', rawMessage),
        details: [
          `${text.sourceId}: ${source.id}`,
          ...(source.provider_source_id ? [`${text.providerSourceId}: ${source.provider_source_id}`] : []),
          `${text.sourceType}: ${sourceTypeLabel(source.source_type, isZh)}`,
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

  const healthyCount = sources.length;
  const criticalCount = sources.filter((source) => {
    if (!source.last_fetch_at) return false;
    const lastFetch = dayjs(source.last_fetch_at);
    return dayjs().diff(lastFetch, 'hours') > 24;
  }).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-6 w-1 bg-[#0d4656]" />
            <span className="font-['Manrope'] text-[11px] uppercase tracking-widest text-[#5e5e5e]">{text.informationArchitecture}</span>
          </div>
          <h1 className="font-['Newsreader'] text-5xl italic leading-tight text-[#1a1c1b] md:text-6xl">{text.sourceManagement}</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleFetchAll}
            disabled={fetchingAll || loading || sources.length === 0}
            className="flex items-center gap-2 rounded-lg border border-[#c0c8cb]/30 px-5 py-2.5 text-sm font-semibold text-[#1a1c1b] transition-colors hover:bg-[#f4f4f2] disabled:cursor-not-allowed disabled:opacity-50"
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
            className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#0d4656] to-[#2c5e6e] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:translate-y-[-1px]"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
              add_link
            </span>
            {text.addNewSource}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl bg-[#f4f4f2] p-6 md:col-span-1">
          <span className="font-['Manrope'] text-[10px] uppercase tracking-widest text-[#5e5e5e]">{text.healthyLinks}</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-['Newsreader'] text-4xl italic">{healthyCount}</span>
            <span className="flex items-center gap-1 text-xs font-bold text-green-600">
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                arrow_upward
              </span>
              {text.active}
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl bg-[#f4f4f2] p-6 md:col-span-1">
          <span className="font-['Manrope'] text-[10px] uppercase tracking-widest text-[#5e5e5e]">{text.latency}</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-['Newsreader'] text-4xl italic">{isZh ? '0.8秒' : '0.8s'}</span>
            <span className="text-xs font-medium text-[#5e5e5e]">{text.avgCrawl}</span>
          </div>
        </div>
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#e2e3e1] p-6 md:col-span-2">
          <div className="relative z-10">
            <span className="font-['Manrope'] text-[10px] uppercase tracking-widest text-[#0d4656]">{text.criticalIssues}</span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-['Newsreader'] text-4xl italic text-[#ba1a1a]">{criticalCount}</span>
              <span className="text-xs font-medium text-[#ba1a1a]">{text.actionRequired}</span>
            </div>
          </div>
          <div className="absolute bottom-[-20%] right-[-10%] opacity-10">
            <span className="material-symbols-outlined text-9xl text-[#0d4656]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
              warning
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[#f4f4f2]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0d4656] border-t-transparent" />
          </div>
        ) : sources.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#eeeeec]">
              <span className="material-symbols-outlined text-4xl text-[#c0c8cb]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                cloud_off
              </span>
            </div>
            <h2 className="mb-2 font-['Newsreader'] text-3xl italic text-[#1a1c1b]">{text.noActiveSignals}</h2>
            <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[#40484b]">{text.noActiveSignalsHint}</p>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-[#0d4656] px-8 py-3 font-semibold text-white shadow-xl transition-opacity hover:opacity-90"
            >
              {text.startConnection}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#c0c8cb]/10 bg-[#e8e8e6]/50">
                  <th className="px-8 py-5 font-['Manrope'] text-[11px] uppercase tracking-widest text-[#5e5e5e]">{text.sourceIdentity}</th>
                  <th className="px-6 py-5 font-['Manrope'] text-[11px] uppercase tracking-widest text-[#5e5e5e]">{text.type}</th>
                  <th className="px-6 py-5 font-['Manrope'] text-[11px] uppercase tracking-widest text-[#5e5e5e]">{text.lastIndexed}</th>
                  <th className="px-6 py-5 font-['Manrope'] text-[11px] uppercase tracking-widest text-[#5e5e5e]">{text.status}</th>
                  <th className="px-8 py-5 text-right font-['Manrope'] text-[11px] uppercase tracking-widest text-[#5e5e5e]">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c0c8cb]/10">
                {sources.map((source) => {
                  const isHealthy = source.last_fetch_at && dayjs().diff(dayjs(source.last_fetch_at), 'hours') < 24;
                  return (
                    <tr
                      key={source.id}
                      className={`group transition-colors hover:bg-[#e2e3e1]/50 ${
                        !isHealthy && source.last_fetch_at ? 'bg-[#ffdad6]/5' : ''
                      }`}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2c5e6e]">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                              newspaper
                            </span>
                          </div>
                          <div>
                            <div className="font-['Newsreader'] text-lg italic text-[#1a1c1b]">{source.name}</div>
                            <div className="text-xs font-medium tracking-wide text-[#71787c]">{source.api_base_url}</div>
                            {source.provider_source_id && (
                              <div className="mt-1 text-[11px] font-semibold text-[#0d4656]">
                                {text.providerSourceId}: {source.provider_source_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="rounded-full bg-[#e2e3e1] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#5e5e5e]">
                          {sourceTypeLabel(source.source_type, isZh)}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-sm text-[#40484b]">
                        {source.last_fetch_at ? dayjs(source.last_fetch_at).format('MM-DD HH:mm') : text.never}
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-2">
                          {isHealthy ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                              <span className="text-[11px] font-bold uppercase tracking-tight text-green-700">{text.healthy}</span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 animate-pulse rounded-full bg-[#ba1a1a]" />
                              <span className="text-[11px] font-bold uppercase tracking-tight text-[#ba1a1a]">{text.needsAttention}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => void handleFetch(source)}
                            disabled={fetchingId === source.id}
                            className="rounded-lg p-2 text-[#71787c] transition-all hover:bg-white hover:text-[#0d4656] disabled:opacity-50"
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
                            className="rounded-lg p-2 text-[#71787c] transition-all hover:bg-white hover:text-[#0d4656]"
                            title={text.editSource}
                          >
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() => void handleDelete(source.id)}
                            className="rounded-lg p-2 text-[#71787c] transition-all hover:bg-white hover:text-[#ba1a1a]"
                            title={text.deleteSource}
                          >
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                              delete
                            </span>
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

      <div className="grid grid-cols-1 items-start gap-8 border-t border-[#c0c8cb]/20 pt-12 md:grid-cols-3">
        <div className="md:col-span-1">
          <h3 className="mb-2 font-['Newsreader'] text-2xl italic text-[#1a1c1b]">{text.ingestSignal}</h3>
          <p className="text-sm leading-relaxed text-[#40484b]">{text.ingestHint}</p>
        </div>
        <div className="md:col-span-2">
          <div className="flex flex-col gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-[#c0c8cb]/15 sm:flex-row">
            <input
              type="url"
              value={quickAddUrl}
              onChange={(event) => {
                setQuickAddUrl(event.target.value);
                setQuickAddError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleQuickAdd();
                }
              }}
              placeholder={text.quickAddPlaceholder}
              className="flex-1 border-none bg-transparent px-4 py-3 text-sm text-[#1a1c1b] placeholder:text-[#71787c]/50 focus:ring-0"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => void handleQuickAdd()}
                disabled={quickAddLoading}
                className="rounded-lg bg-[#0d4656] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {quickAddLoading ? text.parsing : text.add}
              </button>
            </div>
          </div>
          {quickAddError && <p className="mt-2 text-sm text-red-600">{quickAddError}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="mr-2 self-center font-['Manrope'] text-[10px] uppercase tracking-wider text-[#71787c]">{text.suggestions}:</span>
            <span className="rounded-full border border-[#c0c8cb]/10 bg-[#f4f4f2] px-3 py-1 text-[10px] text-[#5e5e5e]">{isZh ? '通用 RSS' : 'Generic RSS'}</span>
            <span className="rounded-full border border-[#c0c8cb]/10 bg-[#f4f4f2] px-3 py-1 text-[10px] text-[#5e5e5e]">{isZh ? '微信公众号' : 'We-MP-RSS'}</span>
          </div>
        </div>
      </div>

      {showModal && (
        <SourceModal
          source={editingSource}
          onClose={() => setShowModal(false)}
          onSave={(savedSource, fetchResult, startedAt) => {
            setShowModal(false);
            setEditingSource(null);
            void loadSources();
            showFetchStatusModal({
              status: 'success',
              source: savedSource,
              message: fetchResult.message || text.fetchCompleted,
              details: [
                `${text.sourceId}: ${savedSource.id}`,
                ...(savedSource.provider_source_id ? [`${text.providerSourceId}: ${savedSource.provider_source_id}`] : []),
                `${text.sourceType}: ${sourceTypeLabel(savedSource.source_type, isZh)}`,
                `${text.triggerTime}: ${startedAt}`,
                `${text.addedArticles}: ${fetchResult.articles_added ?? 0}`,
              ],
              articlesAdded: fetchResult.articles_added ?? 0,
            });
          }}
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
  onSave: (source: NewsSource, fetchResult: SourceFetchResult, startedAt: string) => void;
}

function SourceModal({ source, onClose, onSave }: SourceModalProps) {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const [persistedSource, setPersistedSource] = useState<NewsSource | null>(source);
  const activeSource = persistedSource;
  const existingConfig = (activeSource?.config ?? {}) as Record<string, unknown>;
  const existingAuth = getWeMpRssAuth(existingConfig);
  const existingPassword = existingAuth?.password ?? '';
  const initialType = normalizeFrontendSourceType(activeSource?.source_type);
  const [name, setName] = useState(activeSource?.name || '');
  const [sourceType, setSourceType] = useState<SourceType>(initialType);
  const [apiBaseUrl, setApiBaseUrl] = useState(activeSource?.api_base_url || '');
  const [authTemplate, setAuthTemplate] = useState<WeMpRssAuthTemplate | null>(null);
  const [authTemplateLoading, setAuthTemplateLoading] = useState(!activeSource);
  const [authUsername, setAuthUsername] = useState(existingAuth?.username ?? '');
  const [authPasswordSeed, setAuthPasswordSeed] = useState(existingPassword);
  const [authPassword, setAuthPassword] = useState(existingPassword ? MASKED_PASSWORD_PLACEHOLDER : '');
  const [authPasswordDirty, setAuthPasswordDirty] = useState(false);
  const [savingStage, setSavingStage] = useState<'idle' | 'saving' | 'validating'>('idle');
  const [submitFeedback, setSubmitFeedback] = useState<{
    success: boolean;
    message: string;
    details?: string[];
  } | null>(null);

  const saving = savingStage !== 'idle';

  useEffect(() => {
    if (activeSource) {
      setAuthTemplateLoading(false);
      return;
    }

    let cancelled = false;
    setAuthTemplateLoading(true);

    sourcesApi.getWeMpRssAuthTemplate()
      .then((template) => {
        if (cancelled) return;
        setAuthTemplate(template);
        if (!template.available) return;

        setAuthUsername((current) => current || template.username);
        setAuthPasswordSeed((current) => current || template.password);
        setAuthPassword((current) => current || (template.password ? MASKED_PASSWORD_PLACEHOLDER : ''));
      })
      .catch(() => {
        if (!cancelled) {
          setAuthTemplate(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthTemplateLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSource]);

  const helperText =
    sourceType === 'native_rss'
      ? isZh
        ? '填写任意标准 RSS / Atom / JSON Feed 地址，RSSHub 也按通用 RSS 录入。'
        : 'Paste any standard RSS / Atom / JSON Feed URL. RSSHub routes are also entered as Generic RSS feeds.'
      : isZh
        ? '填写 we-mp-rss 生成的 feed 地址，并补充该服务的登录用户名与密码。'
        : 'Paste the feed generated by we-mp-rss and provide the service username/password.';

  const authHelperText = isZh
    ? '可复用已登记用户；密码会以遮盖形式显示，不修改时会保留原值。'
    : 'You can reuse registered credentials. The password stays masked and is preserved when unchanged.';

  const nextPassword =
    !authPasswordDirty
      ? authPasswordSeed
      : authPassword;

  const credentialsChanged =
    sourceType === 'we_mp_rss' && (
      authUsername.trim() !== (existingAuth?.username ?? '').trim()
      || nextPassword !== existingPassword
    );

  const handlePasswordChange = (value: string) => {
    if (!authPasswordDirty) {
      setAuthPasswordDirty(true);
      setAuthPassword(value.replace(MASKED_PASSWORD_PLACEHOLDER, ''));
      return;
    }
    setAuthPassword(value);
  };

  const buildConfig = () => {
    const config: Record<string, unknown> = { feed_url: apiBaseUrl };

    if (sourceType === 'we_mp_rss') {
      const nextAuth: WeMpRssAuthConfig = {
        ...existingAuth,
        username: authUsername.trim(),
        password: nextPassword,
      };

      if (credentialsChanged) {
        delete nextAuth.access_token;
        delete nextAuth.refresh_token;
        delete nextAuth.token_updated_at;
        delete nextAuth.verified_at;
        delete nextAuth.last_auth_error;
      }

      config.we_mprss_auth = nextAuth;
    }

    return config;
  };

  const buildAuthKey = () => {
    if (sourceType !== 'we_mp_rss') {
      return activeSource?.source_type === 'we_mp_rss' ? '' : (activeSource?.auth_key || '');
    }
    if (!activeSource) {
      return '';
    }
    return credentialsChanged ? '' : (activeSource.auth_key || '');
  };

  const validateSource = () => {
    if (!name.trim()) {
      return isZh ? '请输入新闻源名称' : 'Please enter a source name';
    }
    if (!apiBaseUrl.trim()) {
      return isZh ? '请输入 Feed URL' : 'Please enter a Feed URL';
    }
    try {
      const parsed = new URL(apiBaseUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return isZh ? '请输入 http:// 或 https:// 开头的 Feed URL' : 'Please enter a Feed URL starting with http:// or https://';
      }
    } catch {
      return isZh ? '请输入有效的 Feed URL' : 'Please enter a valid Feed URL';
    }
    if (sourceType !== 'we_mp_rss') {
      return null;
    }
    if (!authUsername.trim()) {
      return isZh ? '请输入 we-mp-rss 用户名' : 'Please enter the We-MP-RSS username';
    }
    if (!nextPassword.trim()) {
      return isZh ? '请输入 we-mp-rss 密码' : 'Please enter the We-MP-RSS password';
    }
    return null;
  };

  const validationError = validateSource();

  const sourceTypeOptions: Array<{ value: SourceType; label: string }> = [
    { value: 'native_rss', label: isZh ? '通用 RSS' : 'Generic RSS' },
    { value: 'we_mp_rss', label: isZh ? '微信公众号' : 'We-MP-RSS' },
  ];

  const authConfigured = Boolean((existingAuth?.username || authTemplate?.username) && authPasswordSeed);
  const validationHints = sourceType === 'we_mp_rss'
    ? isZh
      ? ['请检查 Feed URL 是否来自同一个 we-mp-rss 服务', '请检查用户名、密码是否仍可登录', '请确认 we-mp-rss 服务正在运行且 /feed/... 路径可访问']
      : ['Check that the Feed URL belongs to the same We-MP-RSS service', 'Check that the username/password can still log in', 'Verify the We-MP-RSS service is running and the /feed/... path is reachable']
    : isZh
      ? ['请确认该源返回 RSS / Atom / JSON Feed', '请确认目标站点没有拦截服务端请求']
      : ['Verify the source returns RSS / Atom / JSON Feed', 'Verify the site does not block server-side requests'];

  const saveButtonLabel =
    savingStage === 'saving'
      ? isZh ? '保存中...' : 'Saving...'
      : savingStage === 'validating'
        ? isZh ? '校验中...' : 'Validating...'
        : isZh ? '保存并校验' : 'Save & Validate';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitFeedback(null);
    if (validationError) {
      setSubmitFeedback({ success: false, message: validationError });
      return;
    }
    setSavingStage('saving');
    try {
      const data = {
        name: name.trim(),
        source_type: sourceType,
        api_base_url: apiBaseUrl.trim(),
        auth_key: buildAuthKey(),
        config: buildConfig(),
      };
      const savedSource = activeSource
        ? await sourcesApi.update(activeSource.id, data)
        : await sourcesApi.create(data);

      setPersistedSource(savedSource);
      setAuthPasswordSeed(nextPassword);
      setAuthPassword(nextPassword ? MASKED_PASSWORD_PLACEHOLDER : '');
      setAuthPasswordDirty(false);
      setSavingStage('validating');
      setSubmitFeedback({
        success: true,
        message: isZh ? '已保存，正在执行一次抓取校验...' : 'Saved. Running one fetch validation...',
      });

      const startedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const fetchResult = await sourcesApi.fetch(savedSource.id);
      if (fetchResult.success) {
        let refreshedSource = savedSource;
        try {
          refreshedSource = await sourcesApi.get(savedSource.id);
        } catch {
          // Use the saved response when the follow-up read is unavailable.
        }
        onSave(refreshedSource, fetchResult, startedAt);
        return;
      } else {
        setSubmitFeedback({
          success: false,
          message: fetchResult.message || (isZh ? '已保存，但抓取校验失败' : 'Saved, but fetch validation failed'),
          details: [
            `${isZh ? '新增文章' : 'Articles added'}: ${fetchResult.articles_added ?? 0}`,
            ...validationHints,
          ],
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : (isZh ? '保存或校验失败' : 'Save or validation failed');
      setSubmitFeedback({
        success: false,
        message,
        details: validationHints,
      });
    }
    setSavingStage('idle');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {activeSource ? (isZh ? '编辑新闻源' : 'Edit Source') : (isZh ? '添加新闻源' : 'Add Source')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{isZh ? '名称' : 'Name'}</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder={isZh ? '例如：AI Weekly' : 'e.g. AI Weekly'}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{isZh ? '类型' : 'Type'}</label>
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as SourceType)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
            >
              {sourceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{isZh ? 'Feed URL' : 'Feed URL'}</label>
            <input
              type="url"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              required
              placeholder="https://example.com/feed.xml"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
            />
            <p className="mt-1 text-xs text-gray-500">{helperText}</p>
          </div>
          {sourceType === 'we_mp_rss' && (
            <>
              {!activeSource && authTemplateLoading && (
                <div className="rounded-lg border border-[#c0c8cb]/20 bg-[#f8f8f6] px-3 py-2 text-xs text-[#5e5e5e]">
                  {isZh ? '正在查找已登记的 we-mp-rss 用户...' : 'Looking for registered We-MP-RSS credentials...'}
                </div>
              )}
              {!activeSource && authTemplate?.available && (
                <div className="rounded-lg border border-[#cce1d2] bg-[#eef8f1] px-3 py-2 text-xs text-[#2f6f4f]">
                  {isZh
                    ? `已自动载入「${authTemplate.source_name || '已有来源'}」的用户：${authTemplate.username}`
                    : `Loaded credentials from "${authTemplate.source_name || 'an existing source'}": ${authTemplate.username}`}
                </div>
              )}
              {!activeSource && !authTemplateLoading && authTemplate && !authTemplate.available && (
                <div className="rounded-lg border border-[#c0c8cb]/20 bg-[#f8f8f6] px-3 py-2 text-xs text-[#5e5e5e]">
                  {isZh ? '还没有可复用的 we-mp-rss 用户，请先填写一次。' : 'No reusable We-MP-RSS credentials yet. Fill them in once.'}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{isZh ? '用户名' : 'Username'}</label>
                <input
                  type="text"
                  value={authUsername}
                  onChange={(event) => setAuthUsername(event.target.value)}
                  required
                  placeholder={isZh ? '例如：admin' : 'e.g. admin'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{isZh ? '密码' : 'Password'}</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => handlePasswordChange(event.target.value)}
                  required
                  placeholder={isZh ? '输入 we-mp-rss 密码' : 'Enter the We-MP-RSS password'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d4656]"
                />
                <p className="mt-1 text-xs text-gray-500">{authHelperText}</p>
                {authConfigured && !authPasswordDirty && (
                  <p className="mt-1 text-xs font-medium text-[#0d4656]">
                    {activeSource
                      ? isZh ? '已配置认证' : 'Auth configured'
                      : isZh ? '已加载可复用认证' : 'Reusable credentials loaded'}
                  </p>
                )}
              </div>
            </>
          )}
          {submitFeedback && (
            <div
              className={`rounded-lg border px-3 py-3 text-sm ${
                submitFeedback.success
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <p className="font-medium">{submitFeedback.message}</p>
              {submitFeedback.details && submitFeedback.details.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {submitFeedback.details.map((detail) => (
                    <li key={detail}>• {detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              {isZh ? '取消' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0d4656] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2c5e6e] disabled:opacity-50"
            >
              {saveButtonLabel}
            </button>
          </div>
        </form>
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

  const statusLabel =
    status === 'loading'
      ? isZh ? '进行中' : 'Running'
      : status === 'success'
        ? isZh ? '已完成' : 'Completed'
        : isZh ? '失败' : 'Failed';

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
              <p className="font-['Manrope'] text-[11px] uppercase tracking-widest text-[#5e5e5e]">{isZh ? '抓取状态' : 'Fetch Status'}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClassName}`}>{statusLabel}</span>
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
                status === 'loading' ? 'animate-spin text-[#0d4656]' : status === 'success' ? 'text-[#2f6f4f]' : 'text-[#ba1a1a]'
              }`}
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
            >
              {status === 'loading' ? 'progress_activity' : status === 'success' ? 'task_alt' : 'error'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1a1c1b]">{message}</p>
              {status !== 'loading' && (
                <p className="mt-1 text-xs text-[#5e5e5e]">
                  {isZh ? '本次新增文章' : 'Articles added'}：{articlesAdded}
                </p>
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
              className="rounded-lg border border-[#c0c8cb]/25 px-4 py-2 text-sm font-semibold text-[#1a1c1b] transition-colors hover:bg-white"
            >
              {isZh ? '重试' : 'Retry'}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-[#0d4656] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2c5e6e]"
          >
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
