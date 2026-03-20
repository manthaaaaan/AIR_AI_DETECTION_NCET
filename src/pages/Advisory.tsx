import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAirQuality } from '@/context/AirQualityContext';
import { getAQICategory, getAQIColor } from '@/data/mockSensorData';
import { generateAQIReport } from '@/utils/generateAQIReport';
import {
  Heart, Download, TrendingUp, Send,
  Bot, User, Sparkles, Wind,
  Thermometer,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AQIChartPoint {
  hour: string;
  aqi: number;
}

// ── Quick prompts ──────────────────────────────────────────────
const QUICK_PROMPTS = [
  "Is it safe to go for a run today?",
  "What was AQI like in the past few hours?",
  "Will the air quality get better or worse?",
  "What mask should I wear outside?",
  "Best time to open windows today?",
  "Should I use an air purifier?",
];

// ── Fetch past 24 hours of us_aqi from Open-Meteo ─────────────
async function fetchPast24Hours(lat: number, lon: number): Promise<AQIChartPoint[]> {
  const now       = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=us_aqi` +
    `&start_date=${fmt(yesterday)}` +
    `&end_date=${fmt(now)}` +
    `&timezone=auto` +
    `&domains=cams_global`
  );
  if (!res.ok) throw new Error(`Open-Meteo fetch failed: ${res.status}`);
  const data  = await res.json();
  const times: string[] = data.hourly?.time   ?? [];
  const aqis:  number[] = data.hourly?.us_aqi ?? [];

  now.setMinutes(0, 0, 0);

  let nowIdx = -1;
  for (let i = times.length - 1; i >= 0; i--) {
    if (new Date(times[i]) <= now) { nowIdx = i; break; }
  }

  const endIdx   = nowIdx >= 0 ? nowIdx + 1 : times.length;
  const startIdx = Math.max(0, endIdx - 24);

  return times.slice(startIdx, endIdx).map((t, i) => ({
    hour: `${new Date(t).getHours().toString().padStart(2, '0')}:00`,
    aqi:  aqis[startIdx + i] ?? 0,
  }));
}

// ── Fetch next 24 hours forecast from Open-Meteo ──────────────
async function fetchNext24Hours(lat: number, lon: number): Promise<AQIChartPoint[]> {
  const now     = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=us_aqi` +
    `&start_date=${fmt(now)}` +
    `&end_date=${fmt(tomorrow)}` +
    `&timezone=auto` +
    `&domains=cams_global`
  );
  if (!res.ok) throw new Error(`Open-Meteo forecast fetch failed: ${res.status}`);
  const data  = await res.json();
  const times: string[] = data.hourly?.time   ?? [];
  const aqis:  number[] = data.hourly?.us_aqi ?? [];

  now.setMinutes(0, 0, 0);

  // Find current hour index
  let nowIdx = -1;
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]) >= now) { nowIdx = i; break; }
  }

  const startIdx = nowIdx >= 0 ? nowIdx : 0;
  const endIdx   = Math.min(startIdx + 24, times.length);

  return times.slice(startIdx, endIdx).map((t, i) => ({
    hour: new Date(t).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
    aqi:  aqis[startIdx + i] ?? 0,
  }));
}

// ── Chat bubble ────────────────────────────────────────────────
const ChatBubble = ({ msg }: { msg: ChatMessage }) => {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 14,
      }}
    >
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#e6faf6', border: '1px solid #b2ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <Bot size={14} style={{ color: '#00b38f' }} />
        </div>
      )}
      <div style={{
        maxWidth: '78%', padding: '10px 14px',
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        background: isUser ? '#00b38f' : 'rgba(30,45,65,0.9)',
        border: isUser ? 'none' : '1px solid rgba(100,130,160,0.18)',
        boxShadow: isUser ? '0 2px 8px rgba(0,179,143,0.3)' : '0 1px 6px rgba(0,0,0,0.2)',
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 15,
        color: isUser ? '#ffffff' : '#cbd5e1', lineHeight: 1.75,
        whiteSpace: 'pre-wrap', letterSpacing: '0.01em',
      }}>
        {msg.content}
      </div>
      {isUser && (
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <User size={14} style={{ color: '#64748b' }} />
        </div>
      )}
    </motion.div>
  );
};

// ── Typing indicator ───────────────────────────────────────────
const TypingIndicator = () => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#e6faf6', border: '1px solid #b2ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Bot size={14} style={{ color: '#00b38f' }} />
    </div>
    <div style={{ padding: '12px 16px', borderRadius: '4px 16px 16px 16px', background: 'rgba(30,45,65,0.9)', border: '1px solid rgba(100,130,160,0.18)', boxShadow: '0 1px 6px rgba(0,0,0,0.2)', display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: '#00b38f' }} />
      ))}
    </div>
  </div>
);

// ── AQI Chart ─────────────────────────────────────────────────
const AQIChart = ({ cityName, chartData, currentAQI }: {
  cityName: string;
  chartData: AQIChartPoint[];
  currentAQI: number;
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data: AQIChartPoint[] = chartData.length > 0
    ? chartData
    : Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, '00')}:00`,
        aqi: currentAQI,
      }));

  const W = 800, H = 180, padL = 36, padR = 60, padT = 16, padB = 32;
  const cW = W - padL - padR, cH = H - padT - padB;
  const vals = data.map(d => d.aqi);
  const minV = Math.max(0, Math.min(...vals) - 20);
  const maxV = Math.max(...vals) + 20;
  const x = (i: number) => padL + (i / Math.max(vals.length - 1, 1)) * cW;
  const y = (v: number) => padT + cH - ((v - minV) / Math.max(maxV - minV, 1)) * cH;

  const area = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    + ` L${x(vals.length - 1).toFixed(1)},${(padT + cH).toFixed(1)} L${x(0).toFixed(1)},${(padT + cH).toFixed(1)} Z`;
  const line = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const nowIdx = data.length - 1;
  const thresholds = [{ v: 50, label: 'Good' }, { v: 100, label: 'Moderate' }, { v: 150, label: 'Unhealthy' }];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect   = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const relX   = mouseX - padL;
    const idx    = Math.round((relX / cW) * (vals.length - 1));
    if (idx >= 0 && idx < vals.length) setHoverIdx(idx);
  };

  const hi       = hoverIdx ?? nowIdx;
  const hX       = x(hi);
  const hY       = y(vals[hi]);
  const hColor   = getAQIColor(vals[hi]);
  const tooltipX = hX > W - padR - 80 ? hX - 90 : hX + 10;
  const labelInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="adv-card" style={{ borderRadius: 20, padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <TrendingUp size={15} style={{ color: '#00b38f' }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
          Past 24-Hour AQI
        </span>
        <span style={{ fontSize: 12, color: '#334155', marginLeft: 4 }}>· {cityName}</span>
        {chartData.length === 0 && (
          <span style={{ fontSize: 12, color: '#475569', marginLeft: 8 }}>Loading…</span>
        )}
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00d4aa" stopOpacity="0.02" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="glowStrong"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {thresholds.map(t => {
          const ty = y(t.v);
          if (ty < padT || ty > padT + cH) return null;
          return (
            <g key={t.v}>
              <line x1={padL} y1={ty} x2={W - padR} y2={ty} stroke={getAQIColor(t.v)} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.35" />
              <text x={W - padR + 4} y={ty + 4} fontSize="9" fill={getAQIColor(t.v)} opacity="0.6">{t.label}</text>
            </g>
          );
        })}

        {[minV, Math.round((minV + maxV) / 2), maxV].map(v => (
          <text key={v} x={padL - 6} y={y(v) + 4} fontSize="9" fill="#334155" textAnchor="end">{Math.round(v)}</text>
        ))}

        {data.filter((_, i) => i % labelInterval === 0).map((d, i) => (
          <text key={i} x={x(i * labelInterval)} y={H - 4} fontSize="9"
            fill={hi === i * labelInterval ? '#94a3b8' : '#334155'}
            textAnchor="middle" style={{ transition: 'fill 0.15s' }}>
            {d.hour}
          </text>
        ))}
        <text x={x(data.length - 1)} y={H - 4} fontSize="9" fill="#00b38f" textAnchor="middle" fontWeight="700">
          NOW
        </text>

        <path d={area} fill="url(#aqiGrad)" />
        <path d={line} fill="none" stroke="#00d4aa" strokeWidth="2" strokeLinejoin="round" filter="url(#glow)" />

        {vals.filter((_, i) => i % labelInterval === 0).map((v, i) => (
          <circle key={i} cx={x(i * labelInterval)} cy={y(v)} r={hi === i * labelInterval ? 0 : 3}
            fill={getAQIColor(v)} stroke="rgba(6,8,14,0.8)" strokeWidth="1.5" />
        ))}

        <circle cx={x(nowIdx)} cy={y(vals[nowIdx])} r="6" fill="#00b38f" stroke="rgba(6,8,14,0.9)" strokeWidth="2" filter="url(#glow)" />
        <circle cx={x(nowIdx)} cy={y(vals[nowIdx])} r="10" fill="#00b38f" opacity="0.15" filter="url(#glowStrong)" />

        <line x1={hX} y1={padT} x2={hX} y2={padT + cH} stroke={hColor} strokeWidth="1" strokeDasharray="4 3" opacity="0.6" style={{ transition: 'all 0.05s' }} />
        <circle cx={hX} cy={hY} r="10" fill={hColor} opacity="0.12" filter="url(#glowStrong)" style={{ transition: 'all 0.05s' }} />
        <circle cx={hX} cy={hY} r="6" fill="none" stroke={hColor} strokeWidth="1.5" opacity="0.5" style={{ transition: 'all 0.05s' }} />
        <circle cx={hX} cy={hY} r="4" fill={hColor} stroke="rgba(6,8,14,0.9)" strokeWidth="2" filter="url(#glow)" style={{ transition: 'all 0.05s' }} />

        <g style={{ transition: 'all 0.05s' }}>
          <rect x={tooltipX} y={hY - 28} width={80} height={22} rx="6" fill="rgba(6,8,14,0.92)" stroke={hColor} strokeWidth="0.8" opacity="0.95" />
          <text x={tooltipX + 40} y={hY - 20} fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{data[hi]?.hour}</text>
          <text x={tooltipX + 40} y={hY - 10} fontSize="10" fill={hColor} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontWeight="700">AQI {vals[hi]}</text>
        </g>

        <rect x={padL} y={padT} width={cW} height={cH} fill="transparent" />
      </svg>

      <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Good', v: 25 }, { label: 'Moderate', v: 75 }, { label: 'Unhealthy', v: 125 }, { label: 'Very Unhealthy', v: 250 }].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: getAQIColor(l.v) }} />
            <span style={{ fontSize: 14, color: '#64748b', fontFamily: 'IBM Plex Mono, monospace' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Advisory ──────────────────────────────────────────────
const Advisory = () => {
  const { liveAvgAQI, cityAQI, stations, alerts, cityName, userCoords } = useAirQuality();

  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [chartData,   setChartData]   = useState<AQIChartPoint[]>([]);
  const [forecastData, setForecastData] = useState<AQIChartPoint[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeAQI = liveAvgAQI || cityAQI;

  const displayName    = (name: string) => !name || name === 'Current Location' ? cityName : name;
  const localStations  = stations.filter(s => !s.id.startsWith('init-'));
  const targetStations = localStations.length > 0 ? localStations : stations;
  const peakStation    = [...targetStations].sort((a, b) => b.aqi - a.aqi)[0] || { name: 'N/A', aqi: 0 };
  const lowestStation  = [...targetStations].sort((a, b) => a.aqi - b.aqi)[0] || { name: 'N/A', aqi: 0 };
  const cat = getAQICategory(activeAQI);
  const aqiColor = getAQIColor(activeAQI);

  // ── Fetch past 24h chart data ──────────────────────────────
  useEffect(() => {
    const [lat, lon] = userCoords;
    if (!lat || !lon) return;
    fetchPast24Hours(lat, lon)
      .then(setChartData)
      .catch(e => console.error('Chart fetch failed:', e));
    fetchNext24Hours(lat, lon)
      .then(setForecastData)
      .catch(e => console.error('Forecast fetch failed:', e));
  }, [userCoords]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildSystemPrompt = () => {
    const now          = new Date();
    const todayStr     = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr      = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const yesterdayStr = new Date(now.getTime() - 86400000).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    const tomorrowStr  = new Date(now.getTime() + 86400000).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

    const past24Summary = chartData.length > 0
      ? chartData.map(p => `  ${p.hour}: AQI ${p.aqi}`).join('\n')
      : `  No historical data loaded yet. Current AQI is ${activeAQI} — use this as baseline.`;

    const forecastSummary = forecastData.length > 0
      ? forecastData.map(f => `  ${f.hour}: AQI ${f.aqi}`).join('\n')
      : `  No forecast data loaded yet. Based on current AQI of ${activeAQI} (${cat.label}), conditions are expected to be similar. Always add this caveat when estimating.`;

    const stationsSummary = localStations.length > 0
      ? localStations.map(s => `  ${s.name}: AQI ${s.aqi} | PM2.5 ${s.pm25} | PM10 ${s.pm10} | NO2 ${s.no2} | O3 ${s.o3}`).join('\n')
      : '  No live nearby stations loaded yet.';

    return `
You are AeroSense AI, a friendly and knowledgeable air quality health advisor.

Location: ${cityName}
Current date: ${todayStr}
Current time: ${timeStr}
Yesterday: ${yesterdayStr}
Tomorrow: ${tomorrowStr}
Data source: Open-Meteo CAMS (real-time)

CURRENT AIR QUALITY:
- City AQI: ${activeAQI} (${cat.label})
- Peak zone: ${displayName(peakStation.name)} at AQI ${peakStation.aqi}
- Cleanest zone: ${displayName(lowestStation.name)} at AQI ${lowestStation.aqi}
- Active alerts: ${alerts.length > 0 ? alerts.map(a => `${displayName(a.stationName)} AQI ${a.aqi}`).join(', ') : 'None'}

LIVE NEARBY STATIONS:
${stationsSummary}

PAST 24 HOURS (real Open-Meteo data, hourly):
${past24Summary}

FORECAST NEXT 24 HOURS (real Open-Meteo data, hourly):
${forecastSummary}

YOUR ROLE:
- Answer questions about PAST, CURRENT, and FUTURE air quality using the real data above
- When asked about "yesterday" → look at the earliest entries in PAST 24 HOURS and summarize
- When asked about "tomorrow" → find entries in FORECAST for ${tomorrowStr} and summarize specifically
- When asked "will it get better/worse" → compare current AQI to upcoming FORECAST entries and answer specifically
- When asked "what's AQI now" → use current AQI ${activeAQI}
- When asked "what was AQI at X time" → look at PAST data and answer specifically
- NEVER say "I don't have forecast data" — always give a best estimate using available data, clearly stating if it's an estimate
- AQI values are on the 0–500 US scale — never say AQI 1 or AQI 2
- Give specific, actionable health advice based on the data
- Be concise — 2–4 sentences max
- Be warm, not clinical. Think "knowledgeable friend" not "medical pamphlet"
- Never give medical diagnoses. Suggest consulting a doctor for serious conditions.
- If asked about unrelated topics, gently redirect to air quality / health
    `.trim();
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    if (!chatStarted) setChatStarted(true);

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      const groqMessages = [
        { role: 'system', content: buildSystemPrompt() },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: groqMessages,
          max_tokens: 256,
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? 'Sorry, I could not get a response. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      console.error('Groq error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please check your network and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    generateAQIReport({
      cityName,
      activeAQI,
      catLabel:          cat.label,
      peakStationName:   displayName(peakStation.name),
      peakStationAQI:    peakStation.aqi,
      lowestStationName: displayName(lowestStation.name),
      lowestStationAQI:  lowestStation.aqi,
      pm25:  localStations[0]?.pm25  ?? null,
      pm10:  localStations[0]?.pm10  ?? null,
      o3:    localStations[0]?.o3    ?? null,
      no2:   localStations[0]?.no2   ?? null,
      chartData,
      alerts: alerts.map(a => ({
        stationName: displayName(a.stationName),
        aqi:         a.aqi,
      })),
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        .adv-scroll::-webkit-scrollbar { width: 4px; }
        .adv-scroll::-webkit-scrollbar-track { background: transparent; }
        .adv-scroll::-webkit-scrollbar-thumb { background: rgba(0,179,143,0.25); border-radius: 99px; }
        @keyframes adv-fade-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .adv-card { animation: adv-fade-up 0.4s ease both; }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        .pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
        .chat-input:focus { border-color: rgba(0,179,143,0.5) !important; outline: none; }
        .chat-input::placeholder { color: rgba(100,130,160,0.55); }
        .adv-bg {
          position: fixed; inset: 0; z-index: 0; overflow: hidden;
          background:
            radial-gradient(ellipse 80% 60% at 10% 10%, #0a2e22 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 90% 80%, #071428 0%, transparent 60%),
            #050810;
        }
        .adv-orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.9; animation: orb-drift linear infinite; }
        .adv-orb-1 { width:750px; height:750px; top:-200px; left:-150px; background:radial-gradient(circle,rgba(0,212,170,0.75) 0%,rgba(0,180,140,0.35) 40%,transparent 70%); animation-duration:18s; }
        .adv-orb-2 { width:650px; height:650px; bottom:-150px; right:-100px; background:radial-gradient(circle,rgba(0,100,220,0.65) 0%,rgba(0,60,180,0.25) 45%,transparent 70%); animation-duration:24s; animation-direction:reverse; }
        .adv-orb-3 { width:500px; height:500px; top:35%; left:50%; background:radial-gradient(circle,rgba(0,200,160,0.5) 0%,rgba(0,150,110,0.18) 50%,transparent 75%); animation-duration:28s; animation-delay:-8s; }
        .adv-orb-4 { width:420px; height:420px; top:15%; right:10%; background:radial-gradient(circle,rgba(30,120,255,0.45) 0%,rgba(10,70,200,0.15) 50%,transparent 75%); animation-duration:20s; animation-delay:-5s; }
        .adv-orb-5 { width:320px; height:320px; bottom:20%; left:30%; background:radial-gradient(circle,rgba(0,230,180,0.4) 0%,transparent 65%); animation-duration:26s; animation-delay:-12s; animation-direction:reverse; }
        @keyframes orb-drift {
          0%   { transform:translate(0px,0px) scale(1); }
          20%  { transform:translate(50px,-40px) scale(1.08); }
          45%  { transform:translate(30px,60px) scale(0.93); }
          70%  { transform:translate(-45px,25px) scale(1.06); }
          100% { transform:translate(0px,0px) scale(1); }
        }
        .adv-grid {
          position:absolute; inset:0;
          background-image: linear-gradient(rgba(0,212,170,0.07) 1px,transparent 1px), linear-gradient(90deg,rgba(0,212,170,0.07) 1px,transparent 1px);
          background-size:48px 48px;
          mask-image:radial-gradient(ellipse at 50% 40%,black 20%,transparent 75%);
        }
        .adv-scanline {
          position:absolute; inset:0;
          background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px);
          pointer-events:none;
        }
        .adv-vignette { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 50%,transparent 30%,rgba(5,8,16,0.6) 100%); }
        .adv-content { position:relative; z-index:1; }
      `}</style>

      <div className="adv-bg">
        <div className="adv-orb adv-orb-1" />
        <div className="adv-orb adv-orb-2" />
        <div className="adv-orb adv-orb-3" />
        <div className="adv-orb adv-orb-4" />
        <div className="adv-orb adv-orb-5" />
        <div className="adv-grid" />
        <div className="adv-scanline" />
        <div className="adv-vignette" />
      </div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        className="adv-content pt-28 pb-24 px-4 min-h-screen max-w-6xl mx-auto"
        style={{ fontFamily: 'IBM Plex Mono, monospace' }}
      >
        {/* ── Page Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Heart size={22} style={{ color: aqiColor }} />
            <h1 style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 40, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em', margin: 0 }}>
              Public Health Advisory
            </h1>
          </div>
          <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
            AI-powered health guidance for <span style={{ color: '#94a3b8' }}>{cityName}</span> · AQI&nbsp;
            <span style={{ color: aqiColor, fontWeight: 700 }}>{activeAQI}</span>&nbsp;
            <span style={{ color: aqiColor, fontSize: 13 }}>({cat.label})</span>
          </p>
        </div>

        {/* ── AQI Hero Banner ── */}
        <div className="adv-card" style={{ marginBottom: 24, borderRadius: 20, padding: '20px 24px', background: `linear-gradient(135deg,${aqiColor}12 0%,rgba(6,8,14,0) 100%)`, border: `1px solid ${aqiColor}30`, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Current City AQI</div>
            <div style={{ fontSize: 64, fontWeight: 700, color: aqiColor, lineHeight: 1, textShadow: `0 0 30px ${aqiColor}44` }}>{activeAQI}</div>
            <div style={{ marginTop: 6, display: 'inline-block', padding: '4px 12px', borderRadius: 99, background: aqiColor + '20', color: aqiColor, fontSize: 13, fontWeight: 700, border: `1px solid ${aqiColor}40`, letterSpacing: '0.06em' }}>
              {cat.label.toUpperCase()}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={14} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: 14, color: '#94a3b8' }}>Peak: <span style={{ color: getAQIColor(peakStation.aqi), fontWeight: 600 }}>{displayName(peakStation.name)}</span> · AQI {peakStation.aqi}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wind size={14} style={{ color: '#00b38f' }} />
              <span style={{ fontSize: 14, color: '#94a3b8' }}>Cleanest: <span style={{ color: getAQIColor(lowestStation.aqi), fontWeight: 600 }}>{displayName(lowestStation.name)}</span> · AQI {lowestStation.aqi}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Thermometer size={14} style={{ color: '#fbbf24' }} />
              <span style={{ fontSize: 14, color: '#94a3b8' }}>
                PM2.5: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {localStations[0]?.pm25 ? `${localStations[0].pm25} µg/m³` : 'Loading...'}
                </span>
              </span>
            </div>
          </div>
          <button onClick={handleDownload}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8'; }}>
            <Download size={12} /> Download Report
          </button>
        </div>

        {/* ── Inline AI Chat ── */}
        <div className="adv-card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>
            AI Health Advisor
          </div>
          <div style={{ borderRadius: 20, overflow: 'hidden', background: 'rgba(15,23,35,0.85)', border: '1px solid rgba(100,130,160,0.18)', boxShadow: '0 8px 40px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', height: 480 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(100,130,160,0.12)', background: 'rgba(20,30,45,0.9)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,179,143,0.1)', border: '1px solid rgba(0,179,143,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={16} style={{ color: '#00b38f' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>AeroSense AI</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <div className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#00b38f' }} />
                  <span style={{ fontSize: 12, color: '#00b38f', fontFamily: 'IBM Plex Mono, monospace' }}>
                    Live · AQI {activeAQI} · {cityName}
                  </span>
                  <span style={{ fontSize: 11, color: '#334155', marginLeft: 6 }}>
                    · {forecastData.length > 0 ? `${forecastData.length}pt forecast ✓` : 'loading forecast...'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', padding: '4px 10px', borderRadius: 99, border: '1px solid rgba(100,130,160,0.15)', background: 'rgba(255,255,255,0.04)' }}>
                {cat.label}
              </div>
            </div>

            <div className="adv-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', background: 'transparent' }}>
              {!chatStarted && messages.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 8 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🌬️</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Your Air Quality Assistant</div>
                    <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, fontFamily: 'Inter, system-ui, sans-serif' }}>
                      Ask me about past, current, or future air quality in {cityName}.
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    {QUICK_PROMPTS.map(p => (
                      <button key={p} onClick={() => sendMessage(p)}
                        style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(100,130,160,0.15)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: 13.5, fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', gap: 7, lineHeight: 1.5 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,179,143,0.1)'; e.currentTarget.style.borderColor = 'rgba(0,179,143,0.3)'; e.currentTarget.style.color = '#e2e8f0'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(100,130,160,0.15)'; e.currentTarget.style.color = '#94a3b8'; }}>
                        <Sparkles size={10} style={{ color: '#00d4aa', flexShrink: 0, marginTop: 2 }} />
                        {p}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(100,130,160,0.12)', flexShrink: 0, background: 'rgba(15,23,35,0.9)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder="Ask about past, current or future air quality..."
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(100,130,160,0.18)', background: 'linear-gradient(135deg,rgba(30,42,58,0.9) 0%,rgba(20,30,44,0.95) 100%)', color: '#cbd5e1', fontSize: 15, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', transition: 'border-color 0.2s' }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  style={{ width: 38, height: 38, borderRadius: 10, border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', background: input.trim() && !loading ? '#00b38f' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
                  <Send size={15} style={{ color: input.trim() && !loading ? '#ffffff' : '#334155' }} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#334155', marginTop: 7, textAlign: 'center' }}>
                Powered by Groq · Real air data from Open-Meteo CAMS · {cityName}
              </div>
            </div>
          </div>
        </div>

        {/* ── Past 24h AQI Chart ── */}
        <AQIChart
          cityName={cityName}
          chartData={chartData}
          currentAQI={activeAQI}
        />

      </motion.div>
    </>
  );
};

export default Advisory;