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
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
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

// === Digest API ===
export const digestsApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
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
