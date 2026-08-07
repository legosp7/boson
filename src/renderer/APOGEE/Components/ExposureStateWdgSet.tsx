import React from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import { useKeywords } from "renderer/hooks";

const LABEL_WIDTH = 80;



interface AcceptedReadState {
  text: string;
  isReading: boolean;
  readNum: number;
  isCurrent: boolean;
}

function finiteNumber(value: unknown): number | null {
  if (
    value == null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function ExposureStateWdgSet() {
  const keywords = useKeywords([
    "apogee.exposureState",
    "apogee.utrReadState",
    "apogee.utrReadTime",
  ]);

  const exposureStateW = keywords.exposureState;
  const utrReadStateW = keywords.utrReadState;
  const utrReadTimeW = keywords.utrReadTime;
  

  const currentReadRef = React.useRef(-1);
  const timerStartRef = React.useRef<number | null>(null);
  const timerDurationRef = React.useRef(0);

  const [acceptedRead, setAcceptedRead] = React.useState<AcceptedReadState>({
    text: "?",
    isReading: false,
    readNum: -1,
    isCurrent: false,
  });
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [resettingProgress, setResettingProgress] = React.useState(false);

  const exposureText = React.useMemo(() => {
    const values = exposureStateW?.values;

    if (!Array.isArray(values) || values[0] == null) {
      return "?";
    }

    return `${String(values[0])} ${String(values[1] ?? "")} ${String(
      values[3] ?? ""
    )}`.trim();
  }, [exposureStateW]);

  const readDuration = React.useMemo(
    () => finiteNumber(utrReadTimeW?.values?.[0]),
    [utrReadTimeW]
  );

  React.useEffect(() => {
    const state = exposureStateW?.values?.[0];

    if (state == null || String(state) !== "Stopping") {
      currentReadRef.current = -1;
    }
  }, [exposureStateW?.timestamp, exposureStateW]);

  React.useEffect(() => {
    const values = utrReadStateW?.values;

    if (
      !Array.isArray(values) ||
      values[0] == null ||
      values[1] == null ||
      values[2] == null ||
      values[3] == null
    ) {
      timerStartRef.current = null;
      setElapsedSeconds(0);
      setProgress(0);
      setAcceptedRead({
        text: "?",
        isReading: false,
        readNum: -1,
        isCurrent: utrReadStateW?.isCurrent ?? false,
      });
      return;
    }

    const readNum = finiteNumber(values[2]);
    const nReads = finiteNumber(values[3]);

    if (readNum == null || nReads == null) {
      return;
    }

    // STUI ignores inter-threaded messages from an older read once a newer
    // read has been seen.
    if (readNum < currentReadRef.current) {
      return;
    }

    currentReadRef.current = readNum;

    const readState = String(values[1]);
    const isReading = readState.toLowerCase() === "reading";
    const hasTimer = isReading && readDuration != null && readDuration > 0;
    const text = `${readState} ${readNum} of ${nReads}${
      hasTimer ? `: ${Math.floor(readDuration)} sec` : ""
    }`;

    setAcceptedRead({
      text,
      isReading: hasTimer,
      readNum,
      isCurrent: utrReadStateW?.isCurrent ?? false,
    });

    if (hasTimer) {
      timerDurationRef.current = readDuration;
      timerStartRef.current = Date.now();
      setElapsedSeconds(0);
      setResettingProgress(true);
      setProgress(0);
      window.requestAnimationFrame(() => setResettingProgress(false));
    } else {
      timerStartRef.current = null;
      setElapsedSeconds(0);
      setProgress(0);
    }
  }, [
    readDuration,
    utrReadStateW?.timestamp,
    utrReadStateW,
  ]);

  React.useEffect(() => {
    if (!acceptedRead.isReading || timerStartRef.current == null) {
      return;
    }

    const updateTimer = () => {
      if (timerStartRef.current == null) return;

      const duration = timerDurationRef.current;
      const elapsed = Math.min(
        duration,
        Math.max(0, (Date.now() - timerStartRef.current) / 1000)
      );

      setElapsedSeconds(elapsed);
      setProgress(duration > 0 ? (elapsed / duration) * 100 : 0);
    };

    updateTimer();
    const timerID = window.setInterval(updateTimer, 100);

    return () => window.clearInterval(timerID);
  }, [acceptedRead.isReading, acceptedRead.readNum]);

  const textSx = {
    fontSize: 14,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  } as const;

  const labelSx = {
    ...textSx,
    textAlign: "right",
  } as const;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `${LABEL_WIDTH}px minmax(0, 1fr)`,
        columnGap: 0.5,
        rowGap: 0.35,
        alignItems: "center",
      }}
    >
      <Typography sx={labelSx}>Exp Status</Typography>
      <Typography
        sx={{
          ...textSx,
          color:
            exposureStateW?.isCurrent === false
              ? "text.disabled"
              : "text.primary",
        }}
      >
        {exposureText}
      </Typography>

      <Typography sx={labelSx}>UTR Read</Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
        <Typography
          sx={{
            ...textSx,
            color: acceptedRead.isCurrent ? "text.primary" : "text.disabled",
          }}
        >
          {acceptedRead.text}
        </Typography>

        {acceptedRead.isReading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                width: 72,
                height: 5,
                borderRadius: 0,
                "& .MuiLinearProgress-bar": {
                  transition: resettingProgress ? "none" : undefined,
                },
              }}
            />
            <Typography
              sx={{
                ...textSx,
                minWidth: 48,
                color:
                  utrReadTimeW?.isCurrent === false
                    ? "text.disabled"
                    : "text.secondary",
              }}
            >
              {elapsedSeconds.toFixed(1)} sec
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}