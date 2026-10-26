import { useEffect, useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import clsx from 'clsx';
import { ClockDial } from './ClockDial';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  initialDate: string;
  withTime?: boolean;
  title?: string;
}

type View = 'date' | 'time';
type ClockMode = 'hour' | 'minute';

const pad = (n: number) => String(n).padStart(2, '0');

/** Parse `yyyy-MM-dd` as a local calendar day (new Date() would treat it as UTC midnight). */
function parseInitial(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function DatePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialDate,
  withTime = false,
  title,
}: DatePickerModalProps) {
  const [view, setView] = useState<View>('date');
  const [clockMode, setClockMode] = useState<ClockMode>('hour');
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [showYears, setShowYears] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selected, setSelected] = useState<Date | null>(null);
  const [hour, setHour] = useState(0); // 0–23
  const [minute, setMinute] = useState(0); // 0–59
  const [hourText, setHourText] = useState('');
  const [minuteText, setMinuteText] = useState('');

  // Re-sync all state every time the modal opens (or initialDate changes while open).
  useEffect(() => {
    if (!isOpen) return;
    const valid = parseInitial(initialDate);
    const now = new Date();
    const base = valid ?? now;
    setView('date');
    setClockMode('hour');
    setKeyboardMode(false);
    setShowYears(false);
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setSelected(valid);
    setHour(base.getHours());
    setMinute(base.getMinutes());
  }, [isOpen, initialDate]);

  const h12 = hour % 12 || 12;
  const isPM = hour >= 12;

  // Keep keyboard-entry drafts in step with the dial / AM-PM toggle.
  useEffect(() => {
    setHourText(pad(h12));
    setMinuteText(pad(minute));
  }, [h12, minute]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(first), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(first), { weekStartsOn: 0 }),
    });
  }, [viewYear, viewMonth]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now + 10 - 1900 + 1 }, (_, i) => 1900 + i);
  }, []);

  if (!isOpen) return null;

  const setH12 = (h: number) => setHour((h % 12) + (isPM ? 12 : 0));
  const setMeridiem = (pm: boolean) => setHour((hour % 12) + (pm ? 12 : 0));

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const pickDay = (day: Date) => {
    setSelected(day);
    if (!isSameMonth(day, new Date(viewYear, viewMonth, 1))) {
      setViewYear(day.getFullYear());
      setViewMonth(day.getMonth());
    }
    if (withTime) {
      setView('time');
      setClockMode('hour');
    }
  };

  const commitHourText = () => {
    const n = parseInt(hourText, 10);
    if (n >= 1 && n <= 12) setH12(n);
    else setHourText(pad(h12));
  };
  const commitMinuteText = () => {
    const n = parseInt(minuteText, 10);
    if (n >= 0 && n <= 59) setMinute(n);
    else setMinuteText(pad(minute));
  };

  const handleConfirm = () => {
    const d = selected ?? new Date();
    const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    // In keyboard mode the drafts may not have been committed by a blur yet.
    let h = hour;
    let m = minute;
    if (keyboardMode) {
      const th = parseInt(hourText, 10);
      const tm = parseInt(minuteText, 10);
      if (th >= 1 && th <= 12) h = (th % 12) + (isPM ? 12 : 0);
      if (tm >= 0 && tm <= 59) m = tm;
    }
    onConfirm(withTime ? `${datePart}T${pad(h)}:${pad(m)}` : datePart);
    onClose();
  };

  const dateLabel = format(selected ?? new Date(), 'EEE, MMM d, yyyy');
  const timeLabel = `${h12}:${pad(minute)} ${isPM ? 'PM' : 'AM'}`;

  const timeBox = (mode: ClockMode) => {
    const active = !keyboardMode && clockMode === mode;
    const boxClass = clsx(
      'w-[5.5rem] h-[4.5rem] rounded-xl text-5xl font-light tabular-nums text-center transition-colors',
      active ? 'bg-accent/25 text-accent-100' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
    );
    if (keyboardMode) {
      const isHourBox = mode === 'hour';
      return (
        <label className="flex flex-col items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={isHourBox ? hourText : minuteText}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              if (isHourBox) setHourText(v);
              else setMinuteText(v);
            }}
            onBlur={isHourBox ? commitHourText : commitMinuteText}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            onFocus={(e) => e.currentTarget.select()}
            className={clsx(boxClass, 'outline-none border-2 border-transparent focus:border-accent focus:bg-accent/25')}
            aria-label={isHourBox ? 'Hour' : 'Minute'}
          />
          <span className="text-xs text-slate-400">{isHourBox ? 'Hour' : 'Minute'}</span>
        </label>
      );
    }
    return (
      <button type="button" onClick={() => setClockMode(mode)} className={boxClass}>
        {pad(mode === 'hour' ? h12 : minute)}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm max-h-[calc(100dvh-2rem)] bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">
              {title ?? (withTime ? 'Select date & time' : 'Select date')}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {withTime ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['date', 'time'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-left transition-colors',
                    view === v ? 'bg-accent/25 text-accent-100' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                  )}
                >
                  <span className="block text-[11px] uppercase tracking-wide opacity-70">{v}</span>
                  <span className="block text-sm font-semibold">{v === 'date' ? dateLabel : timeLabel}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-2xl font-semibold text-slate-100">{dateLabel}</p>
          )}
        </div>

        {/* Body — flex-basis auto so it never collapses when the card is content-sized */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
          {view === 'date' ? (
            <div>
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setShowYears((s) => !s)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-semibold text-slate-100 hover:bg-slate-700 transition-colors"
                >
                  {format(new Date(viewYear, viewMonth, 1), 'MMMM yyyy')}
                  <svg
                    className={clsx('w-4 h-4 transition-transform', showYears && 'rotate-180')}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!showYears && (
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => shiftMonth(-1)}
                      aria-label="Previous month"
                      className="p-2 rounded-full text-slate-300 hover:text-slate-50 hover:bg-slate-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftMonth(1)}
                      aria-label="Next month"
                      className="p-2 rounded-full text-slate-300 hover:text-slate-50 hover:bg-slate-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {showYears ? (
                <div className="mt-2 grid grid-cols-4 gap-1.5 max-h-72 overflow-y-auto">
                  {years.map((y) => (
                    <button
                      key={y}
                      type="button"
                      ref={y === viewYear ? (el) => el?.scrollIntoView({ block: 'center' }) : undefined}
                      onClick={() => {
                        setViewYear(y);
                        setShowYears(false);
                      }}
                      className={clsx(
                        'py-2 rounded-full text-sm transition-colors',
                        y === viewYear ? 'bg-accent text-white font-semibold' : 'text-slate-200 hover:bg-slate-700'
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-1">
                  <div className="grid grid-cols-7">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div key={i} className="text-center text-xs font-medium text-slate-500 py-1.5">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-1">
                    {days.map((day) => {
                      const inMonth = isSameMonth(day, new Date(viewYear, viewMonth, 1));
                      const isSelected = selected ? isSameDay(day, selected) : false;
                      return (
                        <div key={day.toISOString()} className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => pickDay(day)}
                            className={clsx(
                              'w-10 h-10 rounded-full text-sm flex items-center justify-center transition-colors',
                              inMonth ? 'text-slate-200' : 'text-slate-600',
                              isToday(day) && !isSelected && 'ring-1 ring-inset ring-accent text-accent-200',
                              isSelected ? 'bg-accent text-white font-semibold' : 'hover:bg-slate-700'
                            )}
                          >
                            {format(day, 'd')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 pt-2 pb-2">
              <div className="flex items-start gap-2">
                {timeBox('hour')}
                <span className="h-[4.5rem] flex items-center text-5xl font-light text-slate-300">:</span>
                {timeBox('minute')}
                <div className="ml-2 h-[4.5rem] w-14 flex flex-col rounded-xl border border-slate-500 overflow-hidden">
                  {[false, true].map((pm) => (
                    <button
                      key={String(pm)}
                      type="button"
                      onClick={() => setMeridiem(pm)}
                      className={clsx(
                        'flex-1 text-sm font-semibold transition-colors',
                        pm && 'border-t border-slate-500',
                        isPM === pm ? 'bg-accent/40 text-accent-100' : 'text-slate-400 hover:bg-slate-700'
                      )}
                    >
                      {pm ? 'PM' : 'AM'}
                    </button>
                  ))}
                </div>
              </div>
              {!keyboardMode && (
                <ClockDial
                  mode={clockMode}
                  value={clockMode === 'hour' ? h12 : minute}
                  onChange={clockMode === 'hour' ? setH12 : setMinute}
                  onCommit={() => clockMode === 'hour' && setClockMode('minute')}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          {view === 'time' && (
            <button
              type="button"
              onClick={() => setKeyboardMode((k) => !k)}
              aria-label={keyboardMode ? 'Switch to clock' : 'Switch to keyboard entry'}
              className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {keyboardMode ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2.5" y="6" width="19" height="12" rx="2" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
                </svg>
              )}
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-slate-300 hover:text-slate-50 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-full text-sm font-medium bg-accent hover:bg-accent-400 text-white transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
