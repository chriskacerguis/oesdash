/* ── OES Dashboard — Client JS ──────────────────────────────────────────── */

(function () {
  'use strict';

  // ── Clock ───────────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const opts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Chicago' };
    const time = now.toLocaleTimeString('en-US', opts);
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
    document.getElementById('clock').textContent = `${dateStr}  ${time} CT`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ── Leaflet Map ───────────────────────────────────────────────────────
  const STATION = [30.2672, -97.7431];
  let map, radarLayer, gaugesLayer, quakesLayer, firesLayer, alertsLayer, flightsLayer;

  function initMap() {
    map = L.map('map', { zoomControl: true, attributionControl: false }).setView(STATION, 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      maxZoom: 19,
      maxNativeZoom: 18,
      subdomains: 'abcd'
    }).addTo(map);

    // Initialise overlay layer groups
    radarLayer  = L.layerGroup().addTo(map);
    gaugesLayer = L.layerGroup();
    quakesLayer = L.layerGroup();
    firesLayer  = L.layerGroup();
    alertsLayer = L.layerGroup();
    flightsLayer= L.layerGroup();

    // Station marker
    L.circleMarker(STATION, { radius: 6, color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 })
      .bindPopup('<div class="popup-title">OES Station</div><div class="popup-dim">30.2672, -97.7431</div>')
      .addTo(map);

    // Load initial radar overlay
    loadRadarOverlay();
  }

  // ── RainViewer Radar Overlay ────────────────────────────────────────
  async function loadRadarOverlay() {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data = await res.json();
      radarLayer.clearLayers();
      const frames = data.radar && data.radar.past ? data.radar.past : [];
      if (frames.length) {
        const latest = frames[frames.length - 1];
        L.tileLayer(data.host + latest.path + '/512/{z}/{x}/{y}/6/1_1.png', {
          opacity: 0.55,
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 19,
          maxNativeZoom: 7
        }).addTo(radarLayer);
      }
    } catch (e) { /* radar overlay failed silently */ }
  }

  // Map layer name mapping
  const layerMap = {
    radar:   () => radarLayer,
    gauges:  () => gaugesLayer,
    quakes:  () => quakesLayer,
    fires:   () => firesLayer,
    alerts:  () => alertsLayer,
    flights: () => flightsLayer
  };

  // ── Layer Toggle Buttons ────────────────────────────────────────────
  document.querySelectorAll('.layer-tog').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.layer;
      const lg = layerMap[name] && layerMap[name]();
      if (!lg || !map) return;
      btn.classList.toggle('active');
      if (btn.classList.contains('active')) {
        map.addLayer(lg);
      } else {
        map.removeLayer(lg);
      }
    });
  });

  // ── Center View Tab Switching ────────────────────────────────────────
  document.querySelectorAll('.cv-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cv-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      document.getElementById('center-radar').style.display = view === 'radar' ? 'block' : 'none';
      document.getElementById('center-satellite').style.display = view === 'satellite' ? 'block' : 'none';
      if (view === 'radar' && map) setTimeout(() => map.invalidateSize(), 100);
    });
  });

  // ── Status Strip Helpers ──────────────────────────────────────────────
  function setStrip(id, value, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    el.className = 's-val' + (colorClass ? ' ' + colorClass : '');
  }

  function setIndClass(id, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('ok', 'warn', 'danger');
    if (cls) el.classList.add(cls);
  }

  // ── Fetch helper ────────────────────────────────────────────────────────
  async function api(path) {
    const res = await fetch(`/api${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function windDir(deg) {
    if (deg == null) return '—';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Weather ─────────────────────────────────────────────────────────────
  async function loadWeather() {
    const el = document.getElementById('weather-body');
    try {
      const w = await api('/weather/current');
      const isAmbient = w.source === 'Ambient Weather';
      const descLine = w.description ? `<div class="weather-desc">${escHtml(w.description)}</div>` : '';
      const feelsLine = w.feelsLike != null ? `<div class="weather-desc">Feels like ${w.feelsLike}°F</div>` : '';

      // Build stat cells — show extra fields when Ambient Weather is the source
      let stats = `
        <div class="weather-stat"><div class="label">Humidity</div><div class="value">${w.humidity != null ? w.humidity + '%' : '—'}</div></div>
        <div class="weather-stat"><div class="label">Wind</div><div class="value">${w.windSpeed != null ? w.windSpeed + ' mph ' + windDir(w.windDirection) : '—'}</div></div>
        <div class="weather-stat"><div class="label">Wind Gust</div><div class="value">${w.windGust != null ? w.windGust + ' mph' : '—'}</div></div>
        <div class="weather-stat"><div class="label">Barometer</div><div class="value">${w.barometer != null ? w.barometer + ' inHg' : '—'}</div></div>
      `;

      if (isAmbient) {
        stats += `
          <div class="weather-stat"><div class="label">Dew Point</div><div class="value">${w.dewPoint != null ? w.dewPoint + '°F' : '—'}</div></div>
          <div class="weather-stat"><div class="label">Rain (1h)</div><div class="value">${w.precipitation1h != null ? w.precipitation1h + ' in' : '—'}</div></div>
          <div class="weather-stat"><div class="label">Rain (Daily)</div><div class="value">${w.dailyRain != null ? w.dailyRain + ' in' : '—'}</div></div>
          <div class="weather-stat"><div class="label">UV Index</div><div class="value">${w.uv != null ? w.uv : '—'}</div></div>
          <div class="weather-stat"><div class="label">Solar Rad</div><div class="value">${w.solarRadiation != null ? w.solarRadiation + ' W/m²' : '—'}</div></div>
          <div class="weather-stat"><div class="label">Indoor</div><div class="value">${w.tempIndoor != null ? w.tempIndoor + '°F / ' + (w.humidityIndoor ?? '—') + '%' : '—'}</div></div>
        `;
      } else {
        stats += `
          <div class="weather-stat"><div class="label">Visibility</div><div class="value">${w.visibility != null ? w.visibility + ' mi' : '—'}</div></div>
          <div class="weather-stat"><div class="label">Precip (1h)</div><div class="value">${w.precipitation1h != null ? w.precipitation1h + ' in' : '—'}</div></div>
        `;
      }

      el.innerHTML = `
        <div class="weather-grid">
          <div class="weather-primary">
            <div class="temp-big">${w.temperature != null ? w.temperature : '—'}<span class="unit">°F</span></div>
            ${descLine}${feelsLine}
          </div>
          ${stats}
        </div>
        <div class="timestamp">${escHtml(w.source || '')} — ${escHtml(w.station || '—')} — ${fmtTime(w.timestamp)}</div>
      `;
      const badge = document.getElementById('weather-source-badge');
      if (badge) badge.textContent = w.source === 'Ambient Weather' ? 'On-Site' : 'NWS';

      // Status strip: TEMP & WIND
      if (w.temperature != null) setStrip('sv-temp', w.temperature + '°F');
      if (w.windSpeed != null) setStrip('sv-wind', w.windSpeed + ' mph');
    } catch (e) {
      el.innerHTML = `<p class="error-text">Weather data unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── Forecast ────────────────────────────────────────────────────────────
  async function loadForecast() {
    const el = document.getElementById('forecast-body');
    try {
      const periods = await api('/weather/forecast');
      el.innerHTML = `<div class="forecast-list">${periods.map(p => `
        <div class="forecast-item">
          <span class="forecast-name">${escHtml(p.name)}</span>
          <span class="forecast-temp">${p.temperature}°${p.temperatureUnit}</span>
          <span class="forecast-short" title="${escHtml(p.detailedForecast)}">${escHtml(p.shortForecast)}</span>
        </div>`).join('')}</div>`;
    } catch (e) {
      el.innerHTML = `<p class="error-text">Forecast unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── Radar (refreshes RainViewer overlay) ─────────────────────────────
  async function loadRadar() {
    await loadRadarOverlay();
  }

  // ── Alerts ──────────────────────────────────────────────────────────────
  async function loadAlerts() {
    const el = document.getElementById('alerts-body');
    const banner = document.getElementById('alerts-banner');
    try {
      const alerts = await api('/weather/alerts');
      if (!alerts.length) {
        el.innerHTML = '<p class="no-alerts">✓ No active alerts for this area</p>';
        banner.classList.add('hidden');
        setStrip('sv-alerts', '0', 'green');
        setIndClass('ind-alerts', 'ok');
        return;
      }
      el.innerHTML = `<div class="alert-list">${alerts.map(a => `
        <div class="alert-item severity-${(a.severity || '').toLowerCase()}">
          <div class="alert-event">${escHtml(a.event)}</div>
          <div class="alert-headline">${escHtml(a.headline || '')}</div>
          <div class="alert-times">${fmtTime(a.onset)} → ${fmtTime(a.expires)}</div>
        </div>`).join('')}</div>`;

      // Scrolling banner
      const items = alerts.map(a =>
        `<span class="alert-scroll-item"><span class="severity-${(a.severity || '').toLowerCase()}">■</span> ${escHtml(a.event)}: ${escHtml((a.headline || '').substring(0, 100))}</span>`
      ).join('');
      banner.innerHTML = `<div class="alert-scroll">${items}${items}</div>`;
      banner.classList.remove('hidden');

      // Status strip: ALERTS
      setStrip('sv-alerts', alerts.length, alerts.length > 0 ? 'red' : 'green');
      setIndClass('ind-alerts', alerts.length > 0 ? 'danger' : 'ok');

      // Map overlay: alert polygons
      if (alertsLayer) {
        alertsLayer.clearLayers();
        alerts.forEach(a => {
          if (!a.geometry) return;
          const sevColor = (a.severity || '').toLowerCase() === 'extreme' ? '#ef4444'
            : (a.severity || '').toLowerCase() === 'severe' ? '#f97316'
            : '#eab308';
          try {
            L.geoJSON(a.geometry, {
              style: { color: sevColor, weight: 2, fillOpacity: 0.15 }
            }).bindPopup(`<div class="popup-title">${escHtml(a.event)}</div><div class="popup-dim">${escHtml((a.headline || '').substring(0, 120))}</div>`).addTo(alertsLayer);
          } catch (e) { /* skip bad geometry */ }
        });
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">Alerts unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── ADS-B ───────────────────────────────────────────────────────────────
  async function loadAdsb() {
    const el = document.getElementById('adsb-body');
    try {
      const d = await api('/adsb');
      if (d.note) {
        el.innerHTML = `
          <div class="adsb-count">—<span class="label-sm">aircraft</span></div>
          <p class="info-text">${escHtml(d.note)}</p>
          <p class="info-text" style="margin-top:0.5rem;">Configure <code>ADSB_URL</code> in .env to point to your dump1090 receiver.</p>
        `;
        return;
      }
      const rows = d.aircraft.filter(a => a.flight).slice(0, 10).map(a => `
        <tr>
          <td>${escHtml(a.flight || a.hex)}</td>
          <td>${a.altitude != null ? a.altitude.toLocaleString() : '—'}</td>
          <td>${a.speed != null ? Math.round(a.speed) : '—'}</td>
          <td>${a.squawk || '—'}</td>
        </tr>`).join('');
      el.innerHTML = `
        <div class="adsb-count">${d.count}<span class="label-sm">aircraft tracked</span></div>
        <table class="adsb-table">
          <thead><tr><th>Callsign</th><th>Alt (ft)</th><th>Spd (kt)</th><th>Squawk</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" style="color:var(--text-dim)">No identified aircraft</td></tr>'}</tbody>
        </table>
      `;

      // Status strip: A/C
      setStrip('sv-flights', d.count);

      // Map overlay: aircraft markers
      if (flightsLayer) {
        flightsLayer.clearLayers();
        d.aircraft.forEach(a => {
          if (a.lat == null || a.lon == null) return;
          const rot = a.track != null ? `transform:rotate(${a.track}deg)` : '';
          const icon = L.divIcon({
            className: 'map-marker-flight',
            html: `<div style="${rot}">✈</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });
          L.marker([a.lat, a.lon], { icon })
            .bindPopup(`<div class="popup-title">${escHtml(a.flight || a.hex)}</div><div class="popup-dim">Alt ${a.altitude != null ? a.altitude.toLocaleString() + ' ft' : '—'} · ${a.speed != null ? Math.round(a.speed) + ' kt' : '—'}</div>${a.squawk ? '<div class="popup-dim">Squawk ' + escHtml(a.squawk) + '</div>' : ''}`)
            .addTo(flightsLayer);
        });
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">ADS-B unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── USGS Gauges ─────────────────────────────────────────────────────────
  async function loadGauges() {
    const el = document.getElementById('gauges-body');
    try {
      const gauges = await api('/gauges');
      const rows = gauges.map(g => `
        <tr>
          <td class="gauge-name" title="${escHtml(g.name)}">${escHtml(g.name)}</td>
          <td class="gauge-val">${g.gageHeight ? g.gageHeight.value + ' ft' : '—'}</td>
          <td class="gauge-val">${g.discharge ? g.discharge.value.toLocaleString() + ' cfs' : '—'}</td>
        </tr>`).join('');
      el.innerHTML = `
        <table class="gauge-table">
          <thead><tr><th>Station</th><th>Stage</th><th>Flow</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="timestamp">Updated: ${fmtTime(gauges[0]?.gageHeight?.dateTime || gauges[0]?.discharge?.dateTime)}</div>
      `;

      // Map overlay: gauge markers
      if (gaugesLayer) {
        gaugesLayer.clearLayers();
        gauges.forEach(g => {
          if (g.lat == null || g.lon == null) return;
          const icon = L.divIcon({ className: 'map-marker-gauge', iconSize: [10, 10], iconAnchor: [5, 5] });
          L.marker([g.lat, g.lon], { icon })
            .bindPopup(`<div class="popup-title">${escHtml(g.name)}</div><div class="popup-val">${g.gageHeight ? g.gageHeight.value + ' ft' : '—'}</div><div class="popup-dim">${g.discharge ? g.discharge.value.toLocaleString() + ' cfs' : '—'}</div>`)
            .addTo(gaugesLayer);
        });
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">Gauge data unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── ATXFloods ───────────────────────────────────────────────────────────
  async function loadFloods() {
    const el = document.getElementById('floods-body');
    try {
      const data = await api('/floods');
      if (data.note || !Array.isArray(data)) {
        el.innerHTML = `<p class="info-text">${escHtml(data.note || 'ATXFloods data format unexpected')}</p>
          <a href="https://www.atxfloods.com" target="_blank" rel="noopener" class="ext-link">Open ATXFloods.com →</a>`;
        return;
      }
      const closed = data.filter(c => c.status === 'closed');
      const caution = data.filter(c => c.status === 'caution');
      if (!closed.length && !caution.length) {
        el.innerHTML = `<p class="no-alerts">✓ All monitored crossings are open</p>
          <a href="https://www.atxfloods.com" target="_blank" rel="noopener" class="ext-link">View all crossings →</a>`;
        return;
      }
      const items = [
        ...closed.map(c => `
          <div class="flood-item">
            <span class="flood-name">${escHtml(c.name)}</span>
            <span class="flood-status closed">CLOSED</span>
          </div>`),
        ...caution.map(c => `
          <div class="flood-item">
            <span class="flood-name">${escHtml(c.name)}</span>
            <span class="flood-status caution">CAUTION</span>
          </div>`),
      ];
      el.innerHTML = `
        <div class="flood-list">${items.slice(0, 15).join('')}</div>
        <div class="timestamp">${closed.length} closed · ${caution.length} caution</div>
        <a href="https://www.atxfloods.com" target="_blank" rel="noopener" class="ext-link">View all crossings →</a>
      `;
    } catch (e) {
      el.innerHTML = `<p class="error-text">Flood data unavailable: ${escHtml(e.message)}</p>
        <a href="https://www.atxfloods.com" target="_blank" rel="noopener" class="ext-link">Open ATXFloods.com →</a>`;
    }
  }

  // ── AQI ─────────────────────────────────────────────────────────────────
  async function loadAqi() {
    const el = document.getElementById('aqi-body');
    try {
      const data = await api('/aqi');
      if (data.error) {
        el.innerHTML = `<p class="info-text">${escHtml(data.error)}</p>
          <a href="https://www.airnow.gov/?city=Austin&state=TX" target="_blank" rel="noopener" class="ext-link">View on AirNow →</a>`;
        return;
      }
      el.innerHTML = `<div class="aqi-grid">${data.map(d => {
        let cls = 'aqi-good';
        if (d.aqi > 150) cls = 'aqi-unhealthy';
        else if (d.aqi > 100) cls = 'aqi-usg';
        else if (d.aqi > 50) cls = 'aqi-moderate';
        return `<div class="aqi-item">
          <div class="aqi-value ${cls}">${d.aqi}</div>
          <div class="aqi-param">${escHtml(d.parameter)}</div>
          <div class="aqi-category ${cls}">${escHtml(d.category)}</div>
        </div>`;
      }).join('')}</div>`;

      // Status strip: AQI (use worst reading)
      const worst = data.reduce((a, b) => b.aqi > a.aqi ? b : a, data[0]);
      if (worst) {
        const aqiColor = worst.aqi > 150 ? 'red' : worst.aqi > 100 ? 'orange' : worst.aqi > 50 ? 'yellow' : 'green';
        setStrip('sv-aqi', worst.aqi, aqiColor);
        setIndClass('ind-aqi', worst.aqi > 100 ? 'danger' : worst.aqi > 50 ? 'warn' : 'ok');
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">AQI unavailable: ${escHtml(e.message)}</p>
        <a href="https://www.airnow.gov/?city=Austin&state=TX" target="_blank" rel="noopener" class="ext-link">View on AirNow →</a>`;
    }
  }

  // ── ERCOT ───────────────────────────────────────────────────────────────
  async function loadErcot() {
    const el = document.getElementById('ercot-body');
    try {
      const d = await api('/ercot');
      const statusCls = (d.status || '').toLowerCase().includes('emergency') ? 'emergency'
        : (d.status || '').toLowerCase().includes('watch') || (d.status || '').toLowerCase().includes('conservation') ? 'warning' : '';
      el.innerHTML = `
        <div class="ercot-status">
          <div class="ercot-status-label ${statusCls}">${escHtml(d.status || 'Normal Operations')}</div>
          ${d.currentDemand ? `<div class="ercot-stats">
            <div class="ercot-stat"><div class="value">${Number(d.currentDemand).toLocaleString()}</div><div class="label">Demand (MW)</div></div>
            <div class="ercot-stat"><div class="value">${Number(d.capacity).toLocaleString()}</div><div class="label">Capacity (MW)</div></div>
            <div class="ercot-stat"><div class="value">${Number(d.operatingReserves).toLocaleString()}</div><div class="label">Reserves (MW)</div></div>
          </div>` : ''}
          ${d.note ? `<p class="info-text" style="margin-top:0.75rem">${escHtml(d.note)}</p>` : ''}
        </div>
        <a href="${d.dashboardUrl || 'https://www.ercot.com/gridmktinfo/dashboards'}" target="_blank" rel="noopener" class="ext-link">ERCOT Dashboard →</a>
      `;

      // Status strip: GRID
      const gridLabel = (d.status || 'Normal').split(' ')[0];
      const gCls = statusCls === 'emergency' ? 'red' : statusCls === 'warning' ? 'yellow' : 'green';
      setStrip('sv-grid', gridLabel, gCls);
      setIndClass('ind-grid', statusCls === 'emergency' ? 'danger' : statusCls === 'warning' ? 'warn' : 'ok');
    } catch (e) {
      el.innerHTML = `<p class="error-text">ERCOT data unavailable: ${escHtml(e.message)}</p>
        <a href="https://www.ercot.com/gridmktinfo/dashboards" target="_blank" rel="noopener" class="ext-link">ERCOT Dashboard →</a>`;
    }
  }

  // ── Airport Status ──────────────────────────────────────────────────────
  async function loadAirports() {
    const el = document.getElementById('airports-body');
    try {
      const airports = await api('/airports');
      el.innerHTML = `<div class="airport-list">${airports.map(a => {
        const m = a.metar;
        const cat = m?.flightCategory || '—';
        const delays = a.delays.map(d => `
          <div class="airport-delay">
            <span class="delay-type">${escHtml(d.type)}</span> — ${escHtml(d.reason)}${d.avg ? ' (avg ' + escHtml(d.avg) + ')' : ''}
          </div>`).join('');
        const closures = a.closures.map(c => `
          <div class="airport-delay">
            <span class="delay-type">CLOSED</span> — ${escHtml(c.reason).substring(0, 80)}
            <br>Reopen: ${escHtml(c.reopen)}
          </div>`).join('');
        const noIssues = !a.delays.length && !a.closures.length ? '<div style="color:var(--green);font-size:0.8rem;margin-top:0.35rem">✓ No delays or closures</div>' : '';
        return `
          <div class="airport-item">
            <div class="airport-header">
              <span class="airport-name">${escHtml(a.icao)} — ${escHtml(a.name)}</span>
              <span class="flt-cat flt-cat-${cat}">${cat}</span>
            </div>
            ${m ? `<div class="airport-wind">Wind ${escHtml(m.wind || 'Calm')} · Vis ${m.visibility} · Alt ${m.altimeter} inHg</div>` : ''}
            ${m ? `<div class="airport-metar">${escHtml(m.raw)}</div>` : '<p class="info-text">METAR unavailable</p>'}
            ${delays}${closures}${noIssues}
          </div>`;
      }).join('')}</div>`;
    } catch (e) {
      el.innerHTML = `<p class="error-text">Airport data unavailable: ${escHtml(e.message)}</p>`;
    }
  }



  // ── SPC Severe Weather Outlook ────────────────────────────────────────
  async function loadSpc() {
    const el = document.getElementById('spc-body');
    try {
      const d = await api('/spc');
      let html = '';
      if (d.dayOneOutlook && d.dayOneOutlook.length) {
        html += '<div class="spc-categories">';
        d.dayOneOutlook.forEach(c => {
          const cat = (c.category || '').replace(/\s/g, '').toUpperCase();
          html += `<span class="spc-cat spc-cat-${cat}" style="${c.fill ? 'border-color:' + c.fill : ''}">${escHtml(c.category || 'General')}</span>`;
        });
        html += '</div>';
      } else {
        html += '<p class="no-alerts">No significant severe weather outlook</p>';
      }
      if (d.discussions && d.discussions.length) {
        html += '<div class="md-list">';
        d.discussions.forEach(md => {
          html += `<div class="md-item">
            <a href="${md.url}" target="_blank" rel="noopener">MD #${md.id}</a>
            ${md.concern ? `<div class="md-concern">${escHtml(md.concern)}</div>` : ''}
          </div>`;
        });
        html += '</div>';
      }
      html += `<a href="${d.spcUrl || 'https://www.spc.noaa.gov/'}" target="_blank" rel="noopener" class="ext-link">SPC Full Outlook →</a>`;
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = `<p class="error-text">SPC data unavailable: ${escHtml(e.message)}</p>
        <a href="https://www.spc.noaa.gov/" target="_blank" rel="noopener" class="ext-link">View SPC →</a>`;
    }
  }

  // ── Tropical Cyclones ─────────────────────────────────────────────────
  async function loadTropical() {
    const el = document.getElementById('tropical-body');
    try {
      const d = await api('/tropical');
      if (d.alerts && d.alerts.length) {
        el.innerHTML = `
          ${d.alerts.map(a => `
            <div class="tropical-alert">
              <div class="event">${escHtml(a.event)}</div>
              <div class="headline">${escHtml(a.headline || '')}</div>
              ${a.areas ? `<div class="headline">Areas: ${escHtml(a.areas.substring(0, 150))}</div>` : ''}
            </div>`).join('')}
          <a href="${d.nhcUrl || 'https://www.nhc.noaa.gov/'}" target="_blank" rel="noopener" class="ext-link">NHC Full View →</a>`;
      } else if (d.activeStorms === false || (!d.alerts || !d.alerts.length)) {
        el.innerHTML = `<p class="no-alerts">✓ No active tropical systems</p>
          <a href="https://www.nhc.noaa.gov/" target="_blank" rel="noopener" class="ext-link">NHC Outlook →</a>`;
      } else {
        // Raw NHC data
        el.innerHTML = `<p class="info-text">${escHtml(JSON.stringify(d).substring(0, 300))}</p>
          <a href="https://www.nhc.noaa.gov/" target="_blank" rel="noopener" class="ext-link">NHC Full View →</a>`;
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">Tropical data unavailable: ${escHtml(e.message)}</p>
        <a href="https://www.nhc.noaa.gov/" target="_blank" rel="noopener" class="ext-link">View NHC →</a>`;
    }
  }

  // ── Earthquakes ───────────────────────────────────────────────────────
  async function loadEarthquakes() {
    const el = document.getElementById('earthquakes-body');
    try {
      const d = await api('/earthquakes');
      if (!d.events || !d.events.length) {
        el.innerHTML = '<p class="no-alerts">✓ No recent earthquakes within 500 km</p>';
        return;
      }
      el.innerHTML = `<div class="quake-list">${d.events.slice(0, 8).map(q => {
        const mag = q.magnitude || 0;
        const cls = mag >= 5 ? 'major' : mag >= 4 ? 'strong' : mag >= 3 ? 'moderate' : 'low';
        return `
          <div class="quake-item">
            <div class="quake-mag ${cls}">${mag.toFixed(1)}</div>
            <div class="quake-info">
              <div class="quake-place">${escHtml(q.place || 'Unknown')}</div>
              <div class="quake-meta">${fmtTime(q.time)} · ${q.depth ? q.depth.toFixed(1) + ' km deep' : ''}</div>
            </div>
          </div>`;
      }).join('')}</div>
      <div class="timestamp">${d.count} event${d.count !== 1 ? 's' : ''} in range</div>`;

      // Map overlay: earthquake markers
      if (quakesLayer) {
        quakesLayer.clearLayers();
        d.events.forEach(q => {
          if (q.lat == null || q.lon == null) return;
          const mag = q.magnitude || 0;
          const color = mag >= 5 ? '#ef4444' : mag >= 4 ? '#f97316' : mag >= 3 ? '#eab308' : '#6b7280';
          const r = Math.max(5, mag * 4);
          L.circleMarker([q.lat, q.lon], { radius: r, color, fillColor: color, fillOpacity: 0.4, weight: 2, className: 'map-marker-quake' })
            .bindPopup(`<div class="popup-title">M${mag.toFixed(1)} Earthquake</div><div class="popup-dim">${escHtml(q.place || 'Unknown')}</div><div class="popup-dim">${fmtTime(q.time)} · ${q.depth ? q.depth.toFixed(1) + ' km deep' : ''}</div>`)
            .addTo(quakesLayer);
        });
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">Earthquake data unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── Space Weather ─────────────────────────────────────────────────────
  async function loadSpaceWeather() {
    const el = document.getElementById('spaceweather-body');
    try {
      const d = await api('/spaceweather');
      let kpHtml = '';
      if (d.kpIndex) {
        const kp = d.kpIndex.kp;
        const cls = kp >= 7 ? 'kp-severe' : kp >= 5 ? 'kp-storm' : kp >= 4 ? 'kp-unsettled' : 'kp-quiet';
        const label = kp >= 7 ? 'Severe Storm' : kp >= 5 ? 'Geomagnetic Storm' : kp >= 4 ? 'Unsettled' : 'Quiet';
        kpHtml = `<div class="kp-display">
          <div class="kp-value ${cls}">${kp}</div>
          <div class="kp-label">Planetary Kp Index — ${label}</div>
        </div>`;
      }

      let scaleHtml = '';
      if (d.scales) {
        scaleHtml = `
          <div class="sw-stat"><div class="value">${escHtml(d.scales.radioBlackout || '—')}</div><div class="label">Radio Blackout</div></div>
          <div class="sw-stat"><div class="value">${escHtml(d.scales.solarRadiation || '—')}</div><div class="label">Solar Radiation</div></div>
          <div class="sw-stat"><div class="value">${escHtml(d.scales.geoStorm || '—')}</div><div class="label">Geomagnetic Storm</div></div>
        `;
      }

      el.innerHTML = `
        <div class="spaceweather-grid">
          ${kpHtml}
          ${scaleHtml}
        </div>
        <a href="${d.swpcUrl || 'https://www.swpc.noaa.gov/'}" target="_blank" rel="noopener" class="ext-link">SWPC Dashboard →</a>
      `;

      // Status strip: Kp
      if (d.kpIndex) {
        const kpV = d.kpIndex.kp;
        const kpC = kpV >= 7 ? 'red' : kpV >= 5 ? 'orange' : kpV >= 4 ? 'yellow' : 'green';
        setStrip('sv-kp', kpV, kpC);
        setIndClass('ind-kp', kpV >= 5 ? 'danger' : kpV >= 4 ? 'warn' : 'ok');
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">Space weather unavailable: ${escHtml(e.message)}</p>
        <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener" class="ext-link">View SWPC →</a>`;
    }
  }

  // ── HF Propagation (MUF / LUF) ────────────────────────────────────────
  async function loadHfProp() {
    const el = document.getElementById('hfprop-body');
    try {
      const d = await api('/hfprop');
      const mufVal = d.muf != null ? d.muf + ' MHz' : '—';
      const lufVal = d.luf != null ? d.luf + ' MHz' : '—';
      const fluxVal = d.solarFlux != null ? d.solarFlux + ' SFU' : '—';
      const gridVal = d.grid || '—';

      el.innerHTML = `
        <div class="hf-grid">
          <div class="hf-stat hf-primary">
            <div class="value">${escHtml(mufVal)}</div>
            <div class="label">MUF — Max Usable Freq</div>
          </div>
          <div class="hf-stat hf-primary">
            <div class="value">${escHtml(lufVal)}</div>
            <div class="label">LUF — Lowest Usable Freq</div>
          </div>
          <div class="hf-stat">
            <div class="value">${escHtml(fluxVal)}</div>
            <div class="label">Solar Flux (10.7 cm)</div>
          </div>
          <div class="hf-stat">
            <div class="value">${escHtml(gridVal)}</div>
            <div class="label">Grid Square</div>
          </div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = `<p class="error-text">HF propagation unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── GOES Satellite ────────────────────────────────────────────────────
  async function loadSatellite() {
    const el = document.getElementById('satellite-body');
    try {
      const d = await api('/satellite');
      el.innerHTML = `
        <div class="satellite-view">
          <img class="satellite-img" id="sat-img" src="${d.visibleUrl}" alt="GOES-16 ${d.sector}" loading="lazy">
          <div class="satellite-controls">
            <button class="sat-btn active" onclick="document.getElementById('sat-img').src='${d.visibleUrl}';document.querySelectorAll('.sat-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Visible</button>
            <button class="sat-btn" onclick="document.getElementById('sat-img').src='${d.infraredUrl}';document.querySelectorAll('.sat-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Infrared</button>
            <button class="sat-btn" onclick="document.getElementById('sat-img').src='${d.waterVaporUrl}';document.querySelectorAll('.sat-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Water Vapor</button>
            <a href="${d.loopUrl}" target="_blank" rel="noopener" class="sat-btn">Loop →</a>
          </div>
          <div class="timestamp">${escHtml(d.satellite)} — ${escHtml(d.sector)}</div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = `<p class="error-text">Satellite imagery unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── Wildfires ─────────────────────────────────────────────────────────
  async function loadWildfires() {
    const el = document.getElementById('wildfires-body');
    try {
      const d = await api('/wildfires');
      if (!d.fires || !d.fires.length) {
        el.innerHTML = '<p class="no-alerts">✓ No active wildfires in the region</p>';
        return;
      }
      el.innerHTML = `<div class="fire-list">${d.fires.slice(0, 8).map(f => {
        const pct = f.contained ?? 0;
        const cls = pct >= 75 ? 'high' : pct >= 25 ? 'medium' : 'low';
        return `
          <div class="fire-item">
            <div class="fire-name">${escHtml(f.name || 'Unnamed Fire')}</div>
            <div class="fire-meta">${f.acres ? Math.round(f.acres).toLocaleString() + ' acres' : '—'} · ${f.state || '—'}</div>
            <span class="fire-contained ${cls}">${pct}% contained</span>
          </div>`;
      }).join('')}</div>
      <a href="${d.nifcUrl || 'https://data-nifc.opendata.arcgis.com/'}" target="_blank" rel="noopener" class="ext-link">NIFC Fire Map →</a>`;

      // Map overlay: wildfire markers
      if (firesLayer) {
        firesLayer.clearLayers();
        d.fires.forEach(f => {
          if (f.lat == null || f.lon == null) return;
          const icon = L.divIcon({ className: 'map-marker-fire', iconSize: [10, 10], iconAnchor: [5, 5] });
          L.marker([f.lat, f.lon], { icon })
            .bindPopup(`<div class="popup-title">${escHtml(f.name || 'Unnamed Fire')}</div><div class="popup-val">${f.acres ? Math.round(f.acres).toLocaleString() + ' acres' : '—'}</div><div class="popup-dim">${(f.contained ?? 0)}% contained · ${f.state || '—'}</div>`)
            .addTo(firesLayer);
        });
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">Wildfire data unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── River Forecasts ───────────────────────────────────────────────────
  async function loadRiverForecast() {
    const el = document.getElementById('riverforecast-body');
    try {
      const gauges = await api('/riverforecast');
      el.innerHTML = `<div class="river-list">${gauges.map(g => {
        if (g.error) {
          return `<div class="river-item"><span class="river-name">${escHtml(g.name)}</span><p class="info-text">${escHtml(g.error)}</p></div>`;
        }
        const inFlood = g.floodStage && g.latestObserved && g.latestObserved.value >= g.floodStage;
        return `
          <div class="river-item ${inFlood ? 'river-flood-danger' : ''}">
            <div class="river-header">
              <span class="river-name">${escHtml(g.name)}</span>
              <span class="river-stage">${g.latestObserved ? g.latestObserved.value + ' ft' : '—'}</span>
            </div>
            ${g.floodStage ? `<div class="river-flood-marker">Flood stage: ${g.floodStage} ft</div>` : ''}
            ${g.forecast && g.forecast.length ? `<div class="river-flood-marker">Forecast: ${g.forecast.map(f => f.value + ' ft').join(' → ')}</div>` : ''}
          </div>`;
      }).join('')}</div>`;
    } catch (e) {
      el.innerHTML = `<p class="error-text">River forecast unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── TCEQ Emissions ────────────────────────────────────────────────────
  async function loadEmissions() {
    const el = document.getElementById('emissions-body');
    try {
      const d = await api('/emissions');
      if (d.url) {
        el.innerHTML = `
          <div class="emissions-info">
            <p class="info-text">${escHtml(d.note || 'TCEQ Emissions Event Reports')}</p>
            <a href="${d.url}" target="_blank" rel="noopener" class="ext-link">TCEQ Emissions Events →</a>
          </div>`;
      } else {
        el.innerHTML = `<p class="info-text">${escHtml(JSON.stringify(d).substring(0, 300))}</p>
          <a href="https://www2.tceq.texas.gov/oce/eer/" target="_blank" rel="noopener" class="ext-link">TCEQ Emissions Events →</a>`;
      }
    } catch (e) {
      el.innerHTML = `<p class="error-text">Emissions data unavailable: ${escHtml(e.message)}</p>
        <a href="https://www2.tceq.texas.gov/oce/eer/" target="_blank" rel="noopener" class="ext-link">TCEQ Emissions Events →</a>`;
    }
  }

  // ── Sun & Moon ────────────────────────────────────────────────────────
  async function loadSun() {
    const el = document.getElementById('sun-body');
    try {
      const d = await api('/sun');
      const phaseEmoji = (d.moonPhase || '').toLowerCase().includes('new') ? '🌑'
        : (d.moonPhase || '').toLowerCase().includes('full') ? '🌕'
        : (d.moonPhase || '').toLowerCase().includes('first') ? '🌓'
        : (d.moonPhase || '').toLowerCase().includes('last') || (d.moonPhase || '').toLowerCase().includes('third') ? '🌗'
        : (d.moonPhase || '').toLowerCase().includes('waxing crescent') ? '🌒'
        : (d.moonPhase || '').toLowerCase().includes('waxing gibbous') ? '🌔'
        : (d.moonPhase || '').toLowerCase().includes('waning gibbous') ? '🌖'
        : (d.moonPhase || '').toLowerCase().includes('waning crescent') ? '🌘'
        : '🌙';

      el.innerHTML = `
        <div class="sun-grid">
          <div class="sun-item"><div class="emoji">🌅</div><div class="time-val">${escHtml(d.sunrise || '—')}</div><div class="label">Sunrise</div></div>
          <div class="sun-item"><div class="emoji">🌇</div><div class="time-val">${escHtml(d.sunset || '—')}</div><div class="label">Sunset</div></div>
          ${d.moonPhase ? `<div class="moon-phase"><div class="emoji">${phaseEmoji}</div><div class="phase-name">${escHtml(d.moonPhase)}</div></div>` : ''}
        </div>
      `;

      // Status strip: SUN
      if (d.sunset) setStrip('sv-sun', '↓' + d.sunset);
    } catch (e) {
      el.innerHTML = `<p class="error-text">Sun/Moon data unavailable: ${escHtml(e.message)}</p>`;
    }
  }

  // ── Initialization & Refresh ────────────────────────────────────────────
  initMap();

  function loadAll() {
    loadWeather();
    loadForecast();
    loadRadar();
    loadAlerts();
    loadAdsb();
    loadAirports();
    loadGauges();
    loadFloods();
    loadAqi();
    loadErcot();
    loadSpc();
    loadTropical();
    loadEarthquakes();
    loadSpaceWeather();
    loadHfProp();
    loadSatellite();
    loadWildfires();
    loadRiverForecast();
    loadEmissions();
    loadSun();
  }

  loadAll();

  // Auto-refresh intervals
  setInterval(loadWeather, 2 * 60 * 1000);
  setInterval(loadForecast, 10 * 60 * 1000);
  setInterval(loadRadar, 2 * 60 * 1000);
  setInterval(loadAlerts, 60 * 1000);
  setInterval(loadAdsb, 15 * 1000);
  setInterval(loadAirports, 2 * 60 * 1000);
  setInterval(loadGauges, 5 * 60 * 1000);
  setInterval(loadFloods, 2 * 60 * 1000);
  setInterval(loadAqi, 10 * 60 * 1000);
  setInterval(loadErcot, 5 * 60 * 1000);
  setInterval(loadSpc, 10 * 60 * 1000);
  setInterval(loadTropical, 10 * 60 * 1000);
  setInterval(loadEarthquakes, 5 * 60 * 1000);
  setInterval(loadSpaceWeather, 5 * 60 * 1000);
  setInterval(loadHfProp, 5 * 60 * 1000);
  setInterval(loadSatellite, 5 * 60 * 1000);
  setInterval(loadWildfires, 10 * 60 * 1000);
  setInterval(loadRiverForecast, 10 * 60 * 1000);
  setInterval(loadEmissions, 10 * 60 * 1000);
  setInterval(loadSun, 60 * 60 * 1000);

})();
