import { useState, useRef } from 'react'

/**
 * Expected KBC CSV format (semicolon-separated):
 *
 * vervaldatum;kapitaalaflossing;intrest;te betalen;kapitaalsaldo
 * 01/05/2022;782,90;373,33;1156,23;229217,10
 *
 * - Decimal separator: comma (,)
 * - Date format: DD/MM/YYYY
 * - Encoding: UTF-8 or windows-1252
 */

// Parse "01/05/2022" → "2022-05-01"
function parseBelgianDate(str) {
  const clean = str.trim()
  // Support DD/MM/YYYY and DD-MM-YYYY
  const m = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (!m) return clean // fallback — pass through
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

// "1.234,56" or "1234,56" or "1234.56" → number
function parseEuroNumber(str) {
  if (!str) return 0
  const clean = str.trim()
    .replace(/\./g, '')   // remove thousands dots
    .replace(',', '.')    // decimal comma → dot
  return parseFloat(clean) || 0
}

function detectSeparator(header) {
  if (header.includes(';')) return ';'
  if (header.includes(',')) return ','
  return ';'
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
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please upload a .csv file.')
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
                      ? 'border-brand-400 bg-brand-900/20'
                      : 'border-slate-600 hover:border-brand-500 bg-slate-700/30'}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-slate-300">
            {dragging ? 'Drop the file here' : 'Drop your KBC CSV here, or click to browse'}
          </p>
          <p className="text-xs text-slate-500">
            Expected columns: vervaldatum · kapitaalaflossing · intrest · te betalen · kapitaalsaldo
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Preview table */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">
              Preview — {parsed.length} rows parsed
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700">
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Period</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Due Date</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Capital</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Interest</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Total</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {preview.map((row) => (
                  <tr key={row.period} className="bg-slate-800 hover:bg-slate-700/50">
                    <td className="px-3 py-2 text-slate-400">{row.period}</td>
                    <td className="px-3 py-2 text-slate-200">{row.dueDate}</td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {row.capitalRepayment.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {row.interest.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {row.totalPayment.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-white">
                      {row.remainingBalance.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 5 && (
              <p className="px-3 py-2 text-xs text-slate-500 text-center bg-slate-800 border-t border-slate-700">
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
