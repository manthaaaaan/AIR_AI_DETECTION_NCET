import { SensorStation } from '@/data/mockSensorData';

const majorCities = [
  { id: 'init-delhi',         name: 'New Delhi',      lat: 28.6139, lng: 77.2090 },
  { id: 'init-mumbai',        name: 'Mumbai',          lat: 19.0760, lng: 72.8777 },
  { id: 'init-bengaluru',     name: 'Bengaluru',       lat: 12.9716, lng: 77.5946 },
  { id: 'init-kolkata',       name: 'Kolkata',         lat: 22.5726, lng: 88.3639 },
  { id: 'init-chennai',       name: 'Chennai',         lat: 13.0827, lng: 80.2707 },
  { id: 'init-hyderabad',     name: 'Hyderabad',       lat: 17.3850, lng: 78.4867 },
  { id: 'init-pune',          name: 'Pune',            lat: 18.5204, lng: 73.8567 },
  { id: 'init-ahmedabad',     name: 'Ahmedabad',       lat: 23.0225, lng: 72.5714 },
  { id: 'init-jaipur',        name: 'Jaipur',          lat: 26.9124, lng: 75.7873 },
  { id: 'init-lucknow',       name: 'Lucknow',         lat: 26.8467, lng: 80.9462 },
  { id: 'init-kanpur',        name: 'Kanpur',          lat: 26.4499, lng: 80.3319 },
  { id: 'init-amritsar',      name: 'Amritsar',        lat: 31.6340, lng: 74.8723 },
  { id: 'init-nagpur',        name: 'Nagpur',          lat: 21.1458, lng: 79.0882 },
  { id: 'init-surat',         name: 'Surat',           lat: 21.1702, lng: 72.8311 },
  { id: 'init-patna',         name: 'Patna',           lat: 25.5941, lng: 85.1376 },
  { id: 'init-bhopal',        name: 'Bhopal',          lat: 23.2599, lng: 77.4126 },
  { id: 'init-visakhapatnam', name: 'Visakhapatnam',   lat: 17.6868, lng: 83.2185 },
  { id: 'init-kochi',         name: 'Kochi',           lat:  9.9312, lng: 76.2673 },
  { id: 'init-guwahati',      name: 'Guwahati',        lat: 26.1445, lng: 91.7362 },
  { id: 'init-chandigarh',    name: 'Chandigarh',      lat: 30.7333, lng: 76.7794 },
  { id: 'init-ranchi',        name: 'Ranchi',          lat: 23.3441, lng: 85.3096 },
  { id: 'init-srinagar',      name: 'Srinagar',        lat: 34.0837, lng: 74.7973 },
];

function pm25ToAqi(pm25: number): number {
  if (pm25 <= 12)    return Math.round((50 / 12) * pm25);
  if (pm25 <= 35.4)  return Math.round(50  + ((100 - 51)  / (35.4  - 12.1))  * (pm25 - 12.1));
  if (pm25 <= 55.4)  return Math.round(100 + ((150 - 101) / (55.4  - 35.5))  * (pm25 - 35.5));
  if (pm25 <= 150.4) return Math.round(150 + ((200 - 151) / (150.4 - 55.5))  * (pm25 - 55.5));
  if (pm25 <= 250.4) return Math.round(200 + ((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5));
  return Math.round(300 + ((400 - 301) / (350.4 - 250.5)) * (pm25 - 250.5));
}

async function fetchOpenMeteo(lat: number, lng: number) {
  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&domains=cams_global`
  );
  const data = await res.json();
  return data.current;
}

async function fetchWeatherCurrent(lat: number, lng: number) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
  );
  const data = await res.json();
  return data.current;
}

async function reverseGeocode(lat: number, lon: number, fallback: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const data = await res.json();
    return (
      data.locality              ||
      data.city                  ||
      data.principalSubdivision  ||
      data.countryName           ||
      fallback
    );
  } catch {
    return fallback;
  }
}

async function resolveUniquePoint(
  centerLat: number,
  centerLng: number,
  takenNames: Set<string>,
  angle: number,
  startRadiusKm: number
): Promise<{ lat: number; lng: number; name: string }> {
  const KM_PER_DEG_LAT = 111;
  const KM_PER_DEG_LNG = 111 * Math.cos(centerLat * Math.PI / 180);
  const MAX_ATTEMPTS = 5;

  let radius = startRadiusKm;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const lat = centerLat + (radius * Math.cos(angle)) / KM_PER_DEG_LAT;
    const lng = centerLng + (radius * Math.sin(angle)) / KM_PER_DEG_LNG;
    const name = await reverseGeocode(lat, lng, '');

    if (name && !takenNames.has(name.toLowerCase())) {
      takenNames.add(name.toLowerCase());
      return { lat, lng, name };
    }
    radius *= 2;
  }

  const lat = centerLat + (radius * Math.cos(angle)) / 111;
  const lng = centerLng + (radius * Math.sin(angle)) / (111 * Math.cos(centerLat * Math.PI / 180));
  const fallbackName = `Outskirts ${Math.round(angle * 180 / Math.PI)}°`;
  takenNames.add(fallbackName.toLowerCase());
  return { lat, lng, name: fallbackName };
}

function buildStation(city: typeof majorCities[0], aq: any, weather: any): SensorStation {
  const pm25 = aq?.pm2_5            ?? 0;
  const pm10 = aq?.pm10             ?? 0;
  const no2  = aq?.nitrogen_dioxide ?? 0;
  const co   = aq?.carbon_monoxide  ?? 0;
  const o3   = aq?.ozone            ?? 0;
  const so2  = aq?.sulphur_dioxide  ?? 0;
  return {
    id: city.id, name: city.name, lat: city.lat, lng: city.lng,
    aqi: pm25ToAqi(pm25),
    pm25: +pm25.toFixed(1), pm10: +pm10.toFixed(1), no2: +no2.toFixed(1),
    co: +(co / 1000).toFixed(2), o3: +o3.toFixed(1), so2: +so2.toFixed(1),
    temp: weather?.temperature_2m ?? 0, humidity: weather?.relative_humidity_2m ?? 0,
    trend: 'stable' as const,
  };
}

export async function fetchAllCityStations(): Promise<SensorStation[]> {
  const results = await Promise.allSettled(
    majorCities.map(async city => {
      const [aq, weather] = await Promise.all([fetchOpenMeteo(city.lat, city.lng), fetchWeatherCurrent(city.lat, city.lng)]);
      return buildStation(city, aq, weather);
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<SensorStation> => r.status === 'fulfilled')
    .map(r => r.value);
}

export async function fetchLiveRadiusStations(
  centerLat: number,
  centerLng: number
): Promise<{ stations: SensorStation[]; averageAQI: number }> {
  const [aq, weather, centerName] = await Promise.all([
    fetchOpenMeteo(centerLat, centerLng),
    fetchWeatherCurrent(centerLat, centerLng),
    reverseGeocode(centerLat, centerLng, 'Your Area'),
  ]);

  const pm25 = aq?.pm2_5            ?? 0;
  const pm10 = aq?.pm10             ?? 0;
  const no2  = aq?.nitrogen_dioxide ?? 0;
  const co   = aq?.carbon_monoxide  ?? 0;
  const o3   = aq?.ozone            ?? 0;
  const so2  = aq?.sulphur_dioxide  ?? 0;

  const takenNames = new Set<string>([centerName.toLowerCase()]);
  // 12 evenly-spaced angles
  const ANGLES = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);

  const surroundingPoints: { lat: number; lng: number; name: string }[] = [];
  for (const angle of ANGLES) {
    const pt = await resolveUniquePoint(centerLat, centerLng, takenNames, angle, 8);
    surroundingPoints.push(pt);
  }

  const allPoints = [
    { lat: centerLat, lng: centerLng, id: 's-center', name: centerName, isCenter: true },
    ...surroundingPoints.map((pt, i) => ({ ...pt, id: `s-live-${i}`, isCenter: false })),
  ];

  const generatedStations: SensorStation[] = allPoints.map((pt, i) => {
    const variance = pt.isCenter ? 1 : 0.85 + Math.abs(Math.sin(i * 123.4)) * 0.3;
    const vPm25 = Math.max(0, Math.round(pm25 * variance));
    return {
      id: pt.id, name: pt.name, lat: pt.lat, lng: pt.lng,
      aqi: pm25ToAqi(vPm25), pm25: vPm25,
      pm10: Math.max(0, Math.round(pm10 * variance)),
      no2:  Math.max(0, Math.round(no2  * variance)),
      co:   +((co * variance) / 1000).toFixed(2),
      o3:   Math.max(0, Math.round(o3   * variance)),
      so2:  Math.max(0, Math.round(so2  * variance)),
      temp: weather?.temperature_2m ?? 0,
      humidity: weather?.relative_humidity_2m ?? 0,
      trend: (variance > 1 ? 'up' : 'down') as 'up' | 'down',
    };
  });

  const avgAQI = Math.round(generatedStations.reduce((s, x) => s + x.aqi, 0) / generatedStations.length);
  return { stations: generatedStations, averageAQI: avgAQI };
}

export async function fetchSingleStation(lat: number, lng: number, knownName: string): Promise<SensorStation> {
  const [aq, weather] = await Promise.all([fetchOpenMeteo(lat, lng), fetchWeatherCurrent(lat, lng)]);
  const pm25 = aq?.pm2_5 ?? 0;
  return {
    id: `search-${lat}-${lng}`, name: knownName, lat, lng,
    aqi: pm25ToAqi(pm25), pm25: +pm25.toFixed(1),
    pm10: +(aq?.pm10 ?? 0).toFixed(1), no2: +(aq?.nitrogen_dioxide ?? 0).toFixed(1),
    co: +((aq?.carbon_monoxide ?? 0) / 1000).toFixed(2), o3: +(aq?.ozone ?? 0).toFixed(1),
    so2: +(aq?.sulphur_dioxide ?? 0).toFixed(1),
    temp: weather?.temperature_2m ?? 0, humidity: weather?.relative_humidity_2m ?? 0,
    trend: 'stable',
  };
}

export async function fetchStationByCoords(lat: number, lng: number): Promise<SensorStation> {
  const [aq, weather, areaName] = await Promise.all([
    fetchOpenMeteo(lat, lng), fetchWeatherCurrent(lat, lng),
    reverseGeocode(lat, lng, 'Selected Location'),
  ]);
  const pm25 = aq?.pm2_5 ?? 0;
  return {
    id: `clicked-${lat}-${lng}`, name: areaName, lat, lng,
    aqi: pm25ToAqi(pm25), pm25: +pm25.toFixed(1),
    pm10: +(aq?.pm10 ?? 0).toFixed(1), no2: +(aq?.nitrogen_dioxide ?? 0).toFixed(1),
    co: +((aq?.carbon_monoxide ?? 0) / 1000).toFixed(2), o3: +(aq?.ozone ?? 0).toFixed(1),
    so2: +(aq?.sulphur_dioxide ?? 0).toFixed(1),
    temp: weather?.temperature_2m ?? 0, humidity: weather?.relative_humidity_2m ?? 0,
    trend: 'stable',
  };
}