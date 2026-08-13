import type { ParsedActivity, ParsedActivityMetric } from "@/contracts/endurance";
import { InvalidActivityFileError } from "./errors";
import { parseXml, toArray } from "./xml-utils";

type GpxTrackpoint = {
  ["@_lat"]?: number;
  ["@_lon"]?: number;
  ele?: number;
  time?: string;
  extensions?: { TrackPointExtension?: { hr?: number; cad?: number } };
};
type GpxTrack = { type?: string; trkseg?: { trkpt?: GpxTrackpoint | GpxTrackpoint[] } | Array<{ trkpt?: GpxTrackpoint | GpxTrackpoint[] }> };
type GpxRoot = { gpx?: { trk?: GpxTrack | GpxTrack[] } };

const EARTH_RADIUS_M = 6371000;
function haversineMeters(a: GpxTrackpoint, b: GpxTrackpoint): number {
  if (a["@_lat"] == null || a["@_lon"] == null || b["@_lat"] == null || b["@_lon"] == null) return 0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b["@_lat"] - a["@_lat"]);
  const dLon = toRad(b["@_lon"] - a["@_lon"]);
  const lat1 = toRad(a["@_lat"]);
  const lat2 = toRad(b["@_lat"]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Isolated GPX parser. GPX carries no lap summary, only raw trackpoints, so
 * duration/distance/elevation gain are derived here (documented derivation,
 * never confirmed by the device the way a FIT/TCX summary is) from
 * consecutive <trkpt> — distance via haversine, elevation gain from positive
 * <ele> deltas only. HR/cadence come from the optional Garmin TrackPointExtension
 * when present; absent otherwise, never invented. Raw lat/lon are read only to
 * compute distance and are never persisted (GPS minimized per FUNCTIONAL-SPECIFICATION.md).
 */
export function parseGpxActivity(xml: string): ParsedActivity {
  let root: GpxRoot;
  try {
    root = parseXml(xml) as GpxRoot;
  } catch {
    throw new InvalidActivityFileError("El archivo GPX no es un XML válido.");
  }

  const track = toArray(root.gpx?.trk)[0];
  if (!track) throw new InvalidActivityFileError("El archivo GPX no contiene ninguna traza (trk).");

  const segments = toArray(track.trkseg);
  const points = segments.flatMap((segment) => toArray(segment.trkpt)).filter((point) => point.time);
  if (points.length < 2) throw new InvalidActivityFileError("El archivo GPX no contiene suficientes puntos con hora para calcular duración o distancia.");

  const first = points[0];
  const last = points[points.length - 1];
  const durationS = Math.max(0, Math.round((new Date(last.time!).getTime() - new Date(first.time!).getTime()) / 1000));

  let distanceM = 0;
  let elevationGainM = 0;
  let hrSum = 0, hrCount = 0, maxHr: number | undefined;
  let cadSum = 0, cadCount = 0;
  for (let i = 1; i < points.length; i += 1) {
    distanceM += haversineMeters(points[i - 1], points[i]);
    if (points[i - 1].ele != null && points[i].ele != null) {
      const delta = points[i].ele! - points[i - 1].ele!;
      if (delta > 0) elevationGainM += delta;
    }
  }
  for (const point of points) {
    const hr = point.extensions?.TrackPointExtension?.hr;
    if (hr != null) { hrSum += hr; hrCount += 1; maxHr = maxHr == null ? hr : Math.max(maxHr, hr); }
    const cad = point.extensions?.TrackPointExtension?.cad;
    if (cad != null) { cadSum += cad; cadCount += 1; }
  }

  const metrics: ParsedActivityMetric[] = [];
  if (hrCount > 0) metrics.push({ metricType: "avg_heart_rate", value: Math.round(hrSum / hrCount), unit: "bpm" });
  if (maxHr != null) metrics.push({ metricType: "max_heart_rate", value: maxHr, unit: "bpm" });
  if (cadCount > 0) metrics.push({ metricType: "avg_cadence", value: Math.round(cadSum / cadCount), unit: "spm" });
  if (elevationGainM > 0) metrics.push({ metricType: "elevation_gain_m", value: Math.round(elevationGainM), unit: "m" });
  if (distanceM > 0 && durationS > 0) metrics.push({ metricType: "avg_pace_sec_per_km", value: Math.round((durationS / distanceM) * 1000), unit: "s/km" });

  const typeRaw = track.type?.toLowerCase();
  const sport = typeRaw?.includes("bik") || typeRaw?.includes("cycl") ? "cycling" : typeRaw?.includes("walk") || typeRaw?.includes("hik") ? "walking" : typeRaw?.includes("run") ? "running" : "other";

  return {
    sport,
    startedAt: new Date(first.time!).toISOString(),
    durationS,
    distanceM: distanceM > 0 ? Math.round(distanceM) : null,
    metrics
  };
}
