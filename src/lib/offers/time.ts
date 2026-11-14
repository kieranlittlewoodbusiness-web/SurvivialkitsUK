import type { IsoDate, LondonIsoDateTime } from './types';

const LONDON = 'Europe/London';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const offsetFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  timeZoneName: 'longOffset',
});

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDate(input: Date | string | number): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid date: ${String(input)}`);
  return d;
}

function londonParts(input: Date | string | number) {
  const d = toDate(input);
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(d)) map[p.type] = p.value;
  return {
    year: map.year!,
    month: map.month!,
    day: map.day!,
    hour: map.hour!,
    minute: map.minute!,
    second: map.second!,
  };
}

/** Europe/London UTC offset at an instant, as "+00:00" or "+01:00". */
export function londonOffset(input: Date | string | number): string {
  const name = offsetFormatter
    .formatToParts(toDate(input))
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(name);
  if (!m) return '+00:00';
  return `${m[1]}${m[2]!.padStart(2, '0')}:${m[3] ?? '00'}`;
}

/** ISO 8601 in Europe/London local time with explicit offset. */
export function toLondonIso(input: Date | string | number): LondonIsoDateTime {
  const p = londonParts(input);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${londonOffset(input)}`;
}

/** Europe/London calendar date ("capture window" key). */
export function londonDateKey(input: Date | string | number): IsoDate {
  const p = londonParts(input);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "14 November 2026, 23:17" in Europe/London time. */
export function formatLondonDateTime(input: Date | string | number): string {
  const p = londonParts(input);
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** Adds whole 24h days and returns a Europe/London ISO string. */
export function addDaysLondon(input: Date | string | number, days: number): LondonIsoDateTime {
  return toLondonIso(toDate(input).getTime() + days * 86_400_000);
}

/** True when the string has an explicit offset that matches Europe/London at that instant. */
export function isLondonIso(value: string): boolean {
  const m = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return false;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return false;
  return m[1] === londonOffset(t);
}
