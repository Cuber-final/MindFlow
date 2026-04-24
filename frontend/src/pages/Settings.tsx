import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  configApi,
  type AIConfig,
  type AIConfigDraft,
  type AIConnectionTestResult,
  type JobRunSummary,
  type ScheduleJob,
  type ScheduleConfig,
} from '../api/newsletter';
import { useI18n } from '../i18n';

type SettingsViewState = 'loading' | 'load_error' | 'unconfigured' | 'configured';
type ScheduleViewState = 'loading' | 'ready' | 'error';

const DEFAULT_DRAFT: AIConfigDraft = {
  provider: 'siliconflow',
  api_key: '',
  base_url: 'https://api.siliconflow.cn/v1',
  model: 'Qwen/Qwen2.5-7B-Instruct',
};

const DEFAULT_SCHEDULE_TIMES = ['08:00', '12:00', '18:00', '23:30'];

function normalizeDraft(draft: AIConfigDraft): AIConfigDraft {
  return {
    provider: draft.provider.trim(),
    api_key: draft.api_key.trim(),
    base_url: draft.base_url.trim(),
    model: draft.model.trim(),
  };
}

function normalizeScheduleTimes(times: string[]): string[] {
  return Array.from(new Set(times.map((time) => time.trim()).filter(Boolean))).sort();
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function formatScheduleTimestamp(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value;
  return parsed.format('MM-DD HH:mm');
}

function getNextDefaultTime(times: string[]) {
  const candidates = ['08:00', '12:00', '18:00', '23:30', '09:00', '15:00'];
  const normalized = new Set(times);
  return candidates.find((candidate) => !normalized.has(candidate)) || '09:00';
}

function getStatusTone(status: string) {
  switch (status) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'partial':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'failed':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'running':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'skipped':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    default:
      return 'border-[#c0c8cb]/20 bg-[#f8f8f6] text-[#5e5e5e]';
  }
}

function summarizeRun(summaryKind: string | null | undefined, run: JobRunSummary | undefined, isZh: boolean) {
  if (!run) {
    return isZh ? '尚无运行记录' : 'No run recorded yet';
  }

  const summary = run.result_summary || {};
  const skipReason = String(summary.skip_reason || '').trim();

  switch (summaryKind) {
    case 'fetch': {
      const articlesAdded = asNumber(summary.articles_added);
      const succeeded = asNumber(summary.sources_succeeded);
      const total = asNumber(summary.sources_total);
      if (articlesAdded !== null && succeeded !== null && total !== null) {
        return isZh
          ? `新增 ${articlesAdded} 篇，来源成功 ${succeeded}/${total}`
          : `${articlesAdded} articles added, ${succeeded}/${total} sources succeeded`;
      }
      break;
    }
    case 'content_refresh': {
      const processed = asNumber(summary.processed);
      const detailFetched = asNumber(summary.detail_fetched);
      const refreshFailed = asNumber(summary.refresh_failed);
      if (processed !== null && detailFetched !== null && refreshFailed !== null) {
        return isZh
          ? `处理 ${processed} 篇，补全 ${detailFetched} 篇，失败 ${refreshFailed} 篇`
          : `${processed} processed, ${detailFetched} backfilled, ${refreshFailed} failed`;
      }
      break;
    }
    case 'anchor_extract': {
      const extracted = asNumber(summary.anchors_extracted);
      const candidates = asNumber(summary.candidates);
      const failures = asNumber(summary.failures);
      if (extracted !== null && candidates !== null && failures !== null) {
        return isZh
          ? `提取 ${extracted} 条锚点，候选 ${candidates} 篇，失败 ${failures} 篇`
          : `${extracted} anchors, ${candidates} candidates, ${failures} failures`;
      }
      break;
    }
    case 'digest': {
      const digestId = asNumber(summary.digest_id);
      const anchorCount = asNumber(summary.anchor_count);
      const totalArticles = asNumber(summary.total_articles);
      if (run.status === 'skipped' && skipReason) {
        if (skipReason === 'digest_exists') {
          return isZh ? '目标日期简报已存在，已跳过' : 'Skipped because the digest already exists';
        }
        if (skipReason === 'no_anchors') {
          return isZh ? '目标日期暂无锚点，已跳过' : 'Skipped because there were no anchors';
        }
      }
      if (digestId !== null && anchorCount !== null && totalArticles !== null) {
        return isZh
          ? `简报 #${digestId}，锚点 ${anchorCount} 条，文章 ${totalArticles} 篇`
          : `Digest #${digestId}, ${anchorCount} anchors, ${totalArticles} articles`;
      }
      break;
    }
    default:
      break;
  }

  if (run.error_message) {
    return run.error_message;
  }

  return isZh ? '已记录运行状态' : 'Run status recorded';
}

function getJobTitle(job: ScheduleJob, isZh: boolean) {
  return (
    (isZh ? job.title_zh : job.title_en)
    || job.title_zh
    || job.title_en
    || job.name
  );
}

function getJobDescription(job: ScheduleJob, isZh: boolean) {
  return (
    (isZh ? job.description_zh : job.description_en)
    || job.description_zh
    || job.description_en
    || ''
  );
}

export default function Settings() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const text = {
    configuredPlaceholder: isZh ? '已配置（不修改请留空）' : 'Configured (leave empty to keep)',
    inputApiKey: isZh ? '请输入 API Key' : 'Enter API Key',
    loadFailedTitle: isZh ? '加载失败，可重试或重新配置' : 'Loading failed. Retry or reconfigure.',
    loadFailedFallback: isZh ? '无法读取当前配置' : 'Unable to read current configuration',
    retry: isZh ? '重试' : 'Retry',
    manualReconfigure: isZh ? '重新手动配置' : 'Manual reconfigure',
    settingsTitle: isZh ? '设置' : 'Settings',
    settingsSubtitle: isZh
      ? '配置 AI 提供商与调度策略。AI 保存前会自动验证当前草稿配置。'
      : 'Configure your AI provider and scheduling strategy. AI settings are validated before save.',
    unconfiguredBanner: isZh ? '尚未完成 AI 配置。请先填写配置，建议先测试连接，再保存。' : 'AI is not configured yet. Fill in your configuration, test connection, then save.',
    configuredBanner: isZh ? '当前已存在可用配置。若不想替换密钥，请保持 API Key 为空后保存。' : 'A working configuration already exists. Keep API Key empty to preserve current key.',
    provider: isZh ? 'AI 提供商' : 'AI Provider',
    customOpenAI: isZh ? '自定义 OpenAI 兼容接口' : 'Custom OpenAI-compatible endpoint',
    apiKey: isZh ? 'API Key' : 'API Key',
    baseUrl: isZh ? 'Base URL' : 'Base URL',
    model: isZh ? '模型' : 'Model',
    testConnection: isZh ? '测试连接' : 'Test Connection',
    testing: isZh ? '测试中...' : 'Testing...',
    saveArchitecture: isZh ? '保存配置' : 'Save Configuration',
    saving: isZh ? '保存中...' : 'Saving...',
    usedStoredKey: isZh ? '（已使用已保存的 API Key）' : ' (used stored API Key)',
    aiSectionTitle: isZh ? 'AI 配置' : 'AI Configuration',
    aiSectionSubtitle: isZh
      ? '配置摘要与简报生成所使用的模型接口。'
      : 'Configure the model endpoint used for summaries and digest generation.',
    scheduleSectionTitle: isZh ? '抓取调度' : 'Fetch Schedule',
    scheduleSectionSubtitle: isZh
      ? '自定义每天的抓取时间点。配置会持久化保存，并在服务重启后自动恢复。'
      : 'Set the daily fetch times. This configuration is persisted and restored on service restart.',
    scheduleLoadError: isZh ? '调度配置加载失败' : 'Failed to load schedule configuration',
    scheduleSave: isZh ? '保存调度' : 'Save Schedule',
    scheduleSaving: isZh ? '保存中...' : 'Saving...',
    addTime: isZh ? '添加时间点' : 'Add Time',
    removeTime: isZh ? '移除时间点' : 'Remove time',
    scheduleHint: isZh ? '支持精确到分钟的 `HH:mm` 格式。' : 'Supports minute-level scheduling in `HH:mm` format.',
    scheduleEmpty: isZh ? '至少保留一个抓取时间点。' : 'Keep at least one fetch time.',
    scheduleDuplicate: isZh ? '抓取时间点不能重复。' : 'Fetch times must be unique.',
    scheduleInvalid: isZh ? '请输入合法的 HH:mm 时间。' : 'Enter a valid HH:mm time.',
    latestRunsTitle: isZh ? '最近运行状态' : 'Latest Run Status',
    latestRunsSubtitle: isZh
      ? '这里展示后台批处理链路的最近一次执行摘要。'
      : 'This shows the most recent execution summary for the background batch pipeline.',
    noRun: isZh ? '尚无运行记录' : 'No run recorded yet',
    nextRun: isZh ? '下次执行' : 'Next Run',
    lastRun: isZh ? '最近执行' : 'Last Run',
    neverRun: isZh ? '未运行' : 'Not yet run',
    noNextRun: isZh ? '未计划' : 'Not scheduled',
    statusSuccess: isZh ? '成功' : 'Success',
    statusPartial: isZh ? '部分成功' : 'Partial',
    statusFailed: isZh ? '失败' : 'Failed',
    statusSkipped: isZh ? '跳过' : 'Skipped',
    statusRunning: isZh ? '运行中' : 'Running',
    statusUnknown: isZh ? '未知' : 'Unknown',
  };

  const [viewState, setViewState] = useState<SettingsViewState>('loading');
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [formData, setFormData] = useState<AIConfigDraft>(DEFAULT_DRAFT);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [feedback, setFeedback] = useState<AIConnectionTestResult | null>(null);
  const [loadError, setLoadError] = useState('');

  const [scheduleState, setScheduleState] = useState<ScheduleViewState>('loading');
  const [scheduleData, setScheduleData] = useState<ScheduleConfig | null>(null);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(DEFAULT_SCHEDULE_TIMES);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState<AIConnectionTestResult | null>(null);
  const [scheduleError, setScheduleError] = useState('');

  const hasStoredApiKey = Boolean(aiConfig?.has_api_key);
  const isConfigured = viewState === 'configured';

  const apiKeyPlaceholder = useMemo(
    () => (hasStoredApiKey ? text.configuredPlaceholder : text.inputApiKey),
    [hasStoredApiKey, text.configuredPlaceholder, text.inputApiKey]
  );

  useEffect(() => {
    void loadConfig();
    void loadSchedule();
  }, []);

  async function loadConfig() {
    setViewState('loading');
    setLoadError('');
    setFeedback(null);

    try {
      const data = await configApi.getAI();
      setAiConfig(data);
      setFormData({
        provider: data.provider,
        api_key: '',
        base_url: data.base_url,
        model: data.model,
      });
      setViewState(data.has_api_key ? 'configured' : 'unconfigured');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : (isZh ? '配置加载失败' : 'Failed to load configuration'));
      setViewState('load_error');
    }
  }

  async function loadSchedule(options?: { showLoading?: boolean; clearFeedback?: boolean }) {
    const showLoading = options?.showLoading ?? true;
    const clearFeedback = options?.clearFeedback ?? true;

    if (showLoading) {
      setScheduleState('loading');
    }
    setScheduleError('');
    if (clearFeedback) {
      setScheduleFeedback(null);
    }

    try {
      const data = await configApi.getSchedule();
      setScheduleData(data);
      setScheduleTimes(data.times.length ? data.times : DEFAULT_SCHEDULE_TIMES);
      setScheduleState('ready');
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : text.scheduleLoadError);
      setScheduleState('error');
    }
  }

  function validateDraft(draft: AIConfigDraft): string | null {
    if (!draft.provider) return isZh ? '请填写 Provider' : 'Provider is required';
    if (!draft.base_url) return isZh ? '请填写 Base URL' : 'Base URL is required';
    if (!draft.model) return isZh ? '请填写 Model' : 'Model is required';
    if (!draft.api_key && !hasStoredApiKey) return isZh ? '首次配置必须填写 API Key' : 'API Key is required for first-time setup';
    return null;
  }

  function validateSchedule(nextTimes: string[]): string | null {
    if (!nextTimes.length) return text.scheduleEmpty;
    if (nextTimes.some((time) => !/^\d{2}:\d{2}$/.test(time.trim()))) return text.scheduleInvalid;
    if (normalizeScheduleTimes(nextTimes).length !== nextTimes.length) return text.scheduleDuplicate;
    return null;
  }

  async function runConnectionTest(draft: AIConfigDraft): Promise<AIConnectionTestResult> {
    return configApi.testAI({
      ...draft,
      use_stored_api_key: hasStoredApiKey,
    });
  }

  async function handleTest() {
    setFeedback(null);
    const normalized = normalizeDraft(formData);
    const validationError = validateDraft(normalized);
    if (validationError) {
      setFeedback({ success: false, message: validationError });
      return;
    }

    setTesting(true);
    try {
      const result = await runConnectionTest(normalized);
      setFeedback(result);
    } catch (error) {
      setFeedback({
        success: false,
        message: error instanceof Error ? error.message : (isZh ? '测试连接失败' : 'Connection test failed'),
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setFeedback(null);
    const normalized = normalizeDraft(formData);
    const validationError = validateDraft(normalized);
    if (validationError) {
      setFeedback({ success: false, message: validationError });
      return;
    }

    setSaving(true);
    try {
      const testResult = await runConnectionTest(normalized);
      if (!testResult.success) {
        setFeedback(testResult);
        return;
      }

      const saveResult = await configApi.updateAI({
        ...normalized,
        keep_existing_api_key: hasStoredApiKey,
      });

      setFeedback({ success: true, message: saveResult.message || (isZh ? 'AI 配置已验证并保存' : 'AI configuration verified and saved') });
      await loadConfig();
    } catch (error) {
      setFeedback({
        success: false,
        message: error instanceof Error ? error.message : (isZh ? '保存失败' : 'Save failed'),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleScheduleSave() {
    if (scheduleSaving) return;
    const scrollTopBeforeSave = window.scrollY;

    setScheduleFeedback(null);
    const validationError = validateSchedule(scheduleTimes);
    if (validationError) {
      setScheduleFeedback({ success: false, message: validationError });
      return;
    }

    const normalized = normalizeScheduleTimes(scheduleTimes);
    setScheduleSaving(true);
    try {
      const result = await configApi.updateSchedule(normalized);
      await loadSchedule({ showLoading: false, clearFeedback: false });
      setScheduleFeedback({
        success: true,
        message: result.message || (isZh ? '调度配置已保存' : 'Schedule configuration saved'),
      });
      setScheduleTimes(normalized);
    } catch (error) {
      setScheduleFeedback({
        success: false,
        message: error instanceof Error ? error.message : (isZh ? '调度保存失败' : 'Failed to save schedule'),
      });
    } finally {
      setScheduleSaving(false);
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollTopBeforeSave });
      });
    }
  }

  function handleManualReconfigure() {
    setAiConfig(null);
    setFormData(DEFAULT_DRAFT);
    setFeedback(null);
    setLoadError('');
    setViewState('unconfigured');
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'success':
        return text.statusSuccess;
      case 'partial':
        return text.statusPartial;
      case 'failed':
        return text.statusFailed;
      case 'skipped':
        return text.statusSkipped;
      case 'running':
        return text.statusRunning;
      default:
        return text.statusUnknown;
    }
  }

  if (viewState === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#0d4656] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (viewState === 'load_error') {
    return (
      <div className="max-w-3xl mx-auto px-8 py-14">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8">
          <h2 className="text-xl font-bold text-red-700 mb-3">{text.loadFailedTitle}</h2>
          <p className="text-sm text-red-700/90 mb-6">{loadError || text.loadFailedFallback}</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadConfig()}
              className="px-5 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
            >
              {text.retry}
            </button>
            <button
              onClick={handleManualReconfigure}
              className="px-5 py-2 rounded border border-red-300 text-red-700 text-sm hover:bg-red-100"
            >
              {text.manualReconfigure}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <header className="mb-10">
        <h1 className="font-['Newsreader'] text-4xl text-[#1a1c1b] mb-3">{text.settingsTitle}</h1>
        <p className="text-[#5e5e5e]">{text.settingsSubtitle}</p>
      </header>

      {viewState === 'unconfigured' && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
          {text.unconfiguredBanner}
        </div>
      )}

      {isConfigured && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">
          {text.configuredBanner}
        </div>
      )}

      <section className="mb-10">
        <div className="mb-4">
          <h2 className="font-['Newsreader'] text-2xl text-[#1a1c1b]">{text.aiSectionTitle}</h2>
          <p className="text-sm text-[#5e5e5e] mt-1">{text.aiSectionSubtitle}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#c0c8cb]/20 p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">{text.provider}</label>
              <select
                value={formData.provider}
                onChange={(event) => setFormData((prev) => ({ ...prev, provider: event.target.value }))}
                className="w-full bg-[#ffffff] border border-[#c0c8cb]/20 rounded-lg px-4 py-3 text-[#1a1c1b] focus:outline-none focus:ring-1 focus:ring-[#0d4656]/30"
              >
                <option value="siliconflow">{isZh ? '硅基流动 (SiliconFlow)' : 'SiliconFlow'}</option>
                <option value="minimax">MiniMax</option>
                <option value="custom">{text.customOpenAI}</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">{text.apiKey}</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.api_key}
                  onChange={(event) => setFormData((prev) => ({ ...prev, api_key: event.target.value }))}
                  placeholder={apiKeyPlaceholder}
                  className="w-full bg-[#ffffff] border border-[#c0c8cb]/20 rounded-lg px-4 py-3 text-[#1a1c1b] focus:outline-none focus:ring-1 focus:ring-[#0d4656]/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="absolute right-3 top-3.5 text-[#40484b] hover:text-[#0d4656] transition-colors"
                >
                  <span className="material-symbols-outlined">{showApiKey ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">{text.baseUrl}</label>
              <input
                type="url"
                value={formData.base_url}
                onChange={(event) => setFormData((prev) => ({ ...prev, base_url: event.target.value }))}
                className="w-full bg-[#ffffff] border border-[#c0c8cb]/20 rounded-lg px-4 py-3 text-[#1a1c1b] focus:outline-none focus:ring-1 focus:ring-[#0d4656]/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">{text.model}</label>
              <input
                type="text"
                value={formData.model}
                onChange={(event) => setFormData((prev) => ({ ...prev, model: event.target.value }))}
                className="w-full bg-[#ffffff] border border-[#c0c8cb]/20 rounded-lg px-4 py-3 text-[#1a1c1b] focus:outline-none focus:ring-1 focus:ring-[#0d4656]/30"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => void handleTest()}
              disabled={testing || saving}
              className="px-6 py-2 border border-[#c0c8cb] text-[#40484b] text-[11px] font-bold uppercase tracking-widest rounded hover:bg-[#e8e8e6] transition-colors disabled:opacity-50"
            >
              {testing ? text.testing : text.testConnection}
            </button>

            <button
              onClick={() => void handleSave()}
              disabled={testing || saving}
              className="px-8 py-2 bg-[#0d4656] text-white rounded text-[11px] font-bold uppercase tracking-widest hover:bg-[#2c5e6e] transition-colors disabled:opacity-50"
            >
              {saving ? text.saving : text.saveArchitecture}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-6 p-4 rounded-lg text-sm ${
              feedback.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {feedback.message}
            {feedback.used_stored_api_key ? text.usedStoredKey : ''}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-['Newsreader'] text-2xl text-[#1a1c1b]">{text.scheduleSectionTitle}</h2>
          <p className="text-sm text-[#5e5e5e] mt-1">{text.scheduleSectionSubtitle}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#c0c8cb]/20 p-8">
          {scheduleState === 'loading' && (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-3 border-[#0d4656] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {scheduleState === 'error' && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <p className="text-sm text-red-700 mb-4">{scheduleError || text.scheduleLoadError}</p>
              <button
                onClick={() => void loadSchedule()}
                className="px-5 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
              >
                {text.retry}
              </button>
            </div>
          )}

          {scheduleState === 'ready' && (
            <>
              <div className="rounded-lg border border-[#c0c8cb]/20 bg-[#f8f8f6] p-4 text-sm text-[#5e5e5e]">
                {text.scheduleHint}
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">
                    {text.scheduleSectionTitle}
                  </label>
                  <button
                    type="button"
                    onClick={() => setScheduleTimes((prev) => [...prev, getNextDefaultTime(prev)])}
                    className="px-4 py-2 border border-[#c0c8cb] text-[#40484b] text-[11px] font-bold uppercase tracking-widest rounded hover:bg-[#e8e8e6] transition-colors"
                  >
                    {text.addTime}
                  </button>
                </div>

                <div className="space-y-3">
                  {scheduleTimes.map((time, index) => (
                    <div
                      key={`${time}-${index}`}
                      className="flex items-center gap-3 rounded-lg border border-[#c0c8cb]/20 bg-[#ffffff] px-4 py-3"
                    >
                      <div className="flex-1">
                        <input
                          type="time"
                          step={60}
                          value={time}
                          onChange={(event) =>
                            setScheduleTimes((prev) => prev.map((item, itemIndex) => (
                              itemIndex === index ? event.target.value : item
                            )))
                          }
                          className="w-full bg-transparent text-[#1a1c1b] focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setScheduleTimes((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        disabled={scheduleTimes.length === 1}
                        className="flex h-9 w-9 items-center justify-center rounded border border-[#c0c8cb]/20 text-[#40484b] hover:bg-[#e8e8e6] disabled:opacity-40 disabled:hover:bg-transparent"
                        aria-label={text.removeTime}
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!scheduleSaving) {
                        void handleScheduleSave();
                      }
                    }}
                    aria-disabled={scheduleSaving}
                    className={`px-8 py-2 bg-[#0d4656] text-white rounded text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      scheduleSaving ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:bg-[#2c5e6e]'
                    }`}
                  >
                    {scheduleSaving ? text.scheduleSaving : text.scheduleSave}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!scheduleSaving) {
                        void loadSchedule();
                      }
                    }}
                    aria-disabled={scheduleSaving}
                    className={`px-6 py-2 border border-[#c0c8cb] text-[#40484b] text-[11px] font-bold uppercase tracking-widest rounded transition-colors ${
                      scheduleSaving ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:bg-[#e8e8e6]'
                    }`}
                  >
                    {text.retry}
                  </button>
                </div>
              </div>

              {scheduleFeedback && (
                <div
                  className={`mt-6 p-4 rounded-lg text-sm ${
                    scheduleFeedback.success
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {scheduleFeedback.message}
                </div>
              )}

              <div className="mt-10">
                <div className="mb-4">
                  <h3 className="font-['Newsreader'] text-xl text-[#1a1c1b]">{text.latestRunsTitle}</h3>
                  <p className="text-sm text-[#5e5e5e] mt-1">{text.latestRunsSubtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(scheduleData?.jobs || []).map((job) => {
                    const latestRun = scheduleData?.latest_runs[job.id];

                    return (
                      <div key={job.id} className="rounded-xl border border-[#c0c8cb]/20 bg-[#f8f8f6] p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[#0d4656]">{job.icon || 'schedule'}</span>
                              <h4 className="text-base font-semibold text-[#1a1c1b]">{getJobTitle(job, isZh)}</h4>
                            </div>
                            <p className="mt-1 text-sm text-[#5e5e5e]">{getJobDescription(job, isZh)}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${getStatusTone(latestRun?.status || 'unknown')}`}>
                            {getStatusLabel(latestRun?.status || 'unknown')}
                          </span>
                        </div>

                        <div className="mt-5 space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#5e5e5e]">{text.nextRun}</span>
                            <span className="font-medium text-[#1a1c1b]">
                              {formatScheduleTimestamp(job.next_run, text.noNextRun)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#5e5e5e]">{text.lastRun}</span>
                            <span className="font-medium text-[#1a1c1b]">
                              {formatScheduleTimestamp(latestRun?.finished_at || latestRun?.started_at, text.neverRun)}
                            </span>
                          </div>

                          <div className="rounded-lg border border-[#c0c8cb]/20 bg-white px-4 py-3 text-[#40484b]">
                            {summarizeRun(job.summary_kind, latestRun, isZh)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
