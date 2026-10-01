export function MacroRing({ label, value, goal, share, color, format }: { label: string; value: number; goal?: number; share: number; color: string; format: Intl.NumberFormat }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  return (
    <div className="nutri-ring">
      <svg aria-label={label} height="56" role="img" viewBox="0 0 56 56" width="56">
        <circle cx="28" cy="28" fill="none" r={radius} stroke="color-mix(in srgb, currentColor 14%, transparent)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(Math.max(share, 0), 1))}
          strokeLinecap="round"
          strokeWidth="6"
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="nutri-ring__value">
        {goal !== undefined ? `${format.format(Math.round(value))} / ${format.format(Math.round(goal))} g` : `${format.format(Math.round(value))} g`}
      </span>
      <span className="nutri-ring__label">{label} · {Math.round(share * 100)}%</span>
    </div>
  )
}

export function EnergyRing({ label, value, goal, share, format, goalLabel }: { label: string; value: number; goal?: number; share: number; format: Intl.NumberFormat; goalLabel: string }) {
  const radius = 50
  const circumference = 2 * Math.PI * radius
  return (
    <div
      aria-label={goal !== undefined ? `${label}: ${Math.round(value)} / ${Math.round(goal)} kcal` : `${label}: ${Math.round(value)} kcal`}
      className="nutri-energyring"
      role="img"
    >
      <svg height="120" viewBox="0 0 120 120" width="120">
        <circle cx="60" cy="60" fill="none" r={radius} stroke="color-mix(in srgb, currentColor 12%, transparent)" strokeWidth="11" />
        <circle
          cx="60"
          cy="60"
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(Math.max(share, 0), 1))}
          strokeLinecap="round"
          strokeWidth="11"
          style={{ stroke: 'var(--mhd-primary)' }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="nutri-energyring__center">
        <span className="nutri-energyring__value">{format.format(Math.round(value))}</span>
        <span className="nutri-energyring__unit">kcal</span>
        {goal !== undefined ? <span className="nutri-energyring__goal">{goalLabel} {format.format(Math.round(goal))}</span> : null}
      </div>
    </div>
  )
}
