import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAirQuality } from '@/context/AirQualityContext';
import { Wind, Activity, ShieldCheck, PieChart as PieIcon } from 'lucide-react';

// ── Design Tokens & Base Setup ───────────────────────────────────────────
const C = {
  bg:      '#050810',
  teal:    '#00d4aa',
  blue:    '#4090ff',
  gold:    '#fbbf24',
  text:    '#e2e8f0',
  textDim: '#94a3b8',
  sub:     '#445566',
  border:  'rgba(100,130,160,0.14)',
};

const AQI_BANDS = [
  { max: 50, label: 'Good', color: '#00d4aa' },
  { max: 100, label: 'Moderate', color: '#c8e05a' },
  { max: 150, label: 'Sensitive', color: '#f0c040' },
  { max: 200, label: 'Unhealthy', color: '#f07840' },
  { max: 300, label: 'Very Poor', color: '#e84860' },
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

// ── Custom Components ────────────────────────────────────────────────────
const Card = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 28, overflow: 'hidden' }}>{children}</div>
);

const CardHeader = ({ title, sub, icon: Icon, iconColor }: any) => (
  <div style={{ padding: '32px 32px 16px', display: 'flex', justifyContent: 'space-between' }}>
    <div>
      <h3 style={{ margin: 0, fontSize: 22, color: '#fff', fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: '6px 0 0', fontSize: 14, color: C.textDim, fontFamily: 'IBM Plex Mono' }}>{sub}</p>
    </div>
    <div style={{ background: `${iconColor}15`, padding: 12, borderRadius: 14, border: `1px solid ${iconColor}30` }}>
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

// ── FIXED BARS (The Hover Fix) ───────────────────────────────────────────
const WhiteHoverFixBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  return <rect x={x} y={y} width={width} height={height} rx={12} ry={12} fill={fill} />;
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
      { label: 'PM2.5', value: nearestStation.pm25 || 0, fill: C.blue },
      { label: 'PM10', value: nearestStation.pm10 || 0, fill: C.blue },
      { label: 'Ozone', value: nearestStation.o3 || 0, fill: C.teal },
      { label: 'Nitrogen', value: nearestStation.no2 || 0, fill: C.teal },
    ];
  }, [nearestStation]);

  const radarData = useMemo(() => localPollutants.map(p => ({
    subject: p.label,
    value: Math.min(100, (p.value / (WHO[p.label.toLowerCase().replace('.','')] || 100)) * 100)
  })), [localPollutants]);

  const qualitySpread = useMemo(() => {
    const allNearby = [...stations, ...allCityStations];
    const counts = AQI_BANDS.map(b => ({
      name: b.label,
      value: allNearby.filter(s => band(s.aqi).label === b.label).length,
      color: b.color
    })).filter(c => c.value > 0);
    return counts;
  }, [stations, allCityStations]);

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
              {/* Tooltip text set to black */}
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                itemStyle={{ color: '#000' }} 
                contentStyle={{ color: '#000' }}
              />
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
              <Bar dataKey="value" barSize={80} shape={<WhiteHoverFixBar />} >
                  {localPollutants.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
              {/* Tooltip text set to black */}
              <Tooltip 
                cursor={false} 
                itemStyle={{ color: '#000' }} 
                contentStyle={{ color: '#000' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 40 }}>
        
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
                  {/* Radar Tooltip text set to black */}
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
            <CardHeader title="Nearby Quality Spread" sub={`Status of all ${stations.length + allCityStations.length} stations in your region`} icon={PieIcon} iconColor={C.gold} />
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={qualitySpread} innerRadius={100} outerRadius={140} paddingAngle={8} dataKey="value" activeShape={false}>
                    {qualitySpread.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  {/* Pie Tooltip text set to black */}
                  <Tooltip itemStyle={{ color: '#000' }} contentStyle={{ color: '#000' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default Analytics;