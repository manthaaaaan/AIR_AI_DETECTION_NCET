import { useAirQuality } from '@/context/AirQualityContext';
import { getAQIColor } from '@/data/mockSensorData';

const BottomTicker = () => {
  const { stations } = useAirQuality();

  const content = stations.map(s => (
    <span key={s.id} className="inline-flex items-center gap-2 mx-4 whitespace-nowrap">
      <span className="w-2 h-2 rounded-full animate-pulse-glow" style={{ backgroundColor: getAQIColor(s.aqi) }} />
      <span className="text-muted-foreground">{s.name}</span>
      <span className="font-semibold" style={{ color: getAQIColor(s.aqi) }}>{s.aqi}</span>
    </span>
  ));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[800] glass-card border-t border-border overflow-hidden h-8 flex items-center">
      <div className="animate-ticker flex font-mono text-xs">
        {content}
        {content}
      </div>
    </div>
  );
};

export default BottomTicker;
