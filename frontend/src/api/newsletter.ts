const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const errorText = await res.text();
      if (errorText) {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed?.detail || parsed?.message || errorMessage;
      }
    } catch {
      // ignore parse failures and use fallback
    }
    throw new Error(errorMessage);
  }

  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength === '0') {
    return undefined as T;
  }

  const responseText = await res.text();
  if (!responseText.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    return responseText as T;
  }
}

// === Shared Types ===
export interface NewsSource {
  id: number;
  name: string;
  source_type: string;
  provider_source_id?: string | null;
  api_base_url: string;
  auth_key: string;
  config: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  last_fetch_at: string | null;
  article_count: number;
}

export interface WeMpRssAuthConfig {
  username?: string;
  password?: string;
  access_token?: string;
  refresh_token?: string;
  token_updated_at?: string;
  verified_at?: string;
  last_auth_error?: string;
}

export interface WeMpRssAuthTemplate {
  available: boolean;
  source_id: number | null;
  source_name: string | null;
  username: string;
  password: string;
}

export interface SourceFetchResult {
  success: boolean;
  message: string;
  articles_added: number;
}

export interface AIConfig {
  provider: string;
  base_url: string;
  model: string;
  has_api_key: boolean;
  updated_at: string | null;
}

export interface AIConfigDraft {
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
}

export interface AIConnectionTestResult {
  success: boolean;
  message: string;
  used_stored_api_key?: boolean;
}

export interface ScheduleJob {
  id: string;
  name: string;
  next_run: string | null;
  icon?: string | null;
  summary_kind?: string | null;
  title_zh?: string | null;
  title_en?: string | null;
  description_zh?: string | null;
  description_en?: string | null;
}

export interface JobRunSummary {
  id: number;
  job_name: string;
  job_type: string;
  trigger_source: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  payload: Record<string, unknown>;
  result_summary: Record<string, unknown>;
}

export interface ScheduleConfig {
  times: string[];
  jobs: ScheduleJob[];
  latest_runs: Record<string, JobRunSummary>;
}

export interface Article {
  id: number;
  source_id: number;
  external_id: string;
  provider_article_id?: string | null;
  title: string;
  link: string;
  content: string;
  summary: string;
  author: string;
  published_at: string | null;
  fetched_at: string;
  content_refresh_status: string;
  content_refresh_error?: string | null;
  content_refresh_requested_at?: string | null;
  content_refresh_checked_at?: string | null;
  content_refreshed_at?: string | null;
  source_name?: string | null;
}

export interface ArticleListResponse {
  items: Article[];
  total: number;
  limit: number;
  offset: number;
}

// === Digest Types ===
export interface DigestSection {
  domain: string;
  domain_icon: string;
  insights: InsightRef[];
}

export interface InsightRef {
  anchor_id: number;
  title: string;
  content: string;
  dialectical_analysis: string;
  source_article_link: string;
  source_name: string;
  tags: string[];
  zone: 'main' | 'explore' | 'surprise';
}

export interface DailyDigest {
  id: number;
  date: string;
  title: string;
  overview: string;
  sections: DigestSection[];
  total_articles_processed: number;
  anchor_count: number;
  created_at: string | null;
}

export interface DigestListResponse {
  items: DailyDigest[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  week_start: string | null;
  week_end: string | null;
}

// === Interest Types ===
export interface UserInterestTag {
  id: number;
  tag: string;
  weight: number;
  status: 'active' | 'frozen' | 'candidate';
  view_count: number;
  show_count: number;
  hide_count: number;
  total_time_spent: number;
  click_count: number;
  last_updated: string | null;
  created_at: string | null;
}

export interface InterestStats {
  total_tags: number;
  active_tags: number;
  frozen_tags: number;
  candidate_tags: number;
}

export interface TagCandidate {
  tag: string;
  avg_significance: number;
  count: number;
}

// === Behavior Types ===
export type SignalType = 'explicit' | 'implicit';
export type BehaviorAction = 'show' | 'hide' | 'click' | 'dwell' | 'scroll' | 'revisit';

export interface BehaviorLog {
  digest_id: number | null;
  anchor_id: number;
  tag: string;
  signal_type: SignalType;
  action: BehaviorAction;
  value: number;
}

export interface DigestFeedback {
  digest_id: number;
  anchor_id: number;
  action: BehaviorAction;
}

// === Now Workbench Types ===
interface RawNowItem {
  anchor_id: number;
  article_id?: number | null;
  title?: string | null;
  excerpt?: string | null;
  source_name?: string | null;
  source_article_link?: string | null;
  tags?: string[];
  published_at?: string | null;
  significance?: number | null;
  zone?: 'main' | 'explore' | 'discover' | string | null;
  priority_score: number;
  priority_reason: string;
  ai_summary: string;
  is_read?: boolean | null;
  is_processed: boolean;
  read_at?: string | null;
  processed_at?: string | null;
}

export interface NowItem {
  anchor_id: number;
  article_id: number;
  title: string;
  excerpt: string;
  source_name: string;
  source_article_link: string;
  tags: string[];
  published_at: string | null;
  significance: number;
  zone: 'main' | 'explore' | 'discover' | string;
  priority_score: number;
  priority_reason: string;
  ai_summary: string;
  is_read: boolean;
  is_processed: boolean;
  read_at: string | null;
  processed_at: string | null;
}

export interface NowListResponse {
  items: NowItem[];
  generated_at?: string | null;
}

interface RawNowDetail extends Omit<RawNowItem, 'excerpt' | 'significance'> {
  dialectical_analysis?: string | null;
  body_markdown: string;
  article_title?: string | null;
  article_link?: string | null;
}

export interface NowDetail {
  anchor_id: number;
  article_id: number;
  title: string;
  source_name: string;
  source_article_link: string;
  zone: string;
  priority_score: number;
  priority_reason: string;
  ai_summary: string;
  dialectical_analysis: string | null;
  body_markdown: string;
  article_title?: string | null;
  article_link?: string | null;
  published_at: string | null;
  tags: string[];
  is_read: boolean;
  is_processed: boolean;
  read_at: string | null;
  processed_at: string | null;
}

export interface NowStateUpdatePayload {
  mark_read?: boolean;
  mark_processed?: boolean;
}

export interface NowStateResponse {
  anchor_id: number;
  article_id?: number | null;
  is_read: boolean;
  is_processed: boolean;
  read_at?: string | null;
  processed_at?: string | null;
}

function normalizeNowItem(item: RawNowItem): NowItem {
  return {
    anchor_id: item.anchor_id,
    article_id: item.article_id ?? 0,
    title: item.title ?? 'Untitled',
    excerpt: item.excerpt ?? item.ai_summary,
    source_name: item.source_name ?? 'Unknown source',
    source_article_link: item.source_article_link ?? '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    published_at: item.published_at ?? null,
    significance: item.significance ?? 0,
    zone: item.zone ?? 'discover',
    priority_score: item.priority_score,
    priority_reason: item.priority_reason,
    ai_summary: item.ai_summary,
    is_read: Boolean(item.is_read),
    is_processed: item.is_processed,
    read_at: item.read_at ?? null,
    processed_at: item.processed_at ?? null,
  };
}

function normalizeNowDetail(detail: RawNowDetail): NowDetail {
  return {
    anchor_id: detail.anchor_id,
    article_id: detail.article_id ?? 0,
    title: detail.title ?? detail.article_title ?? 'Untitled',
    source_name: detail.source_name ?? 'Unknown source',
    source_article_link: detail.source_article_link ?? detail.article_link ?? '',
    zone: detail.zone ?? 'discover',
    priority_score: detail.priority_score,
    priority_reason: detail.priority_reason,
    ai_summary: detail.ai_summary,
    dialectical_analysis: detail.dialectical_analysis ?? null,
    body_markdown: detail.body_markdown,
    article_title: detail.article_title ?? null,
    article_link: detail.article_link ?? null,
    published_at: detail.published_at ?? null,
    tags: Array.isArray(detail.tags) ? detail.tags : [],
    is_read: Boolean(detail.is_read),
    is_processed: detail.is_processed,
    read_at: detail.read_at ?? null,
    processed_at: detail.processed_at ?? null,
  };
}

// === Sources API ===
export const sourcesApi = {
  list: () => fetchApi<NewsSource[]>('/sources'),

  getWeMpRssAuthTemplate: () => fetchApi<WeMpRssAuthTemplate>('/sources/we-mp-rss-auth-template'),

  get: (id: number) => fetchApi<NewsSource>(`/sources/${id}`),

  create: (data: Omit<NewsSource, 'id' | 'created_at' | 'updated_at' | 'last_fetch_at' | 'article_count'>) =>
    fetchApi<NewsSource>('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<NewsSource>) =>
    fetchApi<NewsSource>(`/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchApi<{ success: boolean; message: string }>(`/sources/${id}`, {
      method: 'DELETE',
    }),

  fetch: (id: number) =>
    fetchApi<SourceFetchResult>(`/sources/${id}/fetch`, {
      method: 'POST',
    }),
};

// === Articles API ===
export const articlesApi = {
  list: (params?: { source_id?: number; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.source_id) searchParams.set('source_id', String(params.source_id));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const query = searchParams.toString();
    return fetchApi<ArticleListResponse>(`/articles${query ? `?${query}` : ''}`);
  },

  get: (id: number) => fetchApi<Article>(`/articles/${id}`),

  summarize: (id: number) =>
    fetchApi<{ success: boolean; summary: string }>(`/articles/${id}/summarize`, {
      method: 'POST',
    }),
};

// === Config API ===
export const configApi = {
  getAI: () => fetchApi<AIConfig>('/config/ai'),

  updateAI: (data: AIConfigDraft & { keep_existing_api_key?: boolean }) =>
    fetchApi<{ success: boolean; message: string }>('/config/ai', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  testAI: (data: AIConfigDraft & { use_stored_api_key?: boolean }) =>
    fetchApi<AIConnectionTestResult>('/config/ai/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSchedule: () => fetchApi<ScheduleConfig>('/config/schedule'),

  updateSchedule: (times: string[]) =>
    fetchApi<{ success: boolean; message: string }>('/config/schedule', {
      method: 'PUT',
      body: JSON.stringify({ times }),
    }),
};

// === Digest API ===
export const digestsApi = {
  list: (params?: {
    limit?: number;
    offset?: number;
    week_start?: string;
    week_end?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.week_start) searchParams.set('week_start', params.week_start);
    if (params?.week_end) searchParams.set('week_end', params.week_end);
    const query = searchParams.toString();
    return fetchApi<DigestListResponse>(`/digests${query ? `?${query}` : ''}`);
  },

  latest: () => fetchApi<DailyDigest>('/digests/latest'),

  getByDate: (date: string) => fetchApi<DailyDigest>(`/digests/${date}`),

  generate: (targetDate?: string, force?: boolean) =>
    fetchApi<DailyDigest>('/digests/generate', {
      method: 'POST',
      body: JSON.stringify({ target_date: targetDate, force_regenerate: force }),
    }),
};

// === Interest API ===
export const interestsApi = {
  listTags: () => fetchApi<UserInterestTag[]>('/interests/tags'),

  getTag: (tag: string) => fetchApi<UserInterestTag>(`/interests/tags/${tag}`),

  createTag: (tag: string) =>
    fetchApi<UserInterestTag>('/interests/tags', {
      method: 'POST',
      body: JSON.stringify({ tag }),
    }),

  updateTag: (tagId: number, data: { weight?: number; status?: string }) =>
    fetchApi<UserInterestTag>(`/interests/tags/${tagId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTag: (tagId: number) =>
    fetchApi<void>(`/interests/tags/${tagId}`, { method: 'DELETE' }),

  getStats: () => fetchApi<InterestStats>('/interests/tags/stats'),

  getTagZone: (tag: string) =>
    fetchApi<{ tag: string; weight: number; zone: string }>(`/interests/tags/${tag}/zone`),

  getCandidates: (topN: number = 5) =>
    fetchApi<TagCandidate[]>(`/interests/candidates?top_n=${topN}`),
};

// === Behavior API ===
export const behaviorApi = {
  recordLog: (data: Omit<BehaviorLog, 'digest_id'> & { digest_id?: number }) =>
    fetchApi<{ id: number; status: string }>('/behavior/logs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recordBatch: (logs: BehaviorLog[]) =>
    fetchApi<{ count: number; status: string }>('/behavior/logs/batch', {
      method: 'POST',
      body: JSON.stringify({ logs }),
    }),

  recordFeedback: (data: DigestFeedback) =>
    fetchApi<{ id: number; status: string }>('/behavior/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// === Now API ===
export const nowApi = {
  list: (params?: { limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchApi<{ items: RawNowItem[]; generated_at?: string | null }>(`/now${query ? `?${query}` : ''}`).then((response) => ({
      items: Array.isArray(response.items) ? response.items.map(normalizeNowItem) : [],
      generated_at: response.generated_at ?? null,
    }));
  },

  getDetail: (anchorId: number | string) =>
    fetchApi<RawNowDetail>(`/now/${anchorId}`).then(normalizeNowDetail),

  updateState: (anchorId: number | string, data: NowStateUpdatePayload) =>
    fetchApi<NowStateResponse>(`/now/${anchorId}/state`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
