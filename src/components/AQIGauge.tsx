import { useMemo } from 'react';

interface AQIGaugeProps {
  value: number;
  size?: number;
  label?: string;
}

const AQIGauge = ({ value, size = 160, label }: AQIGaugeProps) => {
  const { color, percentage, strokeDash } = useMemo(() => {
    const pct = Math.min(value / 500, 1);
    let c = '#00d4aa';
    if (value > 300) c = '#991b1b';
    else if (value > 200) c = '#7e22ce';
    else if (value > 150) c = '#ef4444';
    else if (value > 100) c = '#f59e0b';
    else if (value > 50) c = '#fbbf24';

    const circumference = Math.PI * 70;
    return { color: c, percentage: pct, strokeDash: `${circumference * pct} ${circumference}` };
  }, [value]);

  const r = 70;
  const cx = size / 2;
  const cy = size / 2 + 10;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={strokeDash}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), stroke 0.4s' }}
        />
        <text x={cx} y={cy - 15} textAnchor="middle" className="font-mono" fill={color} fontSize="28" fontWeight="600">
          {value}
        </text>
        <text x={cx} y={cy + 2} textAnchor="middle" className="font-body" fill="hsl(215, 20%, 55%)" fontSize="10">
          AQI
        </text>
      </svg>
      {label && <span className="text-xs text-muted-foreground mt-1 font-mono">{label}</span>}
    </div>
  );
};

export default AQIGauge;
