# 🌬️ AeroSense — AI-Powered Air Quality Intelligence

> Real-time air quality monitoring, forecasting, and health advisory — built for NCET Hackathon 2026.

---

## 🎬 Demo Video

[![Watch Demo](https://img.shields.io/badge/Watch%20Demo-Google%20Drive-blue?style=for-the-badge&logo=google-drive)](https://drive.google.com/file/d/1VS3YH1Ziq0_vW5LhOy2mjArYY-0s-QhC/view?usp=sharing)

---

## What is AeroSense?

AeroSense is a full-stack web application that gives users real-time air quality data for their location, predicts future AQI using ML models, and provides AI-driven health guidance — all in one clean, fast interface.

---

## Tech Stack

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Framer](https://img.shields.io/badge/Framer_Motion-black?style=for-the-badge&logo=framer&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![Groq](https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logo=groq&logoColor=white)
![OpenWeatherMap](https://img.shields.io/badge/OpenWeatherMap-EB6E4B?style=for-the-badge&logo=openweathermap&logoColor=white)

---

## Features

| Page | What it does |
|------|-------------|
| 🗺️ **Live Map** | Interactive map with real-time AQI markers, pollutant data, and 7 map themes |
| 📡 **Live Monitor** | Streaming environmental charts (AQI, PM2.5, UV, Humidity, Pathogen Risk) seeded from real OWM data |
| 🔮 **Predict** | Real hourly AQI forecast from Open-Meteo CAMS + AI health risk insight via Groq |
| 🔥 **Hotspots** | Detect and visualize high-pollution danger zones near you |
| 🤖 **Advisory** | AI chatbot that answers questions about past, current, and future air quality using real OWM data |
| 📊 **Analytics** | Regional AQI rankings, WHO pollutant comparison, quality spread, and HuggingFace anomaly detection |

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/manthaaaaan/AIR_AI_DETECTION_NCET.git
cd AIR_AI_DETECTION_NCET
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root:
```dotenv
VITE_GROQ_API_KEY=your_groq_key
VITE_OWM_API_KEY=your_openweathermap_key
VITE_HF_TOKEN=your_huggingface_token
VITE_OPENAQ_API_KEY=your_openaq_key
```

| Key | Get it from |
|-----|-------------|
| `VITE_GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `VITE_OWM_API_KEY` | [openweathermap.org/api](https://openweathermap.org/api) |
| `VITE_HF_TOKEN` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| `VITE_OPENAQ_API_KEY` | [openaq.org](https://openaq.org) |

### 4. Run the app
```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080)

---

## How the AI works

- **Advisory Chatbot** — Groq (Llama 3.1 8B) receives real past 24hr + current + 24hr forecast AQI data from OpenWeatherMap injected into the system prompt. It can answer time-specific questions like "what was AQI at 3am?" or "will it get worse tonight?"

- **AQI Forecast** — Open-Meteo CAMS API provides real hourly PM2.5, US AQI, and European AQI. The confidence band on the chart is the actual spread between the two model scales — not simulated.

- **Anomaly Detection** — HuggingFace `@huggingface/transformers` runs `Xenova/nli-deberta-v3-small` in the browser to classify stations as normal or anomalous. Falls back to Z-score detection if the model fails.

---

## Project Structure
```
src/
├── pages/
│   ├── Dashboard.tsx      # Live map page
│   ├── Predict.tsx        # AQI forecast + AI insight
│   ├── Advisory.tsx       # AI health chatbot
│   ├── Analytics.tsx      # Charts + anomaly detection
│   └── Hotspots.tsx       # Danger zone detection
├── components/
│   ├── LiveDashboard.tsx  # Streaming chart widget
│   ├── AQIGauge.tsx
│   └── PollutantCard.tsx
├── context/
│   └── AirQualityContext.tsx  # Global state + OWM data
├── services/
│   └── aqiService.ts      # OpenAQ + station fetching
└── data/
    └── mockSensorData.ts  # AQI categories, colors, mock data
```

---

## Built by

**GIT-HAPPENS**  
NCET VIBEXATHON-2026