import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useKeywords } from "renderer/hooks";
import type { Severity } from "./LimitParser";
import {
  useDeviceCommand,
  type CommandStatusHandler,
} from "./useDeviceCommand";

interface FPIShutterWdgProps {
  onStatusMessage?: CommandStatusHandler;
}

function severityColor(
  severity: Severity
): "text.primary" | "warning.main" | "error.main" {
  if (severity === "error") return "error.main";
  if (severity === "warning") return "warning.main";
  return "text.primary";
}

export default function FPIShutterWdg({
  onStatusMessage,
}: FPIShutterWdgProps) {
  const keywords = useKeywords(["apogeefpi.shutter_position"]);
  const shutterW = keywords.shutter_position;

  const sendCommand = React.useCallback(
    (command: string) =>
      window.electron.tron.send(`apogeefpi ${command}`, true),
    []
  );
  const command = useDeviceCommand(sendCommand, onStatusMessage);

  const state = React.useMemo<{
    text: string;
    isOpen: boolean | null;
    severity: Severity;
    isCurrent: boolean;
  }>(() => {
    const isCurrent = shutterW?.isCurrent === true;
    const position = String(shutterW?.values?.[0] ?? "?").toLowerCase();

    if (!isCurrent || position === "?") {
      return {
        text: "?",
        isOpen: null,
        severity: "warning",
        isCurrent: false,
      };
    }

    if (position === "open") {
      return {
        text: "Open",
        isOpen: true,
        severity: "normal",
        isCurrent: true,
      };
    }

    if (position === "closed") {
      return {
        text: "Closed",
        isOpen: false,
        severity: "normal",
        isCurrent: true,
      };
    }

    return {
      text: "?",
      isOpen: null,
      severity: "warning",
      isCurrent: false,
    };
  }, [shutterW]);

  const toggle = React.useCallback(() => {
    const opening = state.isOpen !== true;
    const verb = opening ? "open" : "close";

    void command.doCmd(verb, {
      running: `${verb} running`,
      success: `${verb} finished`,
      failure: `${verb} failed`,
    });
  }, [command, state.isOpen]);

  const textSx = {
    fontSize: 14,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  } as const;

  return (
    <Box
      sx={{
        minHeight: 25,
        display: "grid",
        gridTemplateColumns: "80px max-content minmax(0, 1fr)",
        columnGap: 0.5,
        alignItems: "center",
      }}
    >
      <Typography sx={{ ...textSx, textAlign: "right" }}>
        FPI Shutter
      </Typography>
      <Button
        size="small"
        variant="outlined"
        disabled={command.isRunning}
        onClick={toggle}
        sx={{
          minWidth: 54,
          minHeight: 24,
          px: 0.6,
          py: 0,
          borderRadius: 0,
          borderColor: "divider",
          color: state.isCurrent
            ? severityColor(state.severity)
            : "text.disabled",
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.1,
          textTransform: "none",
          bgcolor: "background.paper",
          "&:hover": { bgcolor: "action.hover", borderColor: "text.secondary" },
        }}
      >
        {state.text}
      </Button>
    </Box>
  );
}
