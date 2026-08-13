import React from "react";

type SendResult = {
  abort?: () => void;
} | void;

type SendCommand = (command: string) => Promise<SendResult> | SendResult;

export function useDeviceCommand(sendCommand: SendCommand) {
  const [isRunning, setIsRunning] = React.useState(false);
  const updatingStatusRef = React.useRef(false);
  const abortRef = React.useRef<(() => void) | null>(null);

  const updatingStatus = React.useCallback(() => {
    return updatingStatusRef.current;
  }, []);

  const withUpdateLock = React.useCallback((fn: () => void) => {
    updatingStatusRef.current = true;
    try {
      fn();
    } finally {
      updatingStatusRef.current = false;
    }
  }, []);

  const doCmd = React.useCallback(
    async (cmdStr: string) => {
      if (updatingStatusRef.current) return;
      if (isRunning) {
        throw new Error("A command is already running");
      }

      setIsRunning(true);
      abortRef.current = null;

      try {
        const result = await sendCommand(cmdStr);
        if (result && typeof result === "object" && "abort" in result && typeof result.abort === "function") {
          abortRef.current = result.abort;
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
      }
    },
    [isRunning, sendCommand]
  );

  const doCancel = React.useCallback(() => {
    if (abortRef.current) {
      abortRef.current(); //figure out opscore
    }
  }, []);

  return {
    isRunning,
    doCmd,
    doCancel,
    updatingStatus,
    withUpdateLock,
  };
}