import { Encoder, Profile } from "@garmin/fitsdk";
import type { FileIdMesg, SessionMesg } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";
import { formatFromFilename, parseActivityFile } from "@/features/endurance/domain/parsers";
import { InvalidActivityFileError, UnsupportedFormatError } from "@/features/endurance/domain/parsers/errors";

function buildFitBytes(): Buffer {
  const encoder = new Encoder();
  const fileId: FileIdMesg = { type: "activity", manufacturer: "development", product: 1, timeCreated: new Date("2026-08-10T08:00:00Z") };
  const session: SessionMesg = {
    timestamp: new Date("2026-08-10T08:30:00Z"),
    startTime: new Date("2026-08-10T08:00:00Z"),
    sport: "running",
    totalElapsedTime: 1800,
    totalTimerTime: 1800,
    totalDistance: 5000,
    avgHeartRate: 150,
    maxHeartRate: 175
  };
  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  encoder.onMesg(Profile.MesgNum.SESSION, session);
  return Buffer.from(encoder.close());
}

const VALID_TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-08-10T08:00:00Z</Id>
      <Lap StartTime="2026-08-10T08:00:00Z">
        <TotalTimeSeconds>1800</TotalTimeSeconds>
        <DistanceMeters>5000</DistanceMeters>
        <AverageHeartRateBpm><Value>150</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>175</Value></MaximumHeartRateBpm>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <type>running</type>
    <trkseg>
      <trkpt lat="40.0000" lon="-3.0000">
        <ele>600</ele>
        <time>2026-08-10T08:00:00Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr><gpxtpx:cad>80</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>
      </trkpt>
      <trkpt lat="40.0010" lon="-3.0000">
        <ele>610</ele>
        <time>2026-08-10T08:05:00Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr><gpxtpx:cad>82</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>
      </trkpt>
      <trkpt lat="40.0020" lon="-3.0000">
        <ele>605</ele>
        <time>2026-08-10T08:10:00Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>160</gpxtpx:hr><gpxtpx:cad>84</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("formatFromFilename", () => {
  it("accepts fit/tcx/gpx and rejects anything else", () => {
    expect(formatFromFilename("activity.FIT")).toBe("fit");
    expect(formatFromFilename("activity.tcx")).toBe("tcx");
    expect(formatFromFilename("activity.gpx")).toBe("gpx");
    expect(() => formatFromFilename("activity.csv")).toThrow(UnsupportedFormatError);
    expect(() => formatFromFilename("noextension")).toThrow(UnsupportedFormatError);
  });
});

describe("FIT parser (official Garmin SDK round-trip)", () => {
  it("reads only the fields the session message actually carries", () => {
    const parsed = parseActivityFile("fit", buildFitBytes());
    expect(parsed.sport).toBe("running");
    expect(parsed.startedAt).toBe("2026-08-10T08:00:00.000Z");
    expect(parsed.durationS).toBe(1800);
    expect(parsed.distanceM).toBe(5000);
    expect(parsed.metrics).toContainEqual({ metricType: "avg_heart_rate", value: 150, unit: "bpm" });
    expect(parsed.metrics).toContainEqual({ metricType: "max_heart_rate", value: 175, unit: "bpm" });
    // Never invents a metric the file doesn't carry.
    expect(parsed.metrics.some((metric) => metric.metricType === "avg_power")).toBe(false);
  });

  it("rejects bytes without a valid FIT header", () => {
    expect(() => parseActivityFile("fit", Buffer.from("not a fit file"))).toThrow(InvalidActivityFileError);
  });
});

describe("TCX parser", () => {
  it("aggregates laps into a single parsed activity", () => {
    const parsed = parseActivityFile("tcx", Buffer.from(VALID_TCX, "utf-8"));
    expect(parsed.sport).toBe("running");
    expect(parsed.durationS).toBe(1800);
    expect(parsed.distanceM).toBe(5000);
    expect(parsed.metrics).toContainEqual({ metricType: "avg_heart_rate", value: 150, unit: "bpm" });
    expect(parsed.metrics).toContainEqual({ metricType: "max_heart_rate", value: 175, unit: "bpm" });
  });

  it("rejects a TCX with no Activity", () => {
    const empty = `<TrainingCenterDatabase><Activities></Activities></TrainingCenterDatabase>`;
    expect(() => parseActivityFile("tcx", Buffer.from(empty, "utf-8"))).toThrow(InvalidActivityFileError);
  });
});

describe("GPX parser", () => {
  it("derives duration, distance, elevation gain and HR/cadence from trackpoints, never from GPS position directly", () => {
    const parsed = parseActivityFile("gpx", Buffer.from(VALID_GPX, "utf-8"));
    expect(parsed.sport).toBe("running");
    expect(parsed.durationS).toBe(600);
    expect(parsed.distanceM).toBeGreaterThan(0);
    expect(parsed.metrics).toContainEqual({ metricType: "elevation_gain_m", value: 10, unit: "m" });
    expect(parsed.metrics.find((metric) => metric.metricType === "avg_heart_rate")?.value).toBe(150);
    expect(parsed.metrics.find((metric) => metric.metricType === "avg_cadence")?.value).toBe(82);
  });

  it("rejects a GPX with fewer than two timed points", () => {
    const oneOnly = `<gpx><trk><trkseg><trkpt lat="1" lon="1"><time>2026-08-10T08:00:00Z</time></trkpt></trkseg></trk></gpx>`;
    expect(() => parseActivityFile("gpx", Buffer.from(oneOnly, "utf-8"))).toThrow(InvalidActivityFileError);
  });

  it("rejects (never executes) a DOCTYPE/external-entity payload — no XXE surface", () => {
    const maliciousDoctype = `<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><gpx><trk><trkseg><trkpt lat="1" lon="1"><time>2026-08-10T08:00:00Z</time></trkpt><trkpt lat="1" lon="1"><time>2026-08-10T08:01:00Z</time></trkpt></trkseg></trk></gpx>`;
    expect(() => parseActivityFile("gpx", Buffer.from(maliciousDoctype, "utf-8"))).toThrow(InvalidActivityFileError);
  });
});
