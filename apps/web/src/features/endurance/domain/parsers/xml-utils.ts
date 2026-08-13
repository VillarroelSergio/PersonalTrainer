import { XMLParser } from "fast-xml-parser";
import { InvalidActivityFileError } from "./errors";

const DOCTYPE_OR_ENTITY = /<!\s*(DOCTYPE|ENTITY)\b/i;

/**
 * fast-xml-parser is a non-validating parser: it has no DOCTYPE/ENTITY
 * support at all, so there is no billion-laughs/XXE surface it would resolve.
 * We still reject any DOCTYPE/ENTITY declaration explicitly and before
 * parsing (rather than relying on that incidental non-support), so the
 * contract holds even if the parser dependency changes later.
 * removeNSPrefix flattens vendor namespace prefixes (gpxtpx:, ns3:, ...) so
 * TCX/GPX extensions read consistently regardless of which watch exported them.
 */
export function parseXml(xml: string): unknown {
  if (DOCTYPE_OR_ENTITY.test(xml)) throw new InvalidActivityFileError("El archivo XML incluye una declaración DOCTYPE/ENTITY, no admitida.");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, parseTagValue: true, parseAttributeValue: true });
  return parser.parse(xml);
}

export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
