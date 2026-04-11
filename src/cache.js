const logger = require('./logger');

const cache = {};
const breakers = {};

const STALE_TTL_MULTIPLIER = 5; // serve stale for up to 5× TTL, then discard
const FAILURE_THRESHOLD = 3;    // open circuit after 3 consecutive failures
const COOLDOWN_MS = 30_000;     // wait 30s before retrying after circuit opens
const RETRY_COUNT = 1;          // retry once on transient failure before giving up
const RETRY_DELAY_MS = 500;     // wait between retries

function getBreaker(key) {
  if (!breakers[key]) {
    breakers[key] = { failures: 0, openedAt: null };
  }
  return breakers[key];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(fetcher, retries) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetcher();
    } catch (err) {
      lastErr = err;
      if (i < retries) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

function cached(key, ttlMs, fetcher) {
  return async (_req, res) => {
    const now = Date.now();

    // Serve fresh cache
    if (cache[key] && now - cache[key].ts < ttlMs) {
      return res.json(cache[key].data);
    }

    const breaker = getBreaker(key);

    // Circuit is open — skip upstream, serve stale or error
    if (breaker.openedAt && now - breaker.openedAt < COOLDOWN_MS) {
      logger.warn({ key, failures: breaker.failures }, 'Circuit open — skipping upstream');
      if (cache[key]) return res.json(cache[key].data);
      return res.status(502).json({ error: { message: 'Circuit open — upstream unavailable' } });
    }

    try {
      const data = await fetchWithRetry(fetcher, RETRY_COUNT);
      cache[key] = { data, ts: now };
      breaker.failures = 0;
      breaker.openedAt = null;
      res.json(data);
    } catch (err) {
      breaker.failures += 1;
      logger.error({ key, err, failures: breaker.failures }, 'Upstream fetch failed');

      if (breaker.failures >= FAILURE_THRESHOLD) {
        breaker.openedAt = now;
        logger.warn({ key }, 'Circuit opened after repeated failures');
      }

      // Serve stale data only within the stale window
      const staleTtl = ttlMs * STALE_TTL_MULTIPLIER;
      if (cache[key] && now - cache[key].ts < staleTtl) {
        return res.json(cache[key].data);
      }

      // Stale data expired — discard it
      delete cache[key];
      res.status(502).json({ error: { message: err.message } });
    }
  };
}

module.exports = { cached, cache };
