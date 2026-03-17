import { X } from 'lucide-react';
import { useAirQuality } from '@/context/AirQualityContext';
import { getAQIColor } from '@/data/mockSensorData';

const AlertBanner = () => {
  const { alerts, dismissAlert } = useAirQuality();
  const topAlert = alerts.sort((a, b) => b.aqi - a.aqi)[0];

  if (!topAlert) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 py-2 font-mono text-xs"
      style={{ backgroundColor: getAQIColor(topAlert.aqi) + '22', borderBottom: `1px solid ${getAQIColor(topAlert.aqi)}44` }}
    >
      <div className="flex items-center gap-2">
        <span className="animate-pulse-glow inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getAQIColor(topAlert.aqi) }} />
        <span className="text-foreground">
          ⚠ ALERT: {topAlert.stationName} — AQI {topAlert.aqi} | Health advisory in effect
        </span>
      </div>
      <button onClick={() => dismissAlert(topAlert.id)} className="text-muted-foreground hover:text-foreground transition-colors">
        <X size={14} />
      </button>
    </div>
  );
};

export default AlertBanner;
