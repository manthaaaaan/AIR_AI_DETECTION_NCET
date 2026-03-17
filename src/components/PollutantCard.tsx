import React, { useState } from 'react';

// Quick reference dictionary for the info
const getPollutantInfo = (label: string) => {
  switch (label.toUpperCase()) {
    case 'PM2.5': return 'Fine particles < 2.5µm. Penetrates deep into lungs and bloodstream. Main sources: vehicle exhaust, wildfires, and power plants.';
    case 'PM10': return 'Coarse particles < 10µm. Irritates eyes, nose, and throat. Main sources: dust from roads, construction, and industry.';
    case 'O3':
    case 'OZONE': return 'Surface-level gas causing breathing issues and asthma attacks. Formed when pollutants react with sunlight.';
    case 'NO2':
    case 'NITROGEN': return 'Reddish-brown toxic gas from vehicle engines and power plants. Strongly aggravates asthma and respiratory systems.';
    case 'SO2':
    case 'SULFUR': return 'Pungent, toxic gas from burning coal and oil. Causes coughing, wheezing, and shortness of breath.';
    case 'CO':
    case 'CARBON MONOXIDE': return 'Colorless, odorless gas from incomplete combustion. Reduces the amount of oxygen reaching the body\'s organs.';
    default: return 'Measures the concentration of this specific pollutant in the air.';
  }
};

export default function PollutantCard({ label, value, unit, max, icon: Icon }: any) {
  // State to track if the card is expanded
  const [isOpen, setIsOpen] = useState(false);

  // Calculate percentage for the progress bar
  const pct = Math.min((value / max) * 100, 100);
  
  // Dynamic color based on safety limits
  const color = pct < 35 ? '#00d4aa' : pct < 70 ? '#fbbf24' : '#f07840';
  
  // Fetch the matching description
  const infoText = getPollutantInfo(label);

  return (
    <div 
      onClick={() => setIsOpen(!isOpen)}
      className="glass-card p-4 flex flex-col gap-3 border border-border/50 bg-card/20 rounded-xl cursor-pointer transition-colors duration-200 hover:bg-card/40 hover:border-border/80"
    >
      <div className="flex justify-between items-center">
        
        <div className="flex items-center gap-3">
          <div style={{ color }} className="p-2 rounded-lg bg-background/50">
            <Icon size={24} />
          </div>
          <span className="text-base font-bold font-mono text-foreground tracking-wide">
            {label}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-foreground">
            {value}
          </span>
          <span className="text-sm font-mono text-muted-foreground">
            {unit}
          </span>
        </div>

      </div>
      
      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out" 
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {/* Expandable Info Section */}
      <div 
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0 mt-0'
        }`}
      >
        <div className="overflow-hidden">
          {/* INCREASED FONT SIZE & BRIGHTER COLOR HERE */}
          <p className="text-[15px] font-mono text-gray-100 leading-relaxed pt-3 border-t border-border/40">
            {infoText}
          </p>
        </div>
      </div>

    </div>
  );
}