import type { EnduranceSport, ParsedActivity, ParsedActivityMetric } from "@/contracts/endurance";
import { InvalidActivityFileError } from "./errors";
import { parseXml, toArray } from "./xml-utils";

type TcxLap = {
  ["@_StartTime"]?: string;
  TotalTimeSeconds?: number;
  DistanceMeters?: number;
  AverageHeartRateBpm?: { Value?: number };
  MaximumHeartRateBpm?: { Value?: number };
  Cadence?: number;
};
type TcxActivity = { ["@_Sport"]?: string; Lap?: TcxLap | TcxLap[] };
type TcxRoot = { TrainingCenterDatabase?: { Activities?: { Activity?: TcxActivity | TcxActivity[] } } };

const SPORT_MAP: Record<string, EnduranceSport> = { running: "running", biking: "cycling", other: "other" };

/** Isolated TCX parser. Aggregates laps: sums time/distance, weighted-averages heart rate by lap duration, takes the max across laps. Never reads <Track>/<Trackpoint> position data — GPS is minimized per FUNCTIONAL-SPECIFICATION.md, only the lap summaries the file already computed are used. */
export function parseTcxActivity(xml: string): ParsedActivity {
  let root: TcxRoot;
  try {
    root = parseXml(xml) as TcxRoot;
  } catch {
    throw new InvalidActivityFileError("El archivo TCX no es un XML válido.");
  }

  const activity = toArray(root.TrainingCenterDatabase?.Activities?.Activity)[0];
  if (!activity) throw new InvalidActivityFileError("El archivo TCX no contiene ninguna actividad.");

  const laps = toArray(activity.Lap);
  if (laps.length === 0) throw new InvalidActivityFileError("El archivo TCX no contiene ningún tramo (Lap) interpretable.");

  const startedAt = laps[0]["@_StartTime"];
  if (!startedAt) throw new InvalidActivityFileError("El archivo TCX no indica una hora de inicio.");

  let totalTimeS = 0;
  let totalDistanceM = 0;
  let hrWeightedSum = 0;
  let hrWeightTotal = 0;
  let maxHr: number | undefined;
  let cadenceSum = 0;
  let cadenceCount = 0;

  for (const lap of laps) {
    const time = Number(lap.TotalTimeSeconds ?? 0);
    totalTimeS += time;
    totalDistanceM += Number(lap.DistanceMeters ?? 0);
    const avgHr = lap.AverageHeartRateBpm?.Value;
    if (avgHr != null && time > 0) { hrWeightedSum += avgHr * time; hrWeightTotal += time; }
    const lapMaxHr = lap.MaximumHeartRateBpm?.Value;
    if (lapMaxHr != null) maxHr = maxHr == null ? lapMaxHr : Math.max(maxHr, lapMaxHr);
    if (lap.Cadence != null) { cadenceSum += lap.Cadence; cadenceCount += 1; }
  }

  const metrics: ParsedActivityMetric[] = [];
  if (hrWeightTotal > 0) metrics.push({ metricType: "avg_heart_rate", value: Math.round(hrWeightedSum / hrWeightTotal), unit: "bpm" });
  if (maxHr != null) metrics.push({ metricType: "max_heart_rate", value: maxHr, unit: "bpm" });
  if (cadenceCount > 0) metrics.push({ metricType: "avg_cadence", value: Math.round(cadenceSum / cadenceCount), unit: "spm" });
  if (totalDistanceM > 0 && totalTimeS > 0) metrics.push({ metricType: "avg_pace_sec_per_km", value: Math.round((totalTimeS / totalDistanceM) * 1000), unit: "s/km" });

  const sportRaw = activity["@_Sport"]?.toLowerCase();
  return {
    sport: sportRaw && sportRaw in SPORT_MAP ? SPORT_MAP[sportRaw] : "other",
    startedAt: new Date(startedAt).toISOString(),
    durationS: totalTimeS > 0 ? Math.round(totalTimeS) : null,
    distanceM: totalDistanceM > 0 ? totalDistanceM : null,
    metrics
  };
}
