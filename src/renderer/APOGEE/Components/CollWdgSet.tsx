import React from "react";
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useKeywords } from "renderer/hooks";
import {
  limitParser,
  type Severity,
} from "./LimitParser";
import {
  useDeviceCommand,
  type CommandStatusHandler,
} from "./useDeviceCommand";

interface CollWdgSetProps {
  onStatusMessage?: CommandStatusHandler;
}

interface CollItemProps {
  name: "Piston" | "Pitch" | "Yaw";
  value: unknown;
  isCurrent: boolean;
  onStatusMessage?: CommandStatusHandler;
}

const SUMMARY_LABEL_WIDTH = 120;

function severityColor(
  severity: Severity
): "text.primary" | "warning.main" | "error.main" {
  if (severity === "error") return "error.main";
  if (severity === "warning") return "warning.main";
  return "text.primary";
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
      normalised === "yes"
    ) {
      return true;
    }

    if (
      normalised === "0" ||
      normalised === "false" ||
      normalised === "off" ||
      normalised === "no"
    ) {
      return false;
    }
  }

  return null;
}

function finiteNumber(value: unknown): number | null {
  if (
    value == null ||
    (typeof value === "string" &&
      value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function initialExpanded(): boolean {
  try {
    return Boolean(
      window.electron.store.get(
        "apogee.collimator.expanded"
      )
    );
  } catch {
    return false;
  }
}

function CollItem({
  name,
  value,
  isCurrent,
  onStatusMessage,
}: CollItemProps) {
  const isPiston = name === "Piston";
  const commandVerb = name.toLowerCase();

  const increments = isPiston
    ? ["10", "25", "50", "100"]
    : ["0.1", "0.25", "0.5", "0.75", "1", "2"];

  const units = isPiston ? "μm" : "pix";
  const decimalPlaces = isPiston ? 0 : 2;

  // These are the exact defaults from the STUI CollItemWdg.
  const [increment, setIncrement] = React.useState(
    isPiston ? "25" : "0.75"
  );

  const sendCommand = React.useCallback(
    (command: string) =>
      window.electron.tron.send(
        `apogee ${command}`,
        true
      ),
    []
  );

  const {
    isRunning,
    doCmd,
  } = useDeviceCommand(
    sendCommand,
    onStatusMessage
  );

  const move = React.useCallback(
    (sign: -1 | 1) => {
      const magnitude = Number(increment);

      if (!Number.isFinite(magnitude)) return;

      const delta = sign * magnitude;

      void doCmd(
        `coll ${commandVerb}=${delta}`,
        {
          running: `${commandVerb} move running`,
          success: `${commandVerb} move finished`,
          failure: `${commandVerb} move failed`,
        }
      );
    },
    [commandVerb, doCmd, increment]
  );

  const numericValue = finiteNumber(value);

  const displayedValue =
    numericValue == null
      ? "?"
      : numericValue.toFixed(decimalPlaces);

  const textSx = {
    fontSize: 13,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  } as const;

  const buttonSx = {
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
    ...buttonSx,
    minWidth: 34,
  } as const;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns:
          "62px 66px 30px 32px 32px 94px 34px",
        columnGap: 0.5,
        alignItems: "center",
      }}
    >
      <Typography
        sx={{
          ...textSx,
          textAlign: "right",
        }}
      >
        {name}
      </Typography>

      <Typography
        sx={{
          ...textSx,
          textAlign: "right",
          color: isCurrent
            ? "text.primary"
            : "text.disabled",
        }}
      >
        {displayedValue}
      </Typography>

      <Typography sx={textSx}>
        {units}
      </Typography>

      <Button
        variant="outlined"
        disabled={isRunning}
        onClick={() => move(-1)}
        sx={buttonSx}
      >
        −
      </Button>

      <Button
        variant="outlined"
        disabled={isRunning}
        onClick={() => move(1)}
        sx={buttonSx}
      >
        +
      </Button>

      <Select
        value={increment}
        disabled={isRunning}
        onChange={(
          event: SelectChangeEvent<string>
        ) => setIncrement(String(event.target.value))}
        sx={{
          minWidth: 94,
          height: 28,
          borderRadius: 0,
          fontSize: 13,
          "& .MuiSelect-select": {
            py: 0.25,
            px: 0.55,
          },
        }}
      >
        {increments.map((item) => (
          <MenuItem
            key={item}
            value={item}
            sx={{ fontSize: 13 }}
          >
            {item} {units}
          </MenuItem>
        ))}
      </Select>

      <Button
        variant="outlined"
        disabled
        title="The current Electron Tron API does not expose in-flight command abort."
        sx={cancelButtonSx}
      >
        X
      </Button>
    </Box>
  );
}

export default function CollWdgSet({
  onStatusMessage,
}: CollWdgSetProps) {
  const keywords = useKeywords([
    "apogee.collOrient",
    "apogee.collIndexer",
    "apogee.collLimitSwitch",
  ]);

  const [expanded, setExpanded] =
    React.useState(initialExpanded);

  React.useEffect(() => {
    try {
      window.electron.store.set(
        "apogee.collimator.expanded",
        expanded
      );
    } catch {
      // Persisting the expansion state is optional.
    }
  }, [expanded]);

  const orientW = keywords.collOrient;
  const indexerW = keywords.collIndexer;
  const limitSwitchW = keywords.collLimitSwitch;

  const orientValues = Array.isArray(
    orientW?.values
  )
    ? orientW.values
    : [];

  const summary = React.useMemo<{
    text: string;
    severity: Severity;
    isCurrent: boolean;
  }>(() => {
    const isCurrent =
      indexerW?.isCurrent === true;

    const indexerOn = keyVarBoolean(
      indexerW?.values?.[0]
    );

    if (indexerOn === false) {
      return {
        text: "Off",
        severity: "error",
        isCurrent,
      };
    }

    const rawLimits = Array.isArray(
      limitSwitchW?.values
    )
      ? limitSwitchW.values
      : [];

    // collLimitSwitch has three forward/reverse pairs.
    const normalisedLimits = Array.from(
      { length: 6 },
      (_, index) =>
        keyVarBoolean(rawLimits[index])
    );

    const parsed = limitParser(
      normalisedLimits
    );

    return {
      text:
        parsed.severity === "normal"
          ? "OK"
          : `Limits ${parsed.limStrList.join(" ")}`,
      severity: parsed.severity,

      // STUI deliberately uses collIndexer currentness only.
      isCurrent,
    };
  }, [indexerW, limitSwitchW]);

  const summaryTextSx = {
    fontSize: 14,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  } as const;

  const summaryCheckboxSx = {
    p: 0,
    "& .MuiSvgIcon-root": {
      fontSize: 20,
    },
  } as const;

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
            inputProps={{
              "aria-label":
                "Show collimator controls",
            }}
          />

          <Typography sx={summaryTextSx}>
            Collimator
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

      <Collapse in={expanded} unmountOnExit>
        <Box
          sx={{
            mt: 0.25,
            px: 0.75,
            py: 0.45,
            border: "1px solid",
            borderColor: "text.primary",
            width: "fit-content",
            maxWidth: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 0.35,
          }}
        >
          <CollItem
            name="Piston"
            value={orientValues[0]}
            isCurrent={
              orientW?.isCurrent === true
            }
            onStatusMessage={onStatusMessage}
          />

          <CollItem
            name="Pitch"
            value={orientValues[1]}
            isCurrent={
              orientW?.isCurrent === true
            }
            onStatusMessage={onStatusMessage}
          />

          <CollItem
            name="Yaw"
            value={orientValues[2]}
            isCurrent={
              orientW?.isCurrent === true
            }
            onStatusMessage={onStatusMessage}
          />
        </Box>
      </Collapse>
    </Box>
  );
}
