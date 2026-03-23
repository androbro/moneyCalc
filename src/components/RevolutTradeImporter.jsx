import { useState, useRef } from 'react'

/**
 * Revolut Trading CSV parser + upload UI.
 *
 * Expected columns (comma-separated):
 *   Date, Ticker, Type, Quantity, Price per share, Total Amount, Currency, FX Rate
 *
 * Notes:
 *  - "Date" is an ISO 8601 timestamp: "2025-04-09T20:41:54.010769Z"
 *  - "Total Amount" is prefixed with the currency code: "EUR 525" or "USD 207.76"
 *  - "Price per share" is similarly prefixed: "EUR 75"
 *  - Quantity uses comma as decimal separator (European): "2,33290563"
 *  - Columns may be empty for CASH TOP-UP rows
 */

// ─── Parsers ──────────────────────────────────────────────────────────────────

/** Strip an optional currency prefix ("EUR 525.00" → 525, "USD 207.76" → 207.76). */
function parseCurrencyAmount(str) {
  if (!str) return null
  // Remove currency code prefix and any non-numeric chars except dot/comma/minus
  const cleaned = str.trim().replace(/^[A-Z]{3}\s*/i, '')
  return parseFloat(cleaned.replace(',', '.')) || null
}

/** Parse European-style decimal number: "2,33290563" → 2.33290563 */
function parseEuropeanNumber(str) {
  if (!str || !str.trim()) return null
  const s = str.trim()
  // If both comma and dot present, the last one is the decimal separator
  const lastComma = s.lastIndexOf(',')
  const lastDot   = s.lastIndexOf('.')
  let normalized
  if (lastComma > lastDot) {
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = s.replace(/,/g, '')
  }
  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

function detectSep(headerLine) {
  if (headerLine.includes('\t')) return '\t'
  if (headerLine.includes(';')) return ';'
  return ','
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h.includes(c))
    if (idx !== -1) return idx
  }
  return -1
}

/**
 * Parse raw Revolut trading CSV text into an array of trade objects.
 */
function parseRevolutTradingCSV(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row.')

  const sep = detectSep(lines[0])
  const rawHeaders = lines[0].split(sep).map((h) =>
    h.trim().toLowerCase().replace(/['"]/g, '')
  )

  const COL = {
    date:     findCol(rawHeaders, ['date']),
    ticker:   findCol(rawHeaders, ['ticker']),
    type:     findCol(rawHeaders, ['type']),
    quantity: findCol(rawHeaders, ['quantity']),
    price:    findCol(rawHeaders, ['price per share', 'price']),
    total:    findCol(rawHeaders, ['total amount', 'total']),
    currency: findCol(rawHeaders, ['currency']),
    fxRate:   findCol(rawHeaders, ['fx rate', 'fxrate', 'fx']),
  }

  const missing = ['date', 'type', 'total', 'currency']
    .filter((k) => COL[k] === -1)
  if (missing.length > 0) {
    throw new Error(
      `Could not find required columns: ${missing.join(', ')}.\n` +
      `Found headers: ${rawHeaders.join(', ')}`
    )
  }

  const trades = []
  for (let i = 1; i < lines.length; i++) {
    // Split, respecting quoted fields
    const cols = splitCsvLine(lines[i], sep)
    if (cols.length < 3) continue

    const get = (idx) => (idx >= 0 ? (cols[idx] ?? '').trim().replace(/^["']|["']$/g, '') : '')

    const dateStr     = get(COL.date)
    const type        = get(COL.type)
    const totalRaw    = get(COL.total)
    const currency    = get(COL.currency) || 'EUR'
    const tickerRaw   = get(COL.ticker)
    const quantityRaw = get(COL.quantity)
    const priceRaw    = get(COL.price)
    const fxRaw       = get(COL.fxRate)

    if (!dateStr || !type || !totalRaw) continue

    // Parse ISO timestamp — already UTC
    const tradedAt = new Date(dateStr).toISOString()
    if (isNaN(new Date(dateStr))) continue

    const totalAmount   = Math.abs(parseCurrencyAmount(totalRaw) ?? 0)
    const pricePerShare = parseCurrencyAmount(priceRaw)
    const quantity      = parseEuropeanNumber(quantityRaw)
    const fxRate        = parseEuropeanNumber(fxRaw) ?? 1
    const ticker        = tickerRaw || null

    trades.push({
      tradedAt,
      ticker,
      type,
      quantity,
      pricePerShare,
      totalAmount,
      currency,
      fxRate,
    })
  }

  if (trades.length === 0) throw new Error('No valid data rows found after the header.')
  return trades
}

/** Minimal CSV line splitter that handles quoted fields. */
function splitCsvLine(line, sep) {
  if (sep !== ',') return line.split(sep)
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ─── Component ────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  'CASH TOP-UP':   { label: 'Top-up',    color: 'text-brand-400' },
  'BUY - MARKET':  { label: 'Buy',       color: 'text-emerald-400' },
  'BUY - LIMIT':   { label: 'Buy Limit', color: 'text-emerald-400' },
  'SELL - MARKET': { label: 'Sell',      color: 'text-red-400' },
  'SELL - LIMIT':  { label: 'Sell Limit',color: 'text-red-400' },
  'DIVIDEND':      { label: 'Dividend',  color: 'text-amber-400' },
}

function typeStyle(type) {
  return TYPE_LABELS[type] ?? { label: type, color: 'text-neo-muted' }
}

export default function RevolutTradeImporter({ onImport }) {
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview]   = useState(null)   // first 8 parsed rows
  const [parsed, setParsed]     = useState(null)
  const [error, setError]       = useState(null)
  const fileRef = useRef(null)

  const processFile = (file) => {
    setError(null)
    setPreview(null)
    setParsed(null)

    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.txt') && !name.endsWith('.tsv')) {
      setError('Please upload a .csv, .tsv, or .txt file.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const rows = parseRevolutTradingCSV(e.target.result)
        setParsed(rows)
        setPreview(rows.slice(0, 8))
      } catch (err) {
        setError(err.message)
      }
    }
    reader.onerror = () => setError('Could not read file.')
    reader.readAsText(file, 'UTF-8')
  }

  const handleFile = (e) => processFile(e.target.files?.[0])
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files?.[0]) }
  const handleConfirm = () => { if (parsed) onImport(parsed) }

  const fmtAmt = (amount, currency) =>
    new Intl.NumberFormat('nl-BE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ' + currency

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('nl-BE', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    } catch { return iso }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${dragging
            ? 'border-brand-400 bg-sky-50 shadow-neo'
            : 'border-neo-border hover:border-brand-500 bg-neo-bg shadow-neo-inset-sm'}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          className="hidden"
          onChange={handleFile}
        />
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-neo-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-neo-muted font-medium">
            {dragging ? 'Drop the Revolut export here' : 'Drop your Revolut Trading CSV here, or click to browse'}
          </p>
          <p className="text-xs text-neo-subtle">
            .csv — Revolut trading account export (comma-separated)
          </p>
          <p className="text-xs text-neo-subtle">
            Columns: Date · Ticker · Type · Quantity · Price per share · Total Amount · Currency · FX Rate
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200/80 rounded-2xl px-4 py-3 text-sm text-red-800 whitespace-pre-wrap shadow-neo-inset-sm">
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && parsed && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neo-muted">
              Preview — <span className="text-neo-text">{parsed.length}</span> rows parsed
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neo-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neo-sunken">
                  <th className="px-3 py-2 text-left text-xs font-medium text-neo-muted">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-neo-muted">Ticker</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-neo-muted">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neo-muted">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neo-muted">Price/share</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neo-muted">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neo-border/50">
                {preview.map((row, i) => {
                  const ts = typeStyle(row.type)
                  return (
                    <tr key={i} className="bg-neo-raised hover:bg-neo-sunken/55">
                      <td className="px-3 py-2 text-neo-muted whitespace-nowrap">{fmtDate(row.tradedAt)}</td>
                      <td className="px-3 py-2 font-medium text-neo-text">{row.ticker ?? '—'}</td>
                      <td className={`px-3 py-2 font-medium ${ts.color}`}>{ts.label}</td>
                      <td className="px-3 py-2 text-right text-neo-muted">
                        {row.quantity != null
                          ? row.quantity.toLocaleString('nl-BE', { maximumFractionDigits: 8 })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-neo-muted">
                        {row.pricePerShare != null
                          ? fmtAmt(row.pricePerShare, row.currency)
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-neo-text whitespace-nowrap">
                        {fmtAmt(row.totalAmount, row.currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {parsed.length > 8 && (
              <p className="px-3 py-2 text-xs text-neo-subtle text-center bg-neo-raised border-t border-neo-border">
                … and {parsed.length - 8} more rows
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setParsed(null); setPreview(null) }}
              className="btn-secondary text-sm"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="btn-primary text-sm"
            >
              Import {parsed.length} rows
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
