import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAirQuality } from '@/context/AirQualityContext';
import { Wind, Activity, ShieldCheck, PieChart as PieIcon, AlertTriangle } from 'lucide-react';
import { pipeline } from '@huggingface/transformers';

// ── Cyberpunk tokens ─────────────────────────────────────────────────────
const C = {
  bg:      '#0d0d1a',
  bgCard:  '#0f0f20',
  pink:    '#ff00ff',
  yellow:  '#facc15',
  cyan:    '#00fff5',
  red:     '#ff2d55',
  purple:  '#b94fff',
  green:   '#39ff14',
  text:    '#f0e6ff',
  textDim: '#8b7aaa',
  sub:     '#3d2f5a',
};

const AQI_BANDS = [
  { max: 50,       label: 'Good',      color: '#39ff14' },
  { max: 100,      label: 'Moderate',  color: '#facc15' },
  { max: 150,      label: 'Sensitive', color: '#ff9500' },
  { max: 200,      label: 'Unhealthy', color: '#ff2d55' },
  { max: 300,      label: 'Very Poor', color: '#b94fff' },
  { max: Infinity, label: 'Hazardous', color: '#ff00ff' },
];

const WHO: Record<string, number> = { pm25: 15, pm10: 45, o3: 100, no2: 25 };

function band(aqi: number) {
  return AQI_BANDS.find(b => aqi <= b.max) ?? AQI_BANDS.at(-1)!;
}

function distKm(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371;
  const dLa = (la2 - la1) * Math.PI / 180;
  const dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectAnomalies(values: number[], threshold = 1.8): boolean[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std  = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return values.map(v => Math.abs((v - mean) / (std || 1)) > threshold);
}

// ── Card ─────────────────────────────────────────────────────────────────
const Card = ({ children, accent = C.pink, style }: {
  children: React.ReactNode; accent?: string; style?: React.CSSProperties;
}) => (
  <div style={{
    background: C.bgCard,
    border: `1px solid ${accent}30`,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: `0 0 28px ${accent}10, inset 0 0 28px rgba(0,0,0,0.4)`,
    width: '100%',
    ...style,
  }}>
    <div style={{ position:'absolute', top:0, left:0, width:16, height:16, borderTop:`2px solid ${accent}`, borderLeft:`2px solid ${accent}` }} />
    <div style={{ position:'absolute', top:0, right:0, width:16, height:16, borderTop:`2px solid ${accent}`, borderRight:`2px solid ${accent}` }} />
    <div style={{ position:'absolute', bottom:0, left:0, width:16, height:16, borderBottom:`2px solid ${accent}`, borderLeft:`2px solid ${accent}` }} />
    <div style={{ position:'absolute', bottom:0, right:0, width:16, height:16, borderBottom:`2px solid ${accent}`, borderRight:`2px solid ${accent}` }} />
    {children}
  </div>
);

// ── Card Header ───────────────────────────────────────────────────────────
const CardHeader = ({ title, sub, icon: Icon, iconColor, badge }: any) => (
  <div style={{ padding: '20px 16px 10px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
        <h3 style={{
          margin:0, fontWeight:700, color:iconColor,
          textShadow:`0 0 16px ${iconColor}80`,
          fontFamily:'IBM Plex Mono, monospace',
          letterSpacing:'0.04em', textTransform:'uppercase',
          fontSize:'clamp(12px, 3.5vw, 18px)',
          wordBreak:'break-word',
        }}>{title}</h3>
        {badge}
      </div>
      <p style={{ margin:0, color:C.textDim, fontFamily:'IBM Plex Mono', fontSize:'clamp(9px, 2.2vw, 11px)', wordBreak:'break-word', lineHeight:1.5 }}>{sub}</p>
    </div>
    <div style={{
      background:`${iconColor}12`, padding:9, borderRadius:4,
      border:`1px solid ${iconColor}40`, flexShrink:0,
      boxShadow:`0 0 14px ${iconColor}25`,
    }}>
      <Icon size={18} color={iconColor} style={{ filter:`drop-shadow(0 0 5px ${iconColor})`, display:'block' }} />
    </div>
  </div>
);

// ── Section divider ───────────────────────────────────────────────────────
const SectionNo = ({ n, label, accent }: any) => (
  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
    <span style={{
      fontFamily:'IBM Plex Mono', fontSize:10, color:C.bg,
      background:accent, padding:'2px 7px', borderRadius:2,
      fontWeight:700, letterSpacing:'0.1em',
      boxShadow:`0 0 12px ${accent}80`, flexShrink:0,
    }}>{n}</span>
    <div style={{ flex:1, minWidth:40, height:1, background:`linear-gradient(90deg, ${accent}60, transparent)` }} />
    <span style={{
      fontFamily:'IBM Plex Mono', fontSize:9, color:accent,
      textTransform:'uppercase', letterSpacing:'0.12em',
      textShadow:`0 0 8px ${accent}`, flexShrink:0,
    }}>{label}</span>
  </div>
);

// ── Bar shapes ────────────────────────────────────────────────────────────
const CyberBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (!height || height <= 0) return null;
  return (
    <g>
      <rect x={x-2} y={y} width={width+4} height={height} fill={fill} opacity={0.1} />
      <rect x={x} y={y} width={width} height={height} fill={fill} style={{ filter:`drop-shadow(0 0 7px ${fill}90)` }} />
      <rect x={x} y={y} width={width} height={2} fill="#fff" opacity={0.2} />
    </g>
  );
};

const AnomalyBar = (props: any) => {
  const { x, y, width, height, isAnomaly } = props;
  if (!height || height <= 0) return null;
  const color = isAnomaly ? C.red : C.cyan;
  return (
    <g>
      {isAnomaly && (
        <rect x={x-3} y={y-3} width={width+6} height={height+3}
          fill="rgba(255,45,85,0.07)" stroke={C.red} strokeWidth={1} strokeDasharray="3 2"
          style={{ filter:`drop-shadow(0 0 5px ${C.red})` }}
        />
      )}
      <rect x={x-1} y={y} width={width+2} height={height} fill={color} opacity={0.1} />
      <rect x={x} y={y} width={width} height={height} fill={color} style={{ filter:`drop-shadow(0 0 9px ${color}80)` }} />
      <rect x={x} y={y} width={width} height={2} fill="#fff" opacity={0.18} />
    </g>
  );
};

// ── Tooltips ──────────────────────────────────────────────────────────────
const CyberTooltip = ({ active, payload, label, accent = C.pink }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#0a0a18', border:`1px solid ${accent}50`, borderRadius:4, padding:'9px 13px', fontFamily:'IBM Plex Mono', fontSize:12, boxShadow:`0 0 18px ${accent}25` }}>
      <div style={{ color:C.textDim, marginBottom:3, fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color:accent, fontWeight:700, fontSize:14, textShadow:`0 0 7px ${accent}` }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</div>
      ))}
    </div>
  );
};

const AnomalyTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = d.isAnomaly ? C.red : C.cyan;
  return (
    <div style={{ background:'#0a0a18', border:`1px solid ${color}50`, borderRadius:4, padding:'9px 13px', fontFamily:'IBM Plex Mono', fontSize:12, boxShadow:`0 0 18px ${color}25` }}>
      <div style={{ color:C.textDim, marginBottom:3, fontSize:10 }}>{d.name}</div>
      <div style={{ color, fontWeight:700, fontSize:14, textShadow:`0 0 8px ${color}` }}>AQI {d.aqi}</div>
      {d.isAnomaly && <div style={{ color:C.red, marginTop:5, fontSize:9, textTransform:'uppercase', letterSpacing:'0.1em' }}>⚠ Anomaly</div>}
    </div>
  );
};

// ── HF Badge ─────────────────────────────────────────────────────────────
const HFBadge = ({ loading }: { loading: boolean }) => (
  <div style={{
    display:'flex', alignItems:'center', gap:5,
    padding:'3px 8px', borderRadius:2,
    background: loading ? 'rgba(250,204,21,0.08)' : 'rgba(185,79,255,0.08)',
    border:`1px solid ${loading ? C.yellow + '40' : C.purple + '40'}`,
    fontSize:9, fontFamily:'IBM Plex Mono',
    color: loading ? C.yellow : C.purple,
    whiteSpace:'nowrap',
    textShadow:`0 0 7px ${loading ? C.yellow : C.purple}`,
  }}>
    🤗 {loading ? 'Loading...' : 'HuggingFace'}
  </div>
);

// ── Live anomaly hook (re-runs every 5 min) ───────────────────────────────
const INTERVAL_MS = 5 * 60 * 1000;

const useHFAnomalyDetection = (stationData: { name: string; aqi: number }[]) => {
  const [anomalyFlags, setAnomalyFlags] = useState<boolean[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [modelReady,  setModelReady]  = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [nextCheckIn, setNextCheckIn] = useState<number>(INTERVAL_MS / 1000);

  const runDetection = useCallback(async (data: { name: string; aqi: number }[]) => {
    if (!data.length) return;
    setLoading(true);
    try {
      const classifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-small', { device: 'cpu' });
      setModelReady(true);
      const flags = await Promise.all(
        data.map(async (s) => {
          const result = await classifier(
            `Air quality index reading of ${s.aqi} at station ${s.name}`,
            ['normal air quality', 'anomalous air quality spike']
          );
          return (result as any).labels[0] === 'anomalous air quality spike';
        })
      );
      setAnomalyFlags(flags);
    } catch {
      setAnomalyFlags(detectAnomalies(data.map(s => s.aqi)));
      setModelReady(true);
    } finally {
      setLoading(false);
      setLastChecked(new Date());
      setNextCheckIn(INTERVAL_MS / 1000);
    }
  }, []);

  useEffect(() => {
    if (!stationData.length) return;
    runDetection(stationData);
    const iv = setInterval(() => runDetection(stationData), INTERVAL_MS);
    return () => clearInterval(iv);
  }, [stationData.length]);

  useEffect(() => {
    if (!lastChecked) return;
    const ticker = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastChecked.getTime()) / 1000);
      setNextCheckIn(Math.max(0, INTERVAL_MS / 1000 - elapsed));
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastChecked]);

  return { anomalyFlags, loading, modelReady, lastChecked, nextCheckIn };
};

// ── Main ──────────────────────────────────────────────────────────────────
const Analytics = () => {
  const { stations, cityName, userCoords, allCityStations } = useAirQuality();

  const nearestStation = useMemo(() => {
    const [uLat, uLon] = userCoords;
    return [...stations, ...allCityStations]
      .map(s => ({ ...s, dist: distKm(uLat, uLon, s.lat, s.lng) }))
      .sort((a, b) => a.dist - b.dist)[0];
  }, [stations, allCityStations, userCoords]);

  const comparison = useMemo(() => {
    const [uLat, uLon] = userCoords;
    return [...allCityStations]
      .map(s => ({ ...s, d: distKm(uLat, uLon, s.lat, s.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6)
      .map(s => ({ name: s.name, aqi: s.aqi, color: band(s.aqi).color }));
  }, [allCityStations, userCoords]);

  const localPollutants = useMemo(() => {
    if (!nearestStation) return [];
    return [
      { label: 'PM2.5',    value: nearestStation.pm25 || 0, fill: C.pink },
      { label: 'PM10',     value: nearestStation.pm10 || 0, fill: C.yellow },
      { label: 'Ozone',    value: nearestStation.o3   || 0, fill: C.cyan },
      { label: 'Nitrogen', value: nearestStation.no2  || 0, fill: C.purple },
    ];
  }, [nearestStation]);

  const radarData = useMemo(() => localPollutants.map(p => ({
    subject: p.label,
    value: Math.min(100, (p.value / (WHO[p.label.toLowerCase().replace('.', '')] || 100)) * 100),
  })), [localPollutants]);

  const qualitySpread = useMemo(() => {
    const all = [...stations, ...allCityStations];
    return AQI_BANDS.map(b => ({
      name: b.label,
      value: all.filter(s => band(s.aqi).label === b.label).length,
      color: b.color,
    })).filter(c => c.value > 0);
  }, [stations, allCityStations]);

  const anomalyStationData = useMemo(() => {
    const [uLat, uLon] = userCoords;
    return [...stations, ...allCityStations]
      .map(s => ({ ...s, d: distKm(uLat, uLon, s.lat, s.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .map(s => ({ name: s.name, aqi: s.aqi }));
  }, [stations, allCityStations, userCoords]);

  const { anomalyFlags, loading: anomalyLoading, modelReady, lastChecked, nextCheckIn } = useHFAnomalyDetection(anomalyStationData);

  const anomalyChartData = useMemo(() =>
    anomalyStationData.map((s, i) => ({ ...s, isAnomaly: anomalyFlags[i] ?? false })),
    [anomalyStationData, anomalyFlags]
  );
  const anomalyCount = anomalyFlags.filter(Boolean).length;

  const fmtCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .cp-page {
          background: ${C.bg};
          overflow-x: hidden;
          width: 100%;
          min-height: 100vh;
        }
        .cp-page::before {
          content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px);
        }
        .cp-page::after {
          content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: linear-gradient(rgba(255,0,255,0.04) 1px,transparent 1px), linear-gradient(90deg,rgba(255,0,255,0.04) 1px,transparent 1px);
          background-size: 40px 40px;
        }
        .cp-inner {
          position: relative; z-index: 1;
          width: 100%; max-width: 1100px;
          margin: 0 auto;
          padding: 120px 16px 96px;
          color: ${C.text};
        }
        .cp-title {
          font-size: clamp(40px, 12vw, 72px);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
          font-family: 'IBM Plex Mono', monospace;
          color: ${C.pink};
          animation: cpglitch 4s ease-in-out infinite, cpflicker 6s linear infinite;
          word-break: break-word;
        }
        .cp-two-col {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
          gap: 28px;
          margin-bottom: 40px;
        }
        @keyframes cpglitch {
          0%,100% { text-shadow: 0 0 20px #ff00ff, 0 0 40px #ff00ff80; }
          25%      { text-shadow: -2px 0 #00fff5, 2px 0 #ff00ff, 0 0 40px #ff00ff80; }
          50%      { text-shadow: 2px 0 #ff2d55, -2px 0 #facc15, 0 0 40px #ff00ff80; }
          75%      { text-shadow: -2px 0 #b94fff, 2px 0 #00fff5, 0 0 40px #ff00ff80; }
        }
        @keyframes cpflicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.6} 94%{opacity:1} 97%{opacity:0.85} 98%{opacity:1} }
        @keyframes cpshimmer { 0%,100%{opacity:0.3} 50%{opacity:0.6} }

        .recharts-polar-grid-concentric-polygon, .recharts-polar-grid-angle line { stroke: rgba(255,0,255,0.15) !important; }
        .recharts-polar-angle-axis-tick text { fill: ${C.textDim} !important; font-family: 'IBM Plex Mono',monospace !important; font-size: 11px !important; }
      `}</style>

      <div className="cp-page">
        <div className="cp-inner">

          {/* Header */}
          <header style={{ marginBottom: 56 }}>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:10, color:C.pink, letterSpacing:'0.3em', textTransform:'uppercase', marginBottom:10, textShadow:`0 0 10px ${C.pink}` }}>
              ▶ SYSTEM ONLINE ◀
            </div>
            <h1 className="cp-title">ANALYTICS</h1>
            <p style={{ color:C.cyan, fontFamily:'IBM Plex Mono', fontSize:'clamp(11px,3vw,14px)', marginTop:8, textShadow:`0 0 10px ${C.cyan}`, letterSpacing:'0.07em' }}>
              ◈ SENSORS ACTIVE · {cityName.toUpperCase()}
            </p>
          </header>

          {/* 01 Regional */}
          <SectionNo n="01" label="Regional Comparison" accent={C.pink} />
          <Card accent={C.pink} style={{ marginBottom: 40 }}>
            <CardHeader title="Regional Rankings" sub="AQI levels in cities surrounding your location" icon={Activity} iconColor={C.pink} />
            <div style={{ padding:'0 16px 24px' }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparison} layout="vertical" margin={{ left:0, right:16, top:8, bottom:8 }}>
                  <XAxis type="number" hide domain={[0,'dataMax + 30']} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                    tick={{ fill:C.text, fontSize:11, fontFamily:'IBM Plex Mono' }} width={100} />
                  <Tooltip content={<CyberTooltip accent={C.pink} />} cursor={{ fill:'rgba(255,0,255,0.04)' }} />
                  <Bar dataKey="aqi" barSize={20}
                    shape={(props: any) => <CyberBar {...props} fill={comparison[props.index]?.color ?? C.pink} />}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 02 Pollutants */}
          <SectionNo n="02" label="Local Sensor Breakdown" accent={C.cyan} />
          <Card accent={C.cyan} style={{ marginBottom: 40 }}>
            <CardHeader
              title={`Pollutants @ ${nearestStation?.name || 'Nearest'}`}
              sub="Real-time concentrations from nearest sensor"
              icon={Wind} iconColor={C.cyan}
            />
            <div style={{ padding:'0 16px 24px' }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={localPollutants} margin={{ top:10, right:8, left:0, bottom:8 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false}
                    tick={{ fill:C.text, fontSize:12, fontFamily:'IBM Plex Mono', fontWeight:600 }} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fill:C.textDim, fontSize:11, fontFamily:'IBM Plex Mono' }} width={36} />
                  <Tooltip content={<CyberTooltip accent={C.cyan} />} cursor={{ fill:'rgba(0,255,245,0.04)' }} />
                  <Bar dataKey="value" barSize={50}
                    shape={(props: any) => <CyberBar {...props} fill={localPollutants[props.index]?.fill ?? C.cyan} />}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 03 + 04 two-col */}
          <div className="cp-two-col">
            <div>
              <SectionNo n="03" label="Safety Standards" accent={C.yellow} />
              <Card accent={C.yellow}>
                <CardHeader title="WHO Exposure" sub="Pollutants vs safety limits" icon={ShieldCheck} iconColor={C.yellow} />
                <div style={{ height:300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} margin={{ top:10, right:24, bottom:10, left:24 }}>
                      <PolarGrid stroke={`${C.yellow}20`} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill:C.text, fontSize:11, fontFamily:'IBM Plex Mono' }} />
                      <Radar dataKey="value" stroke={C.yellow} fill={C.yellow} fillOpacity={0.15} strokeWidth={2}
                        style={{ filter:`drop-shadow(0 0 7px ${C.yellow}80)` }} />
                      <Tooltip content={<CyberTooltip accent={C.yellow} />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div>
              <SectionNo n="04" label="Regional Spread" accent={C.purple} />
              <Card accent={C.purple}>
                <CardHeader
                  title="Quality Spread"
                  sub={`All ${stations.length + allCityStations.length} stations`}
                  icon={PieIcon} iconColor={C.purple}
                />
                <div style={{ height:240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={qualitySpread} innerRadius="45%" outerRadius="65%" paddingAngle={4} dataKey="value" strokeWidth={0}>
                        {qualitySpread.map((d, i) => (
                          <Cell key={i} fill={d.color} style={{ filter:`drop-shadow(0 0 7px ${d.color}80)` }} />
                        ))}
                      </Pie>
                      <Tooltip content={<CyberTooltip accent={C.purple} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ padding:'0 16px 16px', display:'flex', flexWrap:'wrap', gap:8 }}>
                  {qualitySpread.map((d, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:7, height:7, background:d.color, flexShrink:0, boxShadow:`0 0 5px ${d.color}` }} />
                      <span style={{ fontSize:10, fontFamily:'IBM Plex Mono', color:C.textDim }}>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* 05 Anomaly */}
          <SectionNo n="05" label="AI Anomaly Detection" accent={C.red} />
          <Card accent={C.red}>
            <CardHeader
              title="AQI Spike Detection"
              sub={
                anomalyLoading
                  ? 'Running HuggingFace model...'
                  : modelReady
                    ? `${anomalyCount} spike${anomalyCount !== 1 ? 's' : ''} · last scan ${lastChecked ? lastChecked.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '—'} · next in ${fmtCountdown(nextCheckIn)}`
                    : 'Initialising...'
              }
              icon={AlertTriangle} iconColor={C.red}
              badge={<HFBadge loading={anomalyLoading} />}
            />

            {modelReady && !anomalyLoading && (
              <div style={{ padding:'0 16px 14px', display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { label:`${anomalyCount} Anomalies`,   color:C.red    },
                  { label:`${anomalyStationData.length - anomalyCount} Normal`, color:C.green  },
                  { label:'nli-deberta-v3-small',        color:C.purple },
                  { label:`Next: ${fmtCountdown(nextCheckIn)}`, color:C.yellow },
                ].map((pill, i) => (
                  <div key={i} style={{
                    padding:'3px 9px', borderRadius:2,
                    background:`${pill.color}10`, border:`1px solid ${pill.color}40`,
                    fontSize:10, color:pill.color, fontFamily:'IBM Plex Mono',
                    textShadow:`0 0 7px ${pill.color}`, whiteSpace:'nowrap',
                  }}>{pill.label}</div>
                ))}
              </div>
            )}

            {anomalyLoading && (
              <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:8 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ height:28, borderRadius:2, background:`${C.red}08`, animation:`cpshimmer 1.4s ease-in-out infinite`, animationDelay:`${i*0.15}s` }} />
                ))}
              </div>
            )}

            {!anomalyLoading && anomalyChartData.length > 0 && (
              <div style={{ padding:'0 16px 28px' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={anomalyChartData} margin={{ top:20, right:12, left:0, bottom:56 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fill:C.textDim, fontSize:10, fontFamily:'IBM Plex Mono' }}
                      angle={-35} textAnchor="end" interval={0} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fill:C.sub, fontSize:10, fontFamily:'IBM Plex Mono' }} width={32} />
                    <Tooltip content={<AnomalyTooltip />} cursor={{ fill:'rgba(255,45,85,0.04)' }} />
                    <ReferenceLine
                      y={Math.round(anomalyChartData.reduce((a,b) => a+b.aqi, 0) / Math.max(1, anomalyChartData.length))}
                      stroke={`${C.yellow}50`} strokeDasharray="4 4"
                      label={{ value:'MEAN', fill:C.yellow, fontSize:8, fontFamily:'IBM Plex Mono', position:'insideTopRight' }}
                    />
                    <Bar dataKey="aqi" barSize={32}
                      shape={(props: any) => <AnomalyBar {...props} isAnomaly={anomalyChartData[props.index]?.isAnomaly} />}
                    />
                  </BarChart>
                </ResponsiveContainer>

                {anomalyCount > 0 && (
                  <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ fontSize:9, color:C.sub, fontFamily:'IBM Plex Mono', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:4 }}>▶ Flagged Stations</div>
                    {anomalyChartData.filter(d => d.isAnomaly).map((d, i) => (
                      <motion.div key={d.name}
                        initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.08 }}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderRadius:2, background:'rgba(255,45,85,0.06)', border:`1px solid ${C.red}30`, flexWrap:'wrap' }}
                      >
                        <AlertTriangle size={12} color={C.red} style={{ filter:`drop-shadow(0 0 4px ${C.red})`, flexShrink:0 }} />
                        <span style={{ flex:1, minWidth:80, color:C.text, fontSize:13, fontFamily:'IBM Plex Mono' }}>{d.name}</span>
                        <span style={{ fontFamily:'IBM Plex Mono', fontWeight:700, color:C.red, fontSize:13, textShadow:`0 0 7px ${C.red}` }}>AQI {d.aqi}</span>
                        <span style={{ fontFamily:'IBM Plex Mono', fontSize:9, color:C.red, padding:'2px 7px', borderRadius:2, background:`${C.red}15`, border:`1px solid ${C.red}40`, letterSpacing:'0.1em' }}>ANOMALY</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

        </div>
      </div>
    </>
  );
};

export default Analytics;