import { useEffect, useMemo, useState } from 'react';
import { configApi, type AIConfig, type AIConfigDraft, type AIConnectionTestResult } from '../api/newsletter';

type SettingsViewState = 'loading' | 'load_error' | 'unconfigured' | 'configured';

const DEFAULT_DRAFT: AIConfigDraft = {
  provider: 'siliconflow',
  api_key: '',
  base_url: 'https://api.siliconflow.cn/v1',
  model: 'Qwen/Qwen2.5-7B-Instruct',
};

function normalizeDraft(draft: AIConfigDraft): AIConfigDraft {
  return {
    provider: draft.provider.trim(),
    api_key: draft.api_key.trim(),
    base_url: draft.base_url.trim(),
    model: draft.model.trim(),
  };
}

export default function Settings() {
  const [viewState, setViewState] = useState<SettingsViewState>('loading');
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [formData, setFormData] = useState<AIConfigDraft>(DEFAULT_DRAFT);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [feedback, setFeedback] = useState<AIConnectionTestResult | null>(null);
  const [loadError, setLoadError] = useState('');

  const hasStoredApiKey = Boolean(aiConfig?.has_api_key);
  const isConfigured = viewState === 'configured';

  const apiKeyPlaceholder = useMemo(
    () => (hasStoredApiKey ? '已配置（不修改请留空）' : '请输入 API Key'),
    [hasStoredApiKey]
  );

  useEffect(() => {
    void loadConfig();
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
      setLoadError(error instanceof Error ? error.message : '配置加载失败');
      setViewState('load_error');
    }
  }

  function validateDraft(draft: AIConfigDraft): string | null {
    if (!draft.provider) return '请填写 Provider';
    if (!draft.base_url) return '请填写 Base URL';
    if (!draft.model) return '请填写 Model';
    if (!draft.api_key && !hasStoredApiKey) return '首次配置必须填写 API Key';
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
        message: error instanceof Error ? error.message : '测试连接失败',
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

      setFeedback({ success: true, message: saveResult.message || 'AI 配置已验证并保存' });
      await loadConfig();
    } catch (error) {
      setFeedback({
        success: false,
        message: error instanceof Error ? error.message : '保存失败',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleManualReconfigure() {
    setAiConfig(null);
    setFormData(DEFAULT_DRAFT);
    setFeedback(null);
    setLoadError('');
    setViewState('unconfigured');
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
          <h2 className="text-xl font-bold text-red-700 mb-3">加载失败，可重试或重新配置</h2>
          <p className="text-sm text-red-700/90 mb-6">{loadError || '无法读取当前配置'}</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadConfig()}
              className="px-5 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
            >
              Retry
            </button>
            <button
              onClick={handleManualReconfigure}
              className="px-5 py-2 rounded border border-red-300 text-red-700 text-sm hover:bg-red-100"
            >
              重新手动配置
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <header className="mb-10">
        <h1 className="font-['Newsreader'] text-4xl text-[#1a1c1b] mb-3">Settings</h1>
        <p className="text-[#5e5e5e]">配置 AI 提供商与模型连接。保存前会自动验证当前草稿配置。</p>
      </header>

      {viewState === 'unconfigured' && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
          尚未完成 AI 配置。请先填写配置，建议先测试连接，再保存。
        </div>
      )}

      {isConfigured && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">
          当前已存在可用配置。若不想替换密钥，请保持 API Key 为空后保存。
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#c0c8cb]/20 p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">AI Provider</label>
            <select
              value={formData.provider}
              onChange={(event) => setFormData((prev) => ({ ...prev, provider: event.target.value }))}
              className="w-full bg-[#ffffff] border border-[#c0c8cb]/20 rounded-lg px-4 py-3 text-[#1a1c1b] focus:outline-none focus:ring-1 focus:ring-[#0d4656]/30"
            >
              <option value="siliconflow">硅基流动 (SiliconFlow)</option>
              <option value="minimax">MiniMax</option>
              <option value="custom">自定义 OpenAI 兼容接口</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">API Key</label>
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
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">Base URL</label>
            <input
              type="url"
              value={formData.base_url}
              onChange={(event) => setFormData((prev) => ({ ...prev, base_url: event.target.value }))}
              className="w-full bg-[#ffffff] border border-[#c0c8cb]/20 rounded-lg px-4 py-3 text-[#1a1c1b] focus:outline-none focus:ring-1 focus:ring-[#0d4656]/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#40484b] block">Model</label>
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
            {testing ? '测试中...' : 'Test Connection'}
          </button>

          <button
            onClick={() => void handleSave()}
            disabled={testing || saving}
            className="px-8 py-2 bg-[#0d4656] text-white rounded text-[11px] font-bold uppercase tracking-widest hover:bg-[#2c5e6e] transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : 'Save Architecture'}
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
          {feedback.used_stored_api_key ? '（已使用已保存的 API Key）' : ''}
        </div>
      )}
    </div>
  );
}
