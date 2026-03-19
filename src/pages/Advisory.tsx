import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAirQuality } from '@/context/AirQualityContext';
import { getAQICategory, getAQIColor, hourlyAQIData } from '@/data/mockSensorData';
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

// ── Quick prompts ──────────────────────────────────────────────
const QUICK_PROMPTS = [
  "Is it safe to go for a run today?",
  "What was AQI like last night?",
  "Will air quality improve tonight?",
  "What mask should I wear outside?",
  "Best time to open windows today?",
  "Should I use an air purifier?",
];

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

// ── AQI Chart ──────────────────────────────────────────────────
const AQIChart = ({ cityName }: { cityName: string }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 800, H = 180, padL = 36, padR = 60, padT = 16, padB = 32;
  const cW = W - padL - padR, cH = H - padT - padB;
  const vals = hourlyAQIData.map(d => d.aqi);
  const minV = Math.min(...vals) - 20, maxV = Math.max(...vals) + 20;
  const x = (i: number) => padL + (i / (vals.length - 1)) * cW;
  const y = (v: number) => padT + cH - ((v - minV) / (maxV - minV)) * cH;
  const area = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    + ` L${x(vals.length - 1).toFixed(1)},${(padT + cH).toFixed(1)} L${x(0).toFixed(1)},${(padT + cH).toFixed(1)} Z`;
  const line = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const now = new Date().getHours();
  const thresholds = [{ v: 50, label: 'Good' }, { v: 100, label: 'Moderate' }, { v: 150, label: 'Unhealthy' }];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const relX = mouseX - padL;
    const idx = Math.round((relX / cW) * (vals.length - 1));
    if (idx >= 0 && idx < vals.length) setHoverIdx(idx);
  };

  const hi = hoverIdx ?? now;
  const hX = x(hi);
  const hY = y(vals[hi]);
  const hColor = getAQIColor(vals[hi]);
  const tooltipX = hX > W - padR - 80 ? hX - 90 : hX + 10;

  return (
    <div className="adv-card" style={{ borderRadius: 20, padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} style={{ color: '#00b38f' }} />
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>24-Hour AQI Trend</span>
          <span style={{ fontSize: 12, color: '#334155', marginLeft: 4 }}>Today · {cityName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 99, background: hColor + '15', border: `1px solid ${hColor}35` }}>
          <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'IBM Plex Mono, monospace' }}>{hourlyAQIData[hi].hour}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: hColor, fontFamily: 'IBM Plex Mono, monospace' }}>AQI {vals[hi]}</span>
          <span style={{ fontSize: 11, color: hColor, fontFamily: 'IBM Plex Mono, monospace' }}>{getAQICategory(vals[hi]).label}</span>
        </div>
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
        {thresholds.map(t => { const ty = y(t.v); if (ty < padT || ty > padT + cH) return null; return (<g key={t.v}><line x1={padL} y1={ty} x2={W - padR} y2={ty} stroke={getAQIColor(t.v)} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.35" /><text x={W - padR + 4} y={ty + 4} fontSize="9" fill={getAQIColor(t.v)} opacity="0.6">{t.label}</text></g>); })}
        {[minV, Math.round((minV + maxV) / 2), maxV].map(v => (<text key={v} x={padL - 6} y={y(v) + 4} fontSize="9" fill="#334155" textAnchor="end">{Math.round(v)}</text>))}
        {hourlyAQIData.filter((_, i) => i % 3 === 0).map((d, i) => (<text key={i} x={x(i * 3)} y={H - 4} fontSize="9" fill={hi === i * 3 ? '#94a3b8' : '#334155'} textAnchor="middle" style={{ transition: 'fill 0.15s' }}>{d.hour}</text>))}
        <path d={area} fill="url(#aqiGrad)" />
        <path d={line} fill="none" stroke="#00d4aa" strokeWidth="2" strokeLinejoin="round" filter="url(#glow)" />
        {vals.filter((_, i) => i % 3 === 0).map((v, i) => (<circle key={i} cx={x(i * 3)} cy={y(v)} r={hi === i * 3 ? 0 : 3} fill={getAQIColor(v)} stroke="rgba(6,8,14,0.8)" strokeWidth="1.5" />))}
        {hoverIdx === null && (<g><line x1={x(now)} y1={padT} x2={x(now)} y2={padT + cH} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" opacity="0.25" /><rect x={x(now) - 18} y={padT - 2} width="36" height="14" rx="4" fill="rgba(6,8,14,0.8)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" /><text x={x(now)} y={padT + 8} fontSize="8" fill="#64748b" textAnchor="middle">NOW</text></g>)}
        <line x1={hX} y1={padT} x2={hX} y2={padT + cH} stroke={hColor} strokeWidth="1" strokeDasharray="4 3" opacity="0.6" style={{ transition: 'all 0.05s' }} />
        <circle cx={hX} cy={hY} r="10" fill={hColor} opacity="0.12" filter="url(#glowStrong)" style={{ transition: 'all 0.05s' }} />
        <circle cx={hX} cy={hY} r="6" fill="none" stroke={hColor} strokeWidth="1.5" opacity="0.5" style={{ transition: 'all 0.05s' }} />
        <circle cx={hX} cy={hY} r="4" fill={hColor} stroke="rgba(6,8,14,0.9)" strokeWidth="2" filter="url(#glow)" style={{ transition: 'all 0.05s' }} />
        <g style={{ transition: 'all 0.05s' }}>
          <rect x={tooltipX} y={hY - 28} width={80} height={22} rx="6" fill="rgba(6,8,14,0.92)" stroke={hColor} strokeWidth="0.8" opacity="0.95" />
          <text x={tooltipX + 40} y={hY - 20} fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{hourlyAQIData[hi].hour}</text>
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
  const { cityAQI, stations, alerts, cityName, owmAir, owmLoading } = useAirQuality();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const owmCurrent = owmAir ? {
    aqi: owmAir.currentAQI,
    label: owmAir.currentLabel,
    components: { pm2_5: owmAir.pm25, pm10: owmAir.pm10, o3: owmAir.o3, no2: owmAir.no2 },
  } : null;
  const owmPast     = owmAir?.past     ?? [];
  const owmForecast = owmAir?.forecast ?? [];

  const displayName = (name: string) => !name || name === 'Current Location' ? cityName : name;
  const localStations = stations.filter(s => !s.id.startsWith('init-'));
  const targetStations = localStations.length > 0 ? localStations : stations;
  const peakStation    = [...targetStations].sort((a, b) => b.aqi - a.aqi)[0] || { name: 'N/A', aqi: 0 };
  const lowestStation  = [...targetStations].sort((a, b) => a.aqi - b.aqi)[0] || { name: 'N/A', aqi: 0 };
  const cat = getAQICategory(cityAQI);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildSystemPrompt = () => {
    const pastSummary = owmPast.length > 0
      ? owmPast.map(p => `  ${p.hour}: AQI ${p.aqi} (${p.label}), PM2.5 ${p.pm25}µg/m³`).join('\n')
      : hourlyAQIData.slice(0, 8).map(d => `  ${d.hour}: AQI ${d.aqi}`).join('\n');

    const forecastSummary = owmForecast.length > 0
      ? owmForecast.map(f => `  ${f.hour}: AQI ${f.aqi} (${f.label}), PM2.5 ${f.pm25}µg/m³`).join('\n')
      : 'Not available';

    const currentSummary = owmCurrent
      ? `AQI ${owmCurrent.aqi} (${owmCurrent.label}) — PM2.5: ${owmCurrent.components.pm2_5.toFixed(1)}µg/m³, PM10: ${owmCurrent.components.pm10.toFixed(1)}µg/m³, O3: ${owmCurrent.components.o3.toFixed(1)}µg/m³, NO2: ${owmCurrent.components.no2.toFixed(1)}µg/m³`
      : `AQI ${cityAQI} (${cat.label})`;

    return `
You are AeroSense AI, a friendly and knowledgeable air quality health advisor.

Location: ${cityName}
Data source: OpenWeatherMap Air Pollution API (real-time)

CURRENT AIR QUALITY:
${currentSummary}
- Peak zone: ${displayName(peakStation.name)} at AQI ${peakStation.aqi}
- Cleanest zone: ${displayName(lowestStation.name)} at AQI ${lowestStation.aqi}
- Active alerts: ${alerts.length > 0 ? alerts.map(a => `${displayName(a.stationName)} AQI ${a.aqi}`).join(', ') : 'None'}

PAST 24 HOURS (real data):
${pastSummary}

FORECAST NEXT 24 HOURS (real data):
${forecastSummary}

YOUR ROLE:
- Answer questions about PAST, CURRENT, and FUTURE air quality using the real data above
- When asked "what was AQI at X time" → look at PAST data and answer specifically
- When asked "will it get better/worse" → look at FORECAST data and answer specifically
- When asked "what's AQI now" → use CURRENT data
- Give specific, actionable health advice based on the data
- Be concise — 3-5 sentences max unless detail is needed
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
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: groqMessages, max_tokens: 512, temperature: 0.7 }),
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
    const report = `AeroSense - Air Quality Report\nDate: ${new Date().toLocaleDateString()}\nCity: ${cityName}\nAQI: ${cityAQI} (${cat.label})\n\nPeak: ${displayName(peakStation.name)} (AQI ${peakStation.aqi})\nLowest: ${displayName(lowestStation.name)} (AQI ${lowestStation.aqi})\nDominant Pollutant: PM2.5\n\nGenerated by AeroSense AI`;
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'aerosense-report.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const aqiColor = getAQIColor(cityAQI);

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
            <span style={{ color: aqiColor, fontWeight: 700 }}>{cityAQI}</span>&nbsp;
            <span style={{ color: aqiColor, fontSize: 13 }}>({cat.label})</span>
          </p>
        </div>

        {/* ── AQI Hero Banner ── */}
        <div className="adv-card" style={{ marginBottom: 24, borderRadius: 20, padding: '20px 24px', background: `linear-gradient(135deg,${aqiColor}12 0%,rgba(6,8,14,0) 100%)`, border: `1px solid ${aqiColor}30`, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Current City AQI</div>
            <div style={{ fontSize: 64, fontWeight: 700, color: aqiColor, lineHeight: 1, textShadow: `0 0 30px ${aqiColor}44` }}>{cityAQI}</div>
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
              <span style={{ fontSize: 14, color: '#94a3b8' }}>PM2.5: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{owmAir ? `${owmAir.pm25.toFixed(1)} µg/m³` : 'Loading...'}</span></span>
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

            {/* Chat header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(100,130,160,0.12)', background: 'rgba(20,30,45,0.9)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,179,143,0.1)', border: '1px solid rgba(0,179,143,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={16} style={{ color: '#00b38f' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>AeroSense AI</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <div className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#00b38f' }} />
                  <span style={{ fontSize: 12, color: '#00b38f', fontFamily: 'IBM Plex Mono, monospace' }}>
                    Live · AQI {cityAQI} · {cityName}
                  </span>
                  {owmLoading && (
                    <span style={{ fontSize: 11, color: '#475569', marginLeft: 6 }}>· fetching data...</span>
                  )}
                  {!owmLoading && owmCurrent && (
                    <span style={{ fontSize: 11, color: '#334155', marginLeft: 6 }}>· past & forecast loaded ✓</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', padding: '4px 10px', borderRadius: 99, border: '1px solid rgba(100,130,160,0.15)', background: 'rgba(255,255,255,0.04)' }}>
                {cat.label}
              </div>
            </div>

            {/* Messages */}
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

            {/* Input */}
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
                Powered by Groq · Real air data from OpenWeatherMap · {cityName}
              </div>
            </div>
          </div>
        </div>

        {/* ── 24hr AQI Trend Chart ── */}
        <AQIChart cityName={cityName} />

      </motion.div>
    </>
  );
};

export default Advisory;