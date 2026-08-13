import React from "react";

export type CommandStatusHandler = (message: string) => void;

export interface CommandMessages {
  running?: string;
  success?: string;
  failure?: string;
}

type SendCommand = (command: string) => Promise<unknown>;

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Command failed";
}

/**
 * Tracks one promise-based Tron command at a time.
 *
 * Device state is intentionally not stored here. The KeyVar-style Keyword
 * objects remain authoritative, so a control changes only after its keyword
 * reports the new state.
 */
export function useDeviceCommand(
  sendCommand: SendCommand,
  onStatusMessage?: CommandStatusHandler
) {
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runningRef = React.useRef(false);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const doCmd = React.useCallback(
    async (
      command: string,
      messages: CommandMessages = {}
    ): Promise<boolean> => {
      if (runningRef.current) {
        return false;
      }

      runningRef.current = true;
      setIsRunning(true);
      setError(null);

      if (messages.running) {
        onStatusMessage?.(messages.running);
      }

      try {
        await sendCommand(command);

        if (messages.success) {
          onStatusMessage?.(messages.success);
        }

        return true;
      } catch (caughtError) {
        const message = errorText(caughtError);

        if (mountedRef.current) {
          setError(message);
        }

        onStatusMessage?.(
          messages.failure
            ? `${messages.failure}: ${message}`
            : message
        );

        return false;
      } finally {
        runningRef.current = false;
        if (mountedRef.current) {
          setIsRunning(false);
        }
      }
    },
    [onStatusMessage, sendCommand]
  );

  return {
    isRunning,
    error,
    doCmd,
  };
}
