export type Severity = "normal" | "warning" | "error";

export function limitParser(values: Array<boolean | null | undefined>): {
  limStrList: string[];
  severity: Severity;
} {
  const limStrDict = new Map<boolean, string>([
    [true, "1"],
    [false, "0"],
  ]);

  const limStrList = values.map((val) => {
    if (val === true || val === false) {
      return limStrDict.get(val)!;
    }
    return "?";
  });

  let severity: Severity = "normal";

  const allZero = limStrList.every((val) => val === "0");
  if (!allZero) {
    const numActuators = Math.floor(values.length / 2);
    const hasBothLimits = Array.from({ length: numActuators }).some((_, ind) => {
      return values[ind * 2] === true && values[ind * 2 + 1] === true;
    });

    severity = hasBothLimits ? "error" : "warning";
  }

  return { limStrList, severity };
}