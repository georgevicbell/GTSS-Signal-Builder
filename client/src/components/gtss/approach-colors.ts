// Approach colors, shared by every surface that draws or names an approach —
// the signal-details map, the main signals map, the approaches table, the bulk
// approach modal, and the approach pickers on the detector forms — so one
// approach reads as the same color everywhere.
//
// Kept in its own module (rather than in signals-map) so consumers that only
// need the palette don't pull Leaflet into their bundle.

/** Approach polyline / swatch colors, assigned by index. */
export const approachColors = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#f97316", // blue, green, red, orange
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#eab308", // violet, pink, teal, yellow
  "#6366f1",
  "#84cc16",
  "#f43f5e",
  "#06b6d4", // indigo, lime, rose, cyan
  "#a855f7",
  "#10b981",
  "#f59e0b",
  "#64748b", // purple, emerald, amber, slate
];

/**
 * Color for one approach of a signal.
 *
 * Index is the approach's position in the signal's own list, counting every
 * approach — including any without a bearing, which draw no line. Callers must
 * pass the unfiltered list or the colors drift out of step with the map.
 */
export const approachColorFor = (
  signalApproaches: { approachId: string; compassBearing: number | null }[],
  approachId: string,
): string | undefined => {
  const idx = signalApproaches.findIndex((a) => a.approachId === approachId);
  return idx >= 0 ? approachColors[idx % approachColors.length] : undefined;
};
