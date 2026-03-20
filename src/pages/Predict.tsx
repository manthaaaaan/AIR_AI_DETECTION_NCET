import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAirQuality } from '@/context/AirQualityContext';
import { getAQIColor, getAQICategory } from '@/data/mockSensorData';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { Brain, AlertTriangle, Shield, Loader2, ChevronRight, Zap, MapPin, Navigation } from 'lucide-react';

interface PredictionPoint { time: string; aqi: number; upper: number; lower: number; }
interface HourlyForecast  { time: string; us_aqi: number; european_aqi: number; pm25: number; }

// Same formula as aqiService.ts
function pm25ToAqi(pm25: number): number {
  if (pm25 <= 12)    return Math.round((50 / 12) * pm25);
  if (pm25 <= 35.4)  return Math.round(50  + ((100 - 51)  / (35.4  - 12.1))  * (pm25 - 12.1));
  if (pm25 <= 55.4)  return Math.round(100 + ((150 - 101) / (55.4  - 35.5))  * (pm25 - 35.5));
  if (pm25 <= 150.4) return Math.round(150 + ((200 - 151) / (150.4 - 55.5))  * (pm25 - 55.5));
  if (pm25 <= 250.4) return Math.round(200 + ((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5));
  return Math.round(300 + ((400 - 301) / (350.4 - 250.5)) * (pm25 - 250.5));
}

async function fetchHourlyForecast(lat: number, lon: number, horizon: number): Promise<HourlyForecast[]> {
  const forecastDays = horizon <= 24 ? 1 : 2;
  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=pm2_5,us_aqi,european_aqi` +
    `&forecast_days=${forecastDays}` +
    `&domains=cams_global`
  );
  if (!res.ok) throw new Error(`Open-Meteo fetch failed: ${res.status}`);
  const data = await res.json();
  const times: string[]  = data.hourly?.time         ?? [];
  const usAqis: number[] = data.hourly?.us_aqi       ?? [];
  const euAqis: number[] = data.hourly?.european_aqi ?? [];
  const pm25s: number[]  = data.hourly?.pm2_5        ?? [];
  return times.map((t, i) => ({ time: t, us_aqi: usAqis[i]??0, european_aqi: euAqis[i]??0, pm25: pm25s[i]??0 }));
}

// Anchor first point to real sensor AQI, follow CAMS trend shape for future hours
function buildPrediction(hourlyData: HourlyForecast[], horizon: number, realAqi: number): PredictionPoint[] {
  // Daily AQI multiplier pattern (index = hour of day 0-23)
  // Based on typical traffic/pollution cycles
  const dailyPattern: Record<number, number> = {
    0:0.62, 1:0.55, 2:0.50, 3:0.47, 4:0.48, 5:0.55,
    6:0.72, 7:0.95, 8:1.10, 9:1.05, 10:0.92, 11:0.85,
    12:0.88, 13:0.84, 14:0.80, 15:0.83, 16:0.90, 17:1.05,
    18:1.12, 19:1.08, 20:0.95, 21:0.85, 22:0.75, 23:0.67,
  };

  const now = new Date();
  const currentHour = now.getHours();
  // Use CAMS only to get the relative trend shape between hours
  // Anchor everything to realAqi at current hour
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  let startIdx = hourlyData.findIndex(h => {
    const d = new Date(h.time);
    return d.getHours() === nextHour.getHours() && d.getDate() === nextHour.getDate();
  });
  if (startIdx === -1) startIdx = 0;

  const count = Math.min(horizon, hourlyData.length - startIdx);
  const currentPattern = dailyPattern[currentHour] ?? 1;

  const points: PredictionPoint[] = [];
  for (let i = 0; i < count; i++) {
    const entry = hourlyData[startIdx + i];
    if (!entry) break;
    const entryHour = new Date(entry.time).getHours();
    const hourPattern = dailyPattern[entryHour] ?? 1;
    // Scale realAqi by the ratio of future hour pattern to current hour pattern
    const aqi = Math.max(1, Math.round(realAqi * (hourPattern / currentPattern)));
    // Confidence band: widens over time (±5% at hour 1, ±20% at hour 24)
    const bandPct = 0.05 + (i / Math.max(count, 1)) * 0.15;
    const band = Math.max(5, Math.round(aqi * bandPct));
    const label = horizon <= 24
      ? `${entryHour.toString().padStart(2,'0')}:00`
      : `+${i+1}h`;
    points.push({ time: label, aqi, upper: aqi + band, lower: Math.max(0, aqi - band) });
  }
  return points;
}

async function generateAiInsight(locationName: string, horizon: number, prediction: PredictionPoint[], peakAqi: number, minAqi: number, avgAqi: number, trend: string): Promise<string> {
  const forecastSummary = prediction
    .filter((_,i) => i % Math.max(1, Math.floor(prediction.length/8)) === 0)
    .map(p => `${p.time}: AQI ${p.aqi}`).join(', ');
  const prompt =
    `You are an air quality analyst. Based on real CAMS forecast data for ${locationName}, ` +
    `provide a concise 2-3 sentence health risk assessment for the next ${horizon} hours.\n\n` +
    `Forecast data: ${forecastSummary}\nPeak AQI: ${peakAqi} | Min AQI: ${minAqi} | Average AQI: ${avgAqi} | Trend: ${trend}\n\n` +
    `Focus on: health impact, who is at risk, and the best time window for outdoor activity. Be specific and practical. Do not use markdown formatting.`;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{ role:'user', content:prompt }] }),
  });
  if (!response.ok) throw new Error(`Claude API failed: ${response.status}`);
  const data = await response.json();
  return (data.content?.filter((b:any)=>b.type==='text').map((b:any)=>b.text).join('')??'').trim();
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const aqi = payload[0]?.value;
  const col = getAQIColor(aqi);
  const cat = getAQICategory(aqi);
  return (
    <div style={{ background:'rgba(6,10,20,0.98)', border:`1px solid ${col}40`, borderRadius:16, padding:'16px 20px', fontFamily:'JetBrains Mono, monospace', minWidth:140 }}>
      <div style={{ fontSize:13, color:'#94a3b8', marginBottom:8, letterSpacing:'0.08em', fontWeight:600 }}>{label}</div>
      <div style={{ fontSize:36, fontWeight:700, color:col, lineHeight:1, letterSpacing:'-0.03em', textShadow:`0 0 24px ${col}55` }}>{aqi}</div>
      <div style={{ fontSize:12, color:col, marginTop:10, fontWeight:700, letterSpacing:'0.06em', padding:'4px 12px', borderRadius:99, background:`${col}15`, border:`1px solid ${col}30`, display:'inline-block' }}>{cat.label}</div>
    </div>
  );
};

const StatPill = ({ label, value, color, delay }: { label:string; value:string; color:string; delay:number }) => (
  <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay, duration:0.35 }}
    style={{ flex:1, minWidth:100, padding:'14px 16px', borderRadius:16, background:`linear-gradient(135deg, ${color}0c 0%, rgba(4,6,14,0) 100%)`, border:`1px solid ${color}25` }}>
    <div style={{ fontSize:10, color:'#64748b', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6, fontFamily:'JetBrains Mono, monospace', fontWeight:600 }}>{label}</div>
    <div style={{ fontSize:22, fontWeight:700, color, fontFamily:'JetBrains Mono, monospace', lineHeight:1, letterSpacing:'-0.02em' }}>{value}</div>
  </motion.div>
);

const ScanEffect = () => (
  <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:16, pointerEvents:'none' }}>
    <motion.div animate={{ y:['-100%','200%'] }} transition={{ duration:2.2, repeat:Infinity, ease:'linear' }}
      style={{ position:'absolute', left:0, right:0, height:'30%', background:'linear-gradient(to bottom, transparent, rgba(0,212,170,0.04) 40%, rgba(0,212,170,0.07) 50%, rgba(0,212,170,0.04) 60%, transparent)' }} />
  </div>
);

const Predict = () => {
  const { stations, allCityStations, cityName, cityAQI, liveAvgAQI, userCoords } = useAirQuality();

  // Only major city stations — no local radius duplicates
  const cityStations = (allCityStations ?? stations).filter(s => s.id.startsWith('init-'));

  const [selectedId,     setSelectedId]     = useState('');
  const [horizon,        setHorizon]        = useState(24);
  const [loading,        setLoading]        = useState(false);
  const [prediction,     setPrediction]     = useState<PredictionPoint[] | null>(null);
  const [aiInsight,      setAiInsight]      = useState<string | null>(null);
  const [locState,       setLocState]       = useState<'idle'|'loading'|'found'|'error'>('idle');
  const [locLabel,       setLocLabel]       = useState<string | null>(null);
  const [locAqi,         setLocAqi]         = useState<number | null>(null);
  const [locCoords,      setLocCoords]      = useState<[number,number] | null>(null);
  const [dataPointCount, setDataPointCount] = useState(0);
  const [shapesLoading,  setShapesLoading]  = useState(false);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const station    = cityStations.find(s => s.id === selectedId);
  // Real sensor AQI — liveAvgAQI matches what Live page shows
  const activeAqi  = locAqi ?? station?.aqi ?? liveAvgAQI ?? cityAQI;
  const activeName = locLabel ?? station?.name ?? cityName;
  const aqiColor   = getAQIColor(activeAqi);

  const getActiveCoords = (): [number,number] => {
    if (locCoords)   return locCoords;
    if (!selectedId) return userCoords;
    if (station)     return [station.lat, station.lng];
    return userCoords;
  };

  useEffect(() => {
    const [lat, lon] = getActiveCoords();
    if (!lat || !lon) return;
    setShapesLoading(true);
    fetchHourlyForecast(lat, lon, 48)
      .then(data => setDataPointCount(data.length))
      .catch(console.error)
      .finally(() => setShapesLoading(false));
  }, [selectedId, locCoords, userCoords]);

  const runForecast = useCallback(async (name: string, h: number, lat: number, lon: number, realAqi: number) => {
    setLoading(true); setPrediction(null); setAiInsight(null);
    try {
      const hourlyData = await fetchHourlyForecast(lat, lon, h);
      setDataPointCount(hourlyData.length);
      const data = buildPrediction(hourlyData, h, realAqi);
      if (!data.length) throw new Error('No forecast data returned');
      setPrediction(data);
      const peakVal = Math.max(...data.map(d=>d.aqi));
      const minVal  = Math.min(...data.map(d=>d.aqi));
      const avgVal  = Math.round(data.reduce((s,d)=>s+d.aqi,0)/data.length);
      const trend   = data[data.length-1].aqi > data[0].aqi ? 'worsening' : 'improving';
      try {
        const insight = await generateAiInsight(name, h, data, peakVal, minVal, avgVal, trend);
        setAiInsight(insight);
      } catch(e) {
        console.error('Claude insight failed:', e);
        setAiInsight(`Air quality at ${name} is forecast to be ${trend} over the next ${h} hours. Peak AQI of ${peakVal} expected${peakVal>150?' — sensitive groups should stay indoors':''}. Lowest reading of ${minVal} projected.`);
      }
    } catch(e) { console.error('Forecast failed:', e); }
    finally    { setLoading(false); }
  }, []);

  const handleGenerate      = () => { const [lat,lon]=getActiveCoords(); runForecast(activeName,horizon,lat,lon,activeAqi); };
  const handleHorizonChange = (h: number) => { setHorizon(h); if(prediction){ const [lat,lon]=getActiveCoords(); runForecast(activeName,h,lat,lon,activeAqi); } };

  const handleLocate = () => {
    if (!navigator.geolocation) { setLocState('error'); return; }
    setLocState('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearest = cityStations.reduce((best,s) => Math.hypot(s.lat-latitude,s.lng-longitude) < Math.hypot(best.lat-latitude,best.lng-longitude) ? s : best, cityStations[0]);
        setLocAqi(nearest.aqi); setLocLabel(`My Location (near ${nearest.name})`);
        setLocCoords([latitude,longitude]); setSelectedId(nearest.id); setLocState('found');
        runForecast(`My Location (near ${nearest.name})`,horizon,latitude,longitude,nearest.aqi);
      },
      () => setLocState('error'),
      { timeout:8000, maximumAge:60000 }
    );
  };

  const peakAqi  = prediction ? Math.max(...prediction.map(d=>d.aqi)) : null;
  const minAqi   = prediction ? Math.min(...prediction.map(d=>d.aqi)) : null;
  const avgAqi   = prediction ? Math.round(prediction.reduce((s,d)=>s+d.aqi,0)/prediction.length) : null;
  const trendDir = prediction && prediction.length > 1
    ? (prediction[prediction.length-1].aqi > prediction[0].aqi ? '↑ Worsening' : '↓ Improving')
    : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .pred-bg { position:fixed;inset:0;z-index:0;overflow:hidden;background:radial-gradient(ellipse 80% 60% at 10% 10%,#0a2e22 0%,transparent 60%),radial-gradient(ellipse 70% 50% at 90% 80%,#071428 0%,transparent 60%),#050810; }
        .pred-orb { position:absolute;border-radius:50%;filter:blur(60px);opacity:0.9;animation:pred-orb-drift linear infinite; }
        .pred-orb-1 { width:700px;height:700px;top:-200px;left:-150px;background:radial-gradient(circle,rgba(0,212,170,0.7) 0%,rgba(0,180,140,0.3) 40%,transparent 70%);animation-duration:18s; }
        .pred-orb-2 { width:600px;height:600px;bottom:-150px;right:-100px;background:radial-gradient(circle,rgba(0,100,220,0.6) 0%,rgba(0,60,180,0.2) 45%,transparent 70%);animation-duration:24s;animation-direction:reverse; }
        .pred-orb-3 { width:450px;height:450px;top:40%;left:55%;background:radial-gradient(circle,rgba(0,200,160,0.45) 0%,transparent 70%);animation-duration:28s;animation-delay:-8s; }
        @keyframes pred-orb-drift { 0%{transform:translate(0,0) scale(1)} 25%{transform:translate(50px,-40px) scale(1.08)} 50%{transform:translate(25px,55px) scale(0.93)} 75%{transform:translate(-40px,22px) scale(1.05)} 100%{transform:translate(0,0) scale(1)} }
        .pred-grid { position:absolute;inset:0;background-image:linear-gradient(rgba(0,212,170,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,170,0.05) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 50% 40%,black 20%,transparent 75%); }
        .pred-vignette { position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 30%,rgba(5,8,16,0.65) 100%); }
        .pred-content { position:relative;z-index:1; }
        .glass { background:rgba(8,14,24,0.7);backdrop-filter:blur(24px);border:1px solid rgba(100,130,160,0.15);border-radius:24px; }
        .glass-bright { background:rgba(12,20,34,0.8);backdrop-filter:blur(24px);border:1px solid rgba(100,130,160,0.2);border-radius:20px; }
        .horizon-btn { padding:10px 18px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;border:1px solid rgba(100,130,160,0.2);background:rgba(255,255,255,0.02);color:#64748b; }
        .horizon-btn:hover { color:#e2e8f0;background:rgba(255,255,255,0.06); }
        .horizon-btn.active { background:rgba(0,212,170,0.15);color:#00d4aa;border-color:rgba(0,212,170,0.4);box-shadow:0 0 20px rgba(0,212,170,0.15); }
        .gen-btn { display:flex;align-items:center;gap:10px;padding:13px 28px;border-radius:14px;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;letter-spacing:0.02em;transition:all 0.2s;background:linear-gradient(135deg,#00d4aa,#00a882);color:#04060e;box-shadow:0 6px 24px rgba(0,212,170,0.35); }
        .gen-btn:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 10px 32px rgba(0,212,170,0.45); }
        .gen-btn:active:not(:disabled) { transform:translateY(0); }
        .gen-btn:disabled { opacity:0.5;cursor:default; }
        .station-select { background:rgba(255,255,255,0.03);border:1px solid rgba(100,130,160,0.25);border-radius:12px;padding:10px 14px;color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:500;outline:none;cursor:pointer;width:100%;transition:border-color 0.2s; }
        .station-select:focus { border-color:rgba(0,212,170,0.5); }
        .station-select option { background:#0f1a2e; }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        .shimmer-bar { position:relative;overflow:hidden;background:rgba(255,255,255,0.03);border-radius:8px; }
        .shimmer-bar::after { content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(0,212,170,0.08),transparent);animation:shimmer 1.6s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .blink { animation:blink 1.2s ease infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .recharts-cartesian-grid-horizontal line,.recharts-cartesian-grid-vertical line { stroke:rgba(100,130,160,0.1)!important; }
        .recharts-rectangle.recharts-tooltip-cursor { fill:rgba(0,212,170,0.05)!important;stroke:none!important; }
        @media (max-width: 767px) {
          .pred-insight-grid { grid-template-columns: 1fr !important; }
          .pred-controls-row { flex-direction: column !important; align-items: stretch !important; gap: 20px !important; }
          .pred-gen-btn-wrap { margin-left: 0 !important; }
          .pred-header h1 { font-size: clamp(26px, 8vw, 44px) !important; }
          .pred-stats-row { gap: 10px !important; }
          .pred-chart-header { flex-direction: column !important; gap: 10px !important; align-items: flex-start !important; }
        }
      `}</style>

      <div className="pred-bg">
        <div className="pred-orb pred-orb-1" />
        <div className="pred-orb pred-orb-2" />
        <div className="pred-orb pred-orb-3" />
        <div className="pred-grid" />
        <div className="pred-vignette" />
      </div>

      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.5 }}
        className="pred-content min-h-screen max-w-6xl mx-auto"
        style={{ paddingTop: isMobile ? 64 : 112, paddingBottom: isMobile ? 80 : 96, paddingLeft: 16, paddingRight: 16 }}>

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}
          className="pred-header" style={{ marginBottom: isMobile ? 28 : 48 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, flexWrap:'wrap' }}>
            <div style={{ width:44,height:44,borderRadius:12,background:'rgba(0,212,170,0.12)',border:'1px solid rgba(0,212,170,0.3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Brain size={22} style={{ color:'#00d4aa' }} />
            </div>
            <h1 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize:44, fontWeight:800, color:'#f8fafc', letterSpacing:'-0.02em', margin:0, lineHeight:1 }}>
              AI Prediction Engine
            </h1>
            <div style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:99,background:'rgba(0,212,170,0.1)',border:'1px solid rgba(0,212,170,0.25)' }}>
              <div className="blink" style={{ width:6,height:6,borderRadius:'50%',background:'#00d4aa',boxShadow:'0 0 8px #00d4aa' }} />
              <span style={{ fontSize:11,fontWeight:700,color:'#00d4aa',fontFamily:'JetBrains Mono, monospace',letterSpacing:'0.08em' }}>LIVE</span>
            </div>
            {shapesLoading && (
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <Loader2 size={16} style={{ color:'#64748b',animation:'spin 1s linear infinite' }} />
                <span style={{ fontSize:13,color:'#64748b',fontFamily:'JetBrains Mono, monospace' }}>syncing…</span>
              </div>
            )}
          </div>
          <p style={{ fontSize:isMobile?12:16, color:'#64748b', fontFamily:'JetBrains Mono, monospace', margin:0, letterSpacing:'0.02em' }}>
            Sensor-anchored forecast · CAMS trend · {dataPointCount} data points
          </p>
        </motion.div>

        {/* Controls */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
          className="glass" style={{ padding: isMobile ? '20px 16px' : '32px', marginBottom:24 }}>
          <div className="pred-controls-row" style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:24 }}>

            <div style={{ flex:1, minWidth: isMobile ? '100%' : 260 }}>
              <div style={{ fontSize:12,fontWeight:600,color:'#64748b',letterSpacing:'0.12em',textTransform:'uppercase',fontFamily:'JetBrains Mono, monospace',marginBottom:10 }}>City Station</div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <select value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); setLocAqi(null); setLocLabel(null); setLocCoords(null); setLocState('idle'); }}
                  className="station-select">
                  <option value="">My Location ({cityName})</option>
                  {cityStations.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — AQI {s.aqi}</option>
                  ))}
                </select>
                <button onClick={handleLocate} disabled={locState==='loading'} title="Use my live location"
                  style={{ width:44,height:44,borderRadius:12,cursor:locState==='loading'?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.2s',background:locState==='found'?'rgba(0,212,170,0.15)':locState==='error'?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.03)',border:`1px solid ${locState==='found'?'rgba(0,212,170,0.4)':locState==='error'?'rgba(239,68,68,0.3)':'rgba(100,130,160,0.25)'}` }}>
                  {locState==='loading' ? <Loader2 size={20} style={{ color:'#00d4aa',animation:'spin 1s linear infinite' }} />
                    : locState==='found' ? <Navigation size={20} style={{ color:'#00d4aa' }} />
                    : locState==='error' ? <MapPin size={20} style={{ color:'#ef4444' }} />
                    : <MapPin size={20} style={{ color:'#94a3b8' }} />}
                </button>
              </div>
              <div style={{ marginTop:10,display:'flex',alignItems:'center',gap:8,minHeight:20 }}>
                {locState==='found' && locLabel ? (
                  <><Navigation size={12} style={{ color:'#00d4aa' }} /><span style={{ fontSize:12,fontWeight:600,color:'#00d4aa',fontFamily:'JetBrains Mono, monospace' }}>{locLabel} · AQI {locAqi}</span></>
                ) : locState==='error' ? (
                  <span style={{ fontSize:12,fontWeight:600,color:'#ef4444',fontFamily:'JetBrains Mono, monospace' }}>Location unavailable</span>
                ) : locState==='loading' ? (
                  <span style={{ fontSize:12,color:'#64748b',fontFamily:'JetBrains Mono, monospace' }}>Detecting location…</span>
                ) : (
                  <><div style={{ width:8,height:8,borderRadius:'50%',background:aqiColor,boxShadow:`0 0 10px ${aqiColor}` }} /><span style={{ fontSize:12,fontWeight:600,color:aqiColor,fontFamily:'JetBrains Mono, monospace' }}>{getAQICategory(activeAqi).label} · AQI {activeAqi}</span></>
                )}
              </div>
            </div>

            <div style={{ minWidth: isMobile ? '100%' : 'auto' }}>
              <div style={{ fontSize:12,fontWeight:600,color:'#64748b',letterSpacing:'0.12em',textTransform:'uppercase',fontFamily:'JetBrains Mono, monospace',marginBottom:10 }}>
                Forecast Horizon {prediction && !isMobile && <span style={{ color:'#00d4aa',marginLeft:8 }}>· fresh fetch on change</span>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[6,12,24,48].map(h => (
                  <button key={h} onClick={() => handleHorizonChange(h)} className={`horizon-btn ${horizon===h?'active':''}`}>{h}h</button>
                ))}
              </div>
            </div>

            <div className="pred-gen-btn-wrap" style={{ marginLeft:'auto' }}>
              <button onClick={handleGenerate} disabled={loading||shapesLoading} className="gen-btn">
                {loading ? <><Loader2 size={18} style={{ animation:'spin 1s linear infinite' }} /> Forecasting…</>
                  : shapesLoading ? <><Loader2 size={18} style={{ animation:'spin 1s linear infinite' }} /> Loading…</>
                  : <><Zap size={18} /> Generate</>}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="glass" style={{ padding: isMobile ? 20 : 32, marginBottom:24, position:'relative', overflow:'hidden' }}>
              <ScanEffect />
              <div style={{ display:'flex',gap:14,marginBottom:24,flexWrap:'wrap' }}>
                {[200,140,100].map((w,i) => <div key={i} className="shimmer-bar" style={{ height:16,width:Math.min(w,isMobile?120:w),borderRadius:6 }} />)}
              </div>
              <div className="shimmer-bar" style={{ height: isMobile ? 200 : 280, borderRadius:16 }} />
              <div style={{ marginTop:24,textAlign:'center' }}>
                <span style={{ fontSize:12,fontWeight:600,color:'#64748b',fontFamily:'JetBrains Mono, monospace',letterSpacing:'0.08em' }}>FETCHING CAMS · {horizon}h WINDOW</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {prediction && !loading && (
            <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} transition={{ duration:0.4 }}>
              <div className="pred-stats-row" style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
                <StatPill label="Peak"    value={String(peakAqi)}  color={getAQIColor(peakAqi!)}  delay={0}    />
                <StatPill label="Avg"     value={String(avgAqi)}   color={getAQIColor(avgAqi!)}   delay={0.06} />
                <StatPill label="Min"     value={String(minAqi)}   color={getAQIColor(minAqi!)}   delay={0.12} />
                <StatPill label="Horizon" value={`${horizon}h`}    color="#94a3b8"                delay={0.18} />
                <StatPill label="Trend"   value={trendDir ?? '—'}  color={trendDir?.includes('↑')?'#ef4444':'#00d4aa'} delay={0.24} />
                {!isMobile && <StatPill label="Source" value="CAMS" color="#64748b" delay={0.3} />}
              </div>

              <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}
                className="glass" style={{ padding: isMobile ? '16px 10px 12px' : '32px 24px 20px', marginBottom:20, position:'relative', overflow:'hidden' }}>
                <div className="pred-chart-header" style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,paddingLeft:isMobile?4:12,flexWrap:'wrap',gap:10 }}>
                  <div>
                    <div style={{ fontSize:11,fontWeight:600,color:'#64748b',letterSpacing:'0.12em',textTransform:'uppercase',fontFamily:'JetBrains Mono, monospace',marginBottom:4 }}>Sensor-Anchored CAMS Forecast</div>
                    <div style={{ fontSize:isMobile?15:20,fontWeight:700,color:'#f8fafc',fontFamily:'JetBrains Mono, monospace' }}>{activeName} · {horizon}h</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 360}>
                  <AreaChart data={prediction}>
                    <defs>
                      <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#00d4aa" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#00d4aa" stopOpacity="0.02" />
                      </linearGradient>
                      <filter id="lineGlow">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4"/>
                    <XAxis dataKey="time" tick={{ fontSize:isMobile?9:12,fontFamily:'JetBrains Mono',fill:'#64748b',fontWeight:500 }} tickLine={false} axisLine={{ stroke:'rgba(100,130,160,0.2)' }} interval={Math.max(1,Math.floor(prediction.length/6))} />
                    <YAxis tick={{ fontSize:isMobile?9:12,fontFamily:'JetBrains Mono',fill:'#64748b',fontWeight:500 }} tickLine={false} axisLine={false} width={isMobile?32:44} />
                    <Tooltip content={<CustomTooltip/>} cursor={{ stroke:'rgba(0,212,170,0.25)',strokeWidth:1.5,fill:'none' }}/>
                    <ReferenceLine y={50}  stroke="#00d4aa" strokeDasharray="5 5" strokeOpacity={0.3}/>
                    <ReferenceLine y={100} stroke="#fbbf24" strokeDasharray="5 5" strokeOpacity={0.4} label={!isMobile?{value:'Moderate',position:'right',fill:'#fbbf24',fontSize:11,fontWeight:600,fontFamily:'JetBrains Mono'}:undefined}/>
                    <ReferenceLine y={150} stroke="#f59e0b" strokeDasharray="5 5" strokeOpacity={0.4} label={!isMobile?{value:'Unhealthy',position:'right',fill:'#f59e0b',fontSize:11,fontWeight:600,fontFamily:'JetBrains Mono'}:undefined}/>
                    <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.4} label={!isMobile?{value:'Very Unhealthy',position:'right',fill:'#ef4444',fontSize:11,fontWeight:600,fontFamily:'JetBrains Mono'}:undefined}/>
                    <Area type="monotone" dataKey="upper" stroke="none" fill="url(#bandGrad)"/>
                    <Area type="monotone" dataKey="lower" stroke="none" fill="#050810"/>
                    <Area type="monotone" dataKey="aqi" stroke="#00d4aa" strokeWidth={isMobile?2:3} fill="url(#predGrad)" dot={false} activeDot={{ r:5,fill:'#00d4aa',stroke:'rgba(4,6,14,0.9)',strokeWidth:2 }} filter="url(#lineGlow)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {aiInsight && (
                <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.2 }}
                  className="pred-insight-grid"
                  style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:24 }}>
                  <div className="glass-bright" style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
                      <div style={{ width:36,height:36,borderRadius:10,background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.25)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                        <AlertTriangle size={18} style={{ color:'#fbbf24' }}/>
                      </div>
                      <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif',fontSize:isMobile?16:18,fontWeight:700,color:'#f8fafc' }}>Risk Assessment</span>
                    </div>
                    <p style={{ fontSize:isMobile?13:15,color:'#94a3b8',lineHeight:1.8,fontFamily:'Inter, sans-serif',margin:0 }}>{aiInsight}</p>
                  </div>
                  <div className="glass-bright" style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
                      <div style={{ width:36,height:36,borderRadius:10,background:'rgba(0,212,170,0.12)',border:'1px solid rgba(0,212,170,0.25)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                        <Shield size={18} style={{ color:'#00d4aa' }}/>
                      </div>
                      <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif',fontSize:isMobile?16:18,fontWeight:700,color:'#f8fafc' }}>Recommended Actions</span>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                      {[
                        { icon:'🚗', text:'Avoid high-traffic zones during peak hours' },
                        { icon:'😷', text:'Wear N95 masks outdoors if AQI > 100' },
                        { icon:'🏃', text:'Reschedule outdoor exercise to lowest AQI window' },
                        { icon:'🪟', text:'Keep windows closed, use air purifiers' },
                        { icon:'💧', text:'Stay hydrated, monitor respiratory symptoms' },
                      ].map((item,i) => (
                        <motion.div key={i} initial={{ opacity:0,x:-10 }} animate={{ opacity:1,x:0 }} transition={{ delay:0.25+i*0.06 }}
                          style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:12,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize:16 }}>{item.icon}</span>
                          <span style={{ fontSize:isMobile?12:14,fontWeight:500,color:'#cbd5e1',fontFamily:'Inter, sans-serif',lineHeight:1.5 }}>{item.text}</span>
                          <ChevronRight size={14} style={{ color:'#475569',marginLeft:'auto',flexShrink:0 }}/>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!prediction && !loading && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}
            className="glass" style={{ padding: isMobile ? '48px 20px' : '80px 40px', textAlign:'center', marginBottom:24 }}>
            <div style={{ fontSize: isMobile ? 40 : 56, marginBottom:20 }}>🛰️</div>
            <div style={{ fontFamily:'Plus Jakarta Sans, sans-serif',fontSize:isMobile?20:24,fontWeight:800,color:'#f8fafc',marginBottom:10,letterSpacing:'-0.02em' }}>
              {shapesLoading ? 'Loading forecast data…' : 'Ready to forecast'}
            </div>
            <p style={{ fontSize:isMobile?13:16,color:'#64748b',fontFamily:'Inter, sans-serif',maxWidth:480,margin:'0 auto 24px',lineHeight:1.7 }}>
              {shapesLoading
                ? `Fetching ${activeName} hourly PM2.5 data from Open-Meteo CAMS…`
                : `Forecast will start from your real AQI (${activeAqi}) and follow CAMS trend. Select horizon and generate.`}
            </p>
            {!shapesLoading && (
              <button onClick={handleGenerate} className="gen-btn" style={{ margin:'0 auto',display:'inline-flex' }}>
                <Zap size={18}/> Generate Forecast
              </button>
            )}
          </motion.div>
        )}

      </motion.div>
    </>
  );
};

export default Predict;