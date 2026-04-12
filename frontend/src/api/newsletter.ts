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
  api_base_url: string;
  auth_key: string;
  config: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  last_fetch_at: string | null;
  article_count: number;
}

export interface ParsedAccount {
  fakeid: string;
  nickname: string;
  alias: string;
  is_verify: number;
  verify_info: string;
  signature: string;
  avatar: string;
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

// === Sources API ===
export const sourcesApi = {
  list: () => fetchApi<NewsSource[]>('/sources'),

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
    fetchApi<{ success: boolean; message: string; articles_added: number }>(`/sources/${id}/fetch`, {
      method: 'POST',
    }),

  parseUrl: (url: string) =>
    fetchApi<ParsedAccount>('/sources/parse-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
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

  getSchedule: () => fetchApi<{ jobs: Array<{ id: string; name: string; next_run: string | null }> }>('/config/schedule'),

  updateSchedule: (hours: number[]) =>
    fetchApi<{ success: boolean; message: string }>('/config/schedule', {
      method: 'PUT',
      body: JSON.stringify(hours),
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
