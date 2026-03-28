# OES Dashboard — Official Emergency Station

A real-time situational awareness dashboard for emergency operations, built with Node.js and Express. Aggregates weather, hydrology, air quality, grid status, aircraft tracking, and road condition data for the Austin, TX metro area.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green) ![Express](https://img.shields.io/badge/Express-4.x-lightgrey) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

| Panel | Source | Description |
|---|---|---|
| **Weather Station** | NWS API | Temperature, humidity, wind, barometric pressure, precipitation, visibility |
| **Forecast** | NWS API | 8-period forecast from the NWS gridpoint API |
| **NWS Radar** | NWS KEWX | Level 3 radar imagery (reflectivity, storm-relative velocity) |
| **NWS Alerts / NOAA Radio** | NWS Alerts API | Active warnings and watches with scrolling banner |
| **ADS-B Aircraft** | Local dump1090 | Tracks aircraft in the Austin terminal area (air tankers, helicopters) |
| **APRS Feed (RX)** | aprs.fi | Receive-only 144.390 MHz — ARES/RACES asset and weather station tracking |
| **USGS Stream Gauges** | USGS Water Services | Barton Creek, Onion Creek, Brushy Creek, Colorado River — stage and flow |
| **ATXFloods** | ATXFloods API | Low-water crossing and road closure status |
| **Air Quality** | AirNow API | AQI for wildfire smoke tracking |
| **ERCOT Grid** | ERCOT API | Grid demand, capacity, reserves, and emergency status |
| **External Resources** | Various | TFS/TCEQ fire maps, TxDOT DriveTexas, Travis County OEM GIS |

All panels auto-refresh on independent intervals (15 seconds to 10 minutes depending on data source).

---

## Requirements

- **Node.js** 18 or later
- **npm** (included with Node.js)

### Optional Hardware / Services

- **ADS-B Receiver** — A dump1090-compatible receiver (e.g. RTL-SDR with dump1090-fa or readsb) serving JSON on a local network endpoint.
- **AirNow API Key** — Free. Register at <https://docs.airnowapi.org/account/request/>

---

## Quick Start

```bash
# Clone the repo
git clone <your-repo-url>
cd oes-dashboard

# Install dependencies
npm install

# Create your environment config
cp .env.example .env

# Start the server
npm start
```

Open **http://localhost:3000** in a browser.

For development with auto-reload on file changes:

```bash
npm run dev
```

---

## Configuration

All configuration is done via environment variables in the `.env` file. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the dashboard listens on |
| `STATION_LAT` | `30.2672` | Latitude for weather lookups (Austin, TX) |
| `STATION_LON` | `-97.7431` | Longitude for weather lookups |
| `NWS_OFFICE` | `EWX` | NWS forecast office identifier |
| `NWS_GRID_X` | `157` | NWS grid X coordinate for your location |
| `NWS_GRID_Y` | `95` | NWS grid Y coordinate for your location |
| `AIRNOW_API_KEY` | *(empty)* | AirNow API key for air quality data |
| `ADSB_URL` | `http://localhost:8080` | dump1090 / readsb JSON endpoint URL |
| `APRS_HOST` | `rotate.aprs2.net` | APRS-IS server hostname |
| `APRS_PORT` | `14580` | APRS-IS server port |
| `APRS_FILTER` | `r/30.2672/-97.7431/80` | APRS-IS filter string (80 km radius of Austin) |

### Finding Your NWS Grid Coordinates

To use this dashboard for a different location, you need the NWS gridpoint values:

```bash
curl -s "https://api.weather.gov/points/YOUR_LAT,YOUR_LON" | jq '.properties | {office: .gridId, gridX: .gridX, gridY: .gridY}'
```

Example for Austin:

```json
{
  "office": "EWX",
  "gridX": 157,
  "gridY": 95
}
```

---

## Project Structure

```
oes-dashboard/
├── server.js              # Express app entry point
├── routes/
│   └── api.js             # All API routes (/api/weather/*, /api/gauges, etc.)
├── public/
│   ├── index.html         # Dashboard HTML
│   ├── css/
│   │   └── style.css      # Dark ops-center theme
│   └── js/
│       └── dashboard.js   # Client-side fetch + rendering logic
├── .env.example           # Environment variable template
├── .env                   # Your local config (not committed)
├── package.json
└── README.md
```

---

## API Endpoints

All endpoints are prefixed with `/api`.

| Endpoint | Method | Description | Cache TTL |
|---|---|---|---|
| `/api/weather/current` | GET | Current weather observations | 2 min |
| `/api/weather/forecast` | GET | 8-period NWS forecast | 10 min |
| `/api/weather/alerts` | GET | Active NWS alerts for the area | 1 min |
| `/api/weather/radar` | GET | Radar imagery URLs for KEWX | 2 min |
| `/api/gauges` | GET | USGS stream gauge readings | 5 min |
| `/api/aqi` | GET | AirNow air quality index | 10 min |
| `/api/ercot` | GET | ERCOT grid status | 5 min |
| `/api/adsb` | GET | ADS-B aircraft from local receiver | 10 sec |
| `/api/floods` | GET | ATXFloods low-water crossing status | 2 min |
| `/api/links` | GET | External resource links | Static |

---

## ADS-B Receiver Setup

The dashboard expects a dump1090-compatible JSON endpoint. Common setups:

1. **dump1090-fa** (FlightAware) — serves on port 8080 by default
2. **readsb** — drop-in replacement, same JSON format
3. **tar1090** — enhanced web UI, same JSON backend

Set `ADSB_URL` in `.env` to your receiver's address:

```env
ADSB_URL=http://192.168.1.100:8080
```

The dashboard reads `{ADSB_URL}/data/aircraft.json`.

If no receiver is configured, the ADS-B panel will display a placeholder with setup instructions.

---

## Data Sources & Attribution

| Source | Website | Notes |
|---|---|---|
| National Weather Service | <https://www.weather.gov> | Free, no key required. Requires `User-Agent` header. |
| USGS Water Services | <https://waterservices.usgs.gov> | Free, no key required |
| AirNow | <https://www.airnow.gov> | Free API key required |
| ERCOT | <https://www.ercot.com> | Public dashboard data |
| ATXFloods | <https://www.atxfloods.com> | City of Austin / Travis County |
| Texas A&M Forest Service | <https://texasforestservice.tamu.edu> | Wildfire perimeter maps |
| TCEQ | <https://www.tceq.texas.gov> | Prescribed burn maps |
| TxDOT DriveTexas | <https://drivetexas.org> | Road conditions |
| Travis County OEM | <https://www.traviscountytx.gov/emergency-services> | GIS feeds |
| APRS.fi | <https://aprs.fi> | APRS station tracking |

---

## License

MIT
