import React, { createContext, useContext, useState, useEffect } from 'react';
import { SensorStation, initialStations } from '@/data/mockSensorData';
import {
  fetchLiveRadiusStations,
  fetchSingleStation,
  fetchAllCityStations,
} from '@/services/aqiService';

interface AirQualityContextType {
  stations: SensorStation[];
  selectedStation: SensorStation | null;
  setSelectedStation: (s: SensorStation | null) => void;
  cityName: string;
  cityAQI: number;
  liveAvgAQI: number;
  userCoords: [number, number];
  viewCoords: [number, number];
  alerts: { id: string; message: string; stationName: string; aqi: number }[];
  dismissAlert: (id: string) => void;
  lastUpdated: Date;
  locationStatus: 'idle' | 'loading' | 'granted' | 'denied';
  dataLoading: boolean;
  setViewCoords: (coords: [number, number]) => void;
  handleMapClick: (lat: number, lng: number) => Promise<void>;
  addSearchedLocation: (lat: number, lng: number, name: string) => Promise<void>;
  allCityStations: SensorStation[];
}

const AirQualityContext = createContext<AirQualityContextType | null>(null);

export const useAirQuality = () => {
  const ctx = useContext(AirQualityContext);
  if (!ctx) throw new Error('useAirQuality must be within AirQualityProvider');
  return ctx;
};

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    );
    const data = await res.json();
    return (
      data.address?.city    ||
      data.address?.town    ||
      data.address?.village ||
      data.address?.county  ||
      'Current Location'
    );
  } catch {
    return 'Current Location';
  }
}

export const AirQualityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [liveStations,     setLiveStations]     = useState<SensorStation[]>([]);
  const [searchedStations, setSearchedStations] = useState<SensorStation[]>([]);
  const [allCityStations,  setAllCityStations]  = useState<SensorStation[]>([]);
  const [liveAvgAQI,       setLiveAvgAQI]       = useState<number>(0);
  const [selectedStation,  setSelectedStation]  = useState<SensorStation | null>(null);
  const [lastUpdated,      setLastUpdated]      = useState(new Date());
  const [alerts,           setAlerts]           = useState<{ id: string; message: string; stationName: string; aqi: number }[]>([]);
  const [cityName,         setCityName]         = useState('Detecting location...');
  const [userCoords,       setUserCoords]       = useState<[number, number]>([22.5, 82.0]);
  const [viewCoords,       setViewCoords]       = useState<[number, number]>([22.5, 82.0]);
  const [locationStatus,   setLocationStatus]   = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [dataLoading,      setDataLoading]      = useState(false);

  const stations = [
    ...initialStations.filter(s => s.id.startsWith('init-')),
    ...liveStations,
    ...searchedStations,
  ];

  // ── Fetch live radius stations ──────────────────────────────────────────
  const fetchLiveArea = async (lat: number, lng: number) => {
    setDataLoading(true);
    try {
      const { stations: newLive, averageAQI } = await fetchLiveRadiusStations(lat, lng);
      setLiveStations(newLive);
      setLiveAvgAQI(averageAQI);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch real AQI data:', e);
    } finally {
      setDataLoading(false);
    }
  };

  // ── Fetch all 22 city stations in parallel ──────────────────────────────
  useEffect(() => {
    const load = () => {
      fetchAllCityStations()
        .then(setAllCityStations)
        .catch(e => console.error('City fetch failed:', e));
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ── Geolocation init ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchWithIpFallback = async () => {
      try {
        const res  = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data?.latitude && data?.longitude)
          return { lat: data.latitude, lon: data.longitude, city: data.city || 'Current Location' };
      } catch (e) {
        console.error('IP fallback failed', e);
      }
      return null;
    };

    const handleSuccess = async (latitude: number, longitude: number, nameFallback?: string) => {
      setLocationStatus('granted');
      setUserCoords([latitude, longitude]);
      setViewCoords([latitude, longitude]);
      const name = nameFallback || await reverseGeocode(latitude, longitude);
      setCityName(name);
      await fetchLiveArea(latitude, longitude);
    };

    const handleError = async () => {
      const ip = await fetchWithIpFallback();
      if (ip) {
        handleSuccess(ip.lat, ip.lon, ip.city);
      } else {
        setCityName('India');
        setLocationStatus('denied');
      }
    };

    setLocationStatus('loading');
    if (!navigator.geolocation) { handleError(); return; }
    navigator.geolocation.getCurrentPosition(
      pos => handleSuccess(pos.coords.latitude, pos.coords.longitude),
      handleError,
      { timeout: 8000 }
    );
  }, []);

  // ── Periodic refresh of live area ───────────────────────────────────────
  useEffect(() => {
    if (locationStatus !== 'granted') return;
    const interval = setInterval(
      () => fetchLiveArea(userCoords[0], userCoords[1]),
      10 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, [locationStatus, userCoords]);

  // ── Alerts ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const newAlerts = liveStations
      .filter(s => s.aqi > 100)
      .map(s => ({
        id:          `${s.id}-${Date.now()}`,
        message:     `Local Alert: ${s.name} AQI is ${s.aqi}`,
        stationName: s.name,
        aqi:         s.aqi,
      }));
    setAlerts(newAlerts);
  }, [liveStations]);

  const dismissAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  const cityAQI = liveStations.length ? liveAvgAQI : 0;

  const handleMapClick = async (lat: number, lng: number) => {
    setDataLoading(true);
    try {
      const { fetchStationByCoords } = await import('@/services/aqiService');
      const station = await fetchStationByCoords(lat, lng);
      setSelectedStation(station);
    } catch (e) {
      console.error('Failed to fetch data for clicked location:', e);
    } finally {
      setDataLoading(false);
    }
  };

  const addSearchedLocation = async (lat: number, lng: number, name: string) => {
    setDataLoading(true);
    try {
      const st = await fetchSingleStation(lat, lng, name);
      setSearchedStations(prev => {
        const filtered = prev.filter(p => p.id !== st.id);
        return [...filtered, st];
      });
      setViewCoords([lat, lng]);
      setSelectedStation(st);
    } catch (e) {
      console.error('Failed to fetch search result AQI:', e);
    } finally {
      setDataLoading(false);
    }
  };

  return (
    <AirQualityContext.Provider value={{
      stations,
      selectedStation, setSelectedStation,
      cityName, cityAQI, liveAvgAQI,
      userCoords, viewCoords,
      alerts, dismissAlert,
      lastUpdated, locationStatus,
      dataLoading, setViewCoords,
      handleMapClick, addSearchedLocation,
      allCityStations,
    }}>
      {children}
    </AirQualityContext.Provider>
  );
};