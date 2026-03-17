import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAirQuality } from '@/context/AirQualityContext';
import { getAQIColor, getAQICategory, SensorStation } from '@/data/mockSensorData';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, TrendingUp, TrendingDown, Minus,
  ZoomIn, ZoomOut, Thermometer, Droplets,
  AlertTriangle, X, Locate, Radio, Zap
} from 'lucide-react';

type LayerKey = 'aqi' | 'pm25' | 'pm10' | 'no2' | 'o3';

const LAYERS: { key: LayerKey; label: string; unit: string; max: number; desc: string }[] = [
  { key: 'aqi', label: 'AQI', unit: '', max: 500, desc: 'Air Quality Index' },
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', max: 250, desc: 'Fine particulate matter' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³', max: 400, desc: 'Coarse particulate matter' },
  { key: 'no2', label: 'NO₂', unit: 'ppb', max: 200, desc: 'Nitrogen dioxide' },
  { key: 'o3', label: 'O₃', unit: 'ppb', max: 150, desc: 'Ozone' },
];

// Realistic hourly AQI multiplier curve
const HOURLY_CURVE: Record<number, number> = {
  0: 0.62, 1: 0.55, 2: 0.50, 3: 0.47, 4: 0.48, 5: 0.55,
  6: 0.72, 7: 0.95, 8: 1.10, 9: 1.05, 10: 0.92, 11: 0.85,
  12: 0.88, 13: 0.84, 14: 0.80, 15: 0.83, 16: 0.90, 17: 1.05,
  18: 1.12, 19: 1.08, 20: 0.95, 21: 0.85, 22: 0.75, 23: 0.67,
};

// Apply hourly multiplier to a station
function applyHour(station: SensorStation, hour: number): SensorStation {
  const m = HOURLY_CURVE[hour] ?? 1;
  const aqi = Math.round(Math.min(500, Math.max(1, station.aqi * m)));
  const pm25 = Math.round(Math.min(500, Math.max(1, station.pm25 * m)));
  const pm10 = Math.round(Math.min(600, Math.max(1, station.pm10 * m)));
  const no2 = Math.round(Math.min(200, Math.max(1, station.no2 * m)));
  const o3 = Math.round(Math.min(150, Math.max(1, station.o3 * m)));
  const so2 = Math.round(Math.min(100, Math.max(1, station.so2 * m)));
  const trend: 'up' | 'down' | 'stable' =
    m > (HOURLY_CURVE[(hour - 1 + 24) % 24] ?? 1) ? 'up'
      : m < (HOURLY_CURVE[(hour - 1 + 24) % 24] ?? 1) ? 'down'
        : 'stable';
  return { ...station, aqi, pm25, pm10, no2, o3, so2, trend };
}

const getThreatLevel = (aqi: number) => {
  if (aqi <= 50) return { label: 'MINIMAL', color: '#00d4aa', bg: '#00d4aa12' };
  if (aqi <= 100) return { label: 'LOW', color: '#fbbf24', bg: '#fbbf2412' };
  if (aqi <= 150) return { label: 'MODERATE', color: '#f97316', bg: '#f9731612' };
  if (aqi <= 200) return { label: 'HIGH', color: '#ef4444', bg: '#ef444412' };
  if (aqi <= 300) return { label: 'SEVERE', color: '#dc2626', bg: '#dc262612' };
  return { label: 'CRITICAL', color: '#ff2020', bg: '#ff202020' };
};

// ── Map Controls ─────────────────────────────────────────────
const MapControls = ({ userLoc, onLocate }: { userLoc: [number, number] | null; onLocate: () => void }) => {
  const map = useMap();
  const btn: React.CSSProperties = {
    width: 44, height: 44, background: 'rgba(8,12,18,0.92)',
    border: '1px solid rgba(255,60,0,0.15)', borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#64748b',
    boxShadow: '0 4px 20px rgba(0,0,0,0.6)', transition: 'all 0.2s',
  };
  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 16, marginRight: 16 }}>
      <div className="leaflet-control" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={{ ...btn, color: userLoc ? '#f97316' : '#64748b' }} onClick={onLocate}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.1)'; e.currentTarget.style.color = '#f97316'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,12,18,0.92)'; e.currentTarget.style.color = userLoc ? '#f97316' : '#64748b'; }}>
          <Locate size={20} strokeWidth={2.5} />
        </button>
        <div style={{ height: 1, background: 'rgba(255,60,0,0.1)', margin: '4px 0' }} />
        <button style={btn} onClick={() => map.zoomIn()}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,12,18,0.92)'; e.currentTarget.style.color = '#64748b'; }}>
          <ZoomIn size={20} />
        </button>
        <button style={btn} onClick={() => map.zoomOut()}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,12,18,0.92)'; e.currentTarget.style.color = '#64748b'; }}>
          <ZoomOut size={20} />
        </button>
      </div>
    </div>
  );
};

// ── User Location Marker ──────────────────────────────────────
const UserLocationMarker = ({ position }: { position: [number, number] | null }) => {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (!position) return;
    const icon = L.divIcon({ className: 'clear-custom-icon', html: `<div class="user-dot"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
    if (markerRef.current) markerRef.current.setLatLng(position);
    else markerRef.current = L.marker(position, { icon, interactive: false }).addTo(map);
    return () => { markerRef.current?.remove(); markerRef.current = null; };
  }, [position, map]);
  return null;
};

// ── Heatmap ───────────────────────────────────────────────────
const HeatmapLayer = ({ stations, layerKey }: { stations: SensorStation[]; layerKey: LayerKey }) => {
  const map = useMap();
  useEffect(() => {
    const els: (L.Circle | L.CircleMarker)[] = [];
    const getInfraredColor = (pct: number) => {
      if (pct <= 0.2) return '#00d4aa';
      if (pct <= 0.4) return '#fbbf24';
      if (pct <= 0.6) return '#f97316';
      if (pct <= 0.8) return '#ef4444';
      return '#ff2020';
    };
    stations.forEach(s => {
      const rawVal = layerKey === 'aqi' ? s.aqi : s[layerKey] as number;
      const layer = LAYERS.find(l => l.key === layerKey)!;
      const pct = Math.min(rawVal / layer.max, 1);
      const color = layerKey === 'aqi' ? getAQIColor(s.aqi) : getInfraredColor(pct);
      const threat = getThreatLevel(s.aqi);
      els.push(L.circle([s.lat, s.lng], { radius: 2500 + pct * 4000, color: 'transparent', fillColor: color, fillOpacity: 0.03 + pct * 0.05, interactive: false }).addTo(map));
      els.push(L.circle([s.lat, s.lng], { radius: 900 + pct * 2000, color: 'transparent', fillColor: color, fillOpacity: 0.07 + pct * 0.12, interactive: false }).addTo(map));
      els.push(L.circle([s.lat, s.lng], { radius: 300 + pct * 700, color, weight: s.aqi > 200 ? 2 : 1, fillColor: color, fillOpacity: 0.25 + pct * 0.35, interactive: false, dashArray: s.aqi > 200 ? '6 3' : undefined }).addTo(map));
      const dot = L.circleMarker([s.lat, s.lng], { radius: 6 + pct * 4, color: '#0a0e14', weight: 2, fillColor: color, fillOpacity: 1 })
        .addTo(map)
        .bindTooltip(`
          <div style="font-family:'IBM Plex Mono',monospace;background:rgba(6,8,14,0.97);border:1px solid ${color}55;border-radius:14px;padding:16px 20px;box-shadow:0 12px 40px rgba(0,0,0,0.9),0 0 30px ${color}20;min-width:200px;">
            <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#e2e8f0;margin-bottom:8px;">${s.name}</div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">
              <span style="font-size:32px;font-weight:700;color:${color};line-height:1;text-shadow:0 0 20px ${color}66;">${s.aqi}</span>
              <span style="font-size:13px;color:#64748b;">AQI</span>
            </div>
            <div style="display:inline-block;padding:4px 10px;border-radius:99px;background:${threat.bg};color:${threat.color};font-size:12px;font-weight:700;letter-spacing:0.1em;border:1px solid ${color}33;margin-bottom:10px;">${threat.label}</div>
            <div style="display:flex;gap:16px;font-size:13px;color:#64748b;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">
              <span>PM2.5 <span style="color:#e2e8f0;font-weight:600;">${s.pm25}</span></span>
              <span>NO₂ <span style="color:#e2e8f0;font-weight:600;">${s.no2}</span></span>
            </div>
          </div>
        `, { className: 'clean-tooltip', direction: 'top', offset: [0, -12] });
      els.push(dot);
    });
    return () => { els.forEach(e => e.remove()); };
  }, [stations, map, layerKey]);
  return null;
};

// ── Map Sync ──────────────────────────────────────────────────
const MapSync = ({ coords, userLoc, isLocating }: { coords: [number, number]; userLoc: [number, number] | null; isLocating: boolean }) => {
  const map = useMap();
  const init = useRef(false);
  useEffect(() => { if (!init.current) { map.setView(userLoc || coords, 12); init.current = true; } }, [coords, userLoc, map]);
  useEffect(() => { if (isLocating && userLoc) map.flyTo(userLoc, 13, { duration: 1.5, easeLinearity: 0.25 }); }, [isLocating, userLoc, map]);
  return null;
};

// ── Hotspot Detail ────────────────────────────────────────────
const HotspotDetail = ({ station, onClose }: { station: SensorStation; onClose: () => void }) => {
  const color = getAQIColor(station.aqi);
  const threat = getThreatLevel(station.aqi);
  const metrics = [
    { label: 'PM2.5', value: station.pm25, unit: 'µg/m³', pct: station.pm25 / 250 },
    { label: 'PM10', value: station.pm10, unit: 'µg/m³', pct: station.pm10 / 400 },
    { label: 'NO₂', value: station.no2, unit: 'ppb', pct: station.no2 / 200 },
    { label: 'O₃', value: station.o3, unit: 'ppb', pct: station.o3 / 150 },
    { label: 'CO', value: station.co, unit: 'ppm', pct: station.co / 10 },
    { label: 'SO₂', value: station.so2, unit: 'ppb', pct: station.so2 / 100 },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      style={{
        position: 'absolute', bottom: 120, left: 24, zIndex: 1000, width: 340,
        background: 'rgba(6,8,14,0.96)', backdropFilter: 'blur(20px)',
        border: `1px solid ${color}33`, borderRadius: 24, overflow: 'hidden',
        boxShadow: `0 32px 80px rgba(0,0,0,0.9), 0 0 60px ${color}10`,
      }}
    >
      <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}00)` }} />
      <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div>
          <div style={{ padding: '4px 10px', borderRadius: 6, background: threat.bg, color: threat.color, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', border: `1px solid ${color}33`, display: 'inline-block', marginBottom: 8 }}>● {threat.label}</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.2 }}>{station.name}</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b', marginTop: 4 }}>{station.lat.toFixed(4)}°N · {station.lng.toFixed(4)}°E</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 10, cursor: 'pointer', color: '#64748b', padding: 8, transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 56, fontWeight: 700, color, lineHeight: 1, textShadow: `0 0 30px ${color}55` }}>{station.aqi}</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>US AQI INDEX</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>{getAQICategory(station.aqi).label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Thermometer size={14} style={{ color: '#64748b' }} />
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: '#cbd5e1' }}>{station.temp}°C</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Droplets size={14} style={{ color: '#64748b' }} />
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: '#cbd5e1' }}>{station.humidity}% RH</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Pollutant Breakdown</div>
        {metrics.map(m => {
          const barColor = m.pct > 0.75 ? '#ff2020' : m.pct > 0.5 ? '#ef4444' : m.pct > 0.25 ? '#f97316' : '#00d4aa';
          return (
            <div key={m.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#94a3b8' }}>{m.label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{m.value} <span style={{ color: '#64748b', fontSize: 11 }}>{m.unit}</span></span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${Math.min(m.pct * 100, 100)}%` }}
                  transition={{ duration: 0.9, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', background: `linear-gradient(90deg, ${barColor}88, ${barColor})`, borderRadius: 99 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ── Threat Row ────────────────────────────────────────────────
const ThreatRow = ({ station, rank, isSelected, onClick }: { station: SensorStation; rank: number; isSelected: boolean; onClick: () => void }) => {
  const color = getAQIColor(station.aqi);
  const threat = getThreatLevel(station.aqi);
  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: rank * 0.05 }}
      onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, border: 'none', cursor: 'pointer', background: isSelected ? `${color}12` : 'transparent', outline: isSelected ? `1px solid ${color}30` : '1px solid transparent', transition: 'all 0.2s', textAlign: 'left' }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, fontWeight: 700, color }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 600, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{station.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: threat.color, letterSpacing: '0.08em', fontWeight: 700 }}>{threat.label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 18, fontWeight: 700, color }}>{station.aqi}</span>
        {station.trend === 'up' ? <TrendingUp size={14} style={{ color: '#ef4444' }} /> : station.trend === 'down' ? <TrendingDown size={14} style={{ color: '#00d4aa' }} /> : <Minus size={14} style={{ color: '#64748b' }} />}
      </div>
    </motion.button>
  );
};

// ── Mini Sparkline for timeline ───────────────────────────────
const Sparkline = ({ baseAqi, currentHour }: { baseAqi: number; currentHour: number }) => {
  const W = 140, H = 36;
  const points = Array.from({ length: 24 }, (_, h) => Math.round(baseAqi * HOURLY_CURVE[h]));
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const toX = (h: number) => (h / 23) * W;
  const toY = (v: number) => H - ((v - min) / range) * H;
  const path = points.map((v, h) => `${h === 0 ? 'M' : 'L'} ${toX(h).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const cx = toX(currentHour);
  const cy = toY(points[currentHour]);
  const dotColor = getAQIColor(points[currentHour]);
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <path d={path} fill="none" stroke="rgba(249,115,22,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={4} fill={dotColor} stroke="#06080e" strokeWidth={2} style={{ filter: `drop-shadow(0 0 6px ${dotColor})` }} />
    </svg>
  );
};

// ── Main ──────────────────────────────────────────────────────
const Hotspots = () => {
  const { stations, userCoords } = useAirQuality();
  const [activeLayer, setActiveLayer] = useState<LayerKey>('aqi');
  const [selectedStation, setSelectedStation] = useState<SensorStation | null>(null);
  const [hour, setHour] = useState<number>(new Date().getHours());
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      p => setUserLoc([p.coords.latitude, p.coords.longitude]),
      () => { }, { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const handleLocate = () => {
    if (!('geolocation' in navigator)) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => { setUserLoc([p.coords.latitude, p.coords.longitude]); setTimeout(() => setIsLocating(false), 2000); },
      () => setIsLocating(false),
      { enableHighAccuracy: true }
    );
  };

  const localStations = stations.filter(s => !s.id.startsWith('init-'));
  const baseStations = localStations.length > 0 ? localStations : stations;

  const hourlyStations = useMemo(() => baseStations.map(s => applyHour(s, hour)), [baseStations, hour]);

  const sorted = [...hourlyStations].sort((a, b) => b.aqi - a.aqi);
  const top5 = sorted.slice(0, 5);
  const worst = top5[0];
  const worstColor = worst ? getAQIColor(worst.aqi) : '#00d4aa';
  const worstThreat = worst ? getThreatLevel(worst.aqi) : { label: 'MINIMAL', color: '#00d4aa', bg: '#00d4aa12' };
  const isCritical = worst && worst.aqi > 200;

  const selectedHourly = selectedStation
    ? hourlyStations.find(s => s.id === selectedStation.id) ?? null
    : null;

  const isLiveHour = hour === new Date().getHours();

  const hourLabel = (h: number) => {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  };

  const peakHours = [8, 18];
  const isPeakHour = peakHours.includes(hour);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      className="pt-12 min-h-screen"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#06080e' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        .clean-tooltip .leaflet-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-tooltip-top.clean-tooltip::before { display: none; }
        .user-dot { position: relative; width: 20px; height: 20px; background: #f97316; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 16px rgba(249,115,22,0.8); transform: translate(-2px, -2px); }
        .user-dot::before { content: ''; position: absolute; top: -14px; left: -14px; right: -14px; bottom: -14px; border-radius: 50%; border: 2px solid rgba(249,115,22,0.5); animation: user-pulse 2s ease-out infinite; }
        @keyframes user-pulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
        .scan-line { position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(249,115,22,0.35), transparent); animation: scan 3s linear infinite; pointer-events: none; z-index: 998; }
        @keyframes scan { 0% { top: 0; opacity: 1; } 90% { opacity: 0.3; } 100% { top: 100%; opacity: 0; } }
        .hs-scroll::-webkit-scrollbar { width: 6px; }
        .hs-scroll::-webkit-scrollbar-track { background: transparent; }
        .hs-scroll::-webkit-scrollbar-thumb { background: rgba(249,115,22,0.25); border-radius: 99px; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .blink { animation: blink 1.4s ease-in-out infinite; }
        input[type=range].timeline-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 99px; outline: none; cursor: pointer; }
        input[type=range].timeline-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #f97316; border: 2px solid #06080e; box-shadow: 0 0 12px rgba(249,115,22,0.8); cursor: pointer; }
      `}</style>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT PANEL ── */}
        <div className="hs-scroll" style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', background: 'rgba(6,8,14,0.98)', borderRight: '1px solid rgba(249,115,22,0.08)', boxShadow: '4px 0 40px rgba(0,0,0,0.8)', zIndex: 10 }}>

          {/* Header */}
          <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Flame size={32} style={{ color: worstColor, filter: `drop-shadow(0 0 10px ${worstColor}88)` }} />
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.02em', lineHeight: 1 }}>HOTSPOTS</div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b', letterSpacing: '0.1em', marginTop: 4 }}>POLLUTION INTELLIGENCE</div>
              </div>
            </div>
            
            {/* UPDATED: LIGHT GREYISH LIVE NOW BADGE WITH MORE GLOW */}
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, marginTop: 14,
              background: isLiveHour ? 'rgba(255,255,255,0.06)' : 'rgba(249,115,22,0.05)', 
              border: isLiveHour ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(249,115,22,0.1)',
              boxShadow: isLiveHour ? '0 0 20px rgba(255,255,255,0.1), inset 0 0 15px rgba(255,255,255,0.05)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className={isLiveHour ? 'blink' : ''} style={{ 
                  width: 8, height: 8, borderRadius: '50%', 
                  background: isLiveHour ? '#cbd5e1' : '#f97316', 
                  boxShadow: isLiveHour ? '0 0 12px #cbd5e1, 0 0 24px rgba(203, 213, 225, 0.6)' : '0 0 8px #f97316' 
                }} />
                <span style={{ 
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700,
                  color: isLiveHour ? '#cbd5e1' : '#f97316',
                  textShadow: isLiveHour ? '0 0 12px rgba(203,213,225,0.6)' : 'none'
                }}>
                  {isLiveHour ? 'LIVE NOW' : `REPLAY ${hourLabel(hour)}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Radio size={14} style={{ color: '#64748b' }} />
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{hourlyStations.length} ZONES</span>
              </div>
            </div>
          </div>

          {/* Worst zone */}
          {worst && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <motion.div
                key={`worst-${hour}`}
                initial={{ opacity: 0.7, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                style={{ borderRadius: 16, padding: '18px', background: `linear-gradient(135deg, ${worstColor}10 0%, rgba(6,8,14,0) 100%)`, border: `1px solid ${worstColor}25`, position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: worstColor, opacity: 0.08, filter: 'blur(24px)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {isCritical && <AlertTriangle size={14} style={{ color: worstColor }} className="blink" />}
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, color: worstColor, letterSpacing: '0.12em' }}>WORST ZONE · {hourLabel(hour)}</span>
                </div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.2 }}>{worst.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 42, fontWeight: 700, color: worstColor, lineHeight: 1, textShadow: `0 0 24px ${worstColor}44` }}>{worst.aqi}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: '#64748b' }}>AQI</span>
                  <span style={{ marginLeft: 6, padding: '4px 10px', borderRadius: 6, background: worstThreat.bg, color: worstThreat.color, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', border: `1px solid ${worstColor}30` }}>{worstThreat.label}</span>
                </div>
                {/* Mini sparkline */}
                <div style={{ marginTop: 12 }}>
                  <Sparkline baseAqi={baseStations.find(s => s.id === worst.id)?.aqi ?? worst.aqi} currentHour={hour} />
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#475569', marginTop: 6 }}>24h AQI pattern</div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Peak hour warning */}
          {isPeakHour && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ margin: '0 20px 16px', padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#ef4444', fontWeight: 600 }}>RUSH HOUR · Peak pollution window</span>
            </motion.div>
          )}

          {/* Overlay selector */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Overlay Metric</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {LAYERS.map(l => {
                const active = activeLayer === l.key;
                return (
                  <button key={l.key} onClick={() => setActiveLayer(l.key)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, fontWeight: active ? 700 : 500, background: active ? `${worstColor}18` : 'rgba(255,255,255,0.03)', color: active ? worstColor : '#94a3b8', outline: active ? `1px solid ${worstColor}35` : '1px solid transparent', transition: 'all 0.2s' }}>
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Threat board */}
          <div style={{ padding: '16px 20px', flex: 1 }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Threat Board · Top {top5.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {top5.map((s, i) => (
                <ThreatRow key={s.id} station={s} rank={i + 1}
                  isSelected={selectedStation?.id === s.id}
                  onClick={() => setSelectedStation(selectedStation?.id === s.id ? null : s)}
                />
              ))}
            </div>
          </div>

          {/* AQI Legend */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>AQI Scale</div>
            {[
              { label: 'Good', range: '0–50', color: '#00d4aa' },
              { label: 'Moderate', range: '51–100', color: '#fbbf24' },
              { label: 'Sensitive', range: '101–150', color: '#f97316' },
              { label: 'Unhealthy', range: '151–200', color: '#ef4444' },
              { label: 'Severe', range: '201–300', color: '#dc2626' },
              { label: 'Critical', range: '300+', color: '#ff2020' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 32, height: 6, borderRadius: 99, background: item.color, flexShrink: 0, boxShadow: `0 0 8px ${item.color}66` }} />
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#cbd5e1', flex: 1 }}>{item.label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{item.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAP ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div className="scan-line" />
          <MapContainer center={userLoc || userCoords} zoom={12} style={{ height: '100%', width: '100%', background: '#04060c' }} zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" attribution="&copy; CARTO" opacity={0.7} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" attribution="" pane="shadowPane" />
            <MapSync coords={userCoords} userLoc={userLoc} isLocating={isLocating} />
            <HeatmapLayer stations={hourlyStations} layerKey={activeLayer} />
            <UserLocationMarker position={userLoc} />
            <MapControls userLoc={userLoc} onLocate={handleLocate} />
          </MapContainer>

          {/* Top badge */}
          <div style={{ position: 'absolute', top: 20, left: 24, right: 80, zIndex: 999, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: 'rgba(6,8,14,0.94)', backdropFilter: 'blur(16px)', border: `1px solid ${worstColor}33`, boxShadow: '0 8px 30px rgba(0,0,0,0.7)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: worstColor, boxShadow: `0 0 10px ${worstColor}` }} />
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{LAYERS.find(l => l.key === activeLayer)?.label}</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b' }}>{LAYERS.find(l => l.key === activeLayer)?.desc}</span>
            </div>
            {worst && (
              <motion.div key={tick} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: 'rgba(6,8,14,0.94)', backdropFilter: 'blur(16px)', border: `1px solid ${worstColor}44`, boxShadow: `0 8px 30px rgba(0,0,0,0.7), 0 0 20px ${worstColor}15` }}>
                <Zap size={14} style={{ color: worstColor }} />
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#cbd5e1' }}>Peak:</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, fontWeight: 800, color: worstColor }}>{worst.aqi} AQI</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b' }}>at {worst.name}</span>
              </motion.div>
            )}
          </div>

          {/* ── TIMELINE ── */}
          <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: "rgba(6,8,14,0.97)", backdropFilter: "blur(24px)", border: "1px solid rgba(249,115,22,0.22)", borderRadius: 32, padding: "28px 32px", width: "94%", maxWidth: 820, boxShadow: "0 24px 80px rgba(0,0,0,0.9), 0 0 50px rgba(249,115,22,0.1)" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 32 }}>

              {/* Time display */}
              <div style={{ flexShrink: 0, minWidth: 130 }}>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, color: isLiveHour ? "#cbd5e1" : "#64748b", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  {isLiveHour ? "⚪ LIVE NOW" : "⏪ REPLAY"}
                </div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 44, fontWeight: 800, color: "#f97316", lineHeight: 1, textShadow: "0 0 30px rgba(249,115,22,0.5)" }}>
                  {hourLabel(hour)}
                </div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, color: "#64748b", marginTop: 8, fontWeight: 500 }}>
                  x{HOURLY_CURVE[hour].toFixed(2)} intensity
                </div>
              </div>

              {/* Slider section */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  {[0, 6, 12, 18, 23].map(h => (
                    <span key={h} style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: h === hour ? "#f97316" : "#64748b", fontWeight: h === hour ? 700 : 500, transition: "color 0.2s" }}>
                      {h.toString().padStart(2, "0")}
                    </span>
                  ))}
                </div>
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <div style={{ height: 8, borderRadius: 99, background: "linear-gradient(90deg, #334155 0%, #00d4aa 25%, #fbbf24 40%, #ef4444 60%, #ef4444 70%, #fbbf24 85%, #334155 100%)", marginBottom: 8, opacity: 0.6 }} />
                  <input type="range" min={0} max={23} value={hour} onChange={e => setHour(+e.target.value)} className="timeline-slider" style={{ width: "100%", background: "rgba(255,255,255,0.06)", position: "relative", zIndex: 2, marginTop: -5 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {["Quiet", "Morning Rush", "Midday", "Evening Rush", "Night"].map(l => (
                    <span key={l} style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, color: "#64748b", fontWeight: 500 }}>{l}</span>
                  ))}
                </div>
              </div>

              {/* Quick jump buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
                {[["Now", new Date().getHours()], ["AM Rush", 8], ["PM Rush", 18], ["Night", 0]].map(([label, h]) => {
                  const active = hour === h;
                  return (
                    <button key={label as string} onClick={() => setHour(h as number)} style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, fontWeight: active ? 700 : 600, padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer", background: active ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.05)", color: active ? "#f97316" : "#94a3b8", outline: active ? "1px solid rgba(249,115,22,0.4)" : "1px solid rgba(255,255,255,0.06)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                      {label as string}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Station detail */}
          <AnimatePresence>
            {selectedHourly && (
              <HotspotDetail station={selectedHourly} onClose={() => setSelectedStation(null)} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default Hotspots;