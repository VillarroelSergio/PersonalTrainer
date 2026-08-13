/** Right extension, but the file is corrupt/unparseable/empty. Distinct from UnsupportedFormatError so the UI can show the two different prototype paths (import.js: drawUnsupported vs drawInvalid). */
export class InvalidActivityFileError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor(message: string) { super(message); }
}

/** Extension/MIME not one of .fit/.tcx/.gpx. */
export class UnsupportedFormatError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor(format: string) { super(`".${format}" no es un formato admitido. Se admiten .FIT, .TCX y .GPX.`); }
}

export class FileTooLargeError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor(maxBytes: number) { super(`El archivo supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB.`); }
}

/** MIME type present but not one this format's export tools plausibly produce. */
export class UnsupportedMimeTypeError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor(mimeType: string) { super(`El tipo de archivo "${mimeType}" no coincide con el formato esperado.`); }
}
