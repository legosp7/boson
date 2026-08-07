import React from "react";
import { Box, Checkbox, Collapse, Typography } from "@mui/material";
import { useKeywords } from "renderer/hooks";
import type { Severity } from "./LimitParser";

interface TelemetryRow {
  key: string;
  sensor: string;
  current: string;
  threshold: string;
  units: string;
  severity: Severity;
  isCurrent: boolean;
}

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

function boolOrNull(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

function formatSignificant(value: unknown): string {
  const number = finiteNumber(value);
  if (number == null) return "?";
  if (number === 0) return "0.0";
  return number.toPrecision(2);
}

function formatInteger(value: unknown): string {
  const number = finiteNumber(value);
  return number == null ? "?" : number.toFixed(0);
}

function formatTemperature(value: unknown): string {
  const number = finiteNumber(value);
  return number == null ? "?" : number.toFixed(1);
}

function initialExpanded(): boolean {
  try {
    return Boolean(window.electron.store.get("apogee.telemetry.expanded"));
  } catch {
    return false;
  }
}

export default function TelemetryWdgSet() {
  const keywords = useKeywords([
    "apogee.arrayPower",
    "apogee.vacuum",
    "apogee.vacuumAlarm",
    "apogee.vacuumThreshold",
    "apogee.vacuumAlt",
    "apogee.ln2Level",
    "apogee.ln2Alarm",
    "apogee.ln2Threshold",
    "apogee.tempNames",
    "apogee.temps",
    "apogee.tempAlarms",
    "apogee.tempThresholds",
  ]);

  const [expanded, setExpanded] = React.useState(initialExpanded);

  React.useEffect(() => {
    try {
      window.electron.store.set("apogee.telemetry.expanded", expanded);
    } catch {
      // State persistence is optional; rendering must not depend on it.
    }
  }, [expanded]);

  const arrayPowerW = keywords.arrayPower;
  const vacuumW = keywords.vacuum;
  const vacuumAlarmW = keywords.vacuumAlarm;
  const vacuumThresholdW = keywords.vacuumThreshold;
  const vacuumAltW = keywords.vacuumAlt;
  const ln2LevelW = keywords.ln2Level;
  const ln2AlarmW = keywords.ln2Alarm;
  const ln2ThresholdW = keywords.ln2Threshold;
  const tempNamesW = keywords.tempNames;
  const tempsW = keywords.temps;
  const tempAlarmsW = keywords.tempAlarms;
  const tempThresholdsW = keywords.tempThresholds;

  const telemetry = React.useMemo(() => {
    let overallSeverity: Severity = "normal";

    const arrayPower = boolOrNull(arrayPowerW?.values?.[0]);
    const arrayPowerSeverity: Severity =
      arrayPower === false ? "warning" : "normal";
    if (arrayPowerSeverity === "warning") overallSeverity = "warning";

    const vacuumSeverity: Severity =
      vacuumAlarmW?.values?.[0] === true ? "error" : "normal";
    if (vacuumSeverity === "error") overallSeverity = "error";

    const ln2Severity: Severity =
      ln2AlarmW?.values?.[0] === true ? "error" : "normal";
    if (ln2Severity === "error") overallSeverity = "error";

    const rows: TelemetryRow[] = [
      {
        key: "vacuum",
        sensor: "Vacuum",
        current: formatSignificant(vacuumW?.values?.[0]),
        threshold: formatSignificant(vacuumThresholdW?.values?.[0]),
        units: "Torr",
        severity: vacuumSeverity,
        isCurrent:
          vacuumW?.isCurrent === true &&
          vacuumAlarmW?.isCurrent === true &&
          vacuumThresholdW?.isCurrent === true,
      },
      {
        key: "vacuum-alt",
        sensor: "Alt Vacuum",
        current: formatSignificant(vacuumAltW?.values?.[0]),
        threshold: "",
        units: "Torr",
        severity: "normal",
        isCurrent: vacuumAltW?.isCurrent === true,
      },
      {
        key: "ln2",
        sensor: "LN2",
        current: formatInteger(ln2LevelW?.values?.[0]),
        threshold: formatInteger(ln2ThresholdW?.values?.[0]),
        units: "%",
        severity: ln2Severity,
        isCurrent:
          ln2LevelW?.isCurrent === true &&
          ln2AlarmW?.isCurrent === true &&
          ln2ThresholdW?.isCurrent === true,
      },
      {
        key: "array-power",
        sensor: "Array Power",
        current:
          arrayPower == null ? "?" : arrayPower ? "On" : "Off",
        threshold: "",
        units: "",
        severity: arrayPowerSeverity,
        isCurrent: arrayPowerW?.isCurrent === true,
      },
    ];

    const tempNames = Array.isArray(tempNamesW?.values)
      ? tempNamesW.values
      : [];
    const temperatures = Array.isArray(tempsW?.values) ? tempsW.values : [];
    const tempAlarms = Array.isArray(tempAlarmsW?.values)
      ? tempAlarmsW.values
      : [];
    const tempThresholds = Array.isArray(tempThresholdsW?.values)
      ? tempThresholdsW.values
      : [];

    const temperaturesConsistent =
      tempNames.length === temperatures.length &&
      temperatures.length === tempAlarms.length &&
      tempAlarms.length === tempThresholds.length;

    if (!temperaturesConsistent) {
      console.warn("APOGEE temperature data is not self-consistent; cannot display");
      if (overallSeverity === "normal") overallSeverity = "warning";
    } else {
      tempNames.forEach((name, index) => {
        const temperatureKnown = temperatures[index] != null;
        const severity: Severity =
          temperatureKnown && tempAlarms[index] === true ? "error" : "normal";

        if (severity === "error") overallSeverity = "error";

        rows.push({
          key: `temp-${index}-${String(name)}`,
          sensor: String(name ?? "?"),
          current: formatTemperature(temperatures[index]),
          threshold: formatTemperature(tempThresholds[index]),
          units: "K",
          severity,
          isCurrent:
            tempNamesW?.isCurrent === true &&
            tempsW?.isCurrent === true &&
            tempAlarmsW?.isCurrent === true &&
            tempThresholdsW?.isCurrent === true,
        });
      });
    }

    const allCurrent =
      arrayPowerW?.isCurrent === true &&
      vacuumW?.isCurrent === true &&
      vacuumAlarmW?.isCurrent === true &&
      vacuumThresholdW?.isCurrent === true &&
      ln2LevelW?.isCurrent === true &&
      ln2AlarmW?.isCurrent === true &&
      ln2ThresholdW?.isCurrent === true &&
      tempNamesW?.isCurrent === true &&
      tempsW?.isCurrent === true &&
      tempAlarmsW?.isCurrent === true &&
      tempThresholdsW?.isCurrent === true &&
      temperaturesConsistent;

    const summary =
      overallSeverity === "error"
        ? "Bad"
        : overallSeverity === "warning"
          ? "Warning"
          : "OK";

    return { rows, summary, overallSeverity, allCurrent };
  }, [
    arrayPowerW,
    vacuumW,
    vacuumAlarmW,
    vacuumThresholdW,
    vacuumAltW,
    ln2LevelW,
    ln2AlarmW,
    ln2ThresholdW,
    tempNamesW,
    tempsW,
    tempAlarmsW,
    tempThresholdsW,
  ]);

  const textSx = { fontSize: 14, lineHeight: 1.2 } as const;
  const checkboxSx = {
    p: 0,
    "& .MuiSvgIcon-root": { fontSize: 18 },
  } as const;

  return (
    <Box>
      <Box
        sx={{
          minHeight: 24,
          display: "grid",
          gridTemplateColumns: "20px max-content minmax(0, 1fr)",
          columnGap: 0.35,
          alignItems: "center",
        }}
      >
        <Checkbox
          size="small"
          checked={expanded}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setExpanded(event.target.checked)
          }
          sx={checkboxSx}
          inputProps={{ "aria-label": "Show telemetry details" }}
        />
        <Typography sx={textSx}>Telemetry</Typography>
        <Typography
          sx={{
            ...textSx,
            ml: 0.5,
            color: telemetry.allCurrent
              ? severityColor(telemetry.overallSeverity)
              : "text.disabled",
          }}
        >
          {telemetry.summary}
        </Typography>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box
          sx={{
            ml: 2.5,
            mt: 0.25,
            p: 0.5,
            border: "1px solid",
            borderColor: "divider",
            width: "fit-content",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "80px 58px 58px max-content",
              columnGap: 0.5,
              rowGap: 0.15,
              alignItems: "center",
            }}
          >
            <Typography sx={{ ...textSx, textAlign: "right", fontWeight: 600 }}>
              Sensor
            </Typography>
            <Typography sx={{ ...textSx, textAlign: "right", fontWeight: 600 }}>
              Curr
            </Typography>
            <Typography sx={{ ...textSx, textAlign: "right", fontWeight: 600 }}>
              Thresh
            </Typography>
            <Box />

            {telemetry.rows.map((row) => (
              <React.Fragment key={row.key}>
                <Typography
                  sx={{
                    ...textSx,
                    textAlign: "right",
                    color: row.isCurrent
                      ? severityColor(row.severity)
                      : "text.disabled",
                  }}
                >
                  {row.sensor}
                </Typography>
                <Typography
                  sx={{
                    ...textSx,
                    textAlign: "right",
                    color: row.isCurrent
                      ? severityColor(row.severity)
                      : "text.disabled",
                  }}
                >
                  {row.current}
                </Typography>
                <Typography
                  sx={{
                    ...textSx,
                    textAlign: "right",
                    color: row.isCurrent
                      ? severityColor(row.severity)
                      : "text.disabled",
                  }}
                >
                  {row.threshold}
                </Typography>
                <Typography
                  sx={{
                    ...textSx,
                    color: row.isCurrent ? "text.primary" : "text.disabled",
                  }}
                >
                  {row.units}
                </Typography>
              </React.Fragment>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
