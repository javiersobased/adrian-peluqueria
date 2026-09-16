/** Safely extract an uppercase initial from a possibly-undefined string. */
export function safeInitial(value: string | null | undefined): string {
  return value && typeof value === 'string' && value.length > 0
    ? value.charAt(0).toUpperCase()
    : '?';
}

/** Safely capitalize the first letter of a string. */
export function safeCap(s: string | null | undefined): string {
  return s && typeof s === 'string' && s.length > 0
    ? s.charAt(0).toUpperCase() + s.slice(1)
    : '';
}

/** Build a Google Calendar "add event" URL. */
export function googleCalendarUrl(opts: {
  title: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM (24h)
  durationMin?: number;
  location?: string;
  details?: string;
}): string {
  const start = new Date(`${opts.date}T${opts.time}:00`);
  const end = new Date(start.getTime() + (opts.durationMin ?? 30) * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    ctz: 'Europe/Madrid',
  });
  if (opts.location) params.set('location', opts.location);
  if (opts.details) params.set('details', opts.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Build an .ics file content string and trigger a download. */
export function downloadIcs(opts: {
  title: string;
  date: string;
  time: string;
  durationMin?: number;
  location?: string;
  description?: string;
}): void {
  const start = new Date(`${opts.date}T${opts.time}:00`);
  const end = new Date(start.getTime() + (opts.durationMin ?? 30) * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Adrian Millan//Reservas//ES',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@adrianmillan.es`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.location ? `LOCATION:${esc(opts.location)}` : '',
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cita-adrian-millan.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
