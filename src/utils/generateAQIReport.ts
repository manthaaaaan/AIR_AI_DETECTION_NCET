import jsPDF from 'jspdf';

interface AQIChartPoint {
  hour: string;
  aqi: number;
}

interface ReportData {
  cityName: string;
  activeAQI: number;
  catLabel: string;
  peakStationName: string;
  peakStationAQI: number;
  lowestStationName: string;
  lowestStationAQI: number;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  chartData: AQIChartPoint[];
  alerts: { stationName: string; aqi: number }[];
}

function aqiToRgb(aqi: number): [number, number, number] {
  if (aqi <= 50)  return [34, 197, 94];
  if (aqi <= 100) return [234, 179, 8];
  if (aqi <= 150) return [249, 115, 22];
  if (aqi <= 200) return [239, 68, 68];
  if (aqi <= 300) return [168, 85, 247];
  return [153, 27, 27];
}

function aqiLabel(aqi: number): string {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// Strip any character outside printable ASCII so jsPDF built-in fonts never break
function safe(str: string): string {
  return (str || '').replace(/[^\x20-\x7E]/g, (c) => {
    const map: Record<string, string> = {
      '\u00b0': 'deg', '\u00b2': '2', '\u00b3': '3', '\u00b5': 'u',
      '\u25b2': '^',   '\u25bc': 'v', '\u26a0': '!', '\u00b7': '-',
      '\u2019': "'",   '\u2018': "'", '\u201c': '"', '\u201d': '"',
      '\u2013': '-',   '\u2014': '-',
    };
    return map[c] ?? '';
  });
}

export function generateAQIReport(data: ReportData): void {
  const {
    cityName, activeAQI, catLabel,
    peakStationName, peakStationAQI,
    lowestStationName, lowestStationAQI,
    pm25, pm10, o3, no2,
    chartData, alerts,
  } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210;
  const M  = 14; // margin
  const CW = PW - M * 2; // content width
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const [ar, ag, ab] = aqiToRgb(activeAQI);

  // ── White page base ──────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // ── HEADER ──────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PW, 52, 'F');

  // Left accent bar
  doc.setFillColor(ar, ag, ab);
  doc.rect(0, 0, 4, 52, 'F');

  // Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('AeroSense', M + 4, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Air Quality Health Report', M + 4, 22);
  doc.text(safe(cityName) + '    ' + safe(dateStr) + '    ' + safe(timeStr), M + 4, 28);

  // AQI number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.setTextColor(ar, ag, ab);
  doc.text(String(activeAQI), PW - M, 24, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('US AQI', PW - M, 30, { align: 'right' });

  // Category badge
  const bW = 46, bH = 8, bX = PW - M - bW, bY = 33;
  doc.setFillColor(ar, ag, ab);
  doc.roundedRect(bX, bY, bW, bH, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(safe(catLabel).toUpperCase(), bX + bW / 2, bY + 5.5, { align: 'center' });

  // ── BODY CURSOR ─────────────────────────────────────────────────────────
  let y = 62;

  const heading = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(ar, ag, ab);
    doc.text(safe(title).toUpperCase(), M, y);
    doc.setDrawColor(ar, ag, ab);
    doc.setLineWidth(0.35);
    doc.line(M, y + 1.5, PW - M, y + 1.5);
    y += 7;
  };

  const ensureSpace = (need: number) => {
    if (y + need > 280) {
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, 'F');
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, PW, 10, 'F');
      doc.setFillColor(ar, ag, ab);
      doc.rect(0, 0, 4, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('AeroSense  -  ' + safe(cityName), M + 4, 7);
      y = 18;
    }
  };

  // ── OVERVIEW CARDS ───────────────────────────────────────────────────────
  heading('Overview');

  const cards = [
    { label: 'Peak Zone',     value: String(peakStationAQI),               sub: safe(peakStationName),   aqi: peakStationAQI },
    { label: 'Cleanest Zone', value: String(lowestStationAQI),             sub: safe(lowestStationName), aqi: lowestStationAQI },
    { label: 'PM2.5',         value: pm25 != null ? pm25.toFixed(1) : 'N/A', sub: 'ug/m3',              aqi: activeAQI },
    { label: 'PM10',          value: pm10 != null ? pm10.toFixed(1) : 'N/A', sub: 'ug/m3',              aqi: activeAQI },
  ];

  const cardW = (CW - 9) / 4;
  const cardH = 23;
  cards.forEach((card, i) => {
    const cx = M + i * (cardW + 3);
    const [cr, cg, cb] = aqiToRgb(card.aqi);

    // Shadow
    doc.setFillColor(210, 218, 228);
    doc.roundedRect(cx + 0.6, y + 0.6, cardW, cardH, 3, 3, 'F');

    // Card
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cx, y, cardW, cardH, 3, 3, 'F');

    // Top bar
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(cx, y, cardW, 3, 1.5, 1.5, 'F');
    doc.rect(cx, y + 1.5, cardW, 1.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, cx + cardW / 2, y + 8.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(cr, cg, cb);
    doc.text(card.value, cx + cardW / 2, y + 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    const subTxt = card.sub.length > 15 ? card.sub.slice(0, 14) + '.' : card.sub;
    doc.text(subTxt, cx + cardW / 2, y + 21, { align: 'center' });
  });
  y += cardH + 10;

  // ── POLLUTANT BARS ───────────────────────────────────────────────────────
  ensureSpace(20);
  heading('Pollutant Breakdown');

  const pollutants = [
    { name: 'PM2.5', val: pm25, max: 250, unit: 'ug/m3' },
    { name: 'PM10',  val: pm10, max: 430, unit: 'ug/m3' },
    { name: 'O3',    val: o3,   max: 240, unit: 'ug/m3' },
    { name: 'NO2',   val: no2,  max: 200, unit: 'ug/m3' },
  ];
  const pColW = (CW - 9) / 4;
  pollutants.forEach((p, i) => {
    const px = M + i * (pColW + 3);
    const ratio = p.val != null ? Math.min(1, p.val / p.max) : 0;
    const [pr, pg, pb] = aqiToRgb(Math.round(ratio * 300));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(p.name, px, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(pr, pg, pb);
    const vStr = p.val != null ? p.val.toFixed(1) + ' ' + p.unit : 'N/A';
    doc.text(vStr, px + pColW, y, { align: 'right' });

    // Track
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(px, y + 2, pColW, 3.5, 1.5, 1.5, 'F');

    // Fill
    if (ratio > 0.01) {
      doc.setFillColor(pr, pg, pb);
      doc.roundedRect(px, y + 2, pColW * ratio, 3.5, 1.5, 1.5, 'F');
    }
  });
  y += 14;

  // ── 24-HOUR CHART ────────────────────────────────────────────────────────
  if (chartData.length > 0) {
    ensureSpace(72);
    heading('24-Hour AQI Trend');

    const cX = M + 8, cY = y;
    const cW2 = CW - 10, cH = 48;
    const vals = chartData.map(d => d.aqi);
    const minV = Math.max(0, Math.min(...vals) - 15);
    const maxV = Math.max(...vals) + 15;
    const xS = (i: number) => cX + (i / Math.max(vals.length - 1, 1)) * cW2;
    const yS = (v: number) => cY + cH - ((v - minV) / Math.max(maxV - minV, 1)) * cH;

    // Chart bg
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cX - 2, cY - 2, cW2 + 4, cH + 14, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(cX - 2, cY - 2, cW2 + 4, cH + 14, 3, 3, 'S');

    // Grid
    [50, 100, 150, 200].forEach(gv => {
      if (gv <= minV || gv >= maxV) return;
      const gy = yS(gv);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.18);
      doc.setLineDashPattern([1.5, 2], 0);
      doc.line(cX, gy, cX + cW2, gy);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(148, 163, 184);
      doc.text(String(gv), cX - 3, gy + 1.5, { align: 'right' });
    });

    // Area fill (light tint per segment)
    for (let i = 0; i < vals.length - 1; i++) {
      const x1 = xS(i), x2 = xS(i + 1);
      const y1 = yS(vals[i]), y2 = yS(vals[i + 1]);
      const bot = cY + cH;
      const avg = Math.round((vals[i] + vals[i + 1]) / 2);
      const [fr, fg, fb] = aqiToRgb(avg);
      const blend = (c: number) => Math.round(c * 0.13 + 255 * 0.87);
      doc.setFillColor(blend(fr), blend(fg), blend(fb));
      const topY = Math.min(y1, y2);
      doc.rect(x1, topY, x2 - x1, bot - topY, 'F');
    }

    // Line
    doc.setLineWidth(1.4);
    for (let i = 0; i < vals.length - 1; i++) {
      const avg = Math.round((vals[i] + vals[i + 1]) / 2);
      const [lr, lg, lb] = aqiToRgb(avg);
      doc.setDrawColor(lr, lg, lb);
      doc.line(xS(i), yS(vals[i]), xS(i + 1), yS(vals[i + 1]));
    }

    // Dots
    vals.forEach((v, i) => {
      if (i % 4 !== 0 && i !== vals.length - 1) return;
      const [dr, dg, db] = aqiToRgb(v);
      doc.setFillColor(dr, dg, db);
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.circle(xS(i), yS(v), i === vals.length - 1 ? 2 : 1.2, 'FD');
    });

    // NOW label
    const nowX2 = xS(vals.length - 1), nowY2 = yS(vals[vals.length - 1]);
    doc.setFillColor(ar, ag, ab);
    doc.roundedRect(nowX2 - 5.5, nowY2 - 9, 11, 6, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text('NOW', nowX2, nowY2 - 5, { align: 'center' });

    // X labels
    const interval2 = Math.max(1, Math.floor(vals.length / 7));
    chartData.forEach((d, i) => {
      if (i % interval2 !== 0) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text(d.hour, xS(i), cY + cH + 8, { align: 'center' });
    });

    // Hi / Lo annotations
    const maxI = vals.indexOf(Math.max(...vals));
    const minI = vals.indexOf(Math.min(...vals));
    if (maxI !== minI) {
      [[maxI, true], [minI, false]].forEach(([idx, isMax]) => {
        const i = idx as number;
        const ax = xS(i), ay = yS(vals[i]);
        const [pr, pg, pb] = aqiToRgb(vals[i]);
        const ly = isMax ? ay - 10 : ay + 3;
        doc.setFillColor(pr, pg, pb);
        doc.roundedRect(ax - 7, ly, 14, 6.5, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.text((isMax ? 'Hi ' : 'Lo ') + vals[i], ax, ly + 4.5, { align: 'center' });
      });
    }

    y += cH + 18;
  }

  // ── HOURLY TABLE ─────────────────────────────────────────────────────────
  if (chartData.length > 0) {
    const cols = 6;
    const cellW2 = CW / cols;
    const cellH2 = 10.5;
    const rows = Math.ceil(chartData.length / cols);
    ensureSpace(rows * cellH2 + 16);
    heading('Hourly AQI Log - Past 24 Hours');

    chartData.forEach((point, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = M + col * cellW2;
      const cy = y + row * cellH2;
      const [cr, cg, cb] = aqiToRgb(point.aqi);
      const isNow = i === chartData.length - 1;

      // Alternating row bg
      doc.setFillColor(isNow ? 248 : row % 2 === 0 ? 255 : 248,
                       isNow ? 250 : row % 2 === 0 ? 255 : 250,
                       isNow ? 252 : row % 2 === 0 ? 255 : 252);
      doc.rect(cx, cy, cellW2, cellH2, 'F');

      // NOW highlight
      if (isNow) {
        doc.setFillColor(cr, cg, cb);
        doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
        doc.rect(cx, cy, cellW2, cellH2, 'F');
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
      }

      // Border
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.18);
      doc.rect(cx, cy, cellW2, cellH2, 'S');

      // Left swatch
      doc.setFillColor(cr, cg, cb);
      doc.rect(cx, cy, 2.5, cellH2, 'F');

      // Hour
      doc.setFont('helvetica', isNow ? 'bold' : 'normal');
      doc.setFontSize(6);
      doc.setTextColor(isNow ? cr : 71, isNow ? cg : 85, isNow ? cb : 105);
      doc.text(isNow ? 'NOW' : point.hour, cx + 4.5, cy + 4);

      // AQI
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(cr, cg, cb);
      doc.text(String(point.aqi), cx + 4.5, cy + 8.5);
    });
    y += rows * cellH2 + 10;
  }

  // ── ALERTS ───────────────────────────────────────────────────────────────
  if (alerts.length > 0) {
    ensureSpace(alerts.length * 11 + 14);
    heading('Active Alerts');
    alerts.forEach(alert => {
      const [er, eg, eb] = aqiToRgb(alert.aqi);
      doc.setFillColor(er, eg, eb);
      doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      doc.roundedRect(M, y - 1, CW, 8.5, 2, 2, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      doc.setFillColor(er, eg, eb);
      doc.rect(M, y - 1, 3, 8.5, 'F');
      doc.setDrawColor(er, eg, eb);
      doc.setLineWidth(0.2);
      doc.roundedRect(M, y - 1, CW, 8.5, 2, 2, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(er, eg, eb);
      doc.text('! ' + safe(alert.stationName), M + 5.5, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('AQI ' + alert.aqi + ' - ' + safe(aqiLabel(alert.aqi)), PW - M, y + 4.5, { align: 'right' });
      y += 11;
    });
    y += 4;
  }

  // ── AQI LEGEND ───────────────────────────────────────────────────────────
  ensureSpace(30);
  heading('AQI Scale Reference');
  const legend = [
    { range: '0-50',     label: 'Good',                        aqi: 25  },
    { range: '51-100',   label: 'Moderate',                    aqi: 75  },
    { range: '101-150',  label: 'Unhealthy (Sensitive)',        aqi: 125 },
    { range: '151-200',  label: 'Unhealthy',                   aqi: 175 },
    { range: '201-300',  label: 'Very Unhealthy',              aqi: 250 },
    { range: '301+',     label: 'Hazardous',                   aqi: 400 },
  ];
  const lCols = 3, lColW = CW / lCols;
  legend.forEach((l, i) => {
    const lx = M + (i % lCols) * lColW;
    const ly = y + Math.floor(i / lCols) * 10;
    const [lr, lg, lb] = aqiToRgb(l.aqi);
    doc.setFillColor(lr, lg, lb);
    doc.circle(lx + 3, ly + 2.5, 2.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(lr, lg, lb);
    doc.text(l.range, lx + 8, ly + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(l.label, lx + 8, ly + 8.5);
  });
  y += Math.ceil(legend.length / lCols) * 10 + 6;

  // ── FOOTER on every page ─────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 284, PW, 13, 'F');
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 284, PW, 0.7, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Generated by AeroSense AI  -  Data: Open-Meteo CAMS  -  Not a substitute for professional medical advice',
      PW / 2, 291, { align: 'center' }
    );
    doc.setTextColor(ar, ag, ab);
    doc.text('Page ' + p + ' of ' + totalPages, PW - M, 291, { align: 'right' });
  }

  const filename = `aerosense-${safe(cityName).toLowerCase().replace(/\s+/g, '-')}-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}