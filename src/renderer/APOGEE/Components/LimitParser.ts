export type Severity = "normal" | "warning" | "error";

export interface LimitSummary {
  limStrList: string[];
  severity: Severity;
}

/**
 * Parses forward/reverse limit-switch pairs 
 *
 * - normal: every switch is false
 * - error: both switches are true for at least one actuator
 * - warning: any other non-normal or unknown combination
 */
export function limitParser(
  values: Array<boolean | null | undefined>
): LimitSummary {
  const limStrList = values.map((value) => {
    if (value === true) return "1";
    if (value === false) return "0";
    return "?";
  });

  if (limStrList.every((value) => value === "0")) {
    return { limStrList, severity: "normal" };
  }

  const actuatorCount = Math.floor(values.length / 2);
  const hasConflictingPair = Array.from(
    { length: actuatorCount },
    (_, index) =>
      values[index * 2] === true && values[index * 2 + 1] === true
  ).some(Boolean);

  return {
    limStrList,
    severity: hasConflictingPair ? "error" : "warning",
  };
}
