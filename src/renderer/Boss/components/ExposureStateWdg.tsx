import React from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import { useKeywords } from "renderer/hooks";

type ExposureState =
  | "IDLE"
  | "FLUSHING"
  | "INTEGRATING"
  | "PAUSED"
  | "PREREADING"
  | "READING"
  | "LEGIBLE"
  | "ABORTED"
  | "?";

function formatSeconds(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `${value.toFixed(1)} sec`;
}

export default function ExposureStateWdg() {
  const keywords = useKeywords(["boss.exposureState"]);
  const exposureStateW = keywords?.exposureState;

  const exposure = React.useMemo(() => {
    const values = Array.isArray(exposureStateW?.values) ? exposureStateW.values : [];

    if (values.length < 3 || values[0] == null) {
      return {
        state: "?" as ExposureState,
        totalTime: null as number | null,
        elapsedTime: null as number | null,
        remainingTime: null as number | null,
        percent: 0,
        showTimer: false,
        isPaused: false,
      };
    }

    const state = String(values[0]) as ExposureState;
    const totalTime = values[1] == null ? 0 : Number(values[1]);
    const elapsedTime = values[2] == null ? totalTime : Number(values[2]);
    const remainingTime = totalTime - elapsedTime;
    const percent =
      totalTime > 0 ? Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100)) : 0;

    return {
      state,
      totalTime,
      elapsedTime,
      remainingTime,
      percent,
      showTimer: totalTime > 0,
      isPaused: state === "PAUSED",
    };
  }, [exposureStateW]);

  return (
    <Box display="flex" alignItems="center" gap={1} minWidth={0}>
      <Typography
        sx={{
          fontSize: 14,
          whiteSpace: "nowrap",
          color: exposure.isPaused ? "warning.main" : "text.primary",
        }}
      >
        {exposure.state === "?" ? "?" : exposure.state.charAt(0) + exposure.state.slice(1).toLowerCase()}
      </Typography>

      {exposure.showTimer && (
        <Box display="flex" alignItems="center" gap={1} minWidth={160} flex={1}>
          <LinearProgress
            variant="determinate"
            value={exposure.percent}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              minWidth: 60,
            }}
          />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: 12, whiteSpace: "nowrap" }}
          >
            {formatSeconds(exposure.remainingTime)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}