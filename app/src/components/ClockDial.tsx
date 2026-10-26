import { useRef } from 'react';
import clsx from 'clsx';

interface ClockDialProps {
  mode: 'hour' | 'minute';
  /** Hour mode: 1–12. Minute mode: 0–59. */
  value: number;
  onChange: (value: number) => void;
  /** Fired when the user releases the hand (or presses Enter) — used to advance hour → minute. */
  onCommit?: () => void;
}

const SIZE = 256;
const CENTER = SIZE / 2;
const LABEL_R = 100;
const KNOB_R = 20;

function polar(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

export function ClockDial({ mode, value, onChange, onCommit }: ClockDialProps) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const isHour = mode === 'hour';
  const angle = isHour ? (value % 12) * 30 : value * 6;
  const knob = polar(angle, LABEL_R);

  const valueFromPointer = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (isHour) {
      const h = Math.round(deg / 30) % 12;
      return h === 0 ? 12 : h;
    }
    return Math.round(deg / 6) % 60;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    onChange(valueFromPointer(e.clientX, e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const next = valueFromPointer(e.clientX, e.clientY);
    if (next !== value) onChange(next);
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = (delta: number) => {
      e.preventDefault();
      if (isHour) onChange((((value - 1 + delta) % 12) + 12) % 12 + 1);
      else onChange((((value + delta) % 60) + 60) % 60);
    };
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Enter') {
      e.preventDefault();
      onCommit?.();
    }
  };

  const labels = Array.from({ length: 12 }, (_, i) => {
    const label = isHour ? (i === 0 ? 12 : i) : i * 5;
    return { label, text: isHour ? String(label) : String(label).padStart(2, '0'), pos: polar(i * 30, LABEL_R) };
  });

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-[16rem] aspect-square touch-none select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
      role="slider"
      tabIndex={0}
      aria-label={isHour ? 'Hour' : 'Minute'}
      aria-valuemin={isHour ? 1 : 0}
      aria-valuemax={isHour ? 12 : 59}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <circle cx={CENTER} cy={CENTER} r={CENTER} className="fill-slate-700/70" />
      <line
        x1={CENTER}
        y1={CENTER}
        x2={knob.x}
        y2={knob.y}
        strokeWidth={2}
        className="stroke-accent"
      />
      <circle cx={CENTER} cy={CENTER} r={4} className="fill-accent" />
      <circle cx={knob.x} cy={knob.y} r={KNOB_R} className="fill-accent" />
      {labels.map(({ label, text, pos }) => (
        <text
          key={label}
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          className={clsx('pointer-events-none', label === value ? 'fill-white font-semibold' : 'fill-slate-200')}
        >
          {text}
        </text>
      ))}
      {/* Between-label minute: small dot in the knob, like Material's picker */}
      {!isHour && value % 5 !== 0 && <circle cx={knob.x} cy={knob.y} r={3} className="fill-white" />}
    </svg>
  );
}
