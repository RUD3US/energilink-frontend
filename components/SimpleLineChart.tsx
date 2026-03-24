import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";

export type ChartPoint = { time: string; value: number };
export type ChartNote = { id: number; time: string; text?: string };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function fmtTick(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPickerTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function nearestIndexByTime(times: number[], target: number) {
  let lo = 0;
  let hi = times.length - 1;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (times[mid] < target) lo = mid + 1;
    else hi = mid;
  }

  const i = lo;
  if (i === 0) return 0;
  const prev = i - 1;
  return Math.abs(times[i] - target) < Math.abs(times[prev] - target) ? i : prev;
}

function getEventRect(evt: any): any | null {
  const candidates = [
    evt?.currentTarget,
    evt?.nativeEvent?.currentTarget,
    evt?.target,
    evt?.nativeEvent?.target,
  ];

  for (const c of candidates) {
    if (c && typeof c.getBoundingClientRect === "function") {
      return c.getBoundingClientRect();
    }
  }

  return null;
}

function buildTicksForWindow(tMinMs: number, tMaxMs: number) {
  const span = tMaxMs - tMinMs;

  let step = 30 * 60 * 1000;

  const approxTicks = Math.floor(span / step) + 1;
  if (approxTicks > 10) step = 60 * 60 * 1000;
  if (Math.floor(span / step) + 1 > 10) step = 2 * 60 * 60 * 1000;

  const start = Math.ceil(tMinMs / step) * step;
  const ticks: number[] = [];

  for (let t = start; t <= tMaxMs; t += step) {
    ticks.push(t);
  }

  return ticks;
}

function getSvgPressProps(handler?: () => void) {
  if (!handler) return {};
  return Platform.OS === "web"
    ? ({ onClick: handler } as any)
    : ({ onPress: handler } as any);
}

function buildSelectableIndices(length: number, maxMarkers: number) {
  if (length <= 0) return [];
  if (length === 1) return [0];
  if (maxMarkers <= 1) return [length - 1];

  if (length <= maxMarkers) {
    return Array.from({ length }, (_, i) => i);
  }

  const used = new Set<number>();
  const result: number[] = [];

  for (let i = 0; i < maxMarkers; i++) {
    const idx = Math.round((i * (length - 1)) / (maxMarkers - 1));
    if (!used.has(idx)) {
      used.add(idx);
      result.push(idx);
    }
  }

  if (result.length < maxMarkers) {
    for (let i = 0; i < length && result.length < maxMarkers; i++) {
      if (!used.has(i)) {
        used.add(i);
        result.push(i);
      }
    }
  }

  result.sort((a, b) => a - b);
  return result;
}

export function SimpleLineChart({
  points,
  notes = [],
  height = 360,
  unit = "V",
  decimals = 2,
  selectedNoteId = null,
  selectedPointTime = null,
  onSelectNoteId,
  onSelectPoint,
  onSelectedPointInvalid,
  hoursBeforeLatest = 3,
  hoursAfterLatest = 2,
  numberedPointSelection = false,
  maxNumberedPoints = 12,
  showPointChooser = false,
}: {
  points: ChartPoint[];
  notes?: ChartNote[];
  height?: number;
  unit?: string;
  decimals?: number;
  selectedNoteId?: number | null;
  selectedPointTime?: string | null;
  onSelectNoteId?: (noteId: number) => void;
  onSelectPoint?: (point: ChartPoint) => void;
  onSelectedPointInvalid?: () => void;
  hoursBeforeLatest?: number;
  hoursAfterLatest?: number;
  numberedPointSelection?: boolean;
  maxNumberedPoints?: number;
  showPointChooser?: boolean;
}) {
  const [svgWidth, setSvgWidth] = useState(700);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const pendingIdx = useRef<number | null>(null);

  const padL = 56;
  const padR = 16;
  const padT = 14;
  const padB = 64;

  const sorted = useMemo(() => {
    const copy = [...points];
    copy.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return copy;
  }, [points]);

  const latestTimeMs = useMemo(() => {
    if (!sorted.length) return 0;
    return new Date(sorted[sorted.length - 1].time).getTime();
  }, [sorted]);

  const tMin = useMemo(() => {
    if (!latestTimeMs) return 0;
    return latestTimeMs - hoursBeforeLatest * 60 * 60 * 1000;
  }, [latestTimeMs, hoursBeforeLatest]);

  const tMax = useMemo(() => {
    if (!latestTimeMs) return 1;
    return latestTimeMs + hoursAfterLatest * 60 * 60 * 1000;
  }, [latestTimeMs, hoursAfterLatest]);

  const visiblePoints = useMemo(() => {
    if (!sorted.length) return [];
    return sorted.filter((p) => {
      const t = new Date(p.time).getTime();
      return t >= tMin && t <= tMax;
    });
  }, [sorted, tMin, tMax]);

  const timesMs = useMemo(
    () => visiblePoints.map((p) => new Date(p.time).getTime()),
    [visiblePoints]
  );

  const ys = useMemo(() => visiblePoints.map((p) => p.value), [visiblePoints]);

  const minYRaw = ys.length ? Math.min(...ys) : 0;
  const maxYRaw = ys.length ? Math.max(...ys) : 1;

  const yPadding = Math.max((maxYRaw - minYRaw) * 0.15, 0.5);
  const minY = minYRaw - yPadding;
  const maxY = maxYRaw + yPadding;
  const spanY = Math.max(1e-9, maxY - minY);
  const spanT = Math.max(1, tMax - tMin);

  const xScaleT = (tMs: number) =>
    padL + ((tMs - tMin) * (svgWidth - padL - padR)) / spanT;

  const yScale = (v: number) =>
    padT + (maxY - v) * ((height - padT - padB) / spanY);

  const poly = useMemo(() => {
    if (!visiblePoints.length) return "";
    return visiblePoints
      .map((p, i) => `${xScaleT(timesMs[i]).toFixed(1)},${yScale(p.value).toFixed(1)}`)
      .join(" ");
  }, [visiblePoints, timesMs, svgWidth, height, minY, maxY, tMin, tMax]);

  const notePositions = useMemo(() => {
    if (!notes.length) return [];

    return notes
      .filter((n) => {
        const t = new Date(n.time).getTime();
        return t >= tMin && t <= tMax;
      })
      .map((n) => ({
        id: n.id,
        time: n.time,
        x: clamp(xScaleT(new Date(n.time).getTime()), padL, svgWidth - padR),
      }));
  }, [notes, tMin, tMax, svgWidth]);

  const ticksMs = useMemo(() => buildTicksForWindow(tMin, tMax), [tMin, tMax]);

  const showSelectablePoints = !!onSelectPoint || !!selectedPointTime;

  const visibleSelectedPointIndex = useMemo(() => {
    if (!selectedPointTime) return -1;
    return visiblePoints.findIndex((p) => p.time === selectedPointTime);
  }, [visiblePoints, selectedPointTime]);

  useEffect(() => {
    if (!selectedPointTime) return;
    if (visibleSelectedPointIndex >= 0) return;
    onSelectedPointInvalid?.();
  }, [selectedPointTime, visibleSelectedPointIndex, onSelectedPointInvalid]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const selectableIndices = useMemo(() => {
    if (!showSelectablePoints) return [];
    if (!visiblePoints.length) return [];

    let indices = numberedPointSelection
      ? buildSelectableIndices(visiblePoints.length, maxNumberedPoints)
      : visiblePoints.map((_, i) => i);

    if (
      visibleSelectedPointIndex >= 0 &&
      !indices.includes(visibleSelectedPointIndex)
    ) {
      indices = [...indices, visibleSelectedPointIndex].sort((a, b) => a - b);
    }

    return indices;
  }, [
    showSelectablePoints,
    visiblePoints,
    numberedPointSelection,
    maxNumberedPoints,
    visibleSelectedPointIndex,
  ]);

  const selectablePoints = selectableIndices.map((pointIndex, pickerIndex) => {
    const point = visiblePoints[pointIndex];
    const tMs = timesMs[pointIndex];
    const x = xScaleT(tMs);
    const y = yScale(point.value);

    return {
      pickerNumber: pickerIndex + 1,
      pointIndex,
      point,
      x,
      y,
      isSelected: selectedPointTime === point.time,
    };
  });

  function commitHover(i: number | null) {
    pendingIdx.current = i;

    if (typeof requestAnimationFrame !== "function") {
      setHoverIdx(i);
      return;
    }

    if (rafRef.current != null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setHoverIdx(pendingIdx.current);
    });
  }

  function onWebMouseMove(evt: any) {
    if (Platform.OS !== "web" || !visiblePoints.length) return;

    const rect = getEventRect(evt);
    if (!rect) return;

    const clientX = evt?.clientX ?? evt?.nativeEvent?.clientX;
    const clientY = evt?.clientY ?? evt?.nativeEvent?.clientY;

    if (typeof clientX !== "number" || typeof clientY !== "number") return;

    const x = ((clientX - rect.left) / rect.width) * svgWidth;
    const y = ((clientY - rect.top) / rect.height) * height;

    if (x < padL || x > svgWidth - padR || y < padT || y > height - padB) {
      commitHover(null);
      return;
    }

    const frac = (x - padL) / (svgWidth - padL - padR);
    const tHover = tMin + clamp(frac, 0, 1) * spanT;

    if (!timesMs.length) {
      commitHover(null);
      return;
    }

    commitHover(nearestIndexByTime(timesMs, tHover));
  }

  function onWebMouseLeave() {
    if (Platform.OS !== "web") return;
    commitHover(null);
  }

  function handleChartLayout(evt: LayoutChangeEvent) {
    const w = evt.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - svgWidth) > 1) {
      setSvgWidth(w);
    }
  }

  if (!visiblePoints.length) {
    return (
      <View
        style={{
          height,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          borderRadius: 12,
          backgroundColor: "#fff",
        }}
      />
    );
  }

  const idx = hoverIdx ?? visiblePoints.length - 1;
  const hp = visiblePoints[idx];
  const hx = xScaleT(timesMs[idx]);
  const hy = yScale(hp.value);

  const tipW = clamp(svgWidth * 0.34, 160, 260);
  const tipH = 52;
  const tipX = Math.min(svgWidth - tipW - 8, Math.max(8, hx + 10));
  const tipY = Math.max(8, hy - tipH - 8);

  const svgProps =
    Platform.OS === "web"
      ? ({
          onMouseMove: onWebMouseMove,
          onMouseLeave: onWebMouseLeave,
          style: { cursor: "crosshair" },
        } as any)
      : {};

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 12,
        padding: 10,
        backgroundColor: "#fff",
        width: "100%",
      }}
    >
      <View onLayout={handleChartLayout} style={{ width: "100%" }}>
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
          {...svgProps}
        >
          <Line
            x1={padL}
            y1={padT}
            x2={padL}
            y2={height - padB}
            stroke="#999"
            strokeWidth={1.5}
            pointerEvents="none"
          />
          <Line
            x1={padL}
            y1={height - padB}
            x2={svgWidth - padR}
            y2={height - padB}
            stroke="#999"
            strokeWidth={1.5}
            pointerEvents="none"
          />

          {ticksMs.map((t) => {
            const x = xScaleT(t);
            const iso = new Date(t).toISOString();

            return (
              <React.Fragment key={t}>
                <Line
                  x1={x}
                  y1={padT}
                  x2={x}
                  y2={height - padB}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  pointerEvents="none"
                />
                <Line
                  x1={x}
                  y1={height - padB}
                  x2={x}
                  y2={height - padB + 5}
                  stroke="#999"
                  pointerEvents="none"
                />
                <SvgText
                  x={x}
                  y={height - 10}
                  fontSize="10"
                  fill="#444"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {fmtTick(iso)}
                </SvgText>
              </React.Fragment>
            );
          })}

          <SvgText
            x={padL}
            y={padT + 10}
            fontSize="11"
            fill="#444"
            textAnchor="start"
            pointerEvents="none"
          >
            {unit}
          </SvgText>

          <Polyline
            points={poly}
            fill="none"
            stroke="#111"
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            pointerEvents="none"
          />

          {notePositions.map((n) => {
            const isSelected = selectedNoteId === n.id;
            const noteHitProps = getSvgPressProps(() => onSelectNoteId?.(n.id));

            return (
              <React.Fragment key={n.id}>
                <Line
                  x1={n.x}
                  y1={padT}
                  x2={n.x}
                  y2={height - padB}
                  stroke="#000"
                  opacity={0.001}
                  strokeWidth={18}
                  pointerEvents="stroke"
                  {...noteHitProps}
                />

                <Line
                  x1={n.x}
                  y1={padT}
                  x2={n.x}
                  y2={height - padB}
                  stroke="#d97706"
                  strokeWidth={isSelected ? 4 : 2}
                  opacity={1}
                  pointerEvents="none"
                />

                {isSelected ? (
                  <SvgText
                    x={n.x}
                    y={height - 32}
                    fontSize="10"
                    fill="#b45309"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {fmtTick(n.time)}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}

          {showSelectablePoints
            ? selectablePoints.map((sp) => {
                const pointPressProps = getSvgPressProps(() => onSelectPoint?.(sp.point));

                if (numberedPointSelection) {
                  return (
                    <React.Fragment key={`${sp.point.time}-${sp.pickerNumber}`}>
                      <Circle
                        cx={sp.x}
                        cy={sp.y}
                        r={14}
                        fill="#000"
                        opacity={0.001}
                        {...pointPressProps}
                      />
                      <Circle
                        cx={sp.x}
                        cy={sp.y}
                        r={sp.isSelected ? 11 : 9}
                        fill={sp.isSelected ? "#dc2626" : "#111"}
                        stroke="#fff"
                        strokeWidth={1.5}
                        pointerEvents="none"
                      />
                      <SvgText
                        x={sp.x}
                        y={sp.y + 4}
                        fontSize={sp.pickerNumber >= 10 ? "8" : "10"}
                        fill="#fff"
                        fontWeight="700"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {String(sp.pickerNumber)}
                      </SvgText>
                    </React.Fragment>
                  );
                }

                if (Platform.OS === "web") {
                  return (
                    <React.Fragment key={`${sp.point.time}-${sp.pointIndex}`}>
                      <Circle
                        cx={sp.x}
                        cy={sp.y}
                        r={12}
                        fill="#000"
                        opacity={0.001}
                        {...pointPressProps}
                      />
                      <Circle
                        cx={sp.x}
                        cy={sp.y}
                        r={sp.isSelected ? 6 : 4}
                        fill={sp.isSelected ? "#dc2626" : "#111"}
                        pointerEvents="none"
                      />
                    </React.Fragment>
                  );
                }

                return (
                  <Circle
                    key={`${sp.point.time}-${sp.pointIndex}`}
                    cx={sp.x}
                    cy={sp.y}
                    r={sp.isSelected ? 6 : 4}
                    fill={sp.isSelected ? "#dc2626" : "#111"}
                    {...pointPressProps}
                  />
                );
              })
            : null}

          <Line
            x1={hx}
            y1={padT}
            x2={hx}
            y2={height - padB}
            stroke="#666"
            strokeWidth={2}
            pointerEvents="none"
          />
          <Line
            x1={padL}
            y1={hy}
            x2={svgWidth - padR}
            y2={hy}
            stroke="#666"
            strokeWidth={2}
            pointerEvents="none"
          />
          <Circle cx={hx} cy={hy} r={6} fill="#111" pointerEvents="none" />

          <Rect
            x={tipX}
            y={tipY}
            width={tipW}
            height={tipH}
            rx={8}
            ry={8}
            fill="#111"
            opacity={0.94}
            pointerEvents="none"
          />
          <SvgText x={tipX + 10} y={tipY + 20} fontSize="11" fill="#fff" pointerEvents="none">
            {fmtTime(hp.time)}
          </SvgText>
          <SvgText x={tipX + 10} y={tipY + 40} fontSize="11" fill="#fff" pointerEvents="none">
            value: {hp.value.toFixed(decimals)} {unit}
          </SvgText>
        </Svg>
      </View>

      {showPointChooser && numberedPointSelection && selectablePoints.length ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          <Text style={{ fontSize: 12, color: "#555" }}>
            Quick timestamp picker: tap the same number here or on the graph.
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {selectablePoints.map((sp) => (
              <Pressable
                key={`picker-${sp.point.time}-${sp.pickerNumber}`}
                onPress={() => onSelectPoint?.(sp.point)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: sp.isSelected ? "#dc2626" : "#ddd",
                  backgroundColor: sp.isSelected ? "#fee2e2" : "#fff",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View
                  style={{
                    minWidth: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: sp.isSelected ? "#dc2626" : "#111",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>
                    {sp.pickerNumber}
                  </Text>
                </View>

                <Text style={{ color: "#111", fontSize: 12 }}>
                  {fmtPickerTime(sp.point.time)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
