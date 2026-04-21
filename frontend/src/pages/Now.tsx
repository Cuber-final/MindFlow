import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  nowApi,
  type NowDetail,
  type NowItem,
} from '../api/newsletter';
import { useI18n } from '../i18n';
import NowContextRail from '../components/now/NowContextRail';
import NowDetailPane from '../components/now/NowDetailPane';
import NowQueueList from '../components/now/NowQueueList';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function Now() {
  const navigate = useNavigate();
  const { anchorId } = useParams<{ anchorId: string }>();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  const activeAnchorId = anchorId ? Number(anchorId) : null;
  const fromDigestDate = searchParams.get('from') === 'digest' ? searchParams.get('date') : null;

  const [items, setItems] = useState<NowItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [detail, setDetail] = useState<NowDetail | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'read' | 'processed' | null>(null);
  const detailRequestIdRef = useRef(0);
  const latestRouteAnchorRef = useRef<number | null>(activeAnchorId);

  const searchSuffix = useMemo(() => {
    const next = searchParams.toString();
    return next ? `?${next}` : '';
  }, [searchParams]);

  async function syncQueue(preferredAnchorId?: number | null) {
    setQueueLoading(true);
    setError(null);
    try {
      const response = await nowApi.list({ limit: 24 });
      setItems(response.items);
      setGeneratedAt(response.generated_at ?? null);

      if (response.items.length === 0) {
        setDetail(null);
        if (activeAnchorId !== null) {
          navigate('/now', { replace: true });
        }
        return null;
      }

      const preferredExists = preferredAnchorId != null && response.items.some((item) => item.anchor_id === preferredAnchorId);
      const nextAnchorId = preferredExists ? preferredAnchorId! : response.items[0].anchor_id;

      if (activeAnchorId !== nextAnchorId) {
        navigate(`/now/${nextAnchorId}${searchSuffix}`, { replace: preferredAnchorId == null });
      }

      return nextAnchorId;
    } catch (queueError) {
      setError(getErrorMessage(queueError, t('now.errors.loadWorkbench')));
      return null;
    } finally {
      setQueueLoading(false);
    }
  }

  async function loadDetail(targetAnchorId: number) {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoading(true);
    setError(null);
    try {
      const payload = await nowApi.getDetail(targetAnchorId);
      if (requestId !== detailRequestIdRef.current) {
        return;
      }
      setDetail(payload);
    } catch (detailError) {
      if (requestId !== detailRequestIdRef.current) {
        return;
      }
      setDetail(null);
      setError(getErrorMessage(detailError, t('now.errors.loadDetail')));
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoading(false);
      }
    }
  }

  useEffect(() => {
    void syncQueue(activeAnchorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    latestRouteAnchorRef.current = activeAnchorId;
  }, [activeAnchorId]);

  useEffect(() => {
    if (!activeAnchorId) {
      detailRequestIdRef.current += 1;
      setDetail(null);
      return;
    }

    const queueContainsTarget = items.some((item) => item.anchor_id === activeAnchorId);
    if (!queueLoading && items.length > 0 && !queueContainsTarget) {
      void syncQueue(activeAnchorId);
      return;
    }

    void loadDetail(activeAnchorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAnchorId]);

  async function handleSelectAnchor(targetAnchorId: number) {
    navigate(`/now/${targetAnchorId}${searchSuffix}`);
  }

  async function handleStateChange(action: 'read' | 'processed') {
    if (!activeAnchorId) {
      return;
    }

    setPendingAction(action);
    setError(null);

    try {
      const currentIndex = items.findIndex((item) => item.anchor_id === activeAnchorId);
      const nextCandidateId =
        action === 'processed'
          ? items[currentIndex + 1]?.anchor_id ?? items.find((item) => item.anchor_id !== activeAnchorId)?.anchor_id ?? null
          : activeAnchorId;

      await nowApi.updateState(activeAnchorId, {
        mark_read: true,
        mark_processed: action === 'processed',
      });

      const syncedAnchorId = await syncQueue(nextCandidateId);

      if (
        syncedAnchorId &&
        syncedAnchorId === activeAnchorId &&
        latestRouteAnchorRef.current === activeAnchorId
      ) {
        await loadDetail(activeAnchorId);
      }
    } catch (stateError) {
      setError(getErrorMessage(stateError, t('now.errors.updateState')));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-8">
      <header className="rounded-[32px] border border-[#c0c8cb]/15 bg-[#f7f5ef] px-8 py-8 shadow-[0_24px_70px_rgba(26,28,27,0.04)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5e5e5e]">{t('now.header.flow')}</p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-headline text-5xl leading-none tracking-tight text-[#1a1c1b] md:text-6xl">{t('now.header.title')}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[#40484b]">
              {t('now.header.description')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQueueCollapsed((current) => !current)}
            className="inline-flex items-center gap-2 self-start rounded-full border border-[#c0c8cb]/20 px-4 py-2 text-sm font-medium text-[#40484b] transition-colors hover:border-[#0d4656]/20 hover:text-[#0d4656]"
          >
            <span className="material-symbols-outlined text-base">{queueCollapsed ? 'right_panel_open' : 'left_panel_close'}</span>
            {queueCollapsed ? t('now.actions.expandQueue') : t('now.actions.collapseQueue')}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-[#ba1a1a]/12 bg-[#fff8f7] px-5 py-4 text-sm text-[#8c1d18]">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(260px,360px)_minmax(0,1fr)]">
        <NowContextRail
          items={items}
          detail={detail}
          fromDigestDate={fromDigestDate}
          generatedAt={generatedAt}
        />
        <NowQueueList
          items={items}
          activeAnchorId={activeAnchorId}
          collapsed={queueCollapsed}
          disabled={pendingAction !== null}
          loading={queueLoading}
          onToggleCollapsed={() => setQueueCollapsed((current) => !current)}
          onSelectAnchor={handleSelectAnchor}
        />
        <NowDetailPane
          detail={detail}
          loading={detailLoading}
          pendingAction={pendingAction}
          onMarkRead={() => void handleStateChange('read')}
          onMarkProcessed={() => void handleStateChange('processed')}
        />
      </div>
    </div>
  );
}
