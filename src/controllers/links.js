function list(_req, res) {
  res.json([
    { name: 'TFS Fire Maps', url: 'https://texasforestservice.tamu.edu/wildfires/', description: 'Texas A&M Forest Service wildfire perimeter maps' },
    { name: 'TCEQ Fire/Burn Maps', url: 'https://www.tceq.texas.gov/airquality/monops/prescribed-burns', description: 'TCEQ prescribed burn notifications' },
    { name: 'TxDOT DriveTexas', url: 'https://drivetexas.org/', description: 'Road conditions and closures' },
    { name: 'Travis County OEM GIS', url: 'https://www.traviscountytx.gov/emergency-services', description: 'Travis County Emergency Management GIS feeds' },
    { name: 'ATXFloods.com', url: 'https://www.atxfloods.com', description: 'Low-water crossing status' },
    { name: 'ERCOT Dashboard', url: 'https://www.ercot.com/gridmktinfo/dashboards', description: 'ERCOT grid conditions dashboard' },
    { name: 'NWS Austin Radar', url: 'https://radar.weather.gov/station/KEWX/standard', description: 'NWS radar for Austin/San Antonio' },
    { name: 'AirNow', url: 'https://www.airnow.gov/?city=Austin&state=TX', description: 'Air quality monitoring' },
    { name: 'APRS.fi Austin', url: 'https://aprs.fi/#!lat=30.2672&lng=-97.7431&z=10', description: 'APRS station tracking map' },
    { name: 'PulsePoint', url: 'https://web.pulsepoint.org/', description: 'Real-time fire/EMS dispatch' },
    { name: 'CapMetro Alerts', url: 'https://www.capmetro.org/alerts', description: 'Austin public transit service alerts' },
    { name: 'CDC Wastewater Data', url: 'https://www.cdc.gov/nwss/wastewater-surveillance.html', description: 'Pathogen wastewater surveillance' },
  ]);
}

module.exports = { list };
