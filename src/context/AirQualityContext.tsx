  import React, { createContext, useContext, useState, useEffect } from 'react';
  import { SensorStation, initialStations } from '@/data/mockSensorData';
  import {
    fetchLiveRadiusStations,
    fetchSingleStation,
    fetchAllCityStations,
  } from '@/services/aqiService';

  const OWM_LABEL = ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
  const toRealAQI = (pm25: number) => Math.min(500, Math.round((pm25 / 250) * 500));

  interface OWMAirData {
    currentAQI: number;
    currentLabel: string;
    pm25: number;
    pm10: number;
    o3: number;
    no2: number;
    past: { hour: string; aqi: number; label: string; pm25: string }[];
    forecast: { hour: string; aqi: number; label: string; pm25: string }[];
  }

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
    owmAir: OWMAirData | null;
    owmLoading: boolean;
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

  async function fetchOWMAir(lat: number, lon: number): Promise<OWMAirData | null> {
    const key = import.meta.env.VITE_OWM_API_KEY;
    if (!key) return null;

    const nowTs   = Math.floor(Date.now() / 1000);
    const startTs = nowTs - 5 * 24 * 3600;

    try {
      const [curRes, histRes, foreRes] = await Promise.all([
        fetch(`/owm/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`),
        fetch(`/owm/data/2.5/air_pollution/history?lat=${lat}&lon=${lon}&start=${startTs}&end=${nowTs}&appid=${key}`),
        fetch(`/owm/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${key}`),
      ]);

      const [cur, hist, fore] = await Promise.all([
        curRes.json(), histRes.json(), foreRes.json(),
      ]);

      const curItem = cur?.list?.[0];
      if (!curItem) return null;

      const past = (hist?.list || [])
        .filter((_: any, i: number) => i % 3 === 0)
        .map((item: any) => ({
          hour: new Date(item.dt * 1000).toLocaleString([], {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }),
          aqi:   toRealAQI(item.components?.pm2_5 ?? 0),
          label: OWM_LABEL[item.main.aqi] || 'Unknown',
          pm25:  item.components?.pm2_5?.toFixed(1) ?? '—',
        }));

      const forecast = (fore?.list || [])
        .filter((_: any, i: number) => i % 3 === 0)
        .map((item: any) => ({
          hour: new Date(item.dt * 1000).toLocaleString([], {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }),
          aqi:   toRealAQI(item.components?.pm2_5 ?? 0),
          label: OWM_LABEL[item.main.aqi] || 'Unknown',
          pm25:  item.components?.pm2_5?.toFixed(1) ?? '—',
        }));

      return {
        currentAQI:   toRealAQI(curItem.components?.pm2_5 ?? 0),
        currentLabel: OWM_LABEL[curItem.main.aqi] || 'Unknown',
        pm25:  curItem.components?.pm2_5  ?? 0,
        pm10:  curItem.components?.pm10   ?? 0,
        o3:    curItem.components?.o3     ?? 0,
        no2:   curItem.components?.no2    ?? 0,
        past,
        forecast,
      };
    } catch (e) {
      console.error('OWM air fetch failed:', e);
      return null;
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
    const [owmAir,           setOwmAir]           = useState<OWMAirData | null>(null);
    const [owmLoading,       setOwmLoading]       = useState(false);

    // ── All cities (init) + live nearby + searched ─────────────────
    // init- stations always present for full India coverage
    // live stations override if same area (they have real AQI)
    // searched stations appended on top
    const stations = [
      ...initialStations,   // all 22 major cities — always shown
      ...liveStations,      // real nearby stations from API
      ...searchedStations,  // user-searched locations
    ];

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

    const fetchOWM = async (lat: number, lon: number) => {
      setOwmLoading(true);
      try {
        const data = await fetchOWMAir(lat, lon);
        setOwmAir(data);
      } finally {
        setOwmLoading(false);
      }
    };

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
        await Promise.all([
          fetchLiveArea(latitude, longitude),
          fetchOWM(latitude, longitude),
        ]);
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

    useEffect(() => {
      if (locationStatus !== 'granted') return;
      const interval = setInterval(() => {
        fetchLiveArea(userCoords[0], userCoords[1]);
        fetchOWM(userCoords[0], userCoords[1]);
      }, 10 * 60 * 1000);
      return () => clearInterval(interval);
    }, [locationStatus, userCoords]);

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

    const cityAQI = owmAir
      ? owmAir.currentAQI
      : (liveStations.length ? liveAvgAQI : 0);

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
        owmAir, owmLoading,
      }}>
        {children}
      </AirQualityContext.Provider>
    );
  };