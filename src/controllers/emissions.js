const axios = require('axios');
const { cached } = require('../cache');

const list = cached('tceq_emissions', 600_000, async () => {
  try {
    const { data } = await axios.get(
      'https://www2.tceq.texas.gov/oce/eer/index.cfm?fuession=main.getDetails&target=198&format=json',
      { timeout: 10000 }
    );
    if (typeof data === 'object') return data;
  } catch { /* fallback below */ }
  return {
    url: 'https://www2.tceq.texas.gov/oce/eer/',
    rssUrl: 'https://www2.tceq.texas.gov/oce/eer/index.cfm?fuession=main.rssAll',
    error: { message: 'TCEQ emissions events — check website for latest' },
  };
});

module.exports = { list };
