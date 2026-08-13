import React from "react";
import { Box } from "@mui/system";
import { LinearProgress, Typography } from "@mui/material";
import { useKeywords } from "renderer/hooks";

type ExposureState =
  | "IDLE"
  | "FLUSHING"
  | "INTEGRATING"
  | "PAUSED"
  | "PREREADING"
  | "READING"
  | "LEGIBLE"
  | "ABORTED";

function formatSeconds(value: number): string {
  return `${Math.max(0, value).toFixed(1)} sec`;
}

export default function ExposureStateWdg() {
  const keywords = useKeywords(["boss.exposureState"]);

  const { exposureState: exposureStateW } = keywords;

  const [progress, setProgress] = React.useState<number>(0);
  const [remainingSec, setRemainingSec] = React.useState<number>(0);

  const state = React.useMemo(() => {
    const v = exposureStateW?.values?.[0];
    return v != null ? String(v).toUpperCase() as ExposureState : null;
  }, [exposureStateW]);

  const totalTime = React.useMemo(() => {
    const v = exposureStateW?.values?.[1];
    return Number.isFinite(v) ? Number(v) : 0;
  }, [exposureStateW]);

  const elapsedTimeFromKeyword = React.useMemo(() => {
    const v = exposureStateW?.values?.[2];
    return Number.isFinite(v) ? Number(v) : totalTime;
  }, [exposureStateW, totalTime]);

  const isPaused = React.useMemo(() => state === "PAUSED", [state]);

  const showTimer = React.useMemo(() => {
    return state !== null && totalTime > 0;
  }, [state, totalTime]);

  const isCountingState = React.useMemo(() => {
    if (state == null) return false;
    return !isPaused && totalTime > 0;
  }, [state, isPaused, totalTime]);

  const localStartRef = React.useRef<number | null>(null);
  const baseElapsedRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!showTimer) {
      setProgress(0);
      setRemainingSec(0);
      localStartRef.current = null;
      baseElapsedRef.current = 0;
      return;
    }

    baseElapsedRef.current = Math.max(0, elapsedTimeFromKeyword);

    if (isPaused) {
      const remaining = Math.max(0, totalTime - elapsedTimeFromKeyword);
      const percent =
        totalTime > 0
          ? Math.max(0, Math.min(100, (elapsedTimeFromKeyword / totalTime) * 100))
          : 0;

      setProgress(percent);
      setRemainingSec(remaining);
      localStartRef.current = null;
      return;
    }

    localStartRef.current = Date.now();
    const initialRemaining = Math.max(0, totalTime - elapsedTimeFromKeyword);
    const initialPercent =
      totalTime > 0
        ? Math.max(0, Math.min(100, (elapsedTimeFromKeyword / totalTime) * 100))
        : 0;

    setProgress(initialPercent);
    setRemainingSec(initialRemaining);
  }, [showTimer, isPaused, totalTime, elapsedTimeFromKeyword, state]);

  React.useEffect(() => {
    if (!showTimer || !isCountingState || totalTime <= 0) {
      return;
    }

    const tick = () => {
      if (localStartRef.current == null) {
        localStartRef.current = Date.now();
      }

      const elapsedSinceLocalStart = (Date.now() - localStartRef.current) / 1000;
      const currentElapsed = baseElapsedRef.current + elapsedSinceLocalStart;
      const remaining = Math.max(0, totalTime - currentElapsed);
      const percent = Math.max(0, Math.min(100, (currentElapsed / totalTime) * 100));

      setProgress(percent);
      setRemainingSec(remaining);

      if (remaining <= 0) {
        setProgress(100);
        setRemainingSec(0);
        localStartRef.current = null;
      }
    };

    tick();
    const id = window.setInterval(tick, 100);

    return () => window.clearInterval(id);
  }, [showTimer, isCountingState, totalTime]);

  const displayState = React.useMemo(() => {
    if (!state) return "?";
    return state.charAt(0) + state.slice(1).toLowerCase();
  }, [state]);

  return (
    <Box display="flex" alignItems="center" gap={1} minWidth={0} width="100%">
      <Typography
        sx={{
          minWidth: 70,
          fontSize: 14,
          whiteSpace: "nowrap",
          color: isPaused ? "warning.main" : "text.primary",
        }}
      >
        {displayState}
      </Typography>

      {showTimer ? (
        <Box display="flex" alignItems="center" gap={1} flex={1} minWidth={100}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: 999,
            }}
          />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontSize: 12,
              whiteSpace: "nowrap",
              minWidth: 55,
            }}
          >
            {formatSeconds(remainingSec)}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}