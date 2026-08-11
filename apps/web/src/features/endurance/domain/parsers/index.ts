import type { ParsedActivity } from "@/contracts/endurance";
import { UnsupportedFormatError, UnsupportedMimeTypeError } from "./errors";
import { parseFitActivity } from "./fit";
import { parseTcxActivity } from "./tcx";
import { parseGpxActivity } from "./gpx";

export { InvalidActivityFileError, UnsupportedFormatError, FileTooLargeError, UnsupportedMimeTypeError } from "./errors";

export type SupportedFormat = "fit" | "tcx" | "gpx";
const SUPPORTED_FORMATS = ["fit", "tcx", "gpx"];

export function formatFromFilename(filename: string): SupportedFormat {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_FORMATS.includes(extension)) throw new UnsupportedFormatError(extension || "sin extensión");
  return extension as SupportedFormat;
}

/**
 * Generic/empty MIME is accepted for every format because watch exports
 * (Garmin, Wahoo, ...) very commonly send "application/octet-stream" or omit
 * the type entirely — the browser/OS often doesn't know a specific type for
 * these formats. A MIME that's clearly for something else (e.g. image/png,
 * application/pdf) is rejected. The file extension (formatFromFilename) and
 * the content parser remain mandatory regardless of what this check allows.
 */
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);
const FORMAT_MIME_TYPES: Record<SupportedFormat, Set<string>> = {
  fit: new Set(["application/vnd.ant.fit", "application/fit"]),
  tcx: new Set(["application/xml", "text/xml", "application/vnd.garmin.tcx+xml"]),
  gpx: new Set(["application/gpx+xml", "application/xml", "text/xml"])
};

export function validateMimeType(format: SupportedFormat, mimeType: string): void {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (GENERIC_MIME_TYPES.has(normalized) || FORMAT_MIME_TYPES[format].has(normalized)) return;
  throw new UnsupportedMimeTypeError(mimeType);
}

/** Single dispatch point: each format's parser stays isolated in its own module (never sharing mutable state), matching "Parser aislado" from the master prompt. */
export function parseActivityFile(format: SupportedFormat, bytes: Buffer): ParsedActivity {
  if (format === "fit") return parseFitActivity(bytes);
  const text = bytes.toString("utf-8");
  if (format === "tcx") return parseTcxActivity(text);
  return parseGpxActivity(text);
}
