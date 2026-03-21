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
  AlertTriangle, X, Locate, Radio, Zap, ChevronDown, ChevronUp
} from 'lucide-react';

type LayerKey = 'aqi' | 'pm25' | 'pm10' | 'no2' | 'o3';

const LAYERS: { key: LayerKey; label: string; unit: string; max: number; desc: string }[] = [
  { key: 'aqi',  label: 'AQI',   unit: '',      max: 500, desc: 'Air Quality Index' },
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', max: 250, desc: 'Fine particulate matter' },
  { key: 'pm10', label: 'PM10',  unit: 'µg/m³', max: 400, desc: 'Coarse particulate matter' },
  { key: 'no2',  label: 'NO₂',   unit: 'ppb',   max: 200, desc: 'Nitrogen dioxide' },
  { key: 'o3',   label: 'O₃',    unit: 'ppb',   max: 150, desc: 'Ozone' },
];

const MAP_THEMES = [
  { id: 'dark',       label: 'Dark',        preview: '#0a0e14', isLight: false, url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                 attribution: '&copy; CARTO' },
  { id: 'voyager',    label: 'Google Maps', preview: '#e8f0d8', isLight: true,  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',                      attribution: '&copy; CARTO' },
  { id: 'light',      label: 'Light',       preview: '#f5f5f0', isLight: true,  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                                attribution: '&copy; CARTO' },
  { id: 'satellite',  label: 'Satellite',   preview: '#1a2a1a', isLight: false, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
  { id: 'terrain',    label: 'Terrain',     preview: '#c8d8a8', isLight: true,  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',attribution: '&copy; Esri' },
  { id: 'watercolor', label: 'Watercolor',  preview: '#d4e8f0', isLight: true,  url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',                          attribution: 'Stamen Design' },
  { id: 'osm',        label: 'Street',      preview: '#f0e8d8', isLight: true,  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                            attribution: '&copy; OpenStreetMap' },
];

// ── Helpers ───────────────────────────────────────────────────
function buildRealCurve(owmPast: { hour: string; aqi: number }[]): Record<number, number> {
  if (!owmPast.length) return buildFallbackCurve();
  const hourMap: Record<number, number[]> = {};
  owmPast.forEach(entry => {
    const match = entry.hour.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return;
    let h = parseInt(match[1]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    if (!hourMap[h]) hourMap[h] = [];
    hourMap[h].push(entry.aqi);
  });
  const avgByHour: Record<number, number> = {};
  Object.entries(hourMap).forEach(([h, vals]) => {
    avgByHour[+h] = vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  const allVals = Object.values(avgByHour);
  if (!allVals.length) return buildFallbackCurve();
  const mean = allVals.reduce((a, b) => a + b, 0) / allVals.length;
  const curve: Record<number, number> = {};
  const knownHours = Object.keys(avgByHour).map(Number).sort((a, b) => a - b);
  for (let h = 0; h < 24; h++) {
    if (avgByHour[h] !== undefined) {
      curve[h] = avgByHour[h] / mean;
    } else {
      const prev = knownHours.filter(k => k < h).at(-1);
      const next = knownHours.find(k => k > h);
      if (prev !== undefined && next !== undefined) {
        const t = (h - prev) / (next - prev);
        curve[h] = (avgByHour[prev] / mean) + t * ((avgByHour[next] / mean) - (avgByHour[prev] / mean));
      } else if (prev !== undefined) {
        curve[h] = avgByHour[prev] / mean;
      } else if (next !== undefined) {
        curve[h] = avgByHour[next] / mean;
      } else {
        curve[h] = 1.0;
      }
    }
  }
  return curve;
}

function buildFallbackCurve(): Record<number, number> {
  return { 0:0.62,1:0.55,2:0.50,3:0.47,4:0.48,5:0.55,6:0.72,7:0.95,8:1.10,9:1.05,10:0.92,11:0.85,12:0.88,13:0.84,14:0.80,15:0.83,16:0.90,17:1.05,18:1.12,19:1.08,20:0.95,21:0.85,22:0.75,23:0.67 };
}

function applyHour(station: SensorStation, hour: number, curve: Record<number, number>): SensorStation {
  const m = curve[hour] ?? 1;
  const prev = curve[(hour - 1 + 24) % 24] ?? 1;
  const trend: 'up' | 'down' | 'stable' = m > prev ? 'up' : m < prev ? 'down' : 'stable';
  return {
    ...station,
    aqi:  Math.round(Math.min(500, Math.max(1, station.aqi  * m))),
    pm25: Math.round(Math.min(500, Math.max(1, station.pm25 * m))),
    pm10: Math.round(Math.min(600, Math.max(1, station.pm10 * m))),
    no2:  Math.round(Math.min(200, Math.max(1, station.no2  * m))),
    o3:   Math.round(Math.min(150, Math.max(1, station.o3   * m))),
    so2:  Math.round(Math.min(100, Math.max(1, station.so2  * m))),
    trend,
  };
}

const getThreatLevel = (aqi: number) => {
  if (aqi <= 50)  return { label: 'MINIMAL',  color: '#00d4aa', bg: '#00d4aa12' };
  if (aqi <= 100) return { label: 'LOW',       color: '#fbbf24', bg: '#fbbf2412' };
  if (aqi <= 150) return { label: 'MODERATE',  color: '#f97316', bg: '#f9731612' };
  if (aqi <= 200) return { label: 'HIGH',      color: '#ef4444', bg: '#ef444412' };
  if (aqi <= 300) return { label: 'SEVERE',    color: '#dc2626', bg: '#dc262612' };
  return             { label: 'CRITICAL',  color: '#ff2020', bg: '#ff202020' };
};

const hourLabel = (h: number) => {
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

// ── Map Controls ──────────────────────────────────────────────
const MapControls = ({ userLoc, onLocate }: { userLoc: [number, number] | null; onLocate: () => void }) => {
  const map = useMap();
  const btn: React.CSSProperties = { width:44,height:44,background:'rgba(8,12,18,0.92)',border:'1px solid rgba(255,60,0,0.15)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#64748b',boxShadow:'0 4px 20px rgba(0,0,0,0.6)',transition:'all 0.2s' };
  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop:16, marginRight:16 }}>
      <div className="leaflet-control" style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <button style={{ ...btn, color: userLoc ? '#f97316' : '#64748b' }} onClick={onLocate}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(249,115,22,0.1)'; e.currentTarget.style.color='#f97316'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(8,12,18,0.92)'; e.currentTarget.style.color=userLoc?'#f97316':'#64748b'; }}>
          <Locate size={20} strokeWidth={2.5} />
        </button>
        <div style={{ height:1, background:'rgba(255,60,0,0.1)', margin:'4px 0' }} />
        <button style={btn} onClick={() => map.zoomIn()}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(8,12,18,0.92)'; e.currentTarget.style.color='#64748b'; }}>
          <ZoomIn size={20} />
        </button>
        <button style={btn} onClick={() => map.zoomOut()}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(8,12,18,0.92)'; e.currentTarget.style.color='#64748b'; }}>
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
    const icon = L.divIcon({ className:'clear-custom-icon', html:`<div class="user-dot"></div>`, iconSize:[24,24], iconAnchor:[12,12] });
    const tooltipHtml = `<div style="font-family:'IBM Plex Mono',monospace;background:rgba(6,8,14,0.97);border:1px solid rgba(249,115,22,0.55);border-radius:14px;padding:14px 18px;box-shadow:0 12px 40px rgba(0,0,0,0.9);min-width:190px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:8px;height:8px;border-radius:50%;background:#f97316;"></div><span style="font-size:15px;font-weight:800;color:#e2e8f0;">You are here</span></div><div style="font-size:12px;color:#64748b;">${position[0].toFixed(4)}°N · ${position[1].toFixed(4)}°E</div></div>`;
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      markerRef.current = L.marker(position, { icon, interactive:true, zIndexOffset:1000 })
        .addTo(map)
        .bindTooltip(tooltipHtml, { className:'clean-tooltip', direction:'top', offset:[0,-14], sticky:false });
    }
    return () => { markerRef.current?.remove(); markerRef.current = null; };
  }, [position, map]);
  return null;
};

// ── Map Theme Switcher ────────────────────────────────────────
const MapThemeSwitcher = ({ activeTheme, onThemeChange }: { activeTheme: string; onThemeChange: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Map Theme"
        style={{ width:44,height:44,background:open?'rgba(249,115,22,0.15)':'rgba(30,35,50,0.97)',border:`1px solid ${open?'rgba(249,115,22,0.6)':'rgba(255,255,255,0.25)'}`,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:open?'#f97316':'#e2e8f0',boxShadow:'0 4px 24px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',transition:'all 0.2s' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, scale:0.92, y:8 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.92, y:8 }} transition={{ type:'spring', stiffness:380, damping:28 }}
            style={{ position:'absolute', bottom:52, right:0, background:'rgba(6,8,14,0.97)', backdropFilter:'blur(20px)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:18, padding:'16px', width:210, boxShadow:'0 24px 60px rgba(0,0,0,0.9)' }}>
            <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>Map Theme</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {MAP_THEMES.map(theme => {
                const isActive = theme.id === activeTheme;
                return (
                  <button key={theme.id} onClick={() => { onThemeChange(theme.id); setOpen(false); }}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 12px', borderRadius:10, border:'none', cursor:'pointer', background:isActive?'rgba(249,115,22,0.12)':'rgba(255,255,255,0.03)', outline:isActive?'1px solid rgba(249,115,22,0.4)':'1px solid transparent', transition:'all 0.15s', textAlign:'left' }}>
                    <div style={{ width:28, height:20, borderRadius:6, flexShrink:0, background:theme.preview, border:isActive?'2px solid #f97316':'1px solid rgba(255,255,255,0.1)', transition:'all 0.15s' }} />
                    <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:13, fontWeight:isActive?700:500, color:isActive?'#f97316':'#94a3b8' }}>{theme.label}</span>
                    {isActive && <div style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'#f97316' }} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Heatmap ───────────────────────────────────────────────────
const HeatmapLayer = ({ stations, layerKey }: { stations: SensorStation[]; layerKey: LayerKey }) => {
  const map = useMap();
  useEffect(() => {
    const els: (L.Circle | L.CircleMarker)[] = [];
    stations.forEach(s => {
      const rawVal = layerKey === 'aqi' ? s.aqi : s[layerKey] as number;
      const layer  = LAYERS.find(l => l.key === layerKey)!;
      const pct    = Math.min(rawVal / layer.max, 1);
      const getInfraredColor = (p: number) => p<=0.2?'#00d4aa':p<=0.4?'#fbbf24':p<=0.6?'#f97316':p<=0.8?'#ef4444':'#ff2020';
      const color  = layerKey === 'aqi' ? getAQIColor(s.aqi) : getInfraredColor(pct);
      const threat = getThreatLevel(s.aqi);
      els.push(L.circle([s.lat,s.lng],{radius:2500+pct*4000,color:'transparent',fillColor:color,fillOpacity:0.03+pct*0.05,interactive:false}).addTo(map));
      els.push(L.circle([s.lat,s.lng],{radius:900+pct*2000,color:'transparent',fillColor:color,fillOpacity:0.07+pct*0.12,interactive:false}).addTo(map));
      els.push(L.circle([s.lat,s.lng],{radius:300+pct*700,color,weight:s.aqi>200?2:1,fillColor:color,fillOpacity:0.25+pct*0.35,interactive:false,dashArray:s.aqi>200?'6 3':undefined}).addTo(map));
      const dot = L.circleMarker([s.lat,s.lng],{radius:6+pct*4,color:'#0a0e14',weight:2,fillColor:color,fillOpacity:1})
        .addTo(map)
        .bindTooltip(`<div style="font-family:'IBM Plex Mono',monospace;background:rgba(6,8,14,0.97);border:1px solid ${color}55;border-radius:14px;padding:16px 20px;min-width:200px;"><div style="font-size:16px;font-weight:800;color:#e2e8f0;margin-bottom:8px;">${s.name}</div><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;"><span style="font-size:32px;font-weight:700;color:${color};">${s.aqi}</span><span style="font-size:13px;color:#64748b;">AQI</span></div><div style="display:inline-block;padding:4px 10px;border-radius:99px;background:${threat.bg};color:${threat.color};font-size:12px;font-weight:700;">${threat.label}</div><div style="display:flex;gap:16px;font-size:13px;color:#64748b;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;margin-top:10px;"><span>PM2.5 <span style="color:#e2e8f0;">${s.pm25}</span></span><span>NO2 <span style="color:#e2e8f0;">${s.no2}</span></span></div></div>`,{className:'clean-tooltip',direction:'top',offset:[0,-12]});
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
  const centeredOnUser = useRef(false);
  useEffect(() => {
    if (!init.current) { map.setView(userLoc || coords, 12); init.current = true; if (userLoc) centeredOnUser.current = true; }
  }, []);
  useEffect(() => {
    if (userLoc && !centeredOnUser.current) { map.flyTo(userLoc, 13, { duration:1.2, easeLinearity:0.25 }); centeredOnUser.current = true; }
  }, [userLoc]);
  useEffect(() => {
    if (isLocating && userLoc) map.flyTo(userLoc, 13, { duration:1.5, easeLinearity:0.25 });
  }, [isLocating]);
  return null;
};

// ── Hotspot Detail ────────────────────────────────────────────
const HotspotDetail = ({ station, onClose, isMobile }: { station: SensorStation; onClose: () => void; isMobile: boolean }) => {
  const color  = getAQIColor(station.aqi);
  const threat = getThreatLevel(station.aqi);
  const metrics = [
    { label:'PM2.5', value:station.pm25, unit:'µg/m³', pct:station.pm25/250 },
    { label:'PM10',  value:station.pm10, unit:'µg/m³', pct:station.pm10/400 },
    { label:'NO₂',   value:station.no2,  unit:'ppb',   pct:station.no2/200  },
    { label:'O₃',    value:station.o3,   unit:'ppb',   pct:station.o3/150   },
    { label:'CO',    value:station.co,   unit:'ppm',   pct:station.co/10    },
    { label:'SO₂',   value:station.so2,  unit:'ppb',   pct:station.so2/100  },
  ];
  const style: React.CSSProperties = isMobile
    ? { position:'absolute', bottom:0, left:0, right:0, zIndex:1000, width:'100%', maxHeight:'60vh', overflowY:'auto', background:'rgba(6,8,14,0.96)', backdropFilter:'blur(20px)', border:`1px solid ${color}33`, borderRadius:'20px 20px 0 0', boxShadow:`0 -16px 60px rgba(0,0,0,0.9)` }
    : { position:'absolute', bottom:120, left:24, zIndex:1000, width:340, background:'rgba(6,8,14,0.96)', backdropFilter:'blur(20px)', border:`1px solid ${color}33`, borderRadius:24, overflow:'hidden', boxShadow:`0 32px 80px rgba(0,0,0,0.9)` };
  return (
    <motion.div initial={isMobile?{y:'100%'}:{opacity:0,x:-20}} animate={isMobile?{y:0}:{opacity:1,x:0}} exit={isMobile?{y:'100%'}:{opacity:0,x:-20}} transition={{ type:'spring', stiffness:340, damping:30 }} style={style}>
      <div style={{ height:4, background:`linear-gradient(90deg, ${color}, ${color}00)` }} />
      <div style={{ padding:'18px 24px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div>
          <div style={{ padding:'4px 10px', borderRadius:6, background:threat.bg, color:threat.color, fontFamily:'IBM Plex Mono, monospace', fontSize:11, fontWeight:700, letterSpacing:'0.12em', border:`1px solid ${color}33`, display:'inline-block', marginBottom:8 }}>● {threat.label}</div>
          <div style={{ fontFamily:'Syne, sans-serif', fontSize:20, fontWeight:800, color:'#e2e8f0', lineHeight:1.2 }}>{station.name}</div>
          <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, color:'#64748b', marginTop:4 }}>{station.lat.toFixed(4)}°N · {station.lng.toFixed(4)}°E</div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.04)', border:'none', borderRadius:10, cursor:'pointer', color:'#64748b', padding:8 }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ padding:'20px 24px', display:'flex', alignItems:'center', gap:20, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div>
          <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:56, fontWeight:700, color, lineHeight:1, textShadow:`0 0 30px ${color}55` }}>{station.aqi}</div>
          <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, color:'#64748b', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:4 }}>US AQI INDEX</div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'Syne, sans-serif', fontSize:15, fontWeight:600, color:'#e2e8f0', marginBottom:12 }}>{getAQICategory(station.aqi).label}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}><Thermometer size={14} style={{ color:'#64748b' }} /><span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:14, color:'#cbd5e1' }}>{station.temp}°C</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}><Droplets size={14} style={{ color:'#64748b' }} /><span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:14, color:'#cbd5e1' }}>{station.humidity}% RH</span></div>
          </div>
        </div>
      </div>
      <div style={{ padding:'20px 24px' }}>
        <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, fontWeight:700, color:'#64748b', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>Pollutant Breakdown</div>
        {metrics.map(m => {
          const barColor = m.pct>0.75?'#ff2020':m.pct>0.5?'#ef4444':m.pct>0.25?'#f97316':'#00d4aa';
          return (
            <div key={m.label} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:13, color:'#94a3b8' }}>{m.label}</span>
                <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{m.value} <span style={{ color:'#64748b', fontSize:11 }}>{m.unit}</span></span>
              </div>
              <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                <motion.div initial={{ width:0 }} animate={{ width:`${Math.min(m.pct*100,100)}%` }} transition={{ duration:0.9, delay:0.05 }} style={{ height:'100%', background:`linear-gradient(90deg, ${barColor}88, ${barColor})`, borderRadius:99 }} />
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
  const color  = getAQIColor(station.aqi);
  const threat = getThreatLevel(station.aqi);
  return (
    <motion.button initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} transition={{ delay:rank*0.05 }} onClick={onClick}
      style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderRadius:14, border:'none', cursor:'pointer', background:isSelected?`${color}12`:'transparent', outline:isSelected?`1px solid ${color}30`:'1px solid transparent', transition:'all 0.2s', textAlign:'left' }}>
      <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:`${color}18`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'IBM Plex Mono, monospace', fontSize:13, fontWeight:700, color }}>{rank}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:14, fontWeight:600, color:'#cbd5e1', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{station.name}</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}` }} />
          <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, color:threat.color, letterSpacing:'0.08em', fontWeight:700 }}>{threat.label}</span>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:18, fontWeight:700, color }}>{station.aqi}</span>
        {station.trend==='up'?<TrendingUp size={14} style={{ color:'#ef4444' }}/>:station.trend==='down'?<TrendingDown size={14} style={{ color:'#00d4aa' }}/>:<Minus size={14} style={{ color:'#64748b' }}/>}
      </div>
    </motion.button>
  );
};

// ── Sparkline ─────────────────────────────────────────────────
const Sparkline = ({ baseAqi, currentHour, curve }: { baseAqi: number; currentHour: number; curve: Record<number, number> }) => {
  const W=140,H=36;
  const points = Array.from({length:24},(_,h) => Math.round(baseAqi*(curve[h]??1)));
  const min=Math.min(...points),max=Math.max(...points),range=max-min||1;
  const toX=(h:number)=>(h/23)*W;
  const toY=(v:number)=>H-((v-min)/range)*H;
  const path=points.map((v,h)=>`${h===0?'M':'L'} ${toX(h).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const dotColor=getAQIColor(points[currentHour]);
  return (
    <svg width={W} height={H} style={{ overflow:'visible' }}>
      <path d={path} fill="none" stroke="rgba(249,115,22,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={toX(currentHour)} cy={toY(points[currentHour])} r={4} fill={dotColor} stroke="#06080e" strokeWidth={2} style={{ filter:`drop-shadow(0 0 6px ${dotColor})` }}/>
    </svg>
  );
};

// ── Panel Content ─────────────────────────────────────────────
interface PanelProps {
  worstColor: string;
  worstThreat: { label: string; color: string; bg: string };
  worst: SensorStation | null;
  isCritical: boolean;
  isRealCurve: boolean;
  isLiveHour: boolean;
  hour: number;
  hourlyStations: SensorStation[];
  top5: SensorStation[];
  isPeakHour: boolean;
  activeLayer: LayerKey;
  setActiveLayer: (k: LayerKey) => void;
  selectedStation: SensorStation | null;
  setSelectedStation: (s: SensorStation | null) => void;
  setPanelOpen: (v: boolean) => void;
  localStations: SensorStation[];
  hourlyCurve: Record<number, number>;
}

const PanelContent = ({
  worstColor, worstThreat, worst, isCritical, isRealCurve, isLiveHour,
  hour, hourlyStations, top5, isPeakHour, activeLayer,
  setActiveLayer, selectedStation, setSelectedStation, setPanelOpen,
  localStations, hourlyCurve,
}: PanelProps) => (
  <>
    <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <Flame size={32} style={{ color:worstColor, filter:`drop-shadow(0 0 10px ${worstColor}88)` }} />
        <div>
          <div style={{ fontFamily:'Syne, sans-serif', fontSize:22, fontWeight:800, color:'#e2e8f0', letterSpacing:'-0.02em', lineHeight:1 }}>HOTSPOTS</div>
          <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, color:'#64748b', letterSpacing:'0.1em', marginTop:4 }}>POLLUTION INTELLIGENCE</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:isRealCurve?'#00d4aa':'#f97316' }} />
        <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, color:isRealCurve?'#00d4aa':'#f97316' }}>
          {isRealCurve ? 'Real OWM hourly curve active' : 'Estimated curve (OWM loading...)'}
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:10, background:isLiveHour?'rgba(255,255,255,0.06)':'rgba(249,115,22,0.05)', border:isLiveHour?'1px solid rgba(255,255,255,0.25)':'1px solid rgba(249,115,22,0.1)', transition:'all 0.3s ease' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className={isLiveHour?'blink':''} style={{ width:8, height:8, borderRadius:'50%', background:isLiveHour?'#cbd5e1':'#f97316' }} />
          <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, fontWeight:700, color:isLiveHour?'#cbd5e1':'#f97316' }}>
            {isLiveHour ? 'LIVE NOW' : `REPLAY ${hourLabel(hour)}`}
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Radio size={14} style={{ color:'#64748b' }} />
          <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, color:'#64748b', fontWeight:600 }}>{hourlyStations.length} ZONES</span>
        </div>
      </div>
    </div>

    {worst && (
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
        <motion.div key={`worst-${hour}`} initial={{ opacity:0.7, scale:0.98 }} animate={{ opacity:1, scale:1 }}
          style={{ borderRadius:16, padding:'18px', background:`linear-gradient(135deg, ${worstColor}10 0%, rgba(6,8,14,0) 100%)`, border:`1px solid ${worstColor}25`, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:worstColor, opacity:0.08, filter:'blur(24px)', pointerEvents:'none' }} />
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            {isCritical && <AlertTriangle size={14} style={{ color:worstColor }} className="blink" />}
            <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, fontWeight:700, color:worstColor, letterSpacing:'0.12em' }}>WORST ZONE · {hourLabel(hour)}</span>
          </div>
          <div style={{ fontFamily:'Syne, sans-serif', fontSize:18, fontWeight:700, color:'#e2e8f0', marginBottom:8, lineHeight:1.2 }}>{worst.name}</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:42, fontWeight:700, color:worstColor, lineHeight:1, textShadow:`0 0 24px ${worstColor}44` }}>{worst.aqi}</span>
            <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:14, color:'#64748b' }}>AQI</span>
            <span style={{ padding:'4px 10px', borderRadius:6, background:worstThreat.bg, color:worstThreat.color, fontFamily:'IBM Plex Mono, monospace', fontSize:11, fontWeight:700, letterSpacing:'0.1em', border:`1px solid ${worstColor}30` }}>{worstThreat.label}</span>
          </div>
          <div style={{ marginTop:12 }}>
            <Sparkline baseAqi={localStations.find(s => s.id === worst.id)?.aqi ?? worst.aqi} currentHour={hour} curve={hourlyCurve} />
            <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, color:'#475569', marginTop:6 }}>{isRealCurve ? 'Real OWM 24h pattern' : 'Estimated 24h pattern'}</div>
          </div>
        </motion.div>
      </div>
    )}

    {isPeakHour && (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        style={{ margin:'0 20px 16px', padding:'12px 16px', borderRadius:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', display:'flex', alignItems:'center', gap:10 }}>
        <AlertTriangle size={16} style={{ color:'#ef4444', flexShrink:0 }} />
        <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, color:'#ef4444', fontWeight:600 }}>
          PEAK POLLUTION HOUR · {isRealCurve ? 'Based on real OWM data' : 'Estimated'}
        </span>
      </motion.div>
    )}

    <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
      <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, fontWeight:700, color:'#64748b', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:14 }}>Overlay Metric</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {LAYERS.map(l => {
          const active = activeLayer === l.key;
          return (
            <button key={l.key} onClick={() => setActiveLayer(l.key)}
              style={{ padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'IBM Plex Mono, monospace', fontSize:13, fontWeight:active?700:500, background:active?`${worstColor}18`:'rgba(255,255,255,0.03)', color:active?worstColor:'#94a3b8', outline:active?`1px solid ${worstColor}35`:'1px solid transparent', transition:'all 0.2s' }}>
              {l.label}
            </button>
          );
        })}
      </div>
    </div>

    <div style={{ padding:'16px 20px', flex:1 }}>
      <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, fontWeight:700, color:'#64748b', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:14 }}>Threat Board · Top {top5.length}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {top5.map((s, i) => (
          <ThreatRow key={s.id} station={s} rank={i+1}
            isSelected={selectedStation?.id === s.id}
            onClick={() => { setSelectedStation(selectedStation?.id === s.id ? null : s); setPanelOpen(false); }}
          />
        ))}
      </div>
    </div>

    <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.03)' }}>
      <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, fontWeight:700, color:'#64748b', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>AQI Scale</div>
      {[
        { label:'Good',      range:'0–50',   color:'#00d4aa' },
        { label:'Moderate',  range:'51–100',  color:'#fbbf24' },
        { label:'Sensitive', range:'101–150', color:'#f97316' },
        { label:'Unhealthy', range:'151–200', color:'#ef4444' },
        { label:'Severe',    range:'201–300', color:'#dc2626' },
        { label:'Critical',  range:'300+',    color:'#ff2020' },
      ].map(item => (
        <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <div style={{ width:32, height:6, borderRadius:99, background:item.color, flexShrink:0, boxShadow:`0 0 8px ${item.color}66` }} />
          <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, color:'#cbd5e1', flex:1 }}>{item.label}</span>
          <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, color:'#64748b', fontWeight:600 }}>{item.range}</span>
        </div>
      ))}
    </div>
  </>
);

// ── Main ──────────────────────────────────────────────────────
const Hotspots = () => {
  const { stations, userCoords, owmAir } = useAirQuality();
  const [activeLayer,     setActiveLayer]     = useState<LayerKey>('aqi');
  const [selectedStation, setSelectedStation] = useState<SensorStation | null>(null);
  const [hour,            setHour]            = useState<number>(new Date().getHours());
  const [userLoc,         setUserLoc]         = useState<[number, number] | null>(null);
  const [isLocating,      setIsLocating]      = useState(false);
  const [tick,            setTick]            = useState(0);
  const [activeTheme,     setActiveTheme]     = useState('terrain');
  const [panelOpen,       setPanelOpen]       = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { const t = setInterval(() => setTick(p => p+1), 1800); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      p => setUserLoc([p.coords.latitude, p.coords.longitude]),
      () => {}, { enableHighAccuracy:true, timeout:5000 }
    );
  }, []);

  const handleLocate = () => {
    if (!('geolocation' in navigator)) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => { setUserLoc([p.coords.latitude, p.coords.longitude]); setTimeout(() => setIsLocating(false), 2000); },
      () => setIsLocating(false), { enableHighAccuracy:true }
    );
  };

  const currentTheme = MAP_THEMES.find(t => t.id === activeTheme) ?? MAP_THEMES[0];
  const isLight      = currentTheme.isLight;

  // Scan line color: subtle dark stroke on light maps, orange glow on dark maps
  const scanLineColor = isLight
    ? 'rgba(0,0,0,0.12)'
    : 'rgba(249,115,22,0.35)';

  const localStations  = stations.filter(s => !s.id.startsWith('init-') && s.id !== 's-center');
  const hourlyCurve    = useMemo(() => buildRealCurve(owmAir?.past ?? []), [owmAir?.past]);
  const isRealCurve    = (owmAir?.past?.length ?? 0) > 0;
  const hourlyStations = useMemo(() => localStations.map(s => applyHour(s, hour, hourlyCurve)), [localStations, hour, hourlyCurve]);
  const sorted         = [...hourlyStations].sort((a, b) => b.aqi - a.aqi);
  const top5           = sorted.slice(0, 5);
  const worst          = top5[0];
  const worstColor     = worst ? getAQIColor(worst.aqi) : '#00d4aa';
  const worstThreat    = worst ? getThreatLevel(worst.aqi) : { label:'MINIMAL', color:'#00d4aa', bg:'#00d4aa12' };
  const isCritical     = !!(worst && worst.aqi > 200);
  const selectedHourly = selectedStation ? hourlyStations.find(s => s.id === selectedStation.id) ?? null : null;
  const isLiveHour     = hour === new Date().getHours();
  const peakHours      = useMemo(() => { const e = Object.entries(hourlyCurve).map(([h,v])=>({h:+h,v})); return new Set(e.sort((a,b)=>b.v-a.v).slice(0,3).map(e=>e.h)); }, [hourlyCurve]);
  const isPeakHour     = peakHours.has(hour);

  const panelProps: PanelProps = {
    worstColor, worstThreat, worst: worst ?? null, isCritical, isRealCurve, isLiveHour,
    hour, hourlyStations, top5, isPeakHour, activeLayer,
    setActiveLayer, selectedStation, setSelectedStation, setPanelOpen,
    localStations, hourlyCurve,
  };

  if (localStations.length === 0) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#06080e', flexDirection:'column', gap:16 }}>
        <Flame size={48} style={{ color:'#f97316', filter:'drop-shadow(0 0 20px #f97316)' }} />
        <div style={{ fontFamily:'Syne, sans-serif', fontSize:24, fontWeight:800, color:'#e2e8f0' }}>Loading Hotspots</div>
        <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:14, color:'#64748b' }}>Fetching nearby stations...</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.5 }}
      className="pt-12 min-h-screen"
      style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#06080e' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .clean-tooltip .leaflet-tooltip { background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important; }
        @media (max-width: 767px) { .leaflet-control-attribution { display: none !important; } }
        .leaflet-tooltip-top.clean-tooltip::before { display:none; }
        .user-dot { position:relative;width:20px;height:20px;background:#f97316;border:3px solid #fff;border-radius:50%;box-shadow:0 0 16px rgba(249,115,22,0.8);transform:translate(-2px,-2px); }
        .user-dot::before { content:'';position:absolute;top:-14px;left:-14px;right:-14px;bottom:-14px;border-radius:50%;border:2px solid rgba(249,115,22,0.5);animation:user-pulse 2s ease-out infinite; }
        @keyframes user-pulse { 0%{transform:scale(0.6);opacity:1} 100%{transform:scale(2.2);opacity:0} }
        @keyframes scan { 0%{top:0;opacity:1} 90%{opacity:0.3} 100%{top:100%;opacity:0} }
        .hs-scroll::-webkit-scrollbar { width:6px; }
        .hs-scroll::-webkit-scrollbar-track { background:transparent; }
        .hs-scroll::-webkit-scrollbar-thumb { background:rgba(249,115,22,0.25);border-radius:99px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .blink { animation:blink 1.4s ease-in-out infinite; }
        input[type=range].timeline-slider { -webkit-appearance:none;appearance:none;height:6px;border-radius:99px;outline:none;cursor:pointer; }
        input[type=range].timeline-slider::-webkit-slider-thumb { -webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#f97316;border:2px solid #06080e;box-shadow:0 0 12px rgba(249,115,22,0.8);cursor:pointer; }
        @media (max-width:767px) { .hs-desktop-panel { display:none!important; } }
        @media (min-width:768px) { .hs-mobile-toggle { display:none!important; } .hs-mobile-drawer { display:none!important; } }
      `}</style>

      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* ── DESKTOP PANEL ── */}
        <div className="hs-scroll hs-desktop-panel"
          style={{ width:340, flexShrink:0, display:'flex', flexDirection:'column', overflowY:'auto', background:'rgba(6,8,14,0.98)', borderRight:'1px solid rgba(249,115,22,0.08)', boxShadow:'4px 0 40px rgba(0,0,0,0.8)', zIndex:10 }}>
          <PanelContent {...panelProps} />
        </div>

        {/* ── MAP ── */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

          {/* Theme-aware scan line */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:'2px',
            background:`linear-gradient(90deg, transparent, ${scanLineColor}, transparent)`,
            animation:'scan 3s linear infinite',
            pointerEvents:'none', zIndex:998,
          }} />

          <MapContainer center={userCoords} zoom={12} style={{ height:'100%', width:'100%', background:'#04060c' }} zoomControl={false}>
            <TileLayer key={activeTheme} url={currentTheme.url} attribution={currentTheme.attribution} opacity={0.85} />
            <MapSync coords={userCoords} userLoc={userLoc} isLocating={isLocating} />
            <HeatmapLayer stations={hourlyStations} layerKey={activeLayer} />
            <UserLocationMarker position={userLoc} />
            <MapControls userLoc={userLoc} onLocate={handleLocate} />
          </MapContainer>

          {/* Theme switcher */}
          <div style={{ position:'absolute', bottom: isMobile ? 280 : 130, right:16, zIndex:1000 }}>
            <MapThemeSwitcher activeTheme={activeTheme} onThemeChange={setActiveTheme} />
          </div>

          {/* Top badge */}
          <div style={{ position:'absolute', top:16, left:16, right:isMobile?70:80, zIndex:999, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderRadius:12, background:'rgba(6,8,14,0.94)', backdropFilter:'blur(16px)', border:`1px solid ${worstColor}33`, boxShadow:'0 8px 30px rgba(0,0,0,0.7)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:worstColor, boxShadow:`0 0 10px ${worstColor}` }} />
              <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, fontWeight:700, color:'#e2e8f0' }}>{LAYERS.find(l=>l.key===activeLayer)?.label}</span>
              {!isMobile && <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, color:'#64748b' }}>{LAYERS.find(l=>l.key===activeLayer)?.desc}</span>}
            </div>
            {worst && (
              <motion.div key={tick} initial={{ opacity:0.6 }} animate={{ opacity:1 }}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:12, background:'rgba(6,8,14,0.94)', backdropFilter:'blur(16px)', border:`1px solid ${worstColor}44`, boxShadow:`0 8px 30px rgba(0,0,0,0.7)` }}>
                <Zap size={13} style={{ color:worstColor }} />
                <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:12, fontWeight:800, color:worstColor }}>{worst.aqi}</span>
                {!isMobile && <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, color:'#64748b' }}>at {worst.name}</span>}
              </motion.div>
            )}
          </div>

          {/* Timeline */}
          <div style={{ position:'absolute', bottom: isMobile ? 72 : 40, left:'50%', transform:'translateX(-50%)', zIndex:999, background:'rgba(6,8,14,0.97)', backdropFilter:'blur(24px)', border:'1px solid rgba(249,115,22,0.22)', borderRadius:isMobile?20:32, padding:isMobile?'16px':'28px 32px', width:isMobile?'calc(100% - 24px)':'94%', maxWidth:820, boxShadow:'0 24px 80px rgba(0,0,0,0.9)' }}>
            {isMobile ? (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:22, fontWeight:800, color:'#f97316' }}>{hourLabel(hour)}</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {[
                      { label:'Now', h:new Date().getHours() },
                      { label:'AM',  h:[...peakHours].find(h=>h>=6&&h<=11)??8 },
                      { label:'PM',  h:[...peakHours].find(h=>h>=15&&h<=20)??18 },
                    ].map(({ label, h }) => {
                      const active = hour === h;
                      return (
                        <button key={label} onClick={() => setHour(h)}
                          style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, fontWeight:active?700:600, padding:'6px 10px', borderRadius:8, border:'none', cursor:'pointer', background:active?'rgba(249,115,22,0.18)':'rgba(255,255,255,0.05)', color:active?'#f97316':'#94a3b8', outline:active?'1px solid rgba(249,115,22,0.4)':'1px solid rgba(255,255,255,0.06)', transition:'all 0.15s' }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ height:6, borderRadius:99, background:'linear-gradient(90deg,#334155 0%,#00d4aa 25%,#fbbf24 40%,#ef4444 60%,#ef4444 70%,#fbbf24 85%,#334155 100%)', marginBottom:6, opacity:0.5 }} />
                <input type="range" min={0} max={23} value={hour} onChange={e=>setHour(+e.target.value)} className="timeline-slider" style={{ width:'100%', background:'rgba(255,255,255,0.06)' }} />
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                  {[0,6,12,18,23].map(h=>(
                    <span key={h} style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:11, color:h===hour?'#f97316':'#64748b', fontWeight:h===hour?700:500 }}>{h.toString().padStart(2,'0')}</span>
                  ))}
                </div>
                <div style={{ textAlign:"right", marginTop:6 }}>
                  <span style={{ fontFamily:"IBM Plex Mono, monospace", fontSize:9, color:"rgba(100,116,139,0.6)" }}>© CARTO · Leaflet</span>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:32 }}>
                <div style={{ flexShrink:0, minWidth:130 }}>
                  <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:13, color:isLiveHour?'#cbd5e1':'#64748b', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>{isLiveHour?'⚪ LIVE NOW':'⏪ REPLAY'}</div>
                  <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:44, fontWeight:800, color:'#f97316', lineHeight:1, textShadow:'0 0 30px rgba(249,115,22,0.5)' }}>{hourLabel(hour)}</div>
                  <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:13, color:'#64748b', marginTop:8 }}>×{(hourlyCurve[hour]??1).toFixed(2)} intensity</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                    {[0,6,12,18,23].map(h=>(
                      <span key={h} style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:14, color:h===hour?'#f97316':'#64748b', fontWeight:h===hour?700:500, transition:'color 0.2s' }}>{h.toString().padStart(2,'0')}</span>
                    ))}
                  </div>
                  <div style={{ position:'relative', marginBottom:14 }}>
                    <div style={{ height:8, borderRadius:99, background:'linear-gradient(90deg,#334155 0%,#00d4aa 25%,#fbbf24 40%,#ef4444 60%,#ef4444 70%,#fbbf24 85%,#334155 100%)', marginBottom:8, opacity:0.6 }} />
                    <input type="range" min={0} max={23} value={hour} onChange={e=>setHour(+e.target.value)} className="timeline-slider" style={{ width:'100%', background:'rgba(255,255,255,0.06)', position:'relative', zIndex:2, marginTop:-5 }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    {['Quiet','Morning Rush','Midday','Evening Rush','Night'].map(l=>(
                      <span key={l} style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:13, color:'#64748b' }}>{l}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10, flexShrink:0 }}>
                  {([
                    ['Now', new Date().getHours()],
                    ['AM Rush', [...peakHours].sort((a,b)=>a-b).find(h=>h>=6&&h<=11)??8],
                    ['PM Rush', [...peakHours].sort((a,b)=>a-b).find(h=>h>=15&&h<=20)??18],
                    ['Night', 0],
                  ] as [string,number][]).map(([label,h])=>{
                    const active=hour===h;
                    return (
                      <button key={label} onClick={()=>setHour(h)}
                        style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:14, fontWeight:active?700:600, padding:'10px 20px', borderRadius:12, border:'none', cursor:'pointer', background:active?'rgba(249,115,22,0.18)':'rgba(255,255,255,0.05)', color:active?'#f97316':'#94a3b8', outline:active?'1px solid rgba(249,115,22,0.4)':'1px solid rgba(255,255,255,0.06)', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Station detail */}
          <AnimatePresence>
            {selectedHourly && <HotspotDetail station={selectedHourly} onClose={()=>setSelectedStation(null)} isMobile={isMobile} />}
          </AnimatePresence>
        </div>

        {/* ── MOBILE TOGGLE ── */}
        <button className="hs-mobile-toggle"
          onClick={() => setPanelOpen(o => !o)}
          style={{ position:'absolute', bottom: 230, left:16, zIndex:1001, display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, background:'rgba(6,8,14,0.95)', backdropFilter:'blur(16px)', border:`1px solid ${worstColor}40`, color:worstColor, cursor:'pointer', fontFamily:'IBM Plex Mono, monospace', fontSize:12, fontWeight:700, boxShadow:`0 4px 20px rgba(0,0,0,0.7)` }}>
          <Flame size={14} style={{ color:worstColor }} />
          HOTSPOTS
          {panelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* ── MOBILE DRAWER ── */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div className="hs-scroll hs-mobile-drawer"
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', stiffness:340, damping:32 }}
              style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:1000, maxHeight:'70vh', overflowY:'auto', background:'rgba(6,8,14,0.98)', borderTop:'1px solid rgba(249,115,22,0.15)', borderRadius:'20px 20px 0 0', boxShadow:'0 -16px 60px rgba(0,0,0,0.9)' }}>
              <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
                <div style={{ width:40, height:4, borderRadius:99, background:'rgba(255,255,255,0.15)' }} />
              </div>
              <PanelContent {...panelProps} />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
};

export default Hotspots;