import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAirQuality } from '@/context/AirQualityContext';
import { getAQIColor, getAQICategory, healthAdvisory, pollutantInfo } from '@/data/mockSensorData';
import { indianStates } from '@/data/indiaLocations';
import AQIGauge from '@/components/AQIGauge';
import PollutantCard from '@/components/PollutantCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Search, X, ChevronUp, ChevronDown } from 'lucide-react';

// ── Map Themes ─────────────────────────────────────────────────
const MAP_THEMES = [
  { id: 'dark',       label: 'Dark',        preview: '#0a0e14', isLight: false, url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                                   attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'voyager',    label: 'Google Maps', preview: '#e8f0d8', isLight: true,  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',                                        attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'light',      label: 'Light',       preview: '#f5f5f0', isLight: true,  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                                                   attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'satellite',  label: 'Satellite',   preview: '#1a2a1a', isLight: false, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',                    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>' },
  { id: 'terrain',    label: 'Terrain',     preview: '#c8d8a8', isLight: true,  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',                   attribution: '&copy; <a href="https://www.esri.com/">Esri</a>' },
  { id: 'watercolor', label: 'Watercolor',  preview: '#d4e8f0', isLight: true,  url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',                                             attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>' },
  { id: 'osm',        label: 'Street',      preview: '#f0e8d8', isLight: true,  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                                               attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>' },
];

// ── Theme-aware marker factory ─────────────────────────────────
const createMarkerIcon = (aqi: number, name: string, isLive = false, isLight = false) => {
  const color = getAQIColor(aqi);
  const showLabel = !name.match(/^Zone\s*\d+$/i) && !name.match(/^s-/);

  // Light themes: dark outline + stronger drop shadow so dots pop on pale maps
  // Dark themes: current glowing style
  const dotBorder   = isLight ? `3px solid rgba(0,0,0,0.75)` : `${isLive ? '2px' : '1px'} solid rgba(255,255,255,0.4)`;
  const dotShadow   = isLight
    ? `0 2px 8px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(0,0,0,0.3)`
    : `0 0 ${isLive ? 16 : 10}px ${color}88`;
  const dotTextColor = isLight ? '#111' : 'white';
  const labelBg     = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.8)';
  const labelBorder = isLight ? `1px solid rgba(0,0,0,0.18)` : `1px solid ${color}88`;
  const labelColor  = isLight ? '#111' : color;
  const labelShadow = isLight ? '0 2px 6px rgba(0,0,0,0.22)' : 'none';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="position:relative;width:${isLive ? 42 : 36}px;height:${isLive ? 42 : 36}px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:${isLight ? 0.18 : 0.25};animation:pulse 2s infinite;"></div>
          ${isLive ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${color};opacity:${isLight ? 0.3 : 0.4};animation:pulse 2s infinite 0.5s;"></div>` : ''}
          <div style="position:absolute;inset:2px;border-radius:50%;background:${color};box-shadow:${dotShadow};display:flex;align-items:center;justify-content:center;color:${dotTextColor};font-weight:bold;font-size:${isLive ? 13 : 11}px;font-family:monospace;border:${dotBorder};z-index:2;">
            ${aqi}
          </div>
        </div>
        ${showLabel ? `<div style="margin-top:4px;background:${labelBg};border:${labelBorder};border-radius:4px;padding:2px 7px;white-space:nowrap;font-size:11px;font-family:monospace;font-weight:600;color:${labelColor};letter-spacing:0.04em;pointer-events:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;box-shadow:${labelShadow};">${name}</div>` : ''}
      </div>
      <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:${isLight ? 0.18 : 0.25}}50%{transform:scale(1.9);opacity:0}}</style>
    `,
    iconSize: [isLive ? 42 : 36, showLabel ? (isLive ? 64 : 56) : (isLive ? 42 : 36)],
    iconAnchor: [isLive ? 21 : 18, isLive ? 21 : 18],
  });
};

const createUserIcon = (isLight = false) => L.divIcon({
  className: 'user-marker',
  html: `<div style="position:relative;width:24px;height:24px;">
    <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.25;animation:pulse 2s infinite;"></div>
    <div style="position:absolute;inset:3px;border-radius:50%;background:#3b82f6;border:${isLight ? '2px solid rgba(0,0,0,0.6)' : '2px solid white'};box-shadow:${isLight ? '0 2px 8px rgba(0,0,0,0.4)' : '0 0 10px #3b82f688'};"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const LOCAL_ZOOM_THRESHOLD = 8;

// ── MapMarkers now receives isLight ───────────────────────────
const MapMarkers = ({ isLight }: { isLight: boolean }) => {
  const map = useMap();
  const { stations, setSelectedStation } = useAirQuality();
  const markersRef = useRef<{ marker: L.Marker; isRegional: boolean }[]>([]);

  const applyZoomVisibility = useCallback((zoom: number) => {
    markersRef.current.forEach(({ marker, isRegional }) => {
      if (!isRegional) return;
      const el = marker.getElement();
      if (!el) return;
      el.style.opacity = zoom <= LOCAL_ZOOM_THRESHOLD ? '0' : '1';
      el.style.pointerEvents = zoom <= LOCAL_ZOOM_THRESHOLD ? 'none' : 'auto';
    });
  }, []);

  useEffect(() => {
    const onZoom = () => applyZoomVisibility(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map, applyZoomVisibility]);

  useEffect(() => {
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];
    const currentZoom = map.getZoom();

    stations.forEach(station => {
      const isLocal    = station.id.startsWith('s-local') || station.id === 's-center';
      const isCenter   = station.id === 's-center';
      const isRegional = !isLocal;

      const marker = L.marker([station.lat, station.lng], {
        icon: createMarkerIcon(station.aqi, isLocal && !isCenter ? '' : station.name, isCenter, isLight),
        zIndexOffset: isCenter ? 1000 : isLocal ? 500 : 0,
      })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;min-width:200px;">
            <strong style="font-family:Syne,sans-serif;font-size:16px;display:block;margin-bottom:6px;">${station.name}</strong>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span style="color:${getAQIColor(station.aqi)};font-size:24px;font-weight:700;">${station.aqi}</span>
              <span style="color:${getAQIColor(station.aqi)};font-size:12px;text-transform:uppercase;font-weight:600;">${getAQICategory(station.aqi).label}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;opacity:0.9;">
              <span>PM2.5: ${station.pm25}</span><span>PM10: ${station.pm10}</span>
              <span>NO2: ${station.no2}</span><span>CO: ${station.co}</span>
              <span>SO2: ${station.so2}</span><span>O3: ${station.o3}</span>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;display:flex;justify-content:space-between;color:#94a3b8;">
              <span>${station.temp}°C</span><span>${station.humidity}% RH</span>
            </div>
          </div>
        `, { className: 'dark-popup' })
        .on('click', () => setSelectedStation(station));

      if (isRegional) {
        const el = marker.getElement();
        if (el) {
          el.style.opacity = currentZoom <= LOCAL_ZOOM_THRESHOLD ? '0' : '1';
          el.style.pointerEvents = currentZoom <= LOCAL_ZOOM_THRESHOLD ? 'none' : 'auto';
        }
      }
      markersRef.current.push({ marker, isRegional });
    });

    setTimeout(() => applyZoomVisibility(map.getZoom()), 50);
    return () => { markersRef.current.forEach(({ marker }) => marker.remove()); };
  }, [stations, map, setSelectedStation, applyZoomVisibility, isLight]);

  return null;
};

const MapFlyTo = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    map.flyTo(coords, 11, { duration: 1.5 });
  }, [coords, map]);
  return null;
};

const MapEvents = ({ onMapClick, userCoords }: { onMapClick: (lat: number, lng: number) => void; userCoords: [number, number] }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      if (Math.hypot(lat - userCoords[0], lng - userCoords[1]) < 0.005) return;
      onMapClick(lat, lng);
    },
  });
  return null;
};

const UserLocationMarker = ({ coords, isLight }: { coords: [number, number]; isLight: boolean }) => {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker(coords, { icon: createUserIcon(isLight), zIndexOffset: 1000 })
      .addTo(map)
      .bindTooltip('You are here', { permanent: false, direction: 'top' });
    return () => { markerRef.current?.remove(); };
  }, [coords, map, isLight]);
  return null;
};

const LocateMeButton = ({ coords, onReset }: { coords: [number, number]; onReset: () => void }) => {
  const map = useMap();
  const handleClick = useCallback(() => { map.flyTo(coords, 11, { duration: 1.2 }); onReset(); }, [map, coords, onReset]);
  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: '10px', marginRight: '10px' }}>
      <div className="leaflet-control">
        <button onClick={handleClick} title="Go to my location"
          style={{ width:'40px',height:'40px',background:'#0f172a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#3b82f6',boxShadow:'0 2px 8px rgba(0,0,0,0.4)',transition:'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background='#1e293b')}
          onMouseLeave={e => (e.currentTarget.style.background='#0f172a')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="#3b82f688" stroke="none"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

const ThemePickerButton = ({ activeTheme, onThemeChange }: { activeTheme: typeof MAP_THEMES[0]; onThemeChange: (t: typeof MAP_THEMES[0]) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:'absolute', bottom:130, right:16, zIndex:1000 }}>
      <button onClick={() => setOpen(o => !o)} title="Map Theme"
        style={{ width:44,height:44,background:open?'rgba(249,115,22,0.15)':'rgba(30,35,50,0.97)',border:`1px solid ${open?'rgba(249,115,22,0.6)':'rgba(255,255,255,0.25)'}`,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:open?'#f97316':'#e2e8f0',boxShadow:'0 4px 24px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',transition:'all 0.2s' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0,scale:0.92,y:8 }} animate={{ opacity:1,scale:1,y:0 }} exit={{ opacity:0,scale:0.92,y:8 }} transition={{ type:'spring',stiffness:380,damping:28 }}
            style={{ position:'absolute',bottom:52,right:0,background:'rgba(6,8,14,0.97)',backdropFilter:'blur(20px)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:18,padding:'16px',width:210,boxShadow:'0 24px 60px rgba(0,0,0,0.9)' }}>
            <div style={{ fontFamily:'IBM Plex Mono,monospace',fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:12 }}>Map Theme</div>
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {MAP_THEMES.map(theme => {
                const isActive = theme.id === activeTheme.id;
                return (
                  <button key={theme.id} onClick={() => { onThemeChange(theme); setOpen(false); }}
                    style={{ display:'flex',alignItems:'center',gap:12,padding:'9px 12px',borderRadius:10,border:'none',cursor:'pointer',background:isActive?'rgba(249,115,22,0.12)':'rgba(255,255,255,0.03)',outline:isActive?'1px solid rgba(249,115,22,0.4)':'1px solid transparent',transition:'all 0.15s',textAlign:'left' }}>
                    <div style={{ width:28,height:20,borderRadius:6,flexShrink:0,background:theme.preview,border:isActive?'2px solid #f97316':'1px solid rgba(255,255,255,0.1)',boxShadow:isActive?'0 0 8px rgba(249,115,22,0.5)':'none',transition:'all 0.15s' }}/>
                    <span style={{ fontFamily:'IBM Plex Mono,monospace',fontSize:13,fontWeight:isActive?700:500,color:isActive?'#f97316':'#94a3b8',transition:'color 0.15s' }}>{theme.label}</span>
                    {isActive && <div style={{ marginLeft:'auto',width:6,height:6,borderRadius:'50%',background:'#f97316',flexShrink:0 }}/>}
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

// ── Main Dashboard ─────────────────────────────────────────────
const Dashboard = () => {
  const {
    cityAQI, cityName, liveAvgAQI, stations, lastUpdated,
    userCoords, viewCoords, setViewCoords, handleMapClick,
    dataLoading, addSearchedLocation, selectedStation, setSelectedStation,
  } = useAirQuality();

  const [selectedState,    setSelectedState]    = useState('');
  const [locationSearch,   setLocationSearch]   = useState('');
  const [showSuggestions,  setShowSuggestions]  = useState(false);
  const [activeTheme,      setActiveTheme]      = useState(MAP_THEMES.find(t => t.id === 'terrain')!);
  // Mobile drawer states
  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  // Detect mobile
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const searchInputRef   = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const isLight = activeTheme.isLight;

  const filteredDistricts = useMemo(() => {
    if (!selectedState) return [];
    const stateObj = indianStates.find(s => s.name === selectedState);
    if (!stateObj) return [];
    const q = locationSearch.trim().toLowerCase();
    return q ? stateObj.districts.filter(d => d.name.toLowerCase().includes(q)) : stateObj.districts;
  }, [selectedState, locationSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeAQI = selectedStation?.aqi ?? liveAvgAQI ?? cityAQI;
  const coordMatch = (a: [number, number], b: [number, number]) => Math.abs(a[0]-b[0])<0.001 && Math.abs(a[1]-b[1])<0.001;
  const isAtUserLocation = coordMatch(viewCoords, userCoords);
  const displayLocationName = dataLoading ? 'Detecting…' : cityName || (isAtUserLocation ? 'Current Location' : 'Unknown');
  const activeName = selectedStation?.name ?? displayLocationName;
  const category   = getAQICategory(activeAQI);
  const advisory   = healthAdvisory[category.label] || '';

  const avgStation = selectedStation ? {
    pm25: selectedStation.pm25, pm10: selectedStation.pm10, no2: selectedStation.no2,
    co: selectedStation.co, o3: selectedStation.o3, so2: selectedStation.so2,
  } : stations.length ? {
    pm25: Math.round(stations.reduce((s,st)=>s+st.pm25,0)/stations.length),
    pm10: Math.round(stations.reduce((s,st)=>s+st.pm10,0)/stations.length),
    no2:  Math.round(stations.reduce((s,st)=>s+st.no2, 0)/stations.length),
    co:   +(stations.reduce((s,st)=>s+st.co,0)/stations.length).toFixed(1),
    o3:   Math.round(stations.reduce((s,st)=>s+st.o3, 0)/stations.length),
    so2:  Math.round(stations.reduce((s,st)=>s+st.so2,0)/stations.length),
  } : { pm25:0,pm10:0,no2:0,co:0,o3:0,so2:0 };

  const secondsAgo = Math.round((Date.now()-lastUpdated.getTime())/1000);

  // ── Left sidebar content ──────────────────────────────────────
  const LeftPanel = () => (
    <div className="flex flex-col gap-4 p-4">
      <div className="glass-card p-5">
        <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Location Filter</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase block mb-1.5">State</label>
            <select value={selectedState}
              onChange={e => { setSelectedState(e.target.value); setLocationSearch(''); setShowSuggestions(false); setSelectedStation(null); }}
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:ring-1 focus:ring-primary outline-none">
              <option value="">Select State</option>
              {indianStates.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          {selectedState && (
            <div ref={searchWrapperRef} className="relative">
              <label className="text-xs font-mono text-muted-foreground uppercase block mb-1.5">Search Location</label>
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none"/>
                <input ref={searchInputRef} type="text" value={locationSearch}
                  onChange={e => { setLocationSearch(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={`Search in ${selectedState}…`}
                  className="w-full bg-muted border border-border rounded-md pl-9 pr-9 py-2 text-sm font-mono text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground/50"/>
                {locationSearch && (
                  <button onClick={() => { setLocationSearch(''); setShowSuggestions(false); searchInputRef.current?.focus(); }} className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors">
                    <X size={14}/>
                  </button>
                )}
              </div>
              {showSuggestions && filteredDistricts.length > 0 && (
                <ul className="absolute z-[9999] top-full mt-2 w-full bg-card border border-border rounded-md shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                  {filteredDistricts.map(district => (
                    <li key={district.name}
                      onMouseDown={e => { e.preventDefault(); setSelectedStation(null); addSearchedLocation(district.lat, district.lng, district.name); setLocationSearch(district.name); setShowSuggestions(false); if(isMobile) setLeftOpen(false); }}
                      className="px-4 py-3 text-sm font-mono text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer flex items-center gap-3 border-b border-border/40 last:border-0 transition-colors">
                      <Search size={12} className="text-muted-foreground flex-shrink-0"/>{district.name}
                    </li>
                  ))}
                </ul>
              )}
              {showSuggestions && locationSearch.trim() && filteredDistricts.length===0 && (
                <div className="absolute z-[9999] top-full mt-2 w-full bg-card border border-border rounded-md px-4 py-3 text-sm font-mono text-muted-foreground shadow-2xl">No locations found in {selectedState}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-5 text-center">
        <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-2">
          {selectedStation ? 'Selected Station AQI' : '10km Area Average AQI'}
        </p>
        <p className="text-xl font-mono font-bold text-foreground mb-4">{activeName}</p>
        <AQIGauge value={activeAQI} size={isMobile ? 180 : 220}/>
        <div className="mt-4">
          <span className="inline-block px-3 py-1 rounded-full text-sm font-mono font-semibold"
            style={{ backgroundColor: category.color+'22', color: category.color, border: `1px solid ${category.color}44` }}>
            {category.label}
          </span>
        </div>
        {selectedStation && (
          <button onClick={() => setSelectedStation(null)} className="mt-3 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            ← Back to area average
          </button>
        )}
      </div>

      <div className="glass-card p-5">
        <h4 className="font-heading text-base font-semibold text-foreground mb-2">Health Advisory</h4>
        <p className="text-sm font-body text-muted-foreground leading-relaxed">{advisory}</p>
      </div>

      <div className="glass-card p-4 flex items-center gap-2">
        <Clock size={14} className="text-primary"/>
        <span className="text-xs font-mono text-muted-foreground">Updated {secondsAgo}s ago</span>
        <span className="ml-auto w-2.5 h-2.5 rounded-full bg-primary animate-pulse-glow"/>
      </div>
    </div>
  );

  // ── Right panel content ───────────────────────────────────────
  const RightPanel = () => (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="font-heading text-base font-bold text-foreground uppercase tracking-widest mb-1 border-b border-border/40 pb-3">
        {dataLoading ? 'Analyzing…' : `Pollutants · ${activeName}`}
      </h3>
      {pollutantInfo.map(p => (
        <PollutantCard key={p.key} label={p.label} value={avgStation[p.key]} unit={p.unit} max={p.max} icon={p.icon}/>
      ))}
    </div>
  );

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.4 }}
      className="grid-bg"
      style={{
        paddingTop: isMobile ? 52 : 64,
        paddingBottom: isMobile ? 64 : 0,
        minHeight: '100vh',
      }}
    >
      <style>{`
        .dash-layout { display: flex; height: calc(100vh - 52px - 64px); }
        @media (min-width: 1024px) {
          .dash-layout { height: calc(100vh - 64px); }
          .dash-mobile-btn { display: none !important; }
          .dash-left { display: flex !important; width: 320px; overflow-y: auto; flex-shrink: 0; }
          .dash-right { display: flex !important; width: 320px; overflow-y: auto; flex-shrink: 0; flex-direction: column; }
          .dash-left-drawer { display: none !important; }
          .dash-right-drawer { display: none !important; }
        }
        @media (max-width: 1023px) {
          .dash-layout { height: calc(100vh - 52px - 64px); }
          .dash-left { display: none !important; }
          .dash-right { display: none !important; }
        }
        .dash-drawer-scroll::-webkit-scrollbar { width: 4px; }
        .dash-drawer-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
      `}</style>

      <div className="dash-layout">

        {/* ── Desktop left sidebar ── */}
        <div className="dash-left" style={{ background:'var(--card)', borderRight:'1px solid var(--border)' }}>
          <div style={{ width:'100%' }}><LeftPanel/></div>
        </div>

        {/* ── Map ── */}
        <div style={{ flex:1, position:'relative', minHeight:300 }}>
          <MapContainer center={[22.5,82.0]} zoom={5} className="h-full w-full rounded-md shadow-inner" zoomControl={false}>
            <TileLayer key={activeTheme.id} url={activeTheme.url} attribution={activeTheme.attribution}/>
            <MapFlyTo coords={viewCoords}/>
            <Circle center={userCoords} radius={10000} pathOptions={{ color:'#f59e0b',fillColor:'#f59e0b',fillOpacity:0.08,weight:1,dashArray:'4 4' }}/>
            <MapMarkers isLight={isLight}/>
            <UserLocationMarker coords={userCoords} isLight={isLight}/>
            <LocateMeButton coords={userCoords} onReset={() => { handleMapClick(userCoords[0],userCoords[1]); setViewCoords(userCoords); setSelectedState(''); setLocationSearch(''); setSelectedStation(null); }}/>
            <MapEvents onMapClick={handleMapClick} userCoords={userCoords}/>
          </MapContainer>

          <ThemePickerButton activeTheme={activeTheme} onThemeChange={setActiveTheme}/>

          {dataLoading && (
            <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] z-[500] flex items-center justify-center">
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xl flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
                <span className="text-sm font-mono">Analyzing Location...</span>
              </div>
            </div>
          )}

          {/* ── Mobile floating buttons ── */}
          <div className="dash-mobile-btn" style={{ position:'absolute', bottom: 16, left: 16, zIndex:999, display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={() => { setLeftOpen(o=>!o); setRightOpen(false); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:12, background:'rgba(6,8,14,0.95)', backdropFilter:'blur(16px)', border:`1px solid ${category.color}50`, color:category.color, cursor:'pointer', fontFamily:'IBM Plex Mono,monospace', fontSize:12, fontWeight:700, boxShadow:`0 4px 20px rgba(0,0,0,0.6), 0 0 14px ${category.color}20` }}>
              <span style={{ fontSize:18, fontWeight:800 }}>{activeAQI}</span>
              <span style={{ fontSize:10, opacity:0.8 }}>{category.label}</span>
              {leftOpen ? <ChevronDown size={13}/> : <ChevronUp size={13}/>}
            </button>
            <button onClick={() => { setRightOpen(o=>!o); setLeftOpen(false); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:12, background:'rgba(6,8,14,0.95)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontFamily:'IBM Plex Mono,monospace', fontSize:12, fontWeight:700, boxShadow:'0 4px 20px rgba(0,0,0,0.6)' }}>
              Pollutants
              {rightOpen ? <ChevronDown size={13}/> : <ChevronUp size={13}/>}
            </button>
          </div>

          {/* ── Mobile left drawer ── */}
          <AnimatePresence>
            {isMobile && leftOpen && (
              <motion.div className="dash-left-drawer dash-drawer-scroll"
                initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
                transition={{ type:'spring', stiffness:340, damping:32 }}
                style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:998, maxHeight:'72vh', overflowY:'auto', background:'rgba(6,8,14,0.97)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px 20px 0 0', boxShadow:'0 -16px 60px rgba(0,0,0,0.9)' }}>
                <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 2px' }}>
                  <div style={{ width:36, height:3, borderRadius:99, background:'rgba(255,255,255,0.15)' }}/>
                </div>
                <LeftPanel/>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Mobile right drawer ── */}
          <AnimatePresence>
            {isMobile && rightOpen && (
              <motion.div className="dash-right-drawer dash-drawer-scroll"
                initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
                transition={{ type:'spring', stiffness:340, damping:32 }}
                style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:998, maxHeight:'72vh', overflowY:'auto', background:'rgba(6,8,14,0.97)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px 20px 0 0', boxShadow:'0 -16px 60px rgba(0,0,0,0.9)' }}>
                <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 2px' }}>
                  <div style={{ width:36, height:3, borderRadius:99, background:'rgba(255,255,255,0.15)' }}/>
                </div>
                <RightPanel/>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Desktop right panel ── */}
        <div className="dash-right" style={{ background:'var(--card)', borderLeft:'1px solid var(--border)' }}>
          <RightPanel/>
        </div>

      </div>
    </motion.div>
  );
};

export default Dashboard;