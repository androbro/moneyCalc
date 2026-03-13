/**
 * Growth Roadmap Advice Engine
 *
 * Pure algorithmic advice — no AI. Runs sensitivity analysis by re-running
 * the growth simulation with small lever variations and computing how many
 * months each change saves for the first planned acquisition.
 *
 * @module growthAdvice
 */

import {
  simulateGrowthRoadmap,
  computeAvailableEquity,
  calcMonthlyPayment,
  calcBulletMonthlyPayment,
} from './growthRoadmap.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function runSim(properties, profile, config) {
  try {
    const result = simulateGrowthRoadmap(properties, profile, config)
    return result.summary.readyInMonths
  } catch {
    return null
  }
}

// ─── Advice generation ────────────────────────────────────────────────────────

/**
 * Generate ranked acceleration advice for the first planned acquisition.
 * Each item describes a concrete action and how many months it saves.
 *
 * @param {Array}  properties
 * @param {Object} profile          - { members, householdExpenses }
 * @param {Object} config           - Same config used for the base simulation
 * @param {number|null} baseReadyInMonths - From base simulation summary
 * @returns {AdviceItem[]} Sorted by impact (most months saved first)
 */
export function generateGrowthAdvice(properties, profile, config, baseReadyInMonths) {
  const advice = []
  const today = new Date().toISOString()
  const firstAcq = (config.plannedAcquisitions || [])[0]
  if (!firstAcq) return []

  const base = baseReadyInMonths ?? Infinity

  // ── 1. Equity release ──────────────────────────────────────────────────────
  const availableEquity = computeAvailableEquity(properties, today)
  if (availableEquity > 0) {
    // Simulate: add available equity to starting cash
    const equityConfig = {
      ...config,
      startingCash: (config.startingCash || 0) + availableEquity,
    }
    const newReady = runSim(properties, profile, equityConfig)
    const saved = newReady !== null ? Math.max(0, base - newReady) : 0

    advice.push({
      id: 'equity_release',
      category: 'equity',
      title: 'Release equity from existing properties',
      description:
        `You have ${fmt(availableEquity)} in available equity (based on 80% LTV). ` +
        `Using it via refinancing or a hypothecair mandaat covers part of your down payment.`,
      monthsSaved: saved,
      isImmediate: newReady === 0,
      monthlyImpact: 0,
      color: 'emerald',
      icon: '🏠',
    })
  }

  // ── 2. Extra monthly savings (+€200) ──────────────────────────────────────
  for (const [extra, label] of [[200, '+€200/mo'], [500, '+€500/mo']]) {
    const modProfile = {
      ...profile,
      householdExpenses: Math.max(0, (profile.householdExpenses || 0) - extra),
    }
    const newReady = runSim(properties, modProfile, config)
    const saved = newReady !== null ? Math.max(0, base - newReady) : 0
    if (saved > 0 || base === Infinity) {
      advice.push({
        id: `extra_savings_${extra}`,
        category: 'income',
        title: `Save ${label} more per month`,
        description:
          `By reducing monthly expenses or growing income by ${fmt(extra)}, ` +
          `you free up ${fmt(extra)} extra to save towards the down payment.`,
        monthsSaved: saved,
        isImmediate: newReady === 0,
        monthlyImpact: extra,
        color: 'brand',
        icon: '💰',
      })
    }
  }

  // ── 3. Bullet loan (if first acquisition is not already bullet) ────────────
  const isBulletAlready =
    firstAcq.loanType === 'bullet_loan' ||
    firstAcq.loanType === 'ipt_bullet' ||
    firstAcq.loanType === 'liquidatiereserve_bullet'

  if (!isBulletAlready && firstAcq.targetPrice) {
    const loanRate = firstAcq.loanRate ?? 0.035
    const myShare = firstAcq.myShare ?? 1.0
    const ltvForAcq = (firstAcq.isPrimaryResidence ? 0.90 : 0.80)
    const loanAmt = firstAcq.targetPrice * ltvForAcq * myShare
    const termMonths = (firstAcq.loanTermYears ?? 20) * 12

    const annuityPayment = calcMonthlyPayment(loanAmt, loanRate, termMonths)
    const bulletPayment = calcBulletMonthlyPayment(loanAmt, loanRate)
    const monthlySaving = Math.round(annuityPayment - bulletPayment)

    if (monthlySaving > 50) {
      // Simulate with bullet loan on first acquisition
      const bulletConfig = {
        ...config,
        plannedAcquisitions: config.plannedAcquisitions.map((a, i) =>
          i === 0 ? { ...a, loanType: 'bullet_loan' } : a
        ),
      }
      const newReady = runSim(properties, profile, bulletConfig)
      const saved = newReady !== null ? Math.max(0, base - newReady) : 0

      advice.push({
        id: 'bullet_loan',
        category: 'loan_structure',
        title: 'Switch to a bullet (interest-only) loan',
        description:
          `With a bullet loan, your monthly payment drops from ${fmt(annuityPayment)} to ${fmt(bulletPayment)} ` +
          `— freeing up ${fmt(monthlySaving)}/month. You need a repayment plan at maturity (sale, pension, reserves).`,
        monthsSaved: saved,
        isImmediate: newReady === 0,
        monthlyImpact: monthlySaving,
        color: 'emerald',
        icon: '📉',
      })
    }
  }

  // ── 4. Lower target price ─────────────────────────────────────────────────
  for (const [reduction, pct] of [[0.05, '5%'], [0.10, '10%']]) {
    const lowerConfig = {
      ...config,
      plannedAcquisitions: config.plannedAcquisitions.map((a, i) =>
        i === 0
          ? { ...a, targetPrice: Math.round(a.targetPrice * (1 - reduction)) }
          : a
      ),
    }
    const newReady = runSim(properties, profile, lowerConfig)
    const saved = newReady !== null ? Math.max(0, base - newReady) : 0
    if (saved > 0 || base === Infinity) {
      const newPrice = Math.round(firstAcq.targetPrice * (1 - reduction))
      advice.push({
        id: `lower_price_${pct}`,
        category: 'target',
        title: `Target a ${pct} lower property price`,
        description:
          `Instead of ${fmt(firstAcq.targetPrice)}, target a property at ${fmt(newPrice)}. ` +
          `The lower down payment requirement means you reach the threshold sooner.`,
        monthsSaved: saved,
        isImmediate: newReady === 0,
        monthlyImpact: 0,
        color: 'amber',
        icon: '🏷️',
      })
    }
  }

  // ── 5. Longer loan term ───────────────────────────────────────────────────
  const currentTerm = firstAcq.loanTermYears ?? 20
  if (currentTerm < 25) {
    const longerConfig = {
      ...config,
      plannedAcquisitions: config.plannedAcquisitions.map((a, i) =>
        i === 0 ? { ...a, loanTermYears: Math.min(30, currentTerm + 5) } : a
      ),
    }
    const loanRate = firstAcq.loanRate ?? 0.035
    const myShare = firstAcq.myShare ?? 1.0
    const ltvForAcq = (firstAcq.isPrimaryResidence ? 0.90 : 0.80)
    const loanAmt = firstAcq.targetPrice * ltvForAcq * myShare
    const currentPayment = calcMonthlyPayment(loanAmt, loanRate, currentTerm * 12)
    const longerPayment = calcMonthlyPayment(loanAmt, loanRate, (currentTerm + 5) * 12)
    const monthlySaving = Math.round(currentPayment - longerPayment)

    const newReady = runSim(properties, profile, longerConfig)
    const saved = newReady !== null ? Math.max(0, base - newReady) : 0
    if (saved > 0 && monthlySaving > 20) {
      advice.push({
        id: 'longer_term',
        category: 'loan_structure',
        title: `Extend loan term to ${currentTerm + 5} years`,
        description:
          `Extending from ${currentTerm} to ${currentTerm + 5} years reduces monthly payments by ${fmt(monthlySaving)}, ` +
          `freeing up more cash each month. Total interest cost will be higher.`,
        monthsSaved: saved,
        isImmediate: newReady === 0,
        monthlyImpact: monthlySaving,
        color: 'violet',
        icon: '📅',
      })
    }
  }

  // ── 6. Higher rental income on existing properties ────────────────────────
  const rentedProps = properties.filter(
    (p) => p.isRented !== false && (p.status === 'rented' || p.isRented === true)
  )
  if (rentedProps.length > 0) {
    const totalCurrentRent = rentedProps.reduce(
      (s, p) => s + (p.startRentalIncome || p.monthlyRentalIncome || 0),
      0
    )
    const extraRent = Math.round(totalCurrentRent * 0.10) // +10% rent

    const rentProfile = {
      ...profile,
      // Model as reduced expenses (equivalent income increase) since rental income
      // flows through portfolio rental CF, not directly into profile — simplest approximation
      householdExpenses: Math.max(0, (profile.householdExpenses || 0) - extraRent),
    }
    const newReady = runSim(properties, rentProfile, config)
    const saved = newReady !== null ? Math.max(0, base - newReady) : 0
    if (saved > 0 && extraRent > 50) {
      advice.push({
        id: 'higher_rent',
        category: 'income',
        title: 'Increase rental income by 10%',
        description:
          `Raising rent by ${fmt(extraRent)}/month on your existing rental${rentedProps.length > 1 ? 's' : ''} ` +
          `(index revision or market adjustment) adds ${fmt(extraRent * 12)}/year to your savings capacity.`,
        monthsSaved: saved,
        isImmediate: newReady === 0,
        monthlyImpact: extraRent,
        color: 'cyan',
        icon: '📈',
      })
    }
  }

  // ── 7. Higher LTV (primary residence: 90% in some banks) ─────────────────
  if (firstAcq.isPrimaryResidence && maxLTV < 0.90) {
    const higherLTVConfig = { ...config, maxLTV: 0.90 }
    const newReady = runSim(properties, profile, higherLTVConfig)
    const saved = newReady !== null ? Math.max(0, base - newReady) : 0
    if (saved > 0) {
      advice.push({
        id: 'higher_ltv',
        category: 'target',
        title: 'Ask for 90% LTV (primary residence)',
        description:
          `Some Belgian banks allow up to 90% financing for a primary residence (enige woning). ` +
          `This reduces the required down payment, letting you buy sooner.`,
        monthsSaved: saved,
        isImmediate: newReady === 0,
        monthlyImpact: 0,
        color: 'amber',
        icon: '🏦',
      })
    }
  }

  // ── Sort: immediate first, then by months saved descending ──────────────
  advice.sort((a, b) => {
    if (a.isImmediate && !b.isImmediate) return -1
    if (!a.isImmediate && b.isImmediate) return 1
    return b.monthsSaved - a.monthsSaved
  })

  // Remove duplicates / very similar items (keep only top variant per category)
  const seenCategories = new Set()
  const deduped = []
  for (const item of advice) {
    // For 'target' and 'income' allow max 2 per category, others max 1
    const allowMultiple = item.category === 'target' || item.category === 'income'
    const key = allowMultiple ? `${item.category}_${item.id}` : item.category
    if (!seenCategories.has(key)) {
      seenCategories.add(key)
      deduped.push(item)
    }
  }

  return deduped
}
