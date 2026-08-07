import React from "react";
import {
  Box,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useKeywords } from "renderer/hooks";

export interface ExposeWdgHandle {
  getDitherCmd: () => string | null;
  getExposureCmd: () => string;
}

interface ExposeWdgProps {
  /** Equivalent to the Python showDither() behavior for script reuse. */
  showDither?: boolean;
}

type DitherChoice = "A" | "B" | "Any";

interface TrackedDefault<T> {
  value: T;
  setFromUser: (value: T) => void;
  setDefault: (value: T) => void;
  valueRef: React.MutableRefObject<T>;
  defaultRef: React.MutableRefObject<T>;
  dirtyRef: React.MutableRefObject<boolean>;
  isDirty: boolean;
}

function useTrackedDefault<T>(initialValue: T): TrackedDefault<T> {
  const [value, setValue] = React.useState(initialValue);
  const [isDirty, setIsDirty] = React.useState(false);
  const valueRef = React.useRef(initialValue);
  const defaultRef = React.useRef(initialValue);
  const dirtyRef = React.useRef(false);

  const setFromUser = React.useCallback((newValue: T) => {
    valueRef.current = newValue;
    setValue(newValue);

    const dirty = !Object.is(newValue, defaultRef.current);
    dirtyRef.current = dirty;
    setIsDirty(dirty);
  }, []);

  const setDefault = React.useCallback((newDefault: T) => {
    const shouldFollowDefault =
      !dirtyRef.current || Object.is(valueRef.current, defaultRef.current);

    defaultRef.current = newDefault;

    if (shouldFollowDefault) {
      valueRef.current = newDefault;
      dirtyRef.current = false;
      setValue(newDefault);
      setIsDirty(false);
    } else {
      const dirty = !Object.is(valueRef.current, newDefault);
      dirtyRef.current = dirty;
      setIsDirty(dirty);
    }
  }, []);

  return {
    value,
    setFromUser,
    setDefault,
    valueRef,
    defaultRef,
    dirtyRef,
    isDirty,
  };
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

function commandQuote(value: string): string {
  return JSON.stringify(value);
}

const ExposeWdg = React.forwardRef<ExposeWdgHandle, ExposeWdgProps>(
  function ExposeWdg({ showDither = true }, ref) {
    const keywords = useKeywords([
      "apogee.ditherPosition",
      "apogee.ditherLimits",
      "apogee.ditherNamedPositions",
      "apogee.exposureTypeList",
      "apogee.exposureState",
      "apogee.utrReadTime",
    ]);

    const ditherPositionW = keywords.ditherPosition;
    const ditherLimitsW = keywords.ditherLimits;
    const ditherNamedPositionsW = keywords.ditherNamedPositions;
    const exposureTypeListW = keywords.exposureTypeList;
    const exposureStateW = keywords.exposureState;
    const utrReadTimeW = keywords.utrReadTime;

    const ditherChoice = useTrackedDefault<DitherChoice>("A");
    const ditherPosition = useTrackedDefault("");
    const exposureType = useTrackedDefault("Object");
    const numberOfReads = useTrackedDefault("60");
    const [comment, setComment] = React.useState("");

    const ditherRange = React.useMemo(() => {
      const minimum = finiteNumber(ditherLimitsW?.values?.[0]);
      const maximum = finiteNumber(ditherLimitsW?.values?.[1]);

      if (minimum == null || maximum == null) return null;
      return { minimum, maximum };
    }, [ditherLimitsW]);

    const namedPositions = React.useMemo(() => {
      const a = finiteNumber(ditherNamedPositionsW?.values?.[0]);
      const b = finiteNumber(ditherNamedPositionsW?.values?.[1]);

      return {
        A: a == null ? "A" : `A\u00a0\u00a0${a.toFixed(1)} pixels`,
        B: b == null ? "B" : `B\u00a0\u00a0${b.toFixed(1)} pixels`,
        Any: "Any",
      } satisfies Record<DitherChoice, string>;
    }, [ditherNamedPositionsW]);

    const exposureTypes = React.useMemo(() => {
      const values = exposureTypeListW?.values;
      if (!Array.isArray(values) || values[0] == null) {
        return ["Object", "Dark"];
      }

      return values.filter((value) => value != null).map(String);
    }, [exposureTypeListW]);

    // ditherPosition supplies the tracked defaults for both the named menu and
    // the numeric Any-position entry.
    React.useEffect(() => {
      const values = ditherPositionW?.values;
      if (!Array.isArray(values)) return;

      const defaultPosition = finiteNumber(values[0]);
      if (defaultPosition != null) {
        ditherPosition.setDefault(String(defaultPosition));
      }

      const reportedName = String(values[1] ?? "?");
      ditherChoice.setDefault(
        reportedName === "A" || reportedName === "B" ? reportedName : "Any"
      );
    }, [ditherPositionW?.timestamp, ditherPositionW]);

    // exposureState supplies the defaults, but user-edited values are kept in
    // the same way as RO widgets with trackDefault=True.
    React.useEffect(() => {
      const values = exposureStateW?.values;
      if (!Array.isArray(values) || values[0] == null) return;

      if (values[1] != null) {
        const reportedType = String(values[1]);
        const matchedType = exposureTypes.find(
          (item) => item.toLowerCase() === reportedType.toLowerCase()
        );
        if (matchedType) exposureType.setDefault(matchedType);
      }

      const reportedReads = finiteNumber(values[2]);
      if (reportedReads != null) {
        numberOfReads.setDefault(String(Math.trunc(reportedReads)));
      }
    }, [exposureStateW?.timestamp, exposureStateW, exposureTypes]);

    const currentExposureTypes = React.useMemo(() => {
      return exposureTypes.includes(exposureType.value)
        ? exposureTypes
        : [...exposureTypes, exposureType.value];
    }, [exposureType.value, exposureTypes]);

    const numericDitherPosition = finiteNumber(ditherPosition.value);
    const ditherPositionError =
      ditherChoice.value === "Any" &&
      (numericDitherPosition == null ||
        (ditherRange != null &&
          (numericDitherPosition < ditherRange.minimum ||
            numericDitherPosition > ditherRange.maximum)));

    const reads = finiteNumber(numberOfReads.value);
    const readsError = reads == null || !Number.isInteger(reads) || reads < 1;
    const timePerRead = finiteNumber(utrReadTimeW?.values?.[0]);
    const estimatedTime = readsError
      ? ""
      : timePerRead == null
        ? "? sec"
        : `${Math.round(reads * timePerRead)} sec`;

    React.useImperativeHandle(
      ref,
      () => ({
        getDitherCmd() {
          const choice = ditherChoice.valueRef.current;

          if (choice === "A" || choice === "B") {
            if (choice === ditherChoice.defaultRef.current) return null;
            return `dither namedpos=${choice}`;
          }

          const position = finiteNumber(ditherPosition.valueRef.current);
          if (position == null) return null;

          if (
            ditherRange != null &&
            (position < ditherRange.minimum || position > ditherRange.maximum)
          ) {
            return null;
          }

          const defaultPosition = finiteNumber(ditherPosition.defaultRef.current);
          if (defaultPosition != null && position === defaultPosition) {
            return null;
          }

          return `dither pixelpos=${position.toFixed(2)}`;
        },

        getExposureCmd() {
          const requestedReads = finiteNumber(numberOfReads.valueRef.current);
          if (
            requestedReads == null ||
            !Number.isInteger(requestedReads) ||
            requestedReads < 1
          ) {
            throw new Error("Must specify number of reads");
          }

          let command = `expose nreads=${requestedReads}; object=${exposureType.valueRef.current}`;
          const trimmedComment = comment.trim();
          if (trimmedComment) {
            command += `; comment=${commandQuote(trimmedComment)}`;
          }

          return command;
        },
      }),
      [comment, ditherRange]
    );

    const textSx = {
      fontSize: 14,
      lineHeight: 1.2,
      whiteSpace: "nowrap",
    } as const;
    const labelSx = { ...textSx, textAlign: "right" } as const;
    const inputSx = {
      "& .MuiInputBase-root": {
        height: 26,
        borderRadius: 0,
        fontSize: 14,
      },
      "& .MuiInputBase-input": {
        py: 0.15,
        px: 0.6,
      },
    } as const;
    const selectSx = {
      height: 26,
      borderRadius: 1,
      fontSize: 14,
      "& .MuiSelect-select": {
        py: 0.15,
        px: 0.7,
      },
    } as const;

    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "80px minmax(0, 1fr)",
          columnGap: 0.5,
          rowGap: 0.4,
          alignItems: "center",
        }}
      >
        {showDither ? (
          <>
            <Typography sx={labelSx}>Dither</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
              <Select
                size="small"
                value={ditherChoice.value}
                onChange={(event: SelectChangeEvent<DitherChoice>) =>
                  ditherChoice.setFromUser(event.target.value as DitherChoice)
                }
                sx={{
                  ...selectSx,
                  width: 106,
                  color:
                    ditherChoice.isDirty || ditherPositionW?.isCurrent === true
                      ? "text.primary"
                      : "text.disabled",
                }}
              >
                {(Object.keys(namedPositions) as DitherChoice[]).map((choice) => (
                  <MenuItem key={choice} value={choice} sx={{ fontSize: 14 }}>
                    {namedPositions[choice]}
                  </MenuItem>
                ))}
              </Select>

              {ditherChoice.value === "Any" ? (
                <>
                  <TextField
                    size="small"
                    value={ditherPosition.value}
                    error={ditherPositionError}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      ditherPosition.setFromUser(event.target.value)
                    }
                    title={
                      ditherRange == null
                        ? "Desired dither position in pixels"
                        : `Allowed range: ${ditherRange.minimum} to ${ditherRange.maximum} pixels`
                    }
                    sx={{
                      ...inputSx,
                      width: 54,
                      opacity:
                        ditherPosition.isDirty ||
                        ditherPositionW?.isCurrent === true
                          ? 1
                          : 0.55,
                    }}
                    inputProps={{ inputMode: "decimal" }}
                  />
                  <Typography sx={textSx}>pixels</Typography>
                </>
              ) : null}
            </Box>
          </>
        ) : null}

        <Typography sx={labelSx}>Exp Type</Typography>
        <Select
          size="small"
          value={exposureType.value}
          onChange={(event: SelectChangeEvent<string>) =>
            exposureType.setFromUser(String(event.target.value))
          }
          sx={{
            ...selectSx,
            width: 106,
            color:
              exposureType.isDirty || exposureStateW?.isCurrent === true
                ? "text.primary"
                : "text.disabled",
          }}
        >
          {currentExposureTypes.map((item) => (
            <MenuItem key={item} value={item} sx={{ fontSize: 14 }}>
              {item}
            </MenuItem>
          ))}
        </Select>

        <Typography sx={labelSx}>Num Reads</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <TextField
            size="small"
            value={numberOfReads.value}
            error={readsError}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              numberOfReads.setFromUser(event.target.value)
            }
            sx={{
              ...inputSx,
              width: 44,
              opacity:
                numberOfReads.isDirty || exposureStateW?.isCurrent === true
                  ? 1
                  : 0.55,
            }}
            inputProps={{ inputMode: "numeric", style: { textAlign: "right" } }}
          />
          <Typography
            sx={{
              ...textSx,
              color:
                utrReadTimeW?.isCurrent === true
                  ? "text.primary"
                  : "text.disabled",
            }}
          >
            {estimatedTime}
          </Typography>
        </Box>

        <Typography sx={labelSx}>Comment</Typography>
        <TextField
          size="small"
          value={comment}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setComment(event.target.value)
          }
          sx={{ ...inputSx, width: "100%" }}
        />
      </Box>
    );
  }
);

export default ExposeWdg;
