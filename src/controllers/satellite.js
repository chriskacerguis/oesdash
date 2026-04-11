const { cached } = require('../cache');

const list = cached('goes_satellite', 300_000, async () => {
  return {
    visibleUrl: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/sp/GEOCOLOR/latest.jpg',
    infraredUrl: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/sp/13/latest.jpg',
    waterVaporUrl: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/sp/09/latest.jpg',
    loopUrl: 'https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G16&sector=sp&band=GEOCOLOR&length=24',
    sector: 'Southern Plains',
    satellite: 'GOES-16',
  };
});

module.exports = { list };
