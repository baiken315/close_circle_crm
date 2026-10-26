import { format, formatDistanceToNow, isToday, isTomorrow, isPast, addDays } from 'date-fns';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy h:mm a');
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isToday(d)) return 'today';
  if (isTomorrow(d)) return 'tomorrow';
  if (isPast(d)) return formatDistanceToNow(d, { addSuffix: true });
  return format(d, 'MMM d');
}

export function formatDueDate(date: string): string {
  const d = new Date(date);
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow at ${format(d, 'h:mm a')}`;
  if (isPast(d)) return `Overdue since ${format(d, 'MMM d')}`;
  if (d <= addDays(new Date(), 7)) return format(d, 'EEEE \'at\' h:mm a');
  return format(d, 'MMM d \'at\' h:mm a');
}

export function formatAnnualDate(dateStr: string): string {
  // YYYY-MM-DD format, just show month and day
  const d = new Date(dateStr + 'T00:00:00');
  return format(d, 'MMMM d');
}

export function daysUntilNextAnnual(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  const thisYear = new Date(today.getFullYear(), (month ?? 1) - 1, day ?? 1);
  if (thisYear < today) {
    thisYear.setFullYear(today.getFullYear() + 1);
  }
  // round, not ceil: a DST change between the two midnights adds/removes an hour
  return Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function to12hLocalInput(value: string): string {
  if (!value) return '';
  // A bare YYYY-MM-DD is a calendar day — return it as-is. new Date() would parse it
  // as UTC midnight, which is the previous evening in US time zones.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  const h24 = d.getHours();
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  const hasTime = value.includes('T');
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return hasTime ? `${datePart} ${h12}:${pad(d.getMinutes())} ${ampm}` : datePart;
}

export function toLocalDatetimeInput(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
