import { useEffect, useRef, useCallback } from 'react';
import { behaviorApi, type SignalType, type BehaviorAction } from '../api/newsletter';

interface UseBehaviorCollectorOptions {
  digestId: number;
  anchorId: number;
  tag: string;
  enabled?: boolean;
}

interface DwellState {
  startTime: number;
  totalDwell: number;
  scrollBottomReached: boolean;
}

/**
 * Hook to collect implicit user behaviors on digest content
 *
 * Collects:
 * - dwell time (10s, 30s, 60s thresholds)
 * - scroll to bottom
 * - revisit detection
 */
export function useBehaviorCollector({
  digestId,
  anchorId,
  tag,
  enabled = true,
}: UseBehaviorCollectorOptions) {
  const dwellState = useRef<DwellState>({
    startTime: Date.now(),
    totalDwell: 0,
    scrollBottomReached: false,
  });

  const lastDwellReport = useRef<number>(0);
  const hasReported = useRef<Set<string>>(new Set());

  // Report a signal (deduplicated)
  const reportSignal = useCallback(
    async (action: BehaviorAction, value: number = 0, signalType: SignalType = 'implicit') => {
      const key = `${action}-${value}`;
      if (hasReported.current.has(key)) return;
      hasReported.current.add(key);

      try {
        await behaviorApi.recordLog({
          digest_id: digestId,
          anchor_id: anchorId,
          tag,
          signal_type: signalType,
          action,
          value,
        });
      } catch (err) {
        console.warn('Failed to report behavior signal:', err);
      }
    },
    [digestId, anchorId, tag]
  );

  // Track dwell time
  useEffect(() => {
    if (!enabled) return;

    const CHECK_INTERVAL = 5000; // Check every 5 seconds
    let intervalId: ReturnType<typeof setInterval>;

    const checkDwell = () => {
      const now = Date.now();
      const elapsed = (now - dwellState.current.startTime) / 1000;
      const totalDwell = dwellState.current.totalDwell + elapsed;

      // Only report at thresholds
      if (totalDwell >= 60 && lastDwellReport.current < 60) {
        reportSignal('dwell', 60, 'implicit');
        lastDwellReport.current = 60;
      } else if (totalDwell >= 30 && lastDwellReport.current < 30) {
        reportSignal('dwell', 30, 'implicit');
        lastDwellReport.current = 30;
      } else if (totalDwell >= 10 && lastDwellReport.current < 10) {
        reportSignal('dwell', 10, 'implicit');
        lastDwellReport.current = 10;
      }
    };

    intervalId = setInterval(checkDwell, CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [enabled, reportSignal]);

  // Track visibility change (tab switch / revisit)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - accumulate dwell
        dwellState.current.totalDwell +=
          (Date.now() - dwellState.current.startTime) / 1000;
      } else {
        // Tab visible - reset start time
        dwellState.current.startTime = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  // Track scroll to bottom
  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;

      const scrollPercent = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercent >= 0.9 && !dwellState.current.scrollBottomReached) {
        dwellState.current.scrollBottomReached = true;
        reportSignal('scroll', 100, 'implicit');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enabled, reportSignal]);

  // Cleanup and final report on unmount
  useEffect(() => {
    return () => {
      const totalDwell =
        dwellState.current.totalDwell +
        (Date.now() - dwellState.current.startTime) / 1000;

      if (totalDwell >= 10) {
        const roundedDwell = Math.floor(totalDwell / 10) * 10;
        reportSignal('dwell', roundedDwell, 'implicit');
      }
    };
  }, [reportSignal]);

  // Expose explicit feedback methods
  const recordShow = useCallback(() => {
    reportSignal('show', 1, 'explicit');
  }, [reportSignal]);

  const recordHide = useCallback(() => {
    reportSignal('hide', 1, 'explicit');
  }, [reportSignal]);

  const recordClick = useCallback(() => {
    reportSignal('click', 1, 'implicit');
  }, [reportSignal]);

  return {
    recordShow,
    recordHide,
    recordClick,
  };
}
