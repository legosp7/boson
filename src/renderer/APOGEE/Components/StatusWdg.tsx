import React from "react";
import { Box, Typography } from "@mui/material";
import { useKeywords } from "renderer/hooks";
import ExposureStateWdgSet from "./ExposureStateWdgSet";
import TelemetryWdgSet from "./TelemetryWdgSet";
import { limitParser, type Severity } from "./LimitParser";

const LABEL_WIDTH = 80;

function severityColor(
  severity: Severity
): "text.primary" | "warning.main" | "error.main" {
  if (severity === "error") return "error.main";
  if (severity === "warning") return "warning.main";
  return "text.primary";
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

function keyVarBoolean(value: unknown): boolean | null {
  if (value === true || value === false) {
    return value;
  }

  if (value === 1) {
    return true;
  }

  if (value === 0) {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "1" ||
      normalized === "true" ||
      normalized === "on" ||
      normalized === "yes"
    ) {
      return true;
    }

    if (
      normalized === "0" ||
      normalized === "false" ||
      normalized === "off" ||
      normalized === "no"
    ) {
      return false;
    }
  }

  return null;
}

export default function StatusWdg() {
  const keywords = useKeywords([
    "apogee.ditherPosition",
    "apogee.ditherIndexer",
    "apogee.ditherLimitSwitch",
  ]);

  const ditherPositionW = keywords.ditherPosition;
  const ditherIndexerW = keywords.ditherIndexer;
  const ditherLimitSwitchW = keywords.ditherLimitSwitch;

  const ditherStatus = React.useMemo(() => {
    const indexerOn = keyVarBoolean(
      ditherIndexerW?.values?.[0]
    );
  
    let stateText = "";
    let stateSeverity: Severity = "normal";
  
    if (indexerOn === false) {
      stateText = "Off";
      stateSeverity = "error";
    } else {
      const rawLimits = Array.isArray(
        ditherLimitSwitchW?.values
      )
        ? ditherLimitSwitchW.values
        : [];
  
      // Do not manufacture "Limits ? ?" before the keyword has arrived.
      if (rawLimits.length >= 2) {
        const normalizedLimits = rawLimits
          .slice(0, 2)
          .map(keyVarBoolean);
  
        const parsed = limitParser(normalizedLimits);
  
        stateSeverity = parsed.severity;
  
        if (parsed.severity !== "normal") {
          stateText = `Limits ${parsed.limStrList.join(" ")}`;
        }
      }
    }
  
    let positionText = "";
    let positionSeverity: Severity = "normal";
  
    if (indexerOn === false) {
      positionText = "";
    } else {
      const position = finiteNumber(
        ditherPositionW?.values?.[0]
      );
  
      const namedPosition = String(
        ditherPositionW?.values?.[1] ?? "?"
      );
  
      if (position == null) {
        positionText = "?";
        positionSeverity = "warning";
      } else if (namedPosition === "?") {
        positionText = `${position.toFixed(2)} pixels`;
      } else {
        positionText =
          `${namedPosition} = ` +
          `${position.toFixed(2)} pixels`;
      }
    }
  
    return {
      stateText,
      stateSeverity,
      stateIsCurrent:
        ditherIndexerW?.isCurrent === true &&
        ditherLimitSwitchW?.isCurrent === true,
  
      positionText,
      positionSeverity,
      positionIsCurrent:
        ditherPositionW?.isCurrent === true,
    };
  }, [ditherPositionW,ditherIndexerW,ditherLimitSwitchW,]);

  const textSx = {
    fontSize: 14,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.35 }}>
      <ExposureStateWdgSet />

      <Box
        sx={{
          minHeight: 24,
          display: "grid",
          gridTemplateColumns: `${LABEL_WIDTH}px minmax(0, 1fr)`,
          columnGap: 0.5,
          alignItems: "center",
        }}
      >
        <Typography sx={{ ...textSx, textAlign: "right" }}>Dither</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography
            sx={{
              ...textSx,
              color: ditherStatus.positionIsCurrent
                ? severityColor(ditherStatus.positionSeverity)
                : "text.disabled",
            }}
          >
            {ditherStatus.positionText}
          </Typography>
          {ditherStatus.stateText ? (
            <Typography
              sx={{
                ...textSx,
                color: ditherStatus.stateIsCurrent
                  ? severityColor(ditherStatus.stateSeverity)
                  : "text.disabled",
              }}
            >
              {ditherStatus.stateText}
            </Typography>
          ) : null}
        </Box>
      </Box>

      <TelemetryWdgSet />
    </Box>
  );
}
