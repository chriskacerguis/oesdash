# OES Dashboard — Official Emergency Station

A real-time situational awareness dashboard for emergency operations, built with Node.js and Express. Aggregates weather, hydrology, air quality, grid status, aircraft tracking, and road condition data for the Austin, TX metro area.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green) ![Express](https://img.shields.io/badge/Express-4.x-lightgrey) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

| Panel | Source | Description |
|---|---|---|
| **Weather Station** | NWS / Ambient Weather | Temperature, humidity, wind, barometric pressure, precipitation, visibility |
| **Forecast** | NWS API | 8-period forecast (auto-resolved from lat/lon) |
| **NWS Alerts** | NWS Alerts API | Active warnings and watches with scrolling banner |
| **SPC Outlook** | SPC | Convective outlook categories |
| **Tropical** | NHC | Active tropical cyclone advisories |
| **Radar / Satellite** | RainViewer / GOES | Interactive Leaflet map with radar overlay and satellite imagery |
| **ADS-B Aircraft** | Local receiver | Tracks aircraft via dump1090/readsb/FR24 feeder |
| **Airports** | FAA AWC | METAR, flight categories, delays for nearby airports |
| **USGS Stream Gauges** | USGS Water Services | Stage and flow for nearby waterways |
| **Low-Water Crossings** | ATXFloods API | Road closure status within 30 miles |
| **Air Quality** | AirNow API | AQI for PM2.5, ozone, and other pollutants |
| **ERCOT Grid** | ERCOT API | Grid demand, capacity, reserves, and emergency status |
| **Space Weather** | SWPC | Kp index, solar flux, X-ray flares |
| **HF Propagation** | KC2G | MUF and foF2 propagation data |
| **Earthquakes** | USGS | Recent seismic events within 100 miles, sorted by distance |
| **Wildfires** | NIFC | Active fire perimeters within 100 miles |

All panels auto-refresh on independent intervals (15 seconds to 10 minutes depending on data source).

---

## Configuration

All configuration is done via environment variables. Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port the dashboard listens on |
| `STATION_LAT` | **Yes** | `30.2672` | Latitude — sets map center and all location-based queries |
| `STATION_LON` | **Yes** | `-97.7431` | Longitude — sets map center and all location-based queries |
| `AMBIENT_APP_KEY` | No | *(empty)* | Ambient Weather application key (for personal weather station) |
| `AMBIENT_API_KEY` | No | *(empty)* | Ambient Weather user API key |
| `AIRNOW_API_KEY` | No | *(empty)* | AirNow API key for air quality data |
| `ADSB_URL` | No | `http://localhost:8754` | dump1090 / readsb / FR24 feeder JSON endpoint |
| `APRS_HOST` | No | `rotate.aprs2.net` | APRS-IS server hostname |
| `APRS_PORT` | No | `14580` | APRS-IS server port |
| `APRS_FILTER` | No | `r/30.2672/-97.7431/80` | APRS-IS filter string |

The NWS forecast office and grid coordinates are **resolved automatically** from `STATION_LAT`/`STATION_LON` — no manual lookup needed.

### API Keys

| Key | Where to get it |
|---|---|
| Ambient Weather | <https://ambientweather.net/account> — you need both an Application Key and an API Key |
| AirNow | <https://docs.airnowapi.org/account/request/> — free |

---

## Deploy with Docker

### Prerequisites

- Docker and Docker Compose installed
- A configured `.env` file

### Start

See the included `docker-compose.yml` for the full configuration.

```bash
cp .env.example .env   # edit with your values
docker compose up -d
```

The dashboard will be available at **http://localhost:3000** (or whatever `PORT` you set).

### Update to latest image

```bash
docker compose pull
docker compose up -d
```

### Stop

```bash
docker compose down
```

---

## ADS-B Receiver Setup

The dashboard expects a dump1090-compatible JSON endpoint. Common setups:

- **dump1090-fa** (FlightAware) — port 8080
- **readsb** — drop-in replacement, same JSON format
- **FlightRadar24 feeder** — port 8754

Set `ADSB_URL` in `.env` to your receiver's address:

```env
ADSB_URL=http://192.168.1.100:8754
```

If no receiver is available, the ADS-B panel will show a placeholder.

---

## Data Sources & Attribution

| Source | Website | Key Required |
|---|---|---|
| National Weather Service | <https://www.weather.gov> | No |
| USGS Water Services | <https://waterservices.usgs.gov> | No |
| USGS Earthquakes | <https://earthquake.usgs.gov> | No |
| AirNow | <https://www.airnow.gov> | Yes (free) |
| ERCOT | <https://www.ercot.com> | No |
| ATXFloods | <https://www.atxfloods.com> | No |
| NIFC Wildfires | <https://data-nifc.opendata.arcgis.com> | No |
| NOAA SWPC | <https://www.swpc.noaa.gov> | No |
| KC2G Propagation | <https://prop.kc2g.com> | No |
| Ambient Weather | <https://ambientweather.net> | Yes (free) |

---

## License

MIT
