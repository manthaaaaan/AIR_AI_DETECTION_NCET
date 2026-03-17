import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MapPin, Activity, Sun, ShieldAlert, Wind, Loader2, Navigation, Droplets } from 'lucide-react';

// ── Categories — renamed to feel technical & premium ──────────
const CATEGORIES = [
  {
    id: 'overall',
    label: 'AQI Index',
    sublabel: 'Air Quality',
    icon: Activity,
    color: '#00d4aa',
    unit: 'AQI',
    yAxisDomain: [0, 200] as [number, number],
    refLines: [{ v: 50, label: 'Good' }, { v: 100, label: 'Moderate' }, { v: 150, label: 'Unhealthy' }],
    initVal: 68,
  },
  {
    id: 'uv',
    label: 'UV Index',
    sublabel: 'Solar Radiation',
    icon: Sun,
    color: '#f59e0b',
    unit: 'UVI',
    yAxisDomain: [0, 15] as [number, number],
    refLines: [{ v: 3, label: 'Moderate' }, { v: 6, label: 'High' }, { v: 8, label: 'Very High' }],
    initVal: 4,
  },
  {
    id: 'virus',
    label: 'Pathogen Risk',
    sublabel: 'Airborne Transmission',
    icon: ShieldAlert,
    color: '#ef4444',
    unit: 'Risk %',
    yAxisDomain: [0, 100] as [number, number],
    refLines: [{ v: 25, label: 'Low' }, { v: 50, label: 'Moderate' }, { v: 75, label: 'High' }],
    initVal: 22,
  },
  {
    id: 'pollution',
    label: 'PM2.5',
    sublabel: 'Particulate Matter',
    icon: Wind,
    color: '#8b5cf6',
    unit: 'µg/m³',
    yAxisDomain: [0, 200] as [number, number],
    refLines: [{ v: 35, label: 'Safe' }, { v: 75, label: 'Elevated' }, { v: 150, label: 'Hazardous' }],
    initVal: 38,
  },
  {
    id: 'humidity',
    label: 'Humidity',
    sublabel: 'Relative Humidity',
    icon: Droplets,
    color: '#38bdf8',
    unit: '%RH',
    yAxisDomain: [0, 100] as [number, number],
    refLines: [{ v: 30, label: 'Dry' }, { v: 60, label: 'Comfortable' }, { v: 80, label: 'Humid' }],
    initVal: 55,
  },
];

interface DataPoint { time: string; value: number; }

// ── Custom Tooltip ─────────────────────────────────────────────
const LiveTooltip = ({ active, payload, label, color, unit }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{
      background: 'rgba(6,10,20,0.98)', border: `1px solid ${color}40`,
      borderRadius: 16, padding: '16px 20px', fontFamily: 'JetBrains Mono, monospace',
      boxShadow: `0 16px 40px rgba(0,0,0,0.8), 0 0 30px ${color}15`, minWidth: 140,
    }}>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8, fontWeight: 600, letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.03em', textShadow: `0 0 24px ${color}55` }}>{val}</div>
      <div style={{ fontSize: 14, color: `${color}99`, marginTop: 6, fontWeight: 600, letterSpacing: '0.06em' }}>{unit}</div>
    </div>
  );
};

// ── Trailing live tip — SVG overlay drawn over recharts ──────
const TrailingLine = ({ data, color, domain }: {
  data: DataPoint[];
  color: string;
  domain: [number, number];
}) => {
  const TAIL = 20;
  const tail = data.slice(-TAIL);
  if (tail.length < 2) return null;

  const W = 100, H = 280, padL = 5.5, padR = 2, padT = 10, padB = 38;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const totalPoints = data.length;
  const [dMin, dMax] = domain;

  const px = (i: number) => padL + ((totalPoints - TAIL + i) / (totalPoints - 1)) * cW;
  const py = (v: number) => padT + cH - ((v - dMin) / (dMax - dMin)) * cH;

  // Build smooth path for the whole tail
  const pathD = tail.map((pt, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(2)},${py(pt.value).toFixed(2)}`).join(' ');

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: 280, pointerEvents: 'none', zIndex: 3 }}
      viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
    >
      <defs>
        {/* Horizontal fade — transparent at left, solid at right */}
        <linearGradient id={`trailFade-${color.replace('#','')}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="40%" stopColor={color} stopOpacity="0.25" />
          <stop offset="75%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        <filter id="trailGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="trailGlowHeavy">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="tipGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Layer 1 — thick blurred glow trail */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={8}
        strokeOpacity={0.12} strokeLinecap="round" strokeLinejoin="round"
        filter="url(#trailGlowHeavy)" />

      {/* Layer 2 — medium glow */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={5}
        strokeOpacity={0.2} strokeLinecap="round" strokeLinejoin="round"
        filter="url(#trailGlow)" />

      {/* Layer 3 — bright core with gradient fade */}
      <path d={pathD} fill="none"
        stroke={`url(#trailFade-${color.replace('#','')})`}
        strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

      {/* Individual fading segments for extra punch */}
      {tail.slice(0, -1).map((pt, i) => {
        const next = tail[i + 1];
        const progress = (i + 1) / (TAIL - 1);
        const opacity = Math.pow(progress, 1.5) * 0.9;
        const strokeW = 1 + progress * 4;
        return (
          <line key={i}
            x1={px(i)} y1={py(pt.value)} x2={px(i+1)} y2={py(next.value)}
            stroke={color} strokeWidth={strokeW} strokeOpacity={opacity}
            strokeLinecap="round" filter={progress > 0.7 ? 'url(#trailGlow)' : undefined}
          />
        );
      })}

      {/* Tip — triple ring pulse */}
      {(() => {
        const tip = tail[tail.length - 1];
        const tx = px(tail.length - 1);
        const ty = py(tip.value);
        return (
          <g>
            <circle cx={tx} cy={ty} r={7} fill={color} opacity={0.08} filter="url(#tipGlow)" />
            <circle cx={tx} cy={ty} r={4.5} fill={color} opacity={0.18} filter="url(#trailGlowHeavy)" />
            <circle cx={tx} cy={ty} r={3} fill="none" stroke={color} strokeWidth={1.2} opacity={0.55} />
            <circle cx={tx} cy={ty} r={1.8} fill={color} opacity={1} filter="url(#trailGlow)" />
          </g>
        );
      })()}
    </svg>
  );
};

// ── Main ──────────────────────────────────────────────────────
export const LiveDashboard = () => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [data, setData] = useState<DataPoint[]>([]);
  const [latestVal, setLatestVal] = useState(CATEGORIES[0].initVal);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [flash, setFlash] = useState(false);
  const [tick, setTick] = useState(0);

  const generateNextValue = useCallback((category: typeof CATEGORIES[0], prevValue: number) => {
    const change = (Math.random() - 0.48) * (category.id === 'uv' ? 0.4 : category.id === 'virus' ? 2 : 5);
    let v = prevValue + change;
    v = Math.max(category.yAxisDomain[0], Math.min(category.yAxisDomain[1], v));
    return Math.round(v * 10) / 10;
  }, []);

  // Init data on category change
  useEffect(() => {
    const init: DataPoint[] = [];
    let cur = activeCategory.initVal;
    for (let i = 30; i >= 0; i--) {
      const t = new Date(Date.now() - i * 2000).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      init.push({ time: t, value: cur });
      cur = generateNextValue(activeCategory, cur);
    }
    setData(init);
    setLatestVal(cur);
  }, [activeCategory, generateNextValue]);

  // Live tick every 2s
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const last = prev[prev.length - 1]?.value ?? activeCategory.initVal;
        const next = generateNextValue(activeCategory, last);
        const t = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setTrend(next > last + 0.5 ? 'up' : next < last - 0.5 ? 'down' : 'stable');
        setLatestVal(next);
        setFlash(true); setTimeout(() => setFlash(false), 400);
        setTick(t => t + 1);
        return [...prev.slice(1), { time: t, value: next }];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [activeCategory, generateNextValue]);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError('unavailable'); return; }
    const ok = (p: GeolocationPosition) => { setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocationError(null); };
    const err = () => { setLocationError('denied'); setLocation({ lat: 12.9716, lng: 77.5946 }); };
    navigator.geolocation.getCurrentPosition(ok, err);
    const id = navigator.geolocation.watchPosition(ok, err, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const trendColor = trend === 'up' ? '#ef4444' : trend === 'down' ? '#00d4aa' : '#64748b';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div style={{
      marginTop: 32, borderRadius: 22,
      background: 'rgba(8,14,24,0.7)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(100,130,160,0.14)',
      padding: '28px 28px 24px',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={15} style={{ color: '#00d4aa' }} />
            </div>
            <h2 style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 31, fontWeight: 700, color: '#e2e8f0', margin: 0, letterSpacing: '0.03em' }}>
              Live Environmental Monitor
            </h2>
            {/* Live pulse */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: 15, color: '#ef4444', letterSpacing: '0.1em' }}>LIVE</span>
            </div>
          </div>
          <p style={{ fontSize: 18, color: '#334155', margin: 0, letterSpacing: '0.04em' }}>
            Real-time atmospheric readings · 2s resolution · 10 km radius
          </p>
        </div>

        {/* Location pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
          borderRadius: 99, background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(100,130,160,0.15)',
        }}>
          {location
            ? <Navigation size={12} style={{ color: '#00d4aa' }} />
            : <MapPin size={12} style={{ color: '#475569' }} />}
          <span style={{ fontSize: 18, color: location ? '#94a3b8' : '#475569', letterSpacing: '0.05em' }}>
            {location
              ? `${location.lat.toFixed(3)}°N  ${location.lng.toFixed(3)}°E`
              : locationError
                ? <span style={{ color: '#ef4444' }}>Location denied</span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Locating…
                  </span>
            }
          </span>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory.id === cat.id;
          return (
            <button key={cat.id} onClick={() => setActiveCategory(cat)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
              borderRadius: 10, cursor: 'pointer', transition: 'all 0.18s',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 20, fontWeight: isActive ? 600 : 400,
              background: isActive ? `${cat.color}14` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? cat.color + '45' : 'rgba(100,130,160,0.14)'}`,
              color: isActive ? cat.color : '#475569',
              boxShadow: isActive ? `0 0 16px ${cat.color}14` : 'none',
            }}>
              <Icon size={13} />
              <span>{cat.label}</span>
              {isActive && <span style={{ fontSize: 15, opacity: 0.6, letterSpacing: '0.06em' }}>{cat.sublabel}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Chart panel ── */}
      <AnimatePresence mode="wait">
        <motion.div key={activeCategory.id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          style={{
            borderRadius: 16, padding: '20px 16px 12px',
            background: 'rgba(4,8,16,0.6)', border: `1px solid ${activeCategory.color}18`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 40px ${activeCategory.color}08`,
          }}
        >
          {/* Chart header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingLeft: 4, paddingRight: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <activeCategory.icon size={14} style={{ color: activeCategory.color }} />
              <div>
                <div style={{ fontSize: 21, fontWeight: 700, color: activeCategory.color, letterSpacing: '0.04em' }}>
                  {activeCategory.label}
                </div>
                <div style={{ fontSize: 17, color: '#334155', letterSpacing: '0.08em' }}>{activeCategory.sublabel}</div>
              </div>
            </div>

            {/* Live value readout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Current</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 42, fontWeight: 700, color: activeCategory.color, lineHeight: 1, textShadow: `0 0 14px ${activeCategory.color}55` }}>
                    {latestVal.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 18, color: activeCategory.color, opacity: 0.7 }}>{activeCategory.unit}</span>
                  <span style={{ fontSize: 22, color: trendColor, marginLeft: 2 }}>{trendIcon}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scan line + pulse dot overlay */}
          <div style={{ position: 'relative' }}>
            {/* Flash border on new data */}
            <motion.div
              animate={{ opacity: flash ? 1 : 0 }}
              transition={{ duration: 0.35 }}
              style={{
                position: 'absolute', inset: 0, borderRadius: 10, pointerEvents: 'none', zIndex: 2,
                border: `1px solid ${activeCategory.color}88`,
                boxShadow: `0 0 20px ${activeCategory.color}22`,
              }}
            />

            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`areaGrad-${activeCategory.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeCategory.color} stopOpacity={0.3} />
                    <stop offset="60%" stopColor={activeCategory.color} stopOpacity={0.06} />
                    <stop offset="100%" stopColor={activeCategory.color} stopOpacity={0} />
                  </linearGradient>
                  <filter id="liveGlow">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="dotGlow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,130,160,0.07)" vertical={false} />
                <XAxis dataKey="time"
                  tick={{ fontSize: 15, fontFamily: 'IBM Plex Mono', fill: '#334155' }}
                  stroke="rgba(100,130,160,0.1)" tickMargin={8}
                  interval={Math.floor(data.length / 6)}
                />
                <YAxis domain={activeCategory.yAxisDomain}
                  tick={{ fontSize: 15, fontFamily: 'IBM Plex Mono', fill: '#334155' }}
                  stroke="rgba(100,130,160,0.1)" width={44}
                />
                <Tooltip content={<LiveTooltip color={activeCategory.color} unit={activeCategory.unit} />} />

                {activeCategory.refLines.map(r => (
                  <ReferenceLine key={r.v} y={r.v}
                    stroke={activeCategory.color} strokeDasharray="4 4" strokeOpacity={0.2}
                    label={{ value: r.label, position: 'right', fill: activeCategory.color, fontSize: 15, opacity: 0.6, fontFamily: 'IBM Plex Mono' }}
                  />
                ))}

                {/* Gradient area fill */}
                <Area
                  type="monotone" dataKey="value"
                  stroke={activeCategory.color} strokeWidth={2.5}
                  fill={`url(#areaGrad-${activeCategory.id})`}
                  dot={false}
                  activeDot={{ r: 6, fill: activeCategory.color, stroke: 'rgba(4,6,14,0.9)', strokeWidth: 2 }}
                  filter="url(#liveGlow)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            {/* Trailing live tip overlay */}
            <TrailingLine data={data} color={activeCategory.color} domain={activeCategory.yAxisDomain} />
          </div>

          {/* Live pulse indicator row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 48, marginTop: 6 }}>
            <motion.div
              animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: activeCategory.color, boxShadow: `0 0 10px ${activeCategory.color}` }}
            />
            <span style={{ fontSize: 12, color: '#334155', letterSpacing: '0.1em' }}>
              STREAMING · LAST UPDATE {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
            <motion.div
              key={tick}
              initial={{ opacity: 1, x: 0 }}
              animate={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.8 }}
              style={{ marginLeft: 4, fontSize: 12, color: activeCategory.color, fontWeight: 700 }}
            >
              +1 pt
            </motion.div>
          </div>

          {/* Bottom ref legend */}
          <div style={{ display: 'flex', gap: 18, paddingLeft: 42, marginTop: 8, flexWrap: 'wrap' }}>
            {activeCategory.refLines.map(r => (
              <div key={r.v} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 16, height: 1.5, background: activeCategory.color, opacity: 0.35, borderRadius: 1 }} />
                <span style={{ fontSize: 17, color: '#475569' }}>{r.label} ({r.v})</span>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};