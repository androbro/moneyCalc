/**
 * yahooFinance.js
 *
 * Thin wrapper around Yahoo Finance public endpoints.
 * No API key required. Uses a CORS proxy for browser requests.
 *
 * Ticker resolution strategy for Revolut XETRA tickers:
 *   1. Try <TICKER>.DE  (XETRA / Frankfurt)
 *   2. Try <TICKER>     (US exchanges, already-qualified tickers)
 *   3. Return null if both fail
 *
 * All fetches are cached in module-level Maps with a TTL so rapid
 * re-renders don't hammer the API.
 */

// ─── CORS proxy ───────────────────────────────────────────────────────────────
// Yahoo Finance blocks direct browser requests with CORS headers,
// so we route through a lightweight public proxy.
const PROXY = 'https://corsproxy.io/?url='

function proxyUrl(url) {
  return PROXY + encodeURIComponent(url)
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const QUOTE_TTL    = 5  * 60 * 1000   // 5 min
const CHART_TTL    = 10 * 60 * 1000   // 10 min
const NEWS_TTL     = 15 * 60 * 1000   // 15 min
const RESOLVE_TTL  = 60 * 60 * 1000   // 1 hr

const quoteCache   = new Map()
const chartCache   = new Map()
const newsCache    = new Map()
const resolveCache = new Map()

function getCached(cache, key, ttl) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < ttl) return entry.data
  return null
}

function setCache(cache, key, data) {
  cache.set(key, { data, ts: Date.now() })
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function yFetch(url) {
  const res = await fetch(proxyUrl(url), {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ─── Ticker resolution ────────────────────────────────────────────────────────

/**
 * Given a bare Revolut ticker (e.g. "EXI2"), resolve it to the Yahoo Finance
 * symbol that actually returns data (e.g. "EXI2.DE").
 *
 * Returns the resolved symbol string, or null if not found.
 */
export async function resolveSymbol(ticker) {
  const cached = getCached(resolveCache, ticker, RESOLVE_TTL)
  if (cached !== null) return cached

  const candidates = [
    `${ticker}.DE`,   // XETRA (most Revolut EU tickers)
    ticker,           // US / already qualified
    `${ticker}.L`,    // London Stock Exchange
    `${ticker}.PA`,   // Euronext Paris
  ]

  for (const sym of candidates) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`
      const data = await yFetch(url)
      if (data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
        setCache(resolveCache, ticker, sym)
        return sym
      }
    } catch {
      // try next candidate
    }
  }

  setCache(resolveCache, ticker, null)
  return null
}

// ─── Quote ────────────────────────────────────────────────────────────────────

/**
 * Fetch current market data for a Yahoo Finance symbol.
 *
 * Returns:
 * {
 *   symbol, shortName, longName,
 *   price, prevClose, change, changePct,
 *   dayHigh, dayLow, volume,
 *   fiftyTwoWeekHigh, fiftyTwoWeekLow,
 *   currency, exchange, type,
 *   marketState,  // "REGULAR" | "PRE" | "POST" | "CLOSED"
 * }
 */
export async function getQuote(symbol) {
  const cached = getCached(quoteCache, symbol, QUOTE_TTL)
  if (cached) return cached

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
  const data = await yFetch(url)
  const meta = data?.chart?.result?.[0]?.meta
  if (!meta) throw new Error(`No quote data for ${symbol}`)

  const quote = {
    symbol:            meta.symbol,
    shortName:         meta.shortName ?? meta.symbol,
    longName:          meta.longName  ?? meta.shortName ?? meta.symbol,
    price:             meta.regularMarketPrice,
    prevClose:         meta.chartPreviousClose,
    change:            meta.regularMarketPrice - meta.chartPreviousClose,
    changePct:         ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
    dayHigh:           meta.regularMarketDayHigh,
    dayLow:            meta.regularMarketDayLow,
    volume:            meta.regularMarketVolume,
    fiftyTwoWeekHigh:  meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow:   meta.fiftyTwoWeekLow,
    currency:          meta.currency ?? 'EUR',
    exchange:          meta.fullExchangeName ?? meta.exchangeName,
    type:              meta.instrumentType,
    marketState:       meta.regularMarketTime ? 'REGULAR' : 'CLOSED',
  }

  setCache(quoteCache, symbol, quote)
  return quote
}

// ─── Historical chart ─────────────────────────────────────────────────────────

/**
 * Fetch OHLC chart data for a symbol.
 * range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'ytd' | 'max'
 * interval: '1m'|'5m'|'15m'|'30m'|'60m'|'1d'|'1wk'|'1mo'
 *
 * Returns array of { date, open, high, low, close, volume }
 */
export async function getChart(symbol, range = '1y', interval = '1d') {
  const key = `${symbol}:${range}:${interval}`
  const cached = getCached(chartCache, key, CHART_TTL)
  if (cached) return cached

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`
  const data = await yFetch(url)
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error(`No chart data for ${symbol}`)

  const { timestamp, indicators } = result
  const { open, high, low, close, volume } = indicators.quote[0]

  const rows = (timestamp || [])
    .map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString(),
      open:   open?.[i]   ?? null,
      high:   high?.[i]   ?? null,
      low:    low?.[i]    ?? null,
      close:  close?.[i]  ?? null,
      volume: volume?.[i] ?? null,
    }))
    .filter((r) => r.close !== null)

  setCache(chartCache, key, rows)
  return rows
}

// ─── News ─────────────────────────────────────────────────────────────────────

/**
 * Fetch recent news headlines for a ticker via Yahoo Finance search.
 * Returns array of { title, publisher, link, providerPublishTime, thumbnail }
 */
export async function getNews(ticker, count = 6) {
  const cached = getCached(newsCache, ticker, NEWS_TTL)
  if (cached) return cached

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&lang=en-US&region=US&newsCount=${count}&quotesCount=0`
  const data = await yFetch(url)
  const items = (data?.news ?? []).slice(0, count).map((n) => ({
    title:                n.title,
    publisher:            n.publisher,
    link:                 n.link,
    providerPublishTime:  n.providerPublishTime,
    thumbnail:            n.thumbnail?.resolutions?.[0]?.url ?? null,
  }))

  setCache(newsCache, ticker, items)
  return items
}

// ─── Bulk quote refresh ───────────────────────────────────────────────────────

/**
 * Resolve + fetch quotes for multiple tickers in parallel.
 * Returns Map<ticker, { symbol, quote } | { symbol: null, error }>
 */
export async function bulkQuote(tickers) {
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const symbol = await resolveSymbol(ticker)
      if (!symbol) return { ticker, symbol: null, quote: null }
      const quote  = await getQuote(symbol)
      return { ticker, symbol, quote }
    })
  )

  const map = new Map()
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      map.set(tickers[i], r.value)
    } else {
      map.set(tickers[i], { ticker: tickers[i], symbol: null, quote: null, error: r.reason?.message })
    }
  })
  return map
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Invalidate all caches (called after CSV import to refresh prices) */
export function invalidateCache() {
  quoteCache.clear()
  chartCache.clear()
  newsCache.clear()
  // Do NOT clear resolveCache — symbols don't change
}
