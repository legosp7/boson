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

interface ShutterWdgSetProps {
  onStatusMessage?: CommandStatusHandler;

  /**
   * STUI omits the physical cold-shutter control at LCO and treats the
   * shutter as open for the summary. Supply this prop to override the
   * observatory setting.
   */
  showColdShutter?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

interface ShutterSummary {
  text: string;
  severity: Severity;
}

const SUMMARY_LABEL_WIDTH = 120;
const DETAIL_LABEL_WIDTH = 62;
const NUMBER_OF_LEDS = 4;
const ALL_LEDS_ON_MASK = (1 << NUMBER_OF_LEDS) - 1;

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

/**
 * KeyVar values may arrive as booleans, 0/1, or string forms depending on
 * how the keyword was parsed or serialised.
 */
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
      normalised === "yes"
    ) {
      return true;
    }

    if (
      normalised === "0" ||
      normalised === "false" ||
      normalised === "off" ||
      normalised === "closed" ||
      normalised === "no"
    ) {
      return false;
    }
  }

  return null;
}

function initialExpanded(): boolean {
  try {
    return Boolean(
      window.electron.store.get("apogee.shutter.expanded")
    );
  } catch {
    return false;
  }
}

function defaultColdShutterAvailability(): boolean {
  try {
    const observatory = String(
      window.electron.store.get("connection.observatory") ?? "APO"
    ).toUpperCase();

    return observatory !== "LCO";
  } catch {
    return true;
  }
}

export default function ShutterWdgSet({
  onStatusMessage,
  showColdShutter,
  onExpandedChange,
}: ShutterWdgSetProps) {
  const keywords = useKeywords([
    "apogee.shutterIndexer",
    "apogee.shutterLimitSwitch",
    "apogee.shutterLED",
  ]);

  const [expanded, setExpanded] = React.useState(initialExpanded);
  const hasColdShutter =
    showColdShutter ?? defaultColdShutterAvailability();

  React.useEffect(() => {
    try {
      window.electron.store.set(
        "apogee.shutter.expanded",
        expanded
      );
    } catch {
      // Persisting the expansion state is optional.
    }
  }, [expanded]);

  const indexerW = keywords.shutterIndexer;
  const limitSwitchW = keywords.shutterLimitSwitch;
  const ledW = keywords.shutterLED;

  const sendCommand = React.useCallback(
    (command: string) =>
      window.electron.tron.send(`apogee ${command}`, true),
    []
  );

  // STUI allows the shutter and LED controls to run separate commands.
  const {
    isRunning: shutterIsRunning,
    doCmd: doShutterCommand,
  } = useDeviceCommand(sendCommand, onStatusMessage);

  const {
    isRunning: ledIsRunning,
    doCmd: doLEDCommand,
  } = useDeviceCommand(sendCommand, onStatusMessage);

  const shutterLimits = React.useMemo(() => {
    const values = Array.isArray(limitSwitchW?.values)
      ? limitSwitchW.values
      : [];

    return [
      keyVarBoolean(values[0]),
      keyVarBoolean(values[1]),
    ] as const;
  }, [limitSwitchW]);

  const reportedShutterOpen = React.useMemo<boolean | null>(() => {
    const [isOpen, isClosed] = shutterLimits;

    if (isOpen === true && isClosed === false) return true;
    if (isOpen === false && isClosed === true) return false;

    return null;
  }, [shutterLimits]);

  /**
   * STUI keeps the last valid checkbutton state when the limit pair becomes
   * invalid, then marks the control non-current. Preserve that behaviour
   * without using the control as the source of truth.
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

  const shutterSummary = React.useMemo<ShutterSummary>(() => {
    if (!hasColdShutter) {
      return { text: "Open", severity: "normal" };
    }

    const [isOpen, isClosed] = shutterLimits;

    if (isOpen === false && isClosed === false) {
      return { text: "?", severity: "warning" };
    }

    if (isOpen === false && isClosed === true) {
      return { text: "Closed", severity: "normal" };
    }

    if (isOpen === true && isClosed === false) {
      return { text: "Open", severity: "normal" };
    }

    if (isOpen === true && isClosed === true) {
      return { text: "Bad", severity: "error" };
    }

    // This is the exact fallback used by STUI getSummary().
    return { text: "?", severity: "error" };
  }, [hasColdShutter, shutterLimits]);

  const rawLEDMask = ledW?.values?.[0];

  const ledMask = React.useMemo<number | null>(() => {
    if (rawLEDMask == null || rawLEDMask === "") return null;

    const mask = Number(rawLEDMask);
    return Number.isInteger(mask) && mask >= 0 ? mask : null;
  }, [rawLEDMask]);

  /**
   * As in STUI, an unknown LED mask does not erase the last displayed LED
   * states. The controls are simply marked non-current.
   */
  const [lastKnownLEDMask, setLastKnownLEDMask] =
    React.useState<number | null>(null);

  React.useEffect(() => {
    if (ledMask != null) {
      setLastKnownLEDMask(ledMask);
    }
  }, [ledMask]);

  const displayedLEDMask = ledMask ?? lastKnownLEDMask ?? 0;

  const ledStates = React.useMemo(
    () =>
      Array.from(
        { length: NUMBER_OF_LEDS },
        (_, index) =>
          (displayedLEDMask & (1 << index)) !== 0
      ),
    [displayedLEDMask]
  );

  const ledSummary = React.useMemo<ShutterSummary>(() => {
    if (ledMask == null) {
      return { text: "LEDs ?", severity: "warning" };
    }

    if (ledMask === 0) {
      return { text: "LEDs all off", severity: "normal" };
    }

    if (ledMask === ALL_LEDS_ON_MASK) {
      return { text: "LEDs ALL ON", severity: "warning" };
    }

    const enabledLEDs = Array.from(
      { length: NUMBER_OF_LEDS },
      (_, index) =>
        (ledMask & (1 << index)) !== 0
          ? String(index + 1)
          : null
    ).filter((value): value is string => value != null);

    return {
      text: `${
        enabledLEDs.length === 1 ? "LED" : "LEDs"
      } ${enabledLEDs.join(" ")} ON`,
      severity: "warning",
    };
  }, [ledMask]);

  const summary = React.useMemo<{
    text: string;
    severity: Severity;
    isCurrent: boolean;
  }>(() => {
    const indexerOn = keyVarBoolean(indexerW?.values?.[0]);

    if (indexerOn === false) {
      return {
        text: "Off",
        severity: "error",
        isCurrent: indexerW?.isCurrent === true,
      };
    }

    return {
      text: `${shutterSummary.text}; ${ledSummary.text}`,
      severity: combineSeverity(
        shutterSummary.severity,
        ledSummary.severity
      ),

      // STUI deliberately uses shutterIndexer currentness only.
      isCurrent: indexerW?.isCurrent === true,
    };
  }, [indexerW, ledSummary, shutterSummary]);

  const toggleShutter = React.useCallback(() => {
    const opening = displayedShutterOpen !== true;
    const command = opening
      ? "shutter open"
      : "shutter close";
    const verb = opening ? "open" : "close";

    void doShutterCommand(command, {
      running: `${verb} running`,
      success: `${verb} finished`,
      failure: `${verb} failed`,
    });
  }, [displayedShutterOpen, doShutterCommand]);

  const setLEDMask = React.useCallback(
    (mask: number) => {
      void doLEDCommand(`shutter ledControl=${mask}`, {
        running: "LED command running",
        success: "LED command finished",
        failure: "LED command failed",
      });
    },
    [doLEDCommand]
  );

  const toggleLED = React.useCallback(
    (index: number) => {
      setLEDMask(displayedLEDMask ^ (1 << index));
    },
    [displayedLEDMask, setLEDMask]
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

  const ledCheckboxSx = {
    p: 0.2,
    color:
      ledW?.isCurrent === true && ledMask != null
        ? "text.secondary"
        : "text.disabled",
    "&.Mui-checked": {
      color:
        ledW?.isCurrent === true && ledMask != null
          ? "primary.main"
          : "text.disabled",
    },
    "& .MuiSvgIcon-root": {
      fontSize: 18,
    },
  } as const;

  const valueButtonSx = {
    minWidth: 32,
    minHeight: 28,
    px: 0.35,
    py: 0,
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

  const actionButtonSx = {
    minWidth: 32,
    minHeight: 28,
    px: 0.35,
    py: 0,
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
    limitSwitchW?.isCurrent === true &&
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
            slotProps={{ input : {
              "aria-label": "Show shutter controls",
            },
            }}
          />

          <Typography sx={summaryTextSx}>
            Shutter
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
            {hasColdShutter ? (
              <>
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
              </>
            ) : null}

            <Typography
              sx={{
                ...detailTextSx,
                textAlign: "right",
              }}
            >
              LEDs
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                flexWrap: "nowrap",
              }}
            >
              {ledStates.map((isOn, index) => (
                <Checkbox
                  key={index}
                  checked={isOn}
                  disabled={ledIsRunning}
                  onChange={() => toggleLED(index)}
                  sx={ledCheckboxSx}
                  slotProps={{ input: {
                    "aria-label": `LED ${index + 1}`,
                  },
                  }}
                />
              ))}

              <Button
                variant="outlined"
                disabled={ledIsRunning}
                onClick={() => setLEDMask(0)}
                sx={actionButtonSx}
              >
                All Off
              </Button>

              <Button
                variant="outlined"
                disabled={ledIsRunning}
                onClick={() =>
                  setLEDMask(ALL_LEDS_ON_MASK)
                }
                sx={actionButtonSx}
              >
                All On
              </Button>

              <Button
                variant="outlined"
                disabled={ledIsRunning}
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
