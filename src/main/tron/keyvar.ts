export type KeyVar<T = unknown> = {
    actor: string;
    name: string;
    values: T[];
    isCurrent: boolean;
    isGenuine: boolean;
    timestamp: number;
    reply?: unknown;
  };
  
  type RawKeywordLike = {
    actor?: unknown;
    name?: unknown;
    keyword?: unknown;
    values?: unknown;
    valueList?: unknown;
    isCurrent?: unknown;
    _isCurrent?: unknown;
    isGenuine?: unknown;
    _isGenuine?: unknown;
    timestamp?: unknown;
    _timeStamp?: unknown;
    reply?: unknown;
  };
  
  export function normalizeKeyword(
    raw: RawKeywordLike | null | undefined,
    fallbackActor = "",
    fallbackName = ""
  ): KeyVar {
    const rawValues = Array.isArray(raw?.values)
      ? raw!.values
      : Array.isArray(raw?.valueList)
      ? raw!.valueList
      : [];
  
    const rawTimestamp =
      typeof raw?.timestamp === "number"
        ? raw.timestamp
        : typeof raw?._timeStamp === "number"
        ? raw._timeStamp
        : Date.now();
  
    return {
      actor: typeof raw?.actor === "string" ? raw.actor : fallbackActor,
      name:
        typeof raw?.name === "string"
          ? raw.name
          : typeof raw?.keyword === "string"
          ? raw.keyword
          : fallbackName,
      values: rawValues,
      isCurrent:
        typeof raw?.isCurrent === "boolean"
          ? raw.isCurrent
          : typeof raw?._isCurrent === "boolean"
          ? raw._isCurrent
          : true,
      isGenuine:
        typeof raw?.isGenuine === "boolean"
          ? raw.isGenuine
          : typeof raw?._isGenuine === "boolean"
          ? raw._isGenuine
          : true,
      timestamp: rawTimestamp,
      reply: raw?.reply,
    };
  }