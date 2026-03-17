import { X, TrendingUp, TrendingDown, Minus, Thermometer, Droplets } from 'lucide-react';
import { useAirQuality } from '@/context/AirQualityContext';
import { getAQICategory, pollutantInfo } from '@/data/mockSensorData';
import AQIGauge from './AQIGauge';
import PollutantCard from './PollutantCard';
import { motion, AnimatePresence } from 'framer-motion';

const StationDrawer = () => {
  const { selectedStation, setSelectedStation } = useAirQuality();

  const trendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp size={14} className="text-danger" />;
    if (trend === 'down') return <TrendingDown size={14} className="text-cyan" />;
    return <Minus size={14} className="text-muted-foreground" />;
  };

  return (
    <AnimatePresence>
      {selectedStation && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', ease: [0.2, 0.8, 0.2, 1], duration: 0.3 }}
          className="fixed right-0 top-0 bottom-0 w-80 z-[900] glass-card border-l border-border overflow-y-auto"
          style={{ borderRadius: 0 }}
        >
          <div className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-foreground text-lg">{selectedStation.name}</h3>
                <span className={`text-xs font-mono ${getAQICategory(selectedStation.aqi).className}`}>
                  {getAQICategory(selectedStation.aqi).label}
                </span>
              </div>
              <button onClick={() => setSelectedStation(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-center mb-4">
              <AQIGauge value={selectedStation.aqi} size={180} />
            </div>

            <div className="flex items-center justify-center gap-4 mb-6 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1"><Thermometer size={12} /> {selectedStation.temp}°C</span>
              <span className="flex items-center gap-1"><Droplets size={12} /> {selectedStation.humidity}%</span>
              <span className="flex items-center gap-1">Trend: {trendIcon(selectedStation.trend)}</span>
            </div>

            <h4 className="font-heading font-semibold text-sm text-foreground mb-3">Pollutants</h4>
            <div className="grid grid-cols-1 gap-2">
              {pollutantInfo.map(p => (
                <PollutantCard
                  key={p.key}
                  label={p.label}
                  value={selectedStation[p.key]}
                  unit={p.unit}
                  max={p.max}
                  icon={p.icon}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StationDrawer;
