import React from "react";
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  Typography,
} from "@mui/material";
import { useKeywords } from "renderer/hooks";
import type { Severity } from "./LimitParser";
import {
  useDeviceCommand,
  type CommandStatusHandler,
} from "./useDeviceCommand";

interface CalBoxWdgSetProps {
  onStatusMessage?: CommandStatusHandler;
}

interface DeviceSummary {
  text: string;
  severity: Severity;
}

const SUMMARY_LABEL_WIDTH = 120;
const DETAIL_LABEL_WIDTH = 62;

function severityColor(
  severity: Severity
): "text.primary" | "warning.main" | "error.main" {
  if (severity === "error") return "error.main";
  if (severity === "warning") return "warning.main";
  return "text.primary";
}

function combineSeverity(first: Severity, second: Severity): Severity {
  if (first === "error" || second === "error") return "error";
  if (first === "warning" || second === "warning") return "warning";
  return "normal";
}

function keyVarBoolean(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (value === 1) return true;
  if (value === 0) return false;

  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();

    if (
      normalised === "1" ||
      normalised === "true" ||
      normalised === "on" ||
      normalised === "open" ||
      normalised === "yes" ||
      normalised === "available"
    ) {
      return true;
    }

    if (
      normalised === "0" ||
      normalised === "false" ||
      normalised === "off" ||
      normalised === "closed" ||
      normalised === "no" ||
      normalised === "unavailable"
    ) {
      return false;
    }
  }

  return null;
}

function initialExpanded(): boolean {
  try {
    return Boolean(
      window.electron.store.get("apogee.calbox.expanded")
    );
  } catch {
    return false;
  }
}

function quoteActorString(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}"`;
}

export default function CalBoxWdgSet({
  onStatusMessage,
}: CalBoxWdgSetProps) {
  const keywords = useKeywords([
    "apogeecal.calBoxController",
    "apogeecal.calShutter",
    "apogeecal.calSourceStatus",
    "apogeecal.calSourceNames",
  ]);

  const [expanded, setExpanded] = React.useState(initialExpanded);

  React.useEffect(() => {
    try {
      window.electron.store.set(
        "apogee.calbox.expanded",
        expanded
      );
    } catch {
      // Persisting the expansion state is optional.
    }
  }, [expanded]);

  const controllerW = keywords.calBoxController;
  const shutterW = keywords.calShutter;
  const sourceStatusW = keywords.calSourceStatus;
  const sourceNamesW = keywords.calSourceNames;

  /**
   * STUI only rebuilds the source widgets after receiving a complete source
   * name list. An incomplete name keyword leaves the existing controls alone.
   */
  const [sourceNames, setSourceNames] =
    React.useState<string[]>([]);

  React.useEffect(() => {
    const values = sourceNamesW?.values;

    if (
      !Array.isArray(values) ||
      values.some((value) => value == null)
    ) {
      return;
    }

    const nextNames = values.map(String);

    setSourceNames((currentNames) => {
      const unchanged =
        currentNames.length === nextNames.length &&
        currentNames.every(
          (name, index) => name === nextNames[index]
        );

      return unchanged ? currentNames : nextNames;
    });
  }, [sourceNamesW]);

  const rawSourceStatuses = Array.isArray(
    sourceStatusW?.values
  )
    ? sourceStatusW.values
    : [];

  const sourceStatuses = React.useMemo(
    () =>
      rawSourceStatuses.map((value) =>
        keyVarBoolean(value)
      ),
    [rawSourceStatuses]
  );

  const sourceLengthsMatch =
    sourceNames.length === sourceStatuses.length;

  const sendCommand = React.useCallback(
    (command: string) =>
      window.electron.tron.send(
        `apogeecal ${command}`,
        true
      ),
    []
  );

  const {
    isRunning: shutterIsRunning,
    doCmd: doShutterCommand,
  } = useDeviceCommand(sendCommand, onStatusMessage);

  const {
    isRunning: sourcesAreRunning,
    doCmd: doSourceCommand,
  } = useDeviceCommand(sendCommand, onStatusMessage);

  const reportedShutterOpen = keyVarBoolean(
    shutterW?.values?.[0]
  );

  /**
   * STUI leaves the last shutter value visible when the keyword becomes
   * unknown, then marks the control non-current.
   */
  const [lastKnownShutterOpen, setLastKnownShutterOpen] =
    React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (reportedShutterOpen != null) {
      setLastKnownShutterOpen(reportedShutterOpen);
    }
  }, [reportedShutterOpen]);

  const displayedShutterOpen =
    reportedShutterOpen ?? lastKnownShutterOpen;

  const shutterSummary = React.useMemo<DeviceSummary>(() => {
    if (reportedShutterOpen == null) {
      return { text: "?", severity: "warning" };
    }

    return {
      text: reportedShutterOpen ? "Open" : "Closed",
      severity: "normal",
    };
  }, [reportedShutterOpen]);

  const sourceSummary = React.useMemo<DeviceSummary>(() => {
    if (!sourceLengthsMatch) {
      return {
        text: "Sources ???",
        severity: "warning",
      };
    }

    const enabledSources: string[] = [];
    const unknownSources: string[] = [];

    sourceNames.forEach((name, index) => {
      const state = sourceStatuses[index];

      if (state == null) {
        unknownSources.push(name);
      } else if (state) {
        enabledSources.push(name);
      }
    });

    const parts: string[] = [];

    if (enabledSources.length > 0) {
      parts.push(`${enabledSources.join(", ")} ON`);
    }

    if (unknownSources.length > 0) {
      parts.push(`${unknownSources.join(", ")} ???`);
    }

    if (parts.length === 0) {
      return {
        text: "Sources off",
        severity: "normal",
      };
    }

    return {
      text: parts.join("; "),
      severity: "warning",
    };
  }, [
    sourceLengthsMatch,
    sourceNames,
    sourceStatuses,
  ]);

  const summary = React.useMemo<{
    text: string;
    severity: Severity;
    isCurrent: boolean;
  }>(() => {
    const isCurrent =
      controllerW?.isCurrent === true &&
      shutterW?.isCurrent === true &&
      sourceStatusW?.isCurrent === true &&
      sourceNamesW?.isCurrent === true;

    const controllerState = keyVarBoolean(
      controllerW?.values?.[0]
    );

    if (controllerState == null) {
      return {
        text: "Controller state unknown",
        severity: "warning",
        isCurrent,
      };
    }

    if (controllerState === false) {
      return {
        text: "Controller unavailable",
        severity: "error",
        isCurrent,
      };
    }

    return {
      text: `${shutterSummary.text}; ${sourceSummary.text}`,
      severity: combineSeverity(
        shutterSummary.severity,
        sourceSummary.severity
      ),
      isCurrent,
    };
  }, [
    controllerW,
    shutterSummary,
    shutterW,
    sourceNamesW,
    sourceStatusW,
    sourceSummary,
  ]);

  const toggleShutter = React.useCallback(() => {
    const opening = displayedShutterOpen !== true;
    const command = opening
      ? "shutterOpen"
      : "shutterClose";
    const verb = opening ? "open" : "close";

    void doShutterCommand(command, {
      running: `${verb} running`,
      success: `${verb} finished`,
      failure: `${verb} failed`,
    });
  }, [displayedShutterOpen, doShutterCommand]);

  const toggleSource = React.useCallback(
    (name: string, currentState: boolean | null) => {
      const turningOn = currentState !== true;
      const command = turningOn
        ? "sourceOn"
        : "sourceOff";

      void doSourceCommand(
        `${command} source=${quoteActorString(name)}`,
        {
          running: `${name} ${
            turningOn ? "on" : "off"
          } running`,
          success: `${name} ${
            turningOn ? "on" : "off"
          } finished`,
          failure: `${name} command failed`,
        }
      );
    },
    [doSourceCommand]
  );

  const summaryTextSx = {
    fontSize: 13,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  } as const;

  const detailTextSx = {
    fontSize: 13,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  } as const;

  const summaryCheckboxSx = {
    p: 0,
    "& .MuiSvgIcon-root": {
      fontSize: 20,
    },
  } as const;

  const sourceCheckboxSx = {
    p: 0.2,
    "& .MuiSvgIcon-root": {
      fontSize: 18,
    },
  } as const;

  const valueButtonSx = {
    minWidth: 72,
    minHeight: 28,
    px: 0.75,
    py: 0.1,
    borderRadius: 0,
    color: "text.primary",
    borderColor: "divider",
    backgroundColor: "background.paper",
    fontSize: 13,
    lineHeight: 1.2,
    textTransform: "none",
    "&:hover": {
      borderColor: "text.primary",
      backgroundColor: "action.hover",
    },
  } as const;

  const cancelButtonSx = {
    minWidth: 34,
    minHeight: 28,
    px: 0.4,
    py: 0.1,
    borderRadius: 0,
    color: "text.primary",
    borderColor: "divider",
    backgroundColor: "background.paper",
    fontSize: 14,
    lineHeight: 1.2,
    textTransform: "none",
    "&.Mui-disabled": {
      color: "text.disabled",
      borderColor: "divider",
      backgroundColor: "action.disabledBackground",
    },
  } as const;

  const shutterControlIsCurrent =
    shutterW?.isCurrent === true &&
    reportedShutterOpen != null;

  return (
    <Box>
      <Box
        sx={{
          minHeight: 28,
          display: "grid",
          gridTemplateColumns: `${SUMMARY_LABEL_WIDTH}px minmax(0, 1fr)`,
          columnGap: 0.75,
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 0.45,
          }}
        >
          <Checkbox
            checked={expanded}
            onChange={(
              event: React.ChangeEvent<HTMLInputElement>
            ) => setExpanded(event.target.checked)}
            sx={summaryCheckboxSx}
            slotProps={{
              input : {
              "aria-label":
                "Show calibration box controls",
              },
            }}
          />

          <Typography sx={summaryTextSx}>
            Cal Box
          </Typography>
        </Box>

        <Typography
          sx={{
            ...summaryTextSx,
            color: summary.isCurrent
              ? severityColor(summary.severity)
              : "text.disabled",
          }}
        >
          {summary.text}
        </Typography>
      </Box>

      <Collapse in={expanded} timeout={0} unmountOnExit>
        <Box
          sx={{
            mt: 0.25,
            px: 0.75,
            py: 0.45,
            border: "1px solid",
            borderColor: "divider",
            width: "fit-content",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `${DETAIL_LABEL_WIDTH}px minmax(0, 1fr)`,
              columnGap: 0.5,
              rowGap: 0.35,
              alignItems: "center",
            }}
          >
            <Typography
              sx={{
                ...detailTextSx,
                textAlign: "right",
              }}
            >
              Shutter
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.4,
              }}
            >
              <Button
                variant="outlined"
                disabled={shutterIsRunning}
                onClick={toggleShutter}
                sx={{
                  ...valueButtonSx,
                  color: shutterControlIsCurrent
                    ? "text.primary"
                    : "text.disabled",
                  borderColor: "divider",
                }}
              >
                {displayedShutterOpen == null
                  ? "?"
                  : displayedShutterOpen
                    ? "Open"
                    : "Closed"}
              </Button>

              <Button
                variant="outlined"
                disabled={shutterIsRunning}
                tabIndex={-1}
                sx={{
                  ...cancelButtonSx,
                  pointerEvents: "none",
                }}
              >
                X
              </Button>
            </Box>

            <Typography
              sx={{
                ...detailTextSx,
                textAlign: "right",
              }}
            >
              Sources
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                flexWrap: "nowrap",
              }}
            >
              {sourceNames.map((name, index) => {
                const state = sourceLengthsMatch
                  ? sourceStatuses[index]
                  : null;

                const stateIsCurrent =
                  sourceLengthsMatch &&
                  sourceStatusW?.isCurrent === true &&
                  state != null;

                return (
                  <Box
                    key={`${name}-${index}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.1,
                    }}
                  >
                    <Checkbox
                      checked={state === true}
                      indeterminate={state == null}
                      disabled={sourcesAreRunning}
                      onChange={() =>
                        toggleSource(name, state)
                      }
                      sx={{
                        ...sourceCheckboxSx,
                        color: stateIsCurrent
                          ? "text.secondary"
                          : state == null
                            ? "warning.main"
                            : "text.disabled",
                        "&.Mui-checked": {
                          color: stateIsCurrent
                            ? "primary.main"
                            : "text.disabled",
                        },
                        "&.MuiCheckbox-indeterminate": {
                          color: "warning.main",
                        },
                      }}
                      slotProps={{ input : {
                        "aria-label": `${name} source`,
                      },}}
                    />

                    <Typography
                      sx={{
                        ...detailTextSx,
                        color: stateIsCurrent
                          ? "text.primary"
                          : state == null
                            ? "warning.main"
                            : "text.disabled",
                      }}
                    >
                      {name}
                    </Typography>
                  </Box>
                );
              })}

              <Button
                variant="outlined"
                disabled={sourcesAreRunning}
                tabIndex={-1}
                sx={{
                  ...cancelButtonSx,
                  pointerEvents: "none",
                }}
              >
                X
              </Button>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
