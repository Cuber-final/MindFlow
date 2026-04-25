import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  articlesApi,
  sourcesApi,
  type Article,
  type ArticleSearchParams,
  type ArticleStateResponse,
  type NewsSource,
} from '../api/newsletter';
import { useI18n } from '../i18n';

const PAGE_SIZE = 20;

interface FilterDraft {
  q: string;
  source_id: string;
  published_from: string;
  published_to: string;
  tag: string;
  status: string;
  content_status: string;
}

function draftFromParams(searchParams: URLSearchParams): FilterDraft {
  return {
    q: searchParams.get('q') ?? '',
    source_id: searchParams.get('source_id') ?? '',
    published_from: searchParams.get('published_from') ?? '',
    published_to: searchParams.get('published_to') ?? '',
    tag: searchParams.get('tag') ?? '',
    status: searchParams.get('status') ?? '',
    content_status: searchParams.get('content_status') ?? '',
  };
}

function paramsFromSearch(searchParams: URLSearchParams): ArticleSearchParams {
  const sourceId = Number(searchParams.get('source_id'));
  const limit = Number(searchParams.get('limit') || PAGE_SIZE);
  const offset = Number(searchParams.get('offset') || 0);

  return {
    q: searchParams.get('q') || undefined,
    source_id: Number.isFinite(sourceId) && sourceId > 0 ? sourceId : undefined,
    published_from: searchParams.get('published_from') || undefined,
    published_to: searchParams.get('published_to') || undefined,
    tag: searchParams.get('tag') || undefined,
    status: searchParams.get('status') || undefined,
    content_status: searchParams.get('content_status') || undefined,
    limit: Number.isFinite(limit) && limit > 0 ? limit : PAGE_SIZE,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  };
}

function buildSearch(draft: FilterDraft, offset = 0) {
  const next = new URLSearchParams();
  const entries: Array<[keyof FilterDraft, string]> = [
    ['q', draft.q],
    ['source_id', draft.source_id],
    ['published_from', draft.published_from],
    ['published_to', draft.published_to],
    ['tag', draft.tag],
    ['status', draft.status],
    ['content_status', draft.content_status],
  ];

  entries.forEach(([key, value]) => {
    const trimmed = value.trim();
    if (trimmed) next.set(key, trimmed);
  });

  next.set('limit', String(PAGE_SIZE));
  if (offset > 0) next.set('offset', String(offset));
  return next;
}

function formatTimestamp(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('MMM D, YYYY · HH:mm') : value;
}

function mergeArticleState(article: Article, state: ArticleStateResponse): Article {
  return {
    ...article,
    is_read: state.is_read,
    is_processed: state.is_processed,
    read_at: state.read_at ?? null,
    processed_at: state.processed_at ?? null,
    last_opened_at: state.last_opened_at ?? article.last_opened_at ?? null,
  };
}

export default function Articles() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const navigate = useNavigate();
  const { articleId } = useParams();
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const activeArticleId = articleId ? Number(articleId) : null;

  const [draft, setDraft] = useState<FilterDraft>(() => draftFromParams(searchParams));
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pendingAction, setPendingAction] = useState<'read' | 'processed' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const text = {
    title: isZh ? '文章检索' : 'Articles',
    total: isZh ? '结果' : 'results',
    filters: isZh ? '筛选' : 'Filters',
    query: isZh ? '关键词' : 'Keyword',
    queryPlaceholder: isZh ? '标题、正文、摘要、作者' : 'Title, body, summary, author',
    source: isZh ? '来源' : 'Source',
    allSources: isZh ? '全部来源' : 'All sources',
    from: isZh ? '开始时间' : 'From',
    to: isZh ? '结束时间' : 'To',
    tag: isZh ? '标签' : 'Tag',
    tagPlaceholder: isZh ? '输入标签' : 'Enter tag',
    status: isZh ? '阅读状态' : 'Read state',
    contentStatus: isZh ? '正文状态' : 'Content state',
    all: isZh ? '全部' : 'All',
    unread: isZh ? '未读' : 'Unread',
    read: isZh ? '已读' : 'Read',
    unprocessed: isZh ? '未处理' : 'Unprocessed',
    processed: isZh ? '已处理' : 'Processed',
    search: isZh ? '搜索' : 'Search',
    clear: isZh ? '清空' : 'Clear',
    noDate: isZh ? '无日期' : 'No date',
    empty: isZh ? '没有符合条件的文章。' : 'No articles match these filters.',
    detailEmpty: isZh ? '选择一篇文章阅读。' : 'Select an article to read.',
    summary: isZh ? '摘要' : 'Summary',
    content: isZh ? '正文' : 'Content',
    noContent: isZh ? '暂无正文内容。' : 'No content available.',
    readSource: isZh ? '阅读原文' : 'Read source',
    sourceUnavailable: isZh ? '原文不可用' : 'Source unavailable',
    markRead: isZh ? '标记已读' : 'Mark read',
    markedRead: isZh ? '已读' : 'Read',
    markProcessed: isZh ? '标记已处理' : 'Mark processed',
    updating: isZh ? '更新中…' : 'Updating…',
    previous: isZh ? '上一页' : 'Previous',
    next: isZh ? '下一页' : 'Next',
    loadError: isZh ? '加载文章失败。' : 'Unable to load articles.',
    updateError: isZh ? '更新阅读状态失败。' : 'Unable to update article state.',
  };

  const statusOptions = [
    { value: '', label: text.all },
    { value: 'unread', label: text.unread },
    { value: 'read', label: text.read },
    { value: 'unprocessed', label: text.unprocessed },
    { value: 'processed', label: text.processed },
  ];

  const contentStatusOptions = [
    { value: '', label: text.all },
    { value: 'ready', label: 'Ready' },
    { value: 'waiting_for_refresh', label: isZh ? '等待刷新' : 'Waiting' },
    { value: 'refresh_requested', label: isZh ? '已请求刷新' : 'Requested' },
    { value: 'refresh_running', label: isZh ? '刷新中' : 'Running' },
    { value: 'detail_fetched', label: isZh ? '正文已就绪' : 'Ready detail' },
    { value: 'refresh_failed', label: isZh ? '刷新失败' : 'Failed' },
  ];

  const activeParams = useMemo(() => paramsFromSearch(searchParams), [searchKey]);
  const querySuffix = searchKey ? `?${searchKey}` : '';
  const availableTags = useMemo(
    () => Array.from(new Set(articles.flatMap((article) => article.tags))).slice(0, 8),
    [articles],
  );

  useEffect(() => {
    setDraft(draftFromParams(searchParams));
  }, [searchKey]);

  useEffect(() => {
    let cancelled = false;
    sourcesApi
      .list()
      .then((data) => {
        if (!cancelled) setSources(data);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setError(null);

    articlesApi
      .list(activeParams)
      .then((response) => {
        if (cancelled) return;
        setArticles(response.items);
        setTotal(response.total);
        setOffset(response.offset);
      })
      .catch(() => {
        if (cancelled) return;
        setError(text.loadError);
        setArticles([]);
        setTotal(0);
        setOffset(0);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeParams, text.loadError]);

  useEffect(() => {
    if (!activeArticleId || !Number.isFinite(activeArticleId)) {
      setSelectedArticle(null);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    setError(null);

    articlesApi
      .get(activeArticleId)
      .then((article) => {
        if (!cancelled) setSelectedArticle(article);
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedArticle(null);
          setError(text.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeArticleId, text.loadError]);

  function updateDraft(key: keyof FilterDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = buildSearch(draft);
    const query = next.toString();
    navigate(`/articles${query ? `?${query}` : ''}`);
  }

  function handleClear() {
    navigate('/articles');
  }

  function handlePage(nextOffset: number) {
    const next = buildSearch(draftFromParams(searchParams), nextOffset);
    navigate(`/articles?${next.toString()}`);
  }

  function openArticle(id: number) {
    navigate(`/articles/${id}${querySuffix}`);
  }

  async function handleStateChange(action: 'read' | 'processed') {
    if (!selectedArticle) return;
    setPendingAction(action);
    setError(null);

    try {
      const state = await articlesApi.updateState(selectedArticle.id, {
        mark_read: action === 'read',
        mark_processed: action === 'processed',
      });
      setSelectedArticle((current) => (current ? mergeArticleState(current, state) : current));
      setArticles((current) =>
        current.map((article) => (article.id === state.article_id ? mergeArticleState(article, state) : article)),
      );
    } catch {
      setError(text.updateError);
    } finally {
      setPendingAction(null);
    }
  }

  const hasPrevious = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5e5e5e]">{text.title}</p>
          <h1 className="mt-3 font-headline text-4xl text-[#1a1c1b] md:text-5xl">{total} {text.total}</h1>
        </div>
        {error && (
          <div className="rounded-lg border border-[#ba1a1a]/15 bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">
            {error}
          </div>
        )}
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-[28px] border border-[#c0c8cb]/15 bg-white p-4 shadow-[0_16px_40px_rgba(26,28,27,0.03)] md:grid-cols-2 xl:grid-cols-7"
      >
        <label className="space-y-2 xl:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#5e5e5e]">{text.query}</span>
          <input
            value={draft.q}
            onChange={(event) => updateDraft('q', event.target.value)}
            placeholder={text.queryPlaceholder}
            className="input w-full"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#5e5e5e]">{text.source}</span>
          <select value={draft.source_id} onChange={(event) => updateDraft('source_id', event.target.value)} className="input w-full">
            <option value="">{text.allSources}</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#5e5e5e]">{text.from}</span>
          <input
            type="date"
            value={draft.published_from}
            onChange={(event) => updateDraft('published_from', event.target.value)}
            className="input w-full"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#5e5e5e]">{text.to}</span>
          <input
            type="date"
            value={draft.published_to}
            onChange={(event) => updateDraft('published_to', event.target.value)}
            className="input w-full"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#5e5e5e]">{text.tag}</span>
          <input
            value={draft.tag}
            onChange={(event) => updateDraft('tag', event.target.value)}
            placeholder={text.tagPlaceholder}
            className="input w-full"
            list="article-tag-options"
          />
          <datalist id="article-tag-options">
            {availableTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </label>

        <label className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#5e5e5e]">{text.status}</span>
          <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)} className="input w-full">
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 xl:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#5e5e5e]">{text.contentStatus}</span>
          <select
            value={draft.content_status}
            onChange={(event) => updateDraft('content_status', event.target.value)}
            className="input w-full"
          >
            {contentStatusOptions.map((option) => (
              <option key={option.value || 'all-content'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2 xl:col-span-2">
          <button type="submit" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0d4656] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b3f4d]">
            <span className="material-symbols-outlined text-base">search</span>
            {text.search}
          </button>
          <button type="button" onClick={handleClear} className="inline-flex items-center justify-center rounded-lg border border-[#c0c8cb]/20 px-4 py-3 text-sm font-semibold text-[#40484b] transition-colors hover:border-[#0d4656]/20 hover:text-[#0d4656]">
            <span className="material-symbols-outlined text-base">close</span>
            {text.clear}
          </button>
        </div>
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-[28px] border border-[#c0c8cb]/15 bg-white shadow-[0_16px_40px_rgba(26,28,27,0.03)] xl:sticky xl:top-28 xl:self-start">
          <div className="max-h-[74vh] space-y-3 overflow-y-auto px-4 py-4">
            {loadingList ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl bg-[#f4f4f2] px-4 py-5">
                  <div className="h-3 w-28 rounded bg-[#e6e4de]" />
                  <div className="mt-4 h-5 w-5/6 rounded bg-[#e6e4de]" />
                  <div className="mt-3 h-14 rounded bg-[#e6e4de]" />
                </div>
              ))
            ) : articles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#c0c8cb]/20 px-4 py-8 text-center text-sm text-[#5e5e5e]">
                {text.empty}
              </div>
            ) : (
              articles.map((article) => {
                const isActive = activeArticleId === article.id;
                const excerpt = article.summary || article.content || article.title;
                return (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => openArticle(article.id)}
                    className={`w-full rounded-[24px] border px-4 py-5 text-left transition-all ${
                      isActive
                        ? 'border-[#0d4656]/18 bg-[#0d4656] text-white shadow-[0_20px_40px_rgba(13,70,86,0.15)]'
                        : 'border-[#c0c8cb]/12 bg-[#faf9f5] text-[#1a1c1b] hover:border-[#0d4656]/12 hover:bg-[#f1efea]'
                    }`}
                  >
                    <div className={`flex flex-wrap items-center gap-2 text-[11px] ${isActive ? 'text-white/72' : 'text-[#5e5e5e]'}`}>
                      <span>{article.source_name || text.source}</span>
                      <span>·</span>
                      <span>{formatTimestamp(article.published_at || article.fetched_at, text.noDate)}</span>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold leading-7">{article.title}</h2>
                    <p className={`mt-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 ${isActive ? 'text-white/78' : 'text-[#40484b]'}`}>
                      {excerpt}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {article.is_read && (
                        <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${isActive ? 'bg-white/12 text-white' : 'bg-[#dce8eb] text-[#0d4656]'}`}>
                          {text.markedRead}
                        </span>
                      )}
                      {article.is_processed && (
                        <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${isActive ? 'bg-white/12 text-white' : 'bg-[#efe7dc] text-[#784f28]'}`}>
                          {text.processed}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${isActive ? 'bg-white/12 text-white' : 'bg-[#f4f4f2] text-[#40484b]'}`}>
                        {article.content_refresh_status}
                      </span>
                    </div>

                    {article.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {article.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className={`rounded-full px-2 py-1 text-[11px] ${isActive ? 'bg-white/10 text-white/80' : 'bg-[#0d4656]/6 text-[#0d4656]'}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#c0c8cb]/12 px-4 py-4">
            <button
              type="button"
              disabled={!hasPrevious}
              onClick={() => handlePage(Math.max(0, offset - PAGE_SIZE))}
              className="inline-flex items-center gap-2 rounded-lg border border-[#c0c8cb]/20 px-3 py-2 text-sm text-[#40484b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
              {text.previous}
            </button>
            <span className="text-xs text-[#5e5e5e]">{Math.min(offset + articles.length, total)} / {total}</span>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => handlePage(offset + PAGE_SIZE)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#c0c8cb]/20 px-3 py-2 text-sm text-[#40484b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {text.next}
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </section>

        <article className="rounded-[28px] border border-[#c0c8cb]/15 bg-white shadow-[0_20px_60px_rgba(26,28,27,0.03)]">
          {loadingDetail ? (
            <div className="animate-pulse space-y-5 px-8 py-8">
              <div className="h-3 w-32 rounded bg-[#e8e8e6]" />
              <div className="h-10 w-3/4 rounded bg-[#e8e8e6]" />
              <div className="h-24 rounded-2xl bg-[#f4f4f2]" />
              <div className="h-80 rounded-2xl bg-[#f4f4f2]" />
            </div>
          ) : !selectedArticle ? (
            <div className="px-8 py-16 text-center text-sm text-[#5e5e5e]">{text.detailEmpty}</div>
          ) : (
            <>
              <div className="border-b border-[#c0c8cb]/12 px-8 py-8">
                <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#5e5e5e]">
                  <span>{selectedArticle.source_name || text.source}</span>
                  <span>·</span>
                  <span>{formatTimestamp(selectedArticle.published_at || selectedArticle.fetched_at, text.noDate)}</span>
                </div>
                <h1 className="mt-5 font-headline text-4xl leading-tight text-[#1a1c1b] md:text-5xl">{selectedArticle.title}</h1>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleStateChange('read')}
                    disabled={selectedArticle.is_read || pendingAction !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#0d4656]/18 px-5 py-3 text-sm font-semibold text-[#0d4656] transition-colors hover:bg-[#0d4656]/6 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">mark_email_read</span>
                    {pendingAction === 'read' ? text.updating : selectedArticle.is_read ? text.markedRead : text.markRead}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleStateChange('processed')}
                    disabled={selectedArticle.is_processed || pendingAction !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0d4656] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b3f4d] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">done_all</span>
                    {pendingAction === 'processed' ? text.updating : selectedArticle.is_processed ? text.processed : text.markProcessed}
                  </button>
                  {selectedArticle.link ? (
                    <a
                      href={selectedArticle.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-[#c0c8cb]/20 px-5 py-3 text-sm font-semibold text-[#40484b] transition-colors hover:border-[#0d4656]/20 hover:text-[#0d4656]"
                    >
                      <span className="material-symbols-outlined text-base">arrow_outward</span>
                      {text.readSource}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-lg border border-[#c0c8cb]/12 px-5 py-3 text-sm text-[#8a8f92]">
                      <span className="material-symbols-outlined text-base">link_off</span>
                      {text.sourceUnavailable}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-7 px-8 py-8">
                {selectedArticle.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-[#0d4656]/6 px-3 py-1 text-[11px] font-medium text-[#0d4656]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {selectedArticle.summary && (
                  <section className="rounded-[24px] bg-[#f7f5ef] px-6 py-6">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{text.summary}</p>
                    <p className="mt-4 text-lg leading-8 text-[#1a1c1b]">{selectedArticle.summary}</p>
                  </section>
                )}

                <section className="rounded-[24px] border border-[#c0c8cb]/12 bg-white px-6 py-6">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#5e5e5e]">{text.content}</p>
                  <div className="mt-5 space-y-6 text-[#1a1c1b]">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="text-base leading-8 text-[#40484b]">{children}</p>,
                        h2: ({ children }) => <h2 className="mt-8 text-2xl font-semibold text-[#1a1c1b] first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="mt-6 text-xl font-semibold text-[#1a1c1b]">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc space-y-2 pl-5 text-base leading-8 text-[#40484b]">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5 text-base leading-8 text-[#40484b]">{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        a: ({ children, href }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0d4656] underline underline-offset-4">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {selectedArticle.content || text.noContent}
                    </ReactMarkdown>
                  </div>
                </section>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
