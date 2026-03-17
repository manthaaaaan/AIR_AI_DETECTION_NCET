export interface SensorStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  co: number;
  o3: number;
  so2: number;
  temp: number;
  humidity: number;
  trend: 'up' | 'down' | 'stable';
}

export interface District {
  name: string;
  lat: number;
  lng: number;
}

export interface State {
  name: string;
  districts: District[];
}


const seedRand = (seed: number) => {
  // Simple deterministic pseudo-random so values are stable on every load
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
};

const majorCities: { id: string; name: string; lat: number; lng: number; baseAqi: number }[] = [
  { id: 'init-delhi',     name: 'New Delhi',       lat: 28.6139, lng: 77.2090, baseAqi: 185 },
  { id: 'init-mumbai',    name: 'Mumbai',           lat: 19.0760, lng: 72.8777, baseAqi: 110 },
  { id: 'init-bengaluru', name: 'Bengaluru',        lat: 12.9716, lng: 77.5946, baseAqi:  88 },
  { id: 'init-kolkata',   name: 'Kolkata',          lat: 22.5726, lng: 88.3639, baseAqi: 155 },
  { id: 'init-chennai',   name: 'Chennai',          lat: 13.0827, lng: 80.2707, baseAqi:  92 },
  { id: 'init-hyderabad', name: 'Hyderabad',        lat: 17.3850, lng: 78.4867, baseAqi: 102 },
  { id: 'init-pune',      name: 'Pune',             lat: 18.5204, lng: 73.8567, baseAqi:  95 },
  { id: 'init-ahmedabad', name: 'Ahmedabad',        lat: 23.0225, lng: 72.5714, baseAqi: 138 },
  { id: 'init-jaipur',    name: 'Jaipur',           lat: 26.9124, lng: 75.7873, baseAqi: 145 },
  { id: 'init-lucknow',   name: 'Lucknow',          lat: 26.8467, lng: 80.9462, baseAqi: 172 },
  { id: 'init-kanpur',    name: 'Kanpur',           lat: 26.4499, lng: 80.3319, baseAqi: 195 },
  { id: 'init-amritsar',  name: 'Amritsar',         lat: 31.6340, lng: 74.8723, baseAqi: 163 },
  { id: 'init-nagpur',    name: 'Nagpur',           lat: 21.1458, lng: 79.0882, baseAqi: 118 },
  { id: 'init-surat',     name: 'Surat',            lat: 21.1702, lng: 72.8311, baseAqi: 125 },
  { id: 'init-patna',     name: 'Patna',            lat: 25.5941, lng: 85.1376, baseAqi: 210 },
  { id: 'init-bhopal',    name: 'Bhopal',           lat: 23.2599, lng: 77.4126, baseAqi: 130 },
  { id: 'init-visakhapatnam', name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185, baseAqi:  78 },
  { id: 'init-kochi',     name: 'Kochi',            lat:  9.9312, lng: 76.2673, baseAqi:  62 },
  { id: 'init-guwahati',  name: 'Guwahati',         lat: 26.1445, lng: 91.7362, baseAqi:  85 },
  { id: 'init-chandigarh',name: 'Chandigarh',       lat: 30.7333, lng: 76.7794, baseAqi: 142 },
  { id: 'init-ranchi',    name: 'Ranchi',           lat: 23.3441, lng: 85.3096, baseAqi: 115 },
  { id: 'init-srinagar',  name: 'Srinagar',         lat: 34.0837, lng: 74.7973, baseAqi:  55 },
];

function makeStation(city: typeof majorCities[0], i: number): SensorStation {
  const r = seedRand(i);
  const aqi = Math.min(500, Math.max(10, Math.round(city.baseAqi + (r - 0.5) * 30)));
  const pm25 = Math.round(aqi * 0.42);
  const pm10 = Math.round(pm25 * 1.6);
  const no2  = Math.round(20 + r * 40);
  const co   = +(0.5 + r * 2).toFixed(1);
  const o3   = Math.round(30 + r * 50);
  const so2  = Math.round(5  + r * 25);
  return {
    id: city.id,
    name: city.name,
    lat: city.lat,
    lng: city.lng,
    aqi,
    pm25,
    pm10,
    no2,
    co,
    o3,
    so2,
    temp: Math.round(22 + r * 12),
    humidity: Math.round(40 + r * 40),
    trend: 'stable' as const,
  };
}

export const initialStations: SensorStation[] = majorCities.map(makeStation);


export const getAQICategory = (aqi: number) => {
  if (aqi <= 50) return { label: 'Good', color: 'hsl(168, 100%, 42%)', className: 'aqi-good' };
  if (aqi <= 100) return { label: 'Moderate', color: 'hsl(48, 96%, 53%)', className: 'aqi-moderate' };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: 'hsl(25, 95%, 53%)', className: 'aqi-unhealthy-sensitive' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'hsl(0, 84%, 60%)', className: 'aqi-unhealthy' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: 'hsl(270, 60%, 40%)', className: 'aqi-very-unhealthy' };
  return { label: 'Hazardous', color: 'hsl(0, 50%, 30%)', className: 'aqi-hazardous' };
};

export const getAQIColor = (aqi: number): string => {
  if (aqi <= 50) return '#00d4aa';
  if (aqi <= 100) return '#fbbf24';
  if (aqi <= 150) return '#f59e0b';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#7e22ce';
  return '#991b1b';
};

export const healthAdvisory: Record<string, string> = {
  'Good': 'Air quality is satisfactory. Enjoy outdoor activities.',
  'Moderate': 'Acceptable air quality. Unusually sensitive people should limit prolonged outdoor exertion.',
  'Unhealthy (Sensitive)': 'Members of sensitive groups may experience health effects. General public less likely to be affected.',
  'Unhealthy': 'Everyone may begin to experience health effects. Sensitive groups may experience more serious effects.',
  'Very Unhealthy': 'Health alert: everyone may experience more serious health effects. Avoid outdoor activities.',
  'Hazardous': 'Health warning of emergency conditions. The entire population is likely to be affected. Stay indoors.',
};

export const pollutantInfo = [
  { key: 'pm25' as const, label: 'PM2.5', unit: 'µg/m³', max: 500, icon: '🔴' },
  { key: 'pm10' as const, label: 'PM10', unit: 'µg/m³', max: 600, icon: '🟠' },
  { key: 'no2' as const, label: 'NO₂', unit: 'ppb', max: 200, icon: '🟡' },
  { key: 'co' as const, label: 'CO', unit: 'ppm', max: 10, icon: '⚫' },
  { key: 'o3' as const, label: 'O₃', unit: 'ppb', max: 150, icon: '🔵' },
  { key: 'so2' as const, label: 'SO₂', unit: 'ppb', max: 100, icon: '🟣' },
];

export const hourlyAQIData = Array.from({ length: 24 }, (_, i) => {
  const baseAQI = i >= 7 && i <= 10 ? 180 : i >= 17 && i <= 20 ? 160 : 100;
  return { hour: `${i.toString().padStart(2, '0')}:00`, aqi: baseAQI + Math.floor(Math.random() * 40 - 20) };
});

export const weeklyTrendData = [
  { day: 'Mon', aqi: 145, pm25: 78 },
  { day: 'Tue', aqi: 168, pm25: 92 },
  { day: 'Wed', aqi: 132, pm25: 65 },
  { day: 'Thu', aqi: 198, pm25: 125 },
  { day: 'Fri', aqi: 175, pm25: 98 },
  { day: 'Sat', aqi: 112, pm25: 52 },
  { day: 'Sun', aqi: 95, pm25: 38 },
];

export const sourceAttribution = [
  { name: 'Vehicles', value: 45, color: '#00d4aa' },
  { name: 'Industry', value: 30, color: '#fbbf24' },
  { name: 'Construction', value: 15, color: '#f59e0b' },
  { name: 'Other', value: 10, color: '#64748b' },
];

export const alertHistory = [
  { id: 1, timestamp: '2026-03-16 08:32', zone: 'Anand Vihar', peakAqi: 342, duration: '4h 15m' },
  { id: 2, timestamp: '2026-03-16 06:15', zone: 'Okhla Industrial', peakAqi: 278, duration: '3h 42m' },
  { id: 3, timestamp: '2026-03-15 19:48', zone: 'Mayur Vihar', peakAqi: 225, duration: '2h 30m' },
  { id: 4, timestamp: '2026-03-15 07:22', zone: 'ITO Junction', peakAqi: 198, duration: '1h 55m' },
  { id: 5, timestamp: '2026-03-14 22:10', zone: 'Nehru Place', peakAqi: 210, duration: '3h 10m' },
  { id: 6, timestamp: '2026-03-14 08:45', zone: 'Anand Vihar', peakAqi: 356, duration: '5h 20m' },
  { id: 7, timestamp: '2026-03-13 17:30', zone: 'Connaught Place', peakAqi: 195, duration: '2h 05m' },
  { id: 8, timestamp: '2026-03-13 09:12', zone: 'Okhla Industrial', peakAqi: 265, duration: '3h 35m' },
  { id: 9, timestamp: '2026-03-12 20:55', zone: 'Rohini Sector 16', peakAqi: 188, duration: '1h 45m' },
  { id: 10, timestamp: '2026-03-12 07:00', zone: 'Punjabi Bagh', peakAqi: 172, duration: '2h 20m' },
];