import { Decoder, Stream } from "@garmin/fitsdk";
import type { EnduranceSport, ParsedActivity, ParsedActivityMetric } from "@/contracts/endurance";
import { InvalidActivityFileError } from "./errors";

const SPORT_MAP: Record<string, EnduranceSport> = {
  running: "running", trail_running: "running", track_running: "running", treadmill_running: "running",
  cycling: "cycling", mountain_biking: "cycling", road_biking: "cycling", indoor_cycling: "cycling", gravel_cycling: "cycling",
  walking: "walking", hiking: "walking", casual_walking: "walking"
};

function toSport(raw: unknown): EnduranceSport {
  if (typeof raw === "string" && raw in SPORT_MAP) return SPORT_MAP[raw];
  return "other";
}

/** Isolated FIT parser using the official Garmin FIT JavaScript SDK. Only reads the summary session_mesg the device already computed — never recomputes averages from raw records, and never fabricates a metric the message doesn't carry. */
export function parseFitActivity(bytes: Buffer): ParsedActivity {
  const stream = Stream.fromBuffer(bytes);
  if (!Decoder.isFIT(stream)) throw new InvalidActivityFileError("El archivo no tiene una cabecera FIT válida.");

  const decoder = new Decoder(stream);
  if (!decoder.checkIntegrity()) throw new InvalidActivityFileError("El archivo FIT no pasó la verificación de integridad (CRC).");

  let messages: ReturnType<Decoder["read"]>["messages"];
  try {
    ({ messages } = decoder.read());
  } catch {
    throw new InvalidActivityFileError("No se pudo leer el contenido del archivo FIT.");
  }

  const session = messages.sessionMesgs?.[0];
  if (!session || !session.startTime) throw new InvalidActivityFileError("El archivo FIT no contiene una sesión de actividad interpretable.");

  const metrics: ParsedActivityMetric[] = [];
  if (session.avgHeartRate != null) metrics.push({ metricType: "avg_heart_rate", value: session.avgHeartRate, unit: "bpm" });
  if (session.maxHeartRate != null) metrics.push({ metricType: "max_heart_rate", value: session.maxHeartRate, unit: "bpm" });
  if (session.avgCadence != null) metrics.push({ metricType: "avg_cadence", value: session.avgCadence, unit: "spm" });
  if (session.avgPower != null) metrics.push({ metricType: "avg_power", value: session.avgPower, unit: "w" });
  if (session.totalAscent != null) metrics.push({ metricType: "elevation_gain_m", value: session.totalAscent, unit: "m" });
  if (session.avgSpeed != null && session.avgSpeed > 0) metrics.push({ metricType: "avg_pace_sec_per_km", value: Math.round(1000 / session.avgSpeed), unit: "s/km" });

  const startTime = session.startTime instanceof Date ? session.startTime : new Date(session.startTime as unknown as string);

  return {
    sport: toSport(session.sport),
    startedAt: startTime.toISOString(),
    durationS: session.totalElapsedTime != null ? Math.round(session.totalElapsedTime) : null,
    distanceM: session.totalDistance ?? null,
    metrics
  };
}
