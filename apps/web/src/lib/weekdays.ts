export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo"
};

export const WEEKDAY_ABBREV: Record<Weekday, string> = {
  monday: "L", tuesday: "M", wednesday: "X", thursday: "J", friday: "V", saturday: "S", sunday: "D"
};

/** JS getDay(): 0 = Sunday. Converted to our Monday-first WEEKDAYS index. */
export function todayWeekday(date: Date = new Date()): Weekday {
  const jsDay = date.getDay();
  return WEEKDAYS[(jsDay + 6) % 7];
}

/** Parses a yyyy-mm-dd string as local midnight, never as UTC (`new Date("yyyy-mm-dd")` parses as UTC, which shifts the weekday in negative-UTC-offset timezones). */
export function parseIsoDateLocal(isoDateString: string): Date {
  const [year, month, day] = isoDateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** yyyy-mm-dd for the given date, local time (no UTC shift). */
export function isoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Monday of the ISO week containing `date`, as yyyy-mm-dd. Identity anchor for weekly adjustments. */
export function isoWeekStart(date: Date = new Date()): string {
  const jsDay = date.getDay();
  const mondayOffset = (jsDay + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
  return isoDate(monday);
}

/** The two days adjacent to `day` in the week, wrapping around (Sunday <-> Monday). */
export function neighborWeekdays(day: Weekday): Weekday[] {
  const index = WEEKDAYS.indexOf(day);
  return [WEEKDAYS[(index + 6) % 7], WEEKDAYS[(index + 1) % 7]];
}
