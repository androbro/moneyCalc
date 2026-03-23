import { useState, useRef } from 'react'

/**
 * Supports multiple KBC / bank export formats:
 *
 * Format A — semicolon + comma-decimal (classic KBC):
 *   vervaldatum;kapitaalaflossing;intrest;te betalen;kapitaalsaldo
 *   01/05/2022;782,90;373,33;1156,23;229217,10
 *
 * Format B — tab + dot-decimal (newer KBC / Excel export):
 *   vervaldatum\tkapitaalaflossing\tinterest\tte betalen\tkapitaalsaldo
 *   17-02-2022\t644.89\t258.98\t903.87\t229355.11
 *
 * Date formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD all accepted.
 */

// Parse date in any of the supported formats → ISO "YYYY-MM-DD"
function parseBelgianDate(str) {
  const clean = str.trim()
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, dd, mm, yyyy] = dmy
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // YYYY-MM-DD already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  return clean // pass through unknown formats
}

/**
 * Smart number parser — detects decimal format from the string itself.
 *
 * Rules:
 *  - If string ends with ",XX" (2 digits after comma)  → comma is decimal  e.g. "1.234,56"
 *  - If string ends with ".XX" (2 digits after dot)    → dot is decimal    e.g. "1234.56" or "644.89"
 *  - If only dots present and not at end               → thousands dots    e.g. "229.355"  (integer)
 *  - Comma + dot both present: last one is decimal separator
 */
function parseEuroNumber(str) {
  if (!str) return 0
  let s = str.trim().replace(/\s/g, '').replace(/['"]/g, '')
  if (!s) return 0

  const lastComma = s.lastIndexOf(',')
  const lastDot   = s.lastIndexOf('.')

  if (lastComma > lastDot) {
    // Comma is decimal separator  →  remove dots (thousands), replace comma with dot
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // Dot is decimal separator  →  remove commas (thousands)
    s = s.replace(/,/g, '')
  } else {
    // No separator at all — plain integer
    s = s.replace(/[,\.]/g, '')
  }

  return parseFloat(s) || 0
}

// Detect column separator: tab wins over semicolon wins over comma
function detectSeparator(header) {
  if (header.includes('\t')) return '\t'
  if (header.includes(';')) return ';'
  if (header.includes(',')) return ','
  return '\t' // fallback
}

/**
 * Parse raw CSV text into an array of AmortizationEntry objects.
 * Tolerant of common variations in KBC exports.
 */
function parseKBCCSV(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row.')

  const sep = detectSeparator(lines[0])
  const headers = lines[0].split(sep).map((h) =>
    h.trim().toLowerCase().replace(/['"]/g, '')
  )

  // Column mapping — flexible matching
  const COL = {
    dueDate:         findCol(headers, ['vervaldatum', 'date', 'datum']),
    capital:         findCol(headers, ['kapitaalaflossing', 'capital', 'kapitaal']),
    interest:        findCol(headers, ['intrest', 'interest', 'rente']),
    total:           findCol(headers, ['te betalen', 'totaal', 'payment', 'te_betalen']),
    balance:         findCol(headers, ['kapitaalsaldo', 'saldo', 'balance', 'remaining']),
  }

  const missing = Object.entries(COL)
    .filter(([, v]) => v === -1)
    .map(([k]) => k)

  if (missing.length > 0) {
    throw new Error(
      `Could not find required columns: ${missing.join(', ')}.\n` +
      `Found headers: ${headers.join(', ')}`
    )
  }

  const entries = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''))
    if (cols.length < 2) continue // skip blank rows

    entries.push({
      period: i,
      dueDate:         parseBelgianDate(cols[COL.dueDate] || ''),
      capitalRepayment: parseEuroNumber(cols[COL.capital]),
      interest:        parseEuroNumber(cols[COL.interest]),
      totalPayment:    parseEuroNumber(cols[COL.total]),
      remainingBalance: parseEuroNumber(cols[COL.balance]),
    })
  }

  if (entries.length === 0) throw new Error('No data rows found after the header.')
  return entries
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h.includes(c))
    if (idx !== -1) return idx
  }
  return -1
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CSVImporter({ onImport }) {
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)   // first 5 parsed rows
  const [error, setError] = useState(null)
  const [parsed, setParsed] = useState(null)
  const fileRef = useRef(null)

  const processFile = (file) => {
    setError(null)
    setPreview(null)
    setParsed(null)

    if (!file) return
    const name = file.name.toLowerCase()
    const allowed = name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')
    if (!allowed) {
      setError('Please upload a .csv, .tsv, or .txt file.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const rows = parseKBCCSV(text)
        setParsed(rows)
        setPreview(rows.slice(0, 5))
      } catch (err) {
        setError(err.message)
      }
    }
    reader.onerror = () => setError('Could not read file.')
    reader.readAsText(file, 'UTF-8')
  }

  const handleFile = (e) => processFile(e.target.files?.[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files?.[0])
  }

  const handleConfirm = () => {
    if (parsed) onImport(parsed)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                    ${dragging
                      ? 'border-brand-400 bg-sky-50 shadow-neo'
                      : 'border-neo-border hover:border-brand-500 bg-neo-bg shadow-neo-inset-sm'}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values"
          className="hidden"
          onChange={handleFile}
        />
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-neo-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-neo-muted">
            {dragging ? 'Drop the file here' : 'Drop your KBC export here, or click to browse'}
          </p>
          <p className="text-xs text-neo-subtle">
            .csv · .txt · .tsv — semicolon or tab separated, comma or dot decimals
          </p>
          <p className="text-xs text-neo-subtle">
            Columns: vervaldatum · kapitaalaflossing · interest · te betalen · kapitaalsaldo
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200/80 rounded-2xl px-4 py-3 text-sm text-red-800 whitespace-pre-wrap shadow-neo-inset-sm">
          {error}
        </div>
      )}

      {/* Preview table */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neo-muted">
              Preview — {parsed.length} rows parsed
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neo-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neo-sunken">
                  <th className="px-3 py-2 text-left text-xs font-medium text-neo-muted">Period</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-neo-muted">Due Date</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neo-muted">Capital</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neo-muted">Interest</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neo-muted">Total</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neo-muted">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neo-border/50">
                {preview.map((row) => (
                  <tr key={row.period} className="bg-neo-raised hover:bg-neo-sunken/55">
                    <td className="px-3 py-2 text-neo-muted">{row.period}</td>
                    <td className="px-3 py-2 text-neo-text/95">{row.dueDate}</td>
                    <td className="px-3 py-2 text-right text-neo-text/95">
                      {row.capitalRepayment.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-neo-text/95">
                      {row.interest.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-neo-text/95">
                      {row.totalPayment.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-neo-text">
                      {row.remainingBalance.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 5 && (
              <p className="px-3 py-2 text-xs text-neo-subtle text-center bg-neo-raised border-t border-neo-border">
                ... and {parsed.length - 5} more rows
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
              Use This Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
