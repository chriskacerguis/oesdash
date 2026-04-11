const axios = require('axios');
const { cached } = require('../cache');

const list = cached('ercot_grid', 300_000, async () => {
  try {
    const { data } = await axios.get(
      'https://www.ercot.com/api/1/services/read/dashboards/todays-outlook.json',
      { timeout: 10000, headers: { Accept: 'application/json' } }
    );
    return {
      currentDemand: data.currentCondition?.demand,
      capacity: data.currentCondition?.capacity,
      operatingReserves: data.currentCondition?.operatingReserves,
      status: data.currentCondition?.epiStatus || 'Normal',
      lastUpdated: data.currentCondition?.lastUpdated,
    };
  } catch {
    return {
      status: 'Normal',
      dashboardUrl: 'https://www.ercot.com/gridmktinfo/dashboards',
      error: { message: 'ERCOT data may be unavailable — check https://www.ercot.com/gridmktinfo/dashboards' },
    };
  }
});

module.exports = { list };
