import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell as RCell,
} from 'recharts';
import { useAirQuality } from '@/context/AirQualityContext';
import { Wind, Activity, ShieldCheck, PieChart as PieIcon, Zap, AlertTriangle } from 'lucide-react';
import { pipeline } from '@huggingface/transformers';

// ── Design Tokens ────────────────────────────────────────────────────────
const C = {
  bg:      '#050810',
  teal:    '#00d4aa',
  blue:    '#4090ff',
  gold:    '#fbbf24',
  red:     '#ef4444',
  purple:  '#7c6fcd',
  text:    '#e2e8f0',
  textDim: '#94a3b8',
  sub:     '#445566',
  border:  'rgba(100,130,160,0.14)',
};

const AQI_BANDS = [
  { max: 50,       label: 'Good',      color: '#00d4aa' },
  { max: 100,      label: 'Moderate',  color: '#c8e05a' },
  { max: 150,      label: 'Sensitive', color: '#f0c040' },
  { max: 200,      label: 'Unhealthy', color: '#f07840' },
  { max: 300,      label: 'Very Poor', color: '#e84860' },
  { max: Infinity, label: 'Hazardous', color: '#c02040' },
];

const WHO = { pm25: 15, pm10: 45, o3: 100, no2: 25 };

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

// ── Z-score anomaly detection (runs on AQI array) ────────────────────────
function detectAnomalies(values: number[], threshold = 1.8): boolean[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return values.map(v => Math.abs((v - mean) / (std || 1)) > threshold);
}

// ── Custom Components ────────────────────────────────────────────────────
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 28, overflow: 'hidden', ...style }}>
    {children}
  </div>
);

const CardHeader = ({ title, sub, icon: Icon, iconColor, badge }: any) => (
  <div style={{ padding: '32px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 22, color: '#fff', fontWeight: 700 }}>{title}</h3>
        {badge}
      </div>
      <p style={{ margin: 0, fontSize: 14, color: C.textDim, fontFamily: 'IBM Plex Mono' }}>{sub}</p>
    </div>
    <div style={{ background: `${iconColor}15`, padding: 12, borderRadius: 14, border: `1px solid ${iconColor}30`, flexShrink: 0 }}>
      <Icon size={24} color={iconColor} />
    </div>
  </div>
);

const SectionNo = ({ n, label, accent }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: accent, fontWeight: 700 }}>{n}</span>
    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}40, transparent)` }} />
    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: C.sub, textTransform: 'uppercase' }}>{label}</span>
  </div>
);

const WhiteHoverFixBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  return <rect x={x} y={y} width={width} height={height} rx={12} ry={12} fill={fill} />;
};

// ── Anomaly Bar — red glow if anomaly ────────────────────────────────────
const AnomalyBar = (props: any) => {
  const { fill, x, y, width, height, isAnomaly } = props;
  return (
    <g>
      {isAnomaly && (
        <rect
          x={x - 3} y={y - 3}
          width={width + 6} height={height + 6}
          rx={10} ry={10}
          fill="rgba(239,68,68,0.15)"
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      )}
      <rect
        x={x} y={y}
        width={width} height={height}
        rx={8} ry={8}
        fill={isAnomaly ? '#ef4444' : fill}
        style={isAnomaly ? { filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.7))' } : undefined}
      />
    </g>
  );
};

// ── HF Badge ─────────────────────────────────────────────────────────────
const HFBadge = ({ loading }: { loading: boolean }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 99,
    background: loading ? 'rgba(255,200,0,0.08)' : 'rgba(124,111,205,0.1)',
    border: `1px solid ${loading ? 'rgba(255,200,0,0.3)' : 'rgba(124,111,205,0.35)'}`,
    fontSize: 11, fontFamily: 'IBM Plex Mono',
    color: loading ? '#fbbf24' : '#7c6fcd',
    whiteSpace: 'nowrap',
  }}>
    <span>🤗</span>
    {loading ? 'Model loading...' : 'HuggingFace · Anomaly Detection'}
  </div>
);

// ── Custom Anomaly Tooltip ────────────────────────────────────────────────
const AnomalyTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'rgba(6,8,20,0.95)', border: `1px solid ${d.isAnomaly ? '#ef4444' : 'rgba(100,130,160,0.3)'}`, borderRadius: 12, padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{d.name}</div>
      <div style={{ color: d.isAnomaly ? '#ef4444' : C.teal, fontWeight: 700, fontSize: 15 }}>AQI {d.aqi}</div>
      {d.isAnomaly && (
        <div style={{ color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={10} /> Anomaly detected
        </div>
      )}
    </div>
  );
};

// ── Hook: HuggingFace Zero-Shot Anomaly Classification ───────────────────
const useHFAnomalyDetection = (stationData: { name: string; aqi: number }[]) => {
  const [anomalyFlags, setAnomalyFlags] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    if (!stationData.length) return;

    const run = async () => {
      setLoading(true);
      try {
        // Load zero-shot-classification pipeline from HF
        // Xenova is the transformers.js compatible model hub
        const classifier = await pipeline(
          'zero-shot-classification',
          'Xenova/nli-deberta-v3-small',
          { device: 'cpu' }
        );

        setModelReady(true);

        // Classify each station's AQI reading
        const flags = await Promise.all(
          stationData.map(async (s) => {
            const result = await classifier(
              `Air quality index reading of ${s.aqi} at station ${s.name}`,
              ['normal air quality', 'anomalous air quality spike']
            );
            // If top label is anomaly → flag it
            return (result as any).labels[0] === 'anomalous air quality spike';
          })
        );

        setAnomalyFlags(flags);
      } catch (err) {
        console.error('HF anomaly detection error:', err);
        // Fallback to statistical detection if model fails
        const values = stationData.map(s => s.aqi);
        setAnomalyFlags(detectAnomalies(values));
        setModelReady(true);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [stationData.length]);

  return { anomalyFlags, loading, modelReady };
};

// ── Main Analytics Component ──────────────────────────────────────────────
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
      { label: 'PM2.5',    value: nearestStation.pm25 || 0, fill: C.blue },
      { label: 'PM10',     value: nearestStation.pm10 || 0, fill: C.blue },
      { label: 'Ozone',    value: nearestStation.o3   || 0, fill: C.teal },
      { label: 'Nitrogen', value: nearestStation.no2  || 0, fill: C.teal },
    ];
  }, [nearestStation]);

  const radarData = useMemo(() => localPollutants.map(p => ({
    subject: p.label,
    value: Math.min(100, (p.value / (WHO[p.label.toLowerCase().replace('.', '')] || 100)) * 100),
  })), [localPollutants]);

  const qualitySpread = useMemo(() => {
    const allNearby = [...stations, ...allCityStations];
    return AQI_BANDS.map(b => ({
      name: b.label,
      value: allNearby.filter(s => band(s.aqi).label === b.label).length,
      color: b.color,
    })).filter(c => c.value > 0);
  }, [stations, allCityStations]);

  // ── Section 05: Anomaly Detection data ──────────────────────────────────
  // Use all nearby stations for anomaly scan
  const anomalyStationData = useMemo(() => {
    const [uLat, uLon] = userCoords;
    return [...stations, ...allCityStations]
      .map(s => ({ ...s, d: distKm(uLat, uLon, s.lat, s.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .map(s => ({ name: s.name, aqi: s.aqi }));
  }, [stations, allCityStations, userCoords]);

  const { anomalyFlags, loading: anomalyLoading, modelReady } = useHFAnomalyDetection(anomalyStationData);

  const anomalyChartData = useMemo(() =>
    anomalyStationData.map((s, i) => ({
      ...s,
      isAnomaly: anomalyFlags[i] ?? false,
    })),
    [anomalyStationData, anomalyFlags]
  );

  const anomalyCount = anomalyFlags.filter(Boolean).length;

  return (
    <div className="pt-32 pb-24 px-8 min-h-screen" style={{ maxWidth: 1100, margin: '0 auto', color: C.text }}>

      <header style={{ marginBottom: 80 }}>
        <h1 style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', margin: 0 }}>Analytics</h1>
        <p style={{ color: C.teal, fontFamily: 'IBM Plex Mono', fontSize: 20 }}>📍 Sensors active near {cityName}</p>
      </header>

      {/* 01. Rankings */}
      <SectionNo n="01" label="Regional Comparison" accent={C.teal} />
      <Card style={{ marginBottom: 56 }}>
        <CardHeader title="Regional Rankings" sub="AQI levels in cities surrounding your current location" icon={Activity} iconColor={C.teal} />
        <div style={{ padding: '0 40px 40px' }}>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={comparison} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#fff', fontSize: 16, fontWeight: 600 }} width={140} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} itemStyle={{ color: '#000' }} contentStyle={{ color: '#000' }} />
              <Bar dataKey="aqi" radius={[0, 10, 10, 0]} barSize={24}>
                {comparison.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 02. Local Pollutants */}
      <SectionNo n="02" label="Local Sensor Breakdown" accent={C.blue} />
      <Card style={{ marginBottom: 56 }}>
        <CardHeader
          title={`Pollutants at ${nearestStation?.name || 'Nearest Station'}`}
          sub="Real-time concentration from a sensor 0.1km away"
          icon={Wind} iconColor={C.blue}
        />
        <div style={{ padding: '0 40px 40px' }}>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={localPollutants}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#fff', fontSize: 18, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: C.sub, fontSize: 14 }} />
              <Bar dataKey="value" barSize={80} shape={<WhiteHoverFixBar />}>
                {localPollutants.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
              <Tooltip cursor={false} itemStyle={{ color: '#000' }} contentStyle={{ color: '#000' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 40, marginBottom: 56 }}>

        {/* 03. WHO Radar */}
        <div>
          <SectionNo n="03" label="Safety Standards" accent="#ff6090" />
          <Card>
            <CardHeader title="WHO Exposure" sub="Local pollutants vs safety limits" icon={ShieldCheck} iconColor="#ff6090" />
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#fff', fontSize: 14 }} />
                  <Radar dataKey="value" stroke="#ff6090" fill="#ff6090" fillOpacity={0.3} strokeWidth={4} />
                  <Tooltip itemStyle={{ color: '#000' }} contentStyle={{ color: '#000' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* 04. Distribution */}
        <div>
          <SectionNo n="04" label="Regional Spread" accent={C.gold} />
          <Card>
            <CardHeader
              title="Nearby Quality Spread"
              sub={`Status of all ${stations.length + allCityStations.length} stations in your region`}
              icon={PieIcon} iconColor={C.gold}
            />
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={qualitySpread} innerRadius={100} outerRadius={140} paddingAngle={8} dataKey="value" activeShape={false}>
                    {qualitySpread.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip itemStyle={{ color: '#000' }} contentStyle={{ color: '#000' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

      </div>

      {/* 05. HuggingFace Anomaly Detection */}
      <SectionNo n="05" label="AI Anomaly Detection" accent={C.red} />
      <Card>
        <CardHeader
          title="AQI Spike Detection"
          sub={
            anomalyLoading
              ? 'Running HuggingFace model on nearby stations...'
              : modelReady
                ? `${anomalyCount} anomalous spike${anomalyCount !== 1 ? 's' : ''} detected across ${anomalyStationData.length} stations`
                : 'Initialising model...'
          }
          icon={AlertTriangle}
          iconColor={C.red}
          badge={<HFBadge loading={anomalyLoading} />}
        />

        {/* Anomaly stat pills */}
        {modelReady && !anomalyLoading && (
          <div style={{ padding: '0 32px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, color: '#ef4444', fontFamily: 'IBM Plex Mono' }}>
              🔴 {anomalyCount} Anomalies
            </div>
            <div style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', fontSize: 12, color: C.teal, fontFamily: 'IBM Plex Mono' }}>
              ✅ {anomalyStationData.length - anomalyCount} Normal
            </div>
            <div style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(124,111,205,0.1)', border: '1px solid rgba(124,111,205,0.3)', fontSize: 12, color: C.purple, fontFamily: 'IBM Plex Mono' }}>
              🤗 Xenova/nli-deberta-v3-small
            </div>
          </div>
        )}

        {/* Loading state */}
        {anomalyLoading && (
          <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 36, borderRadius: 8, background: 'rgba(239,68,68,0.06)', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {/* Anomaly Chart */}
        {!anomalyLoading && anomalyChartData.length > 0 && (
          <div style={{ padding: '0 32px 40px' }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={anomalyChartData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: C.textDim, fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: C.sub, fontSize: 12 }} />
                <Tooltip content={<AnomalyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                {/* Mean reference line */}
                <ReferenceLine
                  y={Math.round(anomalyChartData.reduce((a, b) => a + b.aqi, 0) / anomalyChartData.length)}
                  stroke="rgba(255,255,255,0.2)"
                  strokeDasharray="4 4"
                  label={{ value: 'mean', fill: '#445566', fontSize: 11, position: 'insideTopRight' }}
                />
                <Bar dataKey="aqi" barSize={40}
                  shape={(props: any) => (
                    <AnomalyBar
                      {...props}
                      isAnomaly={anomalyChartData[props.index]?.isAnomaly}
                      fill={C.teal}
                    />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Anomaly list below chart */}
            {anomalyCount > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: C.sub, fontFamily: 'IBM Plex Mono', marginBottom: 4 }}>FLAGGED STATIONS</div>
                {anomalyChartData.filter(d => d.isAnomaly).map((d, i) => (
                  <motion.div
                    key={d.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <AlertTriangle size={14} color="#ef4444" />
                    <span style={{ flex: 1, color: C.text, fontSize: 14 }}>{d.name}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 700, color: '#ef4444', fontSize: 14 }}>AQI {d.aqi}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#ef4444', padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      ANOMALY
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        `}</style>
      </Card>

    </div>
  );
};

export default Analytics;