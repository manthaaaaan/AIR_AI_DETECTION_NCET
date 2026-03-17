import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAirQuality } from '@/context/AirQualityContext';
import { getAQIColor, getAQICategory, healthAdvisory, pollutantInfo } from '@/data/mockSensorData';
import { indianStates } from '@/data/indiaLocations';
import AQIGauge from '@/components/AQIGauge';
import PollutantCard from '@/components/PollutantCard';
import { motion } from 'framer-motion';
import { Clock, Search, X } from 'lucide-react';

const createMarkerIcon = (aqi: number, name: string, isLive = false) => {
  const color = getAQIColor(aqi);
  // Hide "Zone N" labels for local sub-stations — only show name for real named stations
  const showLabel = !name.match(/^Zone\s*\d+$/i) && !name.match(/^s-/);
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="position:relative;width:${isLive ? 42 : 36}px;height:${isLive ? 42 : 36}px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:pulse 2s infinite;"></div>
          ${isLive ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${color};opacity:0.4;animation:pulse 2s infinite 0.5s;"></div>` : ''}
          <div style="position:absolute;inset:2px;border-radius:50%;background:${color};box-shadow:0 0 ${isLive ? 16 : 10}px ${color}88;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:${isLive ? 13 : 11}px;font-family:monospace;border:${isLive ? '2px' : '1px'} solid rgba(255,255,255,0.4);z-index:2;">
            ${aqi}
          </div>
        </div>
        ${showLabel ? `
        <div style="margin-top:4px;background:rgba(0,0,0,0.8);border:1px solid ${color}88;border-radius:4px;padding:2px 7px;white-space:nowrap;font-size:11px;font-family:monospace;font-weight:600;color:${color};letter-spacing:0.04em;pointer-events:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;">
          ${name}
        </div>` : ''}
      </div>
      <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:0.25}50%{transform:scale(1.9);opacity:0}}</style>
    `,
    iconSize: [isLive ? 42 : 36, showLabel ? (isLive ? 64 : 56) : (isLive ? 42 : 36)],
    iconAnchor: [isLive ? 21 : 18, isLive ? 21 : 18],
  });
};

const createUserIcon = () => L.divIcon({
  className: 'user-marker',
  html: `
    <div style="position:relative;width:24px;height:24px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.25;animation:pulse 2s infinite;"></div>
      <div style="position:absolute;inset:3px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 0 10px #3b82f688;"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// ── Local markers are ALWAYS visible — only toggle regional ones ──────────────
const LOCAL_ZOOM_THRESHOLD = 8; // show regional city-level markers at all zoom levels > 8

const MapMarkers = () => {
  const map = useMap();
  const { stations, setSelectedStation } = useAirQuality();
  const markersRef = useRef<{ marker: L.Marker; isRegional: boolean }[]>([]);

  const applyZoomVisibility = useCallback((zoom: number) => {
    markersRef.current.forEach(({ marker, isRegional }) => {
      if (!isRegional) return; // local markers always visible
      const el = marker.getElement();
      if (!el) return;
      // Show regional markers only when zoomed out enough
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
      const isLocal = station.id.startsWith('s-local') || station.id === 's-center';
      const isCenter = station.id === 's-center';
      // Regional = not local (city-level comparison stations)
      const isRegional = !isLocal;

      const marker = L.marker([station.lat, station.lng], {
        icon: createMarkerIcon(
          station.aqi,
          isLocal && !isCenter ? '' : station.name, // suppress Zone N labels
          isCenter // live glow only on center
        ),
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
              <span>PM2.5: ${station.pm25}</span>
              <span>PM10: ${station.pm10}</span>
              <span>NO2: ${station.no2}</span>
              <span>CO: ${station.co}</span>
              <span>SO2: ${station.so2}</span>
              <span>O3: ${station.o3}</span>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;display:flex;justify-content:space-between;color:#94a3b8;">
              <span>${station.temp}°C</span>
              <span>${station.humidity}% RH</span>
            </div>
          </div>
        `, { className: 'dark-popup' })
        .on('click', () => setSelectedStation(station));

      // Regional markers: hidden when zoomed in (local detail view)
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
  }, [stations, map, setSelectedStation, applyZoomVisibility]);

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

const MapEvents = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (e) => { onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
};

const UserLocationMarker = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker(coords, { icon: createUserIcon(), zIndexOffset: 1000 })
      .addTo(map)
      .bindTooltip('You are here', { permanent: false, direction: 'top' });
    return () => { markerRef.current?.remove(); };
  }, [coords, map]);

  return null;
};

const LocateMeButton = ({ coords, onReset }: { coords: [number, number], onReset: () => void }) => {
  const map = useMap();
  const handleClick = useCallback(() => {
    // Use zoom 11 (same as MapFlyTo search) so local markers remain visible
    map.flyTo(coords, 11, { duration: 1.2 });
    onReset();
  }, [map, coords, onReset]);

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: '10px', marginRight: '10px' }}>
      <div className="leaflet-control">
        <button
          onClick={handleClick}
          title="Go to my location"
          style={{
            width: '40px', height: '40px',
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#3b82f6',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
          onMouseLeave={e => (e.currentTarget.style.background = '#0f172a')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="#3b82f688" stroke="none"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const {
    cityAQI, cityName, liveAvgAQI, stations, lastUpdated,
    userCoords, viewCoords, setViewCoords, handleMapClick,
    dataLoading, addSearchedLocation,
  } = useAirQuality();

  const [selectedState, setSelectedState] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const filteredDistricts = useMemo(() => {
    if (!selectedState) return [];
    const stateObj = indianStates.find(s => s.name === selectedState);
    if (!stateObj) return [];
    const q = locationSearch.trim().toLowerCase();
    if (!q) return stateObj.districts;
    return stateObj.districts.filter(d => d.name.toLowerCase().includes(q));
  }, [selectedState, locationSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const category = getAQICategory(cityAQI);
  const advisory = healthAdvisory[category.label] || '';

  const avgStation = stations.length ? {
    pm25: Math.round(stations.reduce((s, st) => s + st.pm25, 0) / stations.length),
    pm10: Math.round(stations.reduce((s, st) => s + st.pm10, 0) / stations.length),
    no2:  Math.round(stations.reduce((s, st) => s + st.no2,  0) / stations.length),
    co:   +(stations.reduce((s, st) => s + st.co, 0) / stations.length).toFixed(1),
    o3:   Math.round(stations.reduce((s, st) => s + st.o3,  0) / stations.length),
    so2:  Math.round(stations.reduce((s, st) => s + st.so2, 0) / stations.length),
  } : { pm25: 0, pm10: 0, no2: 0, co: 0, o3: 0, so2: 0 };

  const secondsAgo = Math.round((Date.now() - lastUpdated.getTime()) / 1000);

  // ── Display name logic ────────────────────────────────────────────────────
  // Compare coords with tolerance (floating point drift)
  const coordMatch = (a: [number, number], b: [number, number]) =>
    Math.abs(a[0] - b[0]) < 0.001 && Math.abs(a[1] - b[1]) < 0.001;

  const isAtUserLocation = coordMatch(viewCoords, userCoords);

  // Use cityName from context — it's already resolved by the context to the
  // real city name via reverse geocoding. Only override with "Current Location"
  // when we're literally at the user's GPS pin AND cityName hasn't resolved yet.
  const displayLocationName = dataLoading
    ? 'Detecting…'
    : cityName || (isAtUserLocation ? 'Current Location' : 'Unknown');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="pt-16 pb-8 min-h-screen grid-bg"
    >
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">

        {/* ── Left Sidebar ── */}
        <div className="w-full lg:w-80 p-4 flex flex-col gap-4 flex-shrink-0">
          <div className="glass-card p-5">
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Location Filter</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase block mb-1.5">State</label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setLocationSearch('');
                    setShowSuggestions(false);
                  }}
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">Select State</option>
                  {indianStates.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              {selectedState && (
                <div ref={searchWrapperRef} className="relative">
                  <label className="text-xs font-mono text-muted-foreground uppercase block mb-1.5">Search Location</label>
                  <div className="relative flex items-center">
                    <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={locationSearch}
                      onChange={(e) => { setLocationSearch(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder={`Search in ${selectedState}…`}
                      className="w-full bg-muted border border-border rounded-md pl-9 pr-9 py-2 text-sm font-mono text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground/50"
                    />
                    {locationSearch && (
                      <button
                        onClick={() => { setLocationSearch(''); setShowSuggestions(false); searchInputRef.current?.focus(); }}
                        className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {showSuggestions && filteredDistricts.length > 0 && (
                    <ul className="absolute z-[9999] top-full mt-2 w-full bg-card border border-border rounded-md shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                      {filteredDistricts.map(district => (
                        <li
                          key={district.name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addSearchedLocation(district.lat, district.lng, district.name);
                            setLocationSearch(district.name);
                            setShowSuggestions(false);
                          }}
                          className="px-4 py-3 text-sm font-mono text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer flex items-center gap-3 border-b border-border/40 last:border-0 transition-colors"
                        >
                          <Search size={12} className="text-muted-foreground flex-shrink-0" />
                          {district.name}
                        </li>
                      ))}
                    </ul>
                  )}

                  {showSuggestions && locationSearch.trim() && filteredDistricts.length === 0 && (
                    <div className="absolute z-[9999] top-full mt-2 w-full bg-card border border-border rounded-md px-4 py-3 text-sm font-mono text-muted-foreground shadow-2xl">
                      No locations found in {selectedState}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 text-center">
            <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-2">10km Area Average AQI</p>
            <p className="text-xl font-mono font-bold text-foreground mb-4">{displayLocationName}</p>
            <AQIGauge value={liveAvgAQI || cityAQI} size={220} />
            <div className="mt-4">
              <span
                className="inline-block px-3 py-1 rounded-full text-sm font-mono font-semibold"
                style={{ backgroundColor: category.color + '22', color: category.color, border: `1px solid ${category.color}44` }}
              >
                {category.label}
              </span>
            </div>
          </div>

          <div className="glass-card p-5">
            <h4 className="font-heading text-base font-semibold text-foreground mb-2">Health Advisory</h4>
            <p className="text-sm font-body text-muted-foreground leading-relaxed">{advisory}</p>
          </div>

          <div className="glass-card p-4 flex items-center gap-2 mt-auto">
            <Clock size={14} className="text-primary" />
            <span className="text-xs font-mono text-muted-foreground">Updated {secondsAgo}s ago</span>
            <span className="ml-auto w-2.5 h-2.5 rounded-full bg-primary animate-pulse-glow" />
          </div>
        </div>

        {/* ── Map ── */}
        <div className="flex-1 relative min-h-[400px]">
          <MapContainer
            center={[22.5, 82.0]}
            zoom={5}
            className="h-full w-full rounded-md shadow-inner"
            style={{ background: '#0a0e14' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <MapFlyTo coords={viewCoords} />
            <Circle
              center={userCoords}
              radius={10000}
              pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, weight: 1, dashArray: '4 4' }}
            />
            <MapMarkers />
            <UserLocationMarker coords={userCoords} />
            <LocateMeButton
              coords={userCoords}
              onReset={() => {
                handleMapClick(userCoords[0], userCoords[1]);
                setViewCoords(userCoords);
                setSelectedState('');
                setLocationSearch('');
              }}
            />
            <MapEvents onMapClick={handleMapClick} />
          </MapContainer>

          {dataLoading && (
            <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] z-[500] flex items-center justify-center">
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xl flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-mono">Analyzing Location...</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="w-full lg:w-80 p-5 flex flex-col gap-4 flex-shrink-0 overflow-y-auto">
          <h3 className="font-heading text-base font-bold text-foreground uppercase tracking-widest mb-1 border-b border-border/40 pb-3">
            {dataLoading ? 'Analyzing…' : `Pollutants · ${displayLocationName}`}
          </h3>
          <div className="flex flex-col gap-3">
            {pollutantInfo.map(p => (
              <PollutantCard
                key={p.key}
                label={p.label}
                value={avgStation[p.key]}
                unit={p.unit}
                max={p.max}
                icon={p.icon}
              />
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default Dashboard;