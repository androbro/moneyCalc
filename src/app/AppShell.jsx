import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import Layout from "../components/Layout";
import MobileLayout from "../components/MobileLayout";
import { useMediaQuery } from "../hooks/useMediaQuery";
import Dashboard from "../components/Dashboard";
import ProjectionChart from "../components/ProjectionChart";
import PropertyForm from "../components/PropertyForm";
import PlannedInvestmentForm from "../components/PlannedInvestmentForm";
import ScenarioPlanner from "../components/ScenarioPlanner";
import HouseholdForm from "../components/HouseholdForm";
import CashFlowAggregator from "../components/CashFlowAggregator";
import PropertySimulator from "../components/PropertySimulator";
import MoneyFlow from "../components/MoneyFlow";
import PropertyDetail from "../components/PropertyDetail";
import TradingAccount from "../components/TradingAccount";
import AiChatOverlay from "../components/AiChatOverlay";
import ShareModal from "../components/ShareModal";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import {
	seedGuestStorage,
	resetGuestStorage,
	getPortfolio as guestGetPortfolio,
	addProperty as guestAddProperty,
	updateProperty as guestUpdateProperty,
	deleteProperty as guestDeleteProperty,
	addPlannedInvestment as guestAddPlannedInvestment,
	updatePlannedInvestment as guestUpdatePlannedInvestment,
	deletePlannedInvestment as guestDeletePlannedInvestment,
	getHouseholdProfile as guestGetHouseholdProfile,
	saveHouseholdProfile as guestSaveHouseholdProfile,
	getSimulatorProfile as guestGetSimulatorProfile,
	saveSimulatorProfile as guestSaveSimulatorProfile,
	getGrowthPlannerProfile as guestGetGrowthPlannerProfile,
	saveGrowthPlannerProfile as guestSaveGrowthPlannerProfile,
	getTrades as guestGetTrades,
	importTrades as guestImportTrades,
	clearTrades as guestClearTrades,
} from "../lib/guestStorage";
import {
	getPortfolio,
	addProperty,
	updateProperty,
	deleteProperty,
	addPlannedInvestment,
	updatePlannedInvestment,
	deletePlannedInvestment,
	getHouseholdProfile,
	saveHouseholdProfile,
	getSimulatorProfile,
	saveSimulatorProfile,
	getGrowthPlannerProfile,
	saveGrowthPlannerProfile,
	getTrades,
	importTrades,
	clearTrades,
	claimOwnerlessData,
	defaultHousehold,
} from "../services/portfolioService";
import { Analytics } from "@vercel/analytics/react";
import { computePositions } from "../calculations/trading/tradingUtils";
import GrowthPlanner from "../components/GrowthPlanner";
import { getRemainingBalance, getLoanPaymentSplit } from "../utils/projectionUtils";

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
	return (
		<div className="min-h-screen bg-neo-bg flex items-center justify-center">
			<div className="text-center space-y-4">
				<div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
				<p className="text-neo-muted text-sm">Loading portfolio…</p>
			</div>
		</div>
	);
}

// ─── Error screen ─────────────────────────────────────────────────────────────

function ErrorScreen({ message, onRetry }) {
	return (
		<div className="min-h-screen bg-neo-bg flex items-center justify-center p-6">
			<div className="card max-w-md w-full text-center space-y-4">
				<div className="w-12 h-12 rounded-2xl bg-red-100 shadow-neo-inset-sm flex items-center justify-center mx-auto border border-red-200/60">
					<svg
						className="w-6 h-6 text-red-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<div>
					<p className="font-semibold text-neo-text">
						Failed to connect to Supabase
					</p>
					<p className="text-neo-muted text-sm mt-1 break-all">{message}</p>
				</div>
				<button onClick={onRetry} className="btn-primary mx-auto">
					Retry
				</button>
			</div>
		</div>
	);
}

// ─── Toast notification ───────────────────────────────────────────────────────

function Toast({ message, type = "error", onDismiss }) {
	useEffect(() => {
		const t = setTimeout(onDismiss, 4000);
		return () => clearTimeout(t);
	}, [onDismiss]);

	return (
		<div
			className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-neo-lg
                     text-sm font-medium border backdrop-blur-xl
                     ${
												type === "error"
													? "bg-red-500/14 border-red-400/25 text-red-200 shadow-neo"
													: "bg-emerald-500/14 border-emerald-400/25 text-emerald-200 shadow-neo"
											}`}
			style={{ WebkitBackdropFilter: "blur(20px)" }}
		>
			{message}
			<button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
				✕
			</button>
		</div>
	);
}

function InstallAppBanner({ onInstall, onDismiss, installSupported }) {
	return (
		<div className="fixed top-16 left-3 right-3 z-40 md:hidden">
			<div className="rounded-2xl border border-brand-500/30 bg-slate-900/95 shadow-neo-lg px-4 py-3 flex items-center gap-3">
				<div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center shrink-0">
					<svg className="w-4 h-4 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
					</svg>
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold text-neo-text">Install wenLambo on your phone</p>
					<p className="text-xs text-neo-muted">
						{installSupported
							? "Tap download to install it like a native app."
							: "Install is available in supported browsers (for example Chrome)."}
					</p>
				</div>
				<button onClick={onInstall} className="btn-primary text-xs px-3 py-2 whitespace-nowrap">
					Download app
				</button>
				<button onClick={onDismiss} className="text-neo-muted hover:text-neo-text">
					✕
				</button>
			</div>
		</div>
	);
}

function isRunningInstalledApp() {
	return (
		window.matchMedia?.("(display-mode: standalone)").matches ||
		window.matchMedia?.("(display-mode: fullscreen)").matches ||
		window.matchMedia?.("(display-mode: minimal-ui)").matches ||
		window.navigator.standalone === true ||
		document.referrer.startsWith("android-app://")
	);
}

// ─── Claim-data migration banner ──────────────────────────────────────────────

function MigrationBanner({ onClaim, onDismiss }) {
	const [claiming, setClaiming] = useState(false);
	const [done, setDone] = useState(false);

	const handleClaim = async () => {
		setClaiming(true);
		try {
			const result = await onClaim();
			setDone(true);
			setTimeout(onDismiss, 3000);
		} catch {
			setClaiming(false);
		}
	};

	return (
		<div className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-3 pointer-events-none">
			<div className="pointer-events-auto max-w-xl w-full bg-amber-50 border border-amber-200/80 rounded-3xl shadow-neo-lg px-5 py-4 flex items-start gap-4">
				<div className="w-9 h-9 shrink-0 rounded-xl bg-amber-100 shadow-neo-inset-sm flex items-center justify-center mt-0.5 border border-amber-200/60">
					<svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
							d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
					</svg>
				</div>
				<div className="flex-1 min-w-0">
					<p className="font-semibold text-amber-900 text-sm">
						{done ? "Data claimed successfully!" : "Unclaimed data found"}
					</p>
					<p className="text-amber-300/80 text-xs mt-0.5 leading-relaxed">
						{done
							? "All your existing properties and profile are now linked to your account."
							: "There is existing portfolio data in the database not yet linked to your account. Claim it now to make it private to you."}
					</p>
				</div>
				{!done && (
					<div className="flex items-center gap-2 shrink-0">
						<button
							onClick={handleClaim}
							disabled={claiming}
							className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white shadow-neo-sm
                             text-xs font-semibold transition-all disabled:opacity-60 active:shadow-neo-inset-sm"
						>
							{claiming ? "Claiming…" : "Claim data"}
						</button>
						<button
							onClick={onDismiss}
							className="text-amber-600/70 hover:text-amber-800 transition-colors"
							title="Dismiss"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
	const { session, user, loading: authLoading, signOut } = useAuth();
	const isMobile = useMediaQuery('(max-width: 767px)')
	const ActiveLayout = isMobile ? MobileLayout : Layout

	const isLoggedIn = Boolean(session);

	const [properties, setProperties] = useState([]);
	const [loading, setLoading] = useState(true);
	const [fatalError, setFatalError] = useState(null);
	const [saving, setSaving] = useState(false);
	const [toast, setToast] = useState(null);

	const [activeTab, setActiveTab] = useState("dashboard");
	const [editingProperty, setEditingProperty] = useState(null);
	const [showForm, setShowForm] = useState(false);
	const [detailProperty, setDetailProperty] = useState(null);
	const [editingInvestment, setEditingInvestment] = useState(null);
	const [showInvestmentForm, setShowInvestmentForm] = useState(false);

	// Household profile
	const [householdProfile, setHouseholdProfile] = useState(defaultHousehold());
	const [showHouseholdForm, setShowHouseholdForm] = useState(false);

	// Trading account
	const [trades, setTrades] = useState([]);
	const [tradingImporting, setTradingImporting] = useState(false);
	// Live portfolio value — updated by TradingAccount when market data arrives.
	// Falls back to cost basis when market data is not yet loaded.
	const [tradingPortfolioValue, setTradingPortfolioValue] = useState(0);

	// Simulator state (lifted so AiChatOverlay can see it)
	const [simState, setSimState] = useState(null);
	const [growthPlannerProfile, setGrowthPlannerProfile] = useState({
		acquisitions: [],
		horizonYears: 25,
		maxLTV: 0.8,
	});

	// Migration banner — show once after first login if unclaimed data exists
	const [showMigrationBanner, setShowMigrationBanner] = useState(false);
	const [migrationChecked, setMigrationChecked] = useState(false);

	// Share modal
	const [showShareModal, setShowShareModal] = useState(false);

	// AI chat (controlled so MobileLayout can use its own trigger)
	const [aiChatOpen, setAiChatOpen] = useState(false);
	const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
	const [showInstallBanner, setShowInstallBanner] = useState(false);

	// Pick the right data-layer functions based on auth state
	const db = isLoggedIn
		? {
				getPortfolio,
				addProperty,
				updateProperty,
				deleteProperty,
				addPlannedInvestment,
				updatePlannedInvestment,
				deletePlannedInvestment,
				getHouseholdProfile,
				saveHouseholdProfile,
				getTrades,
				importTrades,
				clearTrades,
				getGrowthPlannerProfile,
				saveGrowthPlannerProfile,
		  }
		: {
				getPortfolio: guestGetPortfolio,
				addProperty: guestAddProperty,
				updateProperty: guestUpdateProperty,
				deleteProperty: guestDeleteProperty,
				addPlannedInvestment: guestAddPlannedInvestment,
				updatePlannedInvestment: guestUpdatePlannedInvestment,
				deletePlannedInvestment: guestDeletePlannedInvestment,
				getHouseholdProfile: guestGetHouseholdProfile,
				saveHouseholdProfile: guestSaveHouseholdProfile,
				getTrades: guestGetTrades,
				importTrades: guestImportTrades,
				clearTrades: guestClearTrades,
				getGrowthPlannerProfile: guestGetGrowthPlannerProfile,
				saveGrowthPlannerProfile: guestSaveGrowthPlannerProfile,
		  };

	// ── Load portfolio + household profile ──
	const load = useCallback(async () => {
		setLoading(true);
		setFatalError(null);
		try {
			if (!isLoggedIn) {
				// Seed guest localStorage if empty, then load from it
				seedGuestStorage();
			}
			const [portfolio, profile, tradeRows, growthProfile] = await Promise.all([
				db.getPortfolio(),
				db.getHouseholdProfile(),
				db.getTrades(),
				db.getGrowthPlannerProfile(),
			]);
			setProperties(portfolio.properties);
			setHouseholdProfile(profile);
			setTrades(tradeRows);
			setGrowthPlannerProfile(growthProfile);
			// Seed trading value with cost basis until live prices arrive
			const { positions } = computePositions(tradeRows);
			setTradingPortfolioValue(positions.reduce((s, p) => s + p.totalCostEur, 0));
		} catch (err) {
			setFatalError(err.message);
		} finally {
			setLoading(false);
		}
	}, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!authLoading) load();
	}, [authLoading, load]);

	useEffect(() => {
		if (!isMobile) return;

		if (isRunningInstalledApp()) return;

		const dismissed = localStorage.getItem("install-banner-dismissed") === "1";
		if (!dismissed) {
			setShowInstallBanner(true);
		}

		const handleBeforeInstallPrompt = (event) => {
			if (isRunningInstalledApp()) return;
			event.preventDefault();
			setDeferredInstallPrompt(event);
			setShowInstallBanner(true);
		};

		const handleAppInstalled = () => {
			setDeferredInstallPrompt(null);
			setShowInstallBanner(false);
			setToast({ message: "wenLambo installed successfully", type: "success" });
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		window.addEventListener("appinstalled", handleAppInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
			window.removeEventListener("appinstalled", handleAppInstalled);
		};
	}, [isMobile]);

	// ── Check for unclaimed data after sign-in ──
	useEffect(() => {
		if (!isLoggedIn || migrationChecked) return;
		setMigrationChecked(true);

		checkForOwnerlessData().then((hasOwnerless) => {
			if (hasOwnerless) setShowMigrationBanner(true);
		});
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoggedIn]);

	const handleClaim = async () => {
		try {
			const result = await claimOwnerlessData();
			setToast({ message: `Data claimed — ${result.properties} properties linked to your account`, type: "success" });
			setShowMigrationBanner(false);
			// Reload so the newly-claimed data appears
			await load();
		} catch (err) {
			setToast({ message: `Failed to claim data: ${err.message}`, type: "error" });
			throw err;
		}
	};

	const handleSaveGrowthPlannerProfile = useCallback(
		async (nextState) => {
			try {
				const saveFn = isLoggedIn
					? saveGrowthPlannerProfile
					: guestSaveGrowthPlannerProfile;
				const saved = await saveFn(nextState);
				setGrowthPlannerProfile(saved);
			} catch (err) {
				setToast({ message: err.message, type: "error" });
			}
		},
		[isLoggedIn],
	);

	// ── Auth handlers ──
	const handleSignOut = async () => {
		await signOut();
		// After sign-out, seed fresh guest data
		resetGuestStorage();
		setToast({ message: "Signed out — showing demo data", type: "success" });
	};

	// ── Reset guest demo data ──
	const handleResetDemo = () => {
		resetGuestStorage();
		load();
		setToast({ message: "Demo data reset to default", type: "success" });
	};

	const handleInstallApp = async () => {
		if (deferredInstallPrompt) {
			deferredInstallPrompt.prompt();
			try {
				await deferredInstallPrompt.userChoice;
			} catch {
				// No-op; browser handles dismiss/accept state.
			}
			setDeferredInstallPrompt(null);
			return;
		}

		setToast({
			message: "This browser does not support one-tap web install.",
			type: "success",
		});
	};

	const dismissInstallBanner = () => {
		setShowInstallBanner(false);
		localStorage.setItem("install-banner-dismissed", "1");
	};

	// ── Shared save wrapper ──
	const withSave = async (fn, successMsg) => {
		setSaving(true);
		try {
			const portfolio = await fn();
			setProperties(portfolio.properties);
			if (successMsg) setToast({ message: successMsg, type: "success" });
		} catch (err) {
			setToast({ message: err.message, type: "error" });
		} finally {
			setSaving(false);
		}
	};

	// ── Handlers ──
	const handleAddProperty = () => {
		setEditingProperty(undefined);
		setShowForm(true);
		setActiveTab("properties");
	};

	const handleEditProperty = (property) => {
		setEditingProperty(property);
		setShowForm(true);
		setDetailProperty(null);
		setActiveTab("properties");
	};

	const handleDeleteProperty = async (propertyId) => {
		if (!window.confirm("Delete this property and all its loans?")) return;
		await withSave(
			() => db.deleteProperty(null, propertyId),
			"Property deleted",
		);
	};

	const handleSave = async (property) => {
		const isEdit = Boolean(editingProperty);
		await withSave(
			() =>
				isEdit
					? db.updateProperty(null, property)
					: db.addProperty(null, property),
			isEdit ? "Property updated" : "Property added",
		);
		setShowForm(false);
		setEditingProperty(null);
		setActiveTab("properties");
	};

	const handleCancelForm = () => {
		setShowForm(false);
		setEditingProperty(null);
	};

	// ── Planned investment handlers ──
	const handleAddInvestment = () => {
		setEditingInvestment(undefined);
		setShowInvestmentForm(true);
		setActiveTab("investments");
	};

	const handleEditInvestment = (inv) => {
		setEditingInvestment(inv);
		setShowInvestmentForm(true);
		setActiveTab("investments");
	};

	const handleDeleteInvestment = async (id) => {
		if (!window.confirm("Delete this planned investment?")) return;
		await withSave(() => db.deletePlannedInvestment(id), "Investment deleted");
	};

	const handleSaveInvestment = async (inv) => {
		const isEdit = Boolean(editingInvestment);
		await withSave(
			() =>
				isEdit ? db.updatePlannedInvestment(inv) : db.addPlannedInvestment(inv),
			isEdit ? "Investment updated" : "Investment added",
		);
		setShowInvestmentForm(false);
		setEditingInvestment(null);
	};

	const handleCancelInvestmentForm = () => {
		setShowInvestmentForm(false);
		setEditingInvestment(null);
	};

	// ── Household profile handlers ──
	const handleSaveHousehold = async (profile) => {
		setSaving(true);
		try {
			const saved = await db.saveHouseholdProfile(profile);
			setHouseholdProfile(saved);
			setToast({ message: "Household profile saved", type: "success" });
			setShowHouseholdForm(false);
		} catch (err) {
			setToast({ message: err.message, type: "error" });
		} finally {
			setSaving(false);
		}
	};

	// ── Trading account handlers ──
	const handleImportTrades = async (parsed) => {
		setTradingImporting(true);
		try {
			const inserted = await db.importTrades(parsed);
			const updated = await db.getTrades();
			setTrades(updated);
			setToast({
				message: inserted === 0
					? "No new rows — all rows already imported"
					: `${inserted} trade${inserted !== 1 ? "s" : ""} imported`,
				type: "success",
			});
		} catch (err) {
			setToast({ message: err.message, type: "error" });
		} finally {
			setTradingImporting(false);
		}
	};

	const handleClearTrades = async () => {
		try {
			await db.clearTrades();
			setTrades([]);
			setToast({ message: "All trade data cleared", type: "success" });
		} catch (err) {
			setToast({ message: err.message, type: "error" });
		}
	};

	// ── Render guards ──
	if (authLoading) return <LoadingScreen />;
	if (loading) return <LoadingScreen />;
	if (fatalError) return <ErrorScreen message={fatalError} onRetry={load} />;

	return (
		<>
			<Analytics />

			{/* Migration banner */}
			{showMigrationBanner && (
				<MigrationBanner
					onClaim={handleClaim}
					onDismiss={() => setShowMigrationBanner(false)}
				/>
			)}

			{/* Share modal */}
			{showShareModal && (
				<ShareModal onClose={() => setShowShareModal(false)} />
			)}

			{isMobile && showInstallBanner && (
				<InstallAppBanner
					onInstall={handleInstallApp}
					onDismiss={dismissInstallBanner}
					installSupported={Boolean(deferredInstallPrompt)}
				/>
			)}

			<ActiveLayout
				activeTab={activeTab}
				onTabChange={(tab) => {
					setActiveTab(tab);
					setDetailProperty(null);
					setShowForm(false);
				}}
				isLoggedIn={isLoggedIn}
				user={user}
				onSignOut={handleSignOut}
				onResetDemo={handleResetDemo}
				onShare={() => setShowShareModal(true)}
				aiChatOpen={aiChatOpen}
				onAiChatToggle={() => setAiChatOpen(o => !o)}
			>
			{/* ── Dashboard ── */}
			{activeTab === "dashboard" && (
				<Dashboard
					properties={properties}
					profile={householdProfile}
					onAddProperty={handleAddProperty}
					onEditProperty={handleEditProperty}
					onDeleteProperty={handleDeleteProperty}
					onSaveProfile={handleSaveHousehold}
					tradingPortfolioValue={tradingPortfolioValue}
				/>
			)}

				{/* ── Property detail view ── */}
				{activeTab === "properties" && detailProperty && !showForm && (
					<PropertyDetail
						property={
							properties.find((p) => p.id === detailProperty.id) ??
							detailProperty
						}
						onEdit={() => handleEditProperty(detailProperty)}
						onBack={() => setDetailProperty(null)}
					/>
				)}

				{/* ── Properties list ── */}
				{activeTab === "properties" && !showForm && !detailProperty && (
					<div className="space-y-4">
						{/* Header */}
						<div className="flex items-center justify-between gap-3">
							<div>
								<h1 className="text-2xl font-bold text-neo-text">Properties</h1>
								<p className="text-neo-muted text-sm mt-0.5">
									{properties.length > 0
										? `${properties.length} propert${properties.length === 1 ? "y" : "ies"} in your portfolio`
										: "Manage your real estate portfolio"}
								</p>
							</div>
							<button onClick={handleAddProperty} className="btn-primary shrink-0">
								<PlusIcon />
								<span className="hidden sm:inline">Add Property</span>
								<span className="sm:hidden">Add</span>
							</button>
						</div>

						{/* Portfolio summary strip */}
						{properties.length > 0 && (() => {
							const todayISO = new Date().toISOString();
							const totalValue = properties.reduce((s, p) => s + (p.currentValue || 0), 0);
							const totalDebt  = properties.reduce((s, p) =>
								s + (p.loans || []).reduce((ls, l) => ls + getRemainingBalance(l, todayISO), 0), 0);
							const totalEquity = totalValue - totalDebt;
							const rentedProps = properties.filter((p) => p.status === "rented");
							const totalRent   = rentedProps.reduce((s, p) =>
								s + (Number(p.startRentalIncome) || Number(p.monthlyRentalIncome) || 0), 0);
							const fmtK = (n) => {
								const abs = Math.abs(n);
								if (abs >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
								if (abs >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`;
								return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
							};
							return (
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
									{[
										{ label: "Total Value",  value: fmtK(totalValue),  color: "text-neo-text" },
										{ label: "Total Equity", value: fmtK(totalEquity), color: totalEquity >= 0 ? "text-emerald-400" : "text-red-400" },
										{ label: "Loan Balance", value: fmtK(totalDebt),   color: "text-amber-300" },
										{ label: "Monthly Rent", value: totalRent > 0 ? fmtK(totalRent) : "—", color: "text-brand-400" },
									].map((s) => (
										<div key={s.label} className="rounded-2xl border border-white/[0.06] px-3 py-2.5"
											style={{ background: "rgba(10,14,24,0.38)", backdropFilter: "blur(14px)" }}>
											<p className="text-xs text-neo-muted mb-0.5">{s.label}</p>
											<p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
										</div>
									))}
								</div>
							);
						})()}

						{properties.length === 0 ? (
							<div className="card flex flex-col items-center justify-center py-16 text-center">
								<p className="text-neo-muted font-medium">No properties yet</p>
								<p className="text-neo-subtle text-sm mt-1 mb-4">
									Add your first property to start tracking your portfolio
								</p>
								<button onClick={handleAddProperty} className="btn-primary">
									<PlusIcon />
									Add Property
								</button>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
								{properties.map((p) => (
									<PropertyListCard
										key={p.id}
										property={p}
										onView={() => setDetailProperty(p)}
										onEdit={() => handleEditProperty(p)}
										onDelete={() => handleDeleteProperty(p.id)}
									/>
								))}
							</div>
						)}
					</div>
				)}

				{/* ── Property form ── */}
				{activeTab === "properties" && showForm && (
					<div className="relative">
						{saving && (
							<div className="absolute inset-0 z-10 bg-neo-bg/65 rounded-2xl flex items-center justify-center">
								<div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
							</div>
						)}
						<PropertyForm
							property={editingProperty}
							profile={householdProfile}
							onSave={handleSave}
							onCancel={handleCancelForm}
						/>
					</div>
				)}

				{/* ── Investments ── */}
				{activeTab === "investments" && !showInvestmentForm && (
					<InvestmentsPage
						properties={properties}
						onAdd={handleAddInvestment}
						onEdit={handleEditInvestment}
						onDelete={handleDeleteInvestment}
					/>
				)}

				{activeTab === "investments" && showInvestmentForm && (
					<div className="relative">
						{saving && (
							<div className="absolute inset-0 z-10 bg-neo-bg/65 rounded-2xl flex items-center justify-center">
								<div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
							</div>
						)}
						<PlannedInvestmentForm
							investment={editingInvestment}
							properties={properties}
							onSave={handleSaveInvestment}
							onCancel={handleCancelInvestmentForm}
						/>
					</div>
				)}

				{/* ── Projection ── */}
				{activeTab === "projection" && (
					<ProjectionChart properties={properties} profile={householdProfile} trades={trades} tradingPortfolioValue={tradingPortfolioValue} />
				)}

				{/* ── Scenarios ── */}
				{activeTab === "scenario" && (
					<ScenarioPlanner properties={properties} />
				)}

				{/* ── Cash-Flow Aggregator ── */}
				{activeTab === "cashflow" && !showHouseholdForm && (
					<CashFlowAggregator
						properties={properties}
						profile={householdProfile}
						onEditProfile={() => setShowHouseholdForm(true)}
					/>
				)}

				{/* ── Household Form ── */}
				{activeTab === "cashflow" && showHouseholdForm && (
					<div className="relative">
						{saving && (
							<div className="absolute inset-0 z-10 bg-neo-bg/65 rounded-2xl flex items-center justify-center">
								<div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
							</div>
						)}
						<div className="flex items-center gap-3 mb-4">
							<button
								onClick={() => setShowHouseholdForm(false)}
								className="text-neo-muted hover:text-neo-text transition-colors"
							>
								<svg
									className="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 19l-7-7 7-7"
									/>
								</svg>
							</button>
							<span className="text-neo-muted text-sm">
								Back to Cash-Flow Aggregator
							</span>
						</div>
					<HouseholdForm
						profile={householdProfile}
						onSave={handleSaveHousehold}
						saving={saving}
						trades={trades}
						tradingPortfolioValue={tradingPortfolioValue}
					/>
				</div>
			)}

			{/* ── Household Profile (standalone nav item) ── */}
			{activeTab === "household" && (
				<div className="relative">
					{saving && (
						<div className="absolute inset-0 z-10 bg-neo-bg/65 rounded-2xl flex items-center justify-center">
							<div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
						</div>
					)}
					<HouseholdForm
						profile={householdProfile}
						onSave={handleSaveHousehold}
						saving={saving}
						trades={trades}
						tradingPortfolioValue={tradingPortfolioValue}
					/>
					</div>
				)}

				{/* ── Money Flow ── */}
				{activeTab === "moneyflow" && (
					<MoneyFlow properties={properties} profile={householdProfile} />
				)}

				{/* ── Property Simulator ── */}
				{activeTab === "simulator" && (
					<PropertySimulator
						properties={properties}
						onSimChange={setSimState}
						getSimulatorProfile={
							isLoggedIn ? getSimulatorProfile : guestGetSimulatorProfile
						}
						saveSimulatorProfile={
							isLoggedIn ? saveSimulatorProfile : guestSaveSimulatorProfile
						}
					/>
				)}

			{/* ── Growth Planner ── */}
			{activeTab === "growth" && (
				<GrowthPlanner
					properties={properties}
					profile={householdProfile}
					initialPlan={growthPlannerProfile}
					onSavePlan={handleSaveGrowthPlannerProfile}
				/>
			)}

			{/* ── Trading Account ── */}
			{activeTab === "trading" && (
				<TradingAccount
					trades={trades}
					onImport={handleImportTrades}
					onClear={handleClearTrades}
					importing={tradingImporting}
					onPortfolioValue={setTradingPortfolioValue}
				/>
			)}
			</ActiveLayout>

			{/* Toast */}
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onDismiss={() => setToast(null)}
				/>
			)}

			{/* AI Chat overlay — only for logged-in users (needs Gemini key) */}
			<AiChatOverlay
				properties={properties}
				profile={householdProfile}
				activeTab={activeTab}
				simState={simState}
				isOwner={isLoggedIn}
				open={isMobile ? aiChatOpen : undefined}
				onToggle={isMobile ? () => setAiChatOpen(o => !o) : undefined}
			/>
		</>
	);
}

// ─── Ownerless data check ─────────────────────────────────────────────────────

async function checkForOwnerlessData() {
	try {
		const { count } = await supabase
			.from('properties')
			.select('id', { count: 'exact', head: true })
			.is('user_id', null)
		return (count ?? 0) > 0
	} catch {
		return false
	}
}

// ─── Investments page ─────────────────────────────────────────────────────────

function InvestmentsPage({ properties, onAdd, onEdit, onDelete }) {
	const allInvestments = properties
		.flatMap((p) =>
			(p.plannedInvestments || []).map((inv) => ({
				...inv,
				propertyName: p.name,
			})),
		)
		.sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate));

	const fmt = (n) =>
		new Intl.NumberFormat("nl-BE", {
			style: "currency",
			currency: "EUR",
			maximumFractionDigits: 0,
		}).format(n);

	const today = new Date();

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-neo-text">Planned Investments</h1>
					<p className="text-neo-muted text-sm mt-0.5">
						One-off capital outlays that increase a property's value from a
						specific date.
					</p>
				</div>
				<button
					onClick={onAdd}
					className="btn-primary"
					disabled={properties.length === 0}
				>
					<PlusIcon />
					Add Investment
				</button>
			</div>

			{properties.length === 0 && (
				<div className="card text-center py-12">
					<p className="text-neo-muted">
						Add at least one property before planning investments.
					</p>
				</div>
			)}

			{properties.length > 0 && allInvestments.length === 0 && (
				<div className="card flex flex-col items-center justify-center py-16 text-center">
					<div className="w-12 h-12 rounded-2xl bg-neo-sunken flex items-center justify-center mb-4">
						<svg
							className="w-6 h-6 text-neo-muted"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M19 14l-7 7m0 0l-7-7m7 7V3"
							/>
						</svg>
					</div>
					<p className="text-neo-muted font-medium">
						No planned investments yet
					</p>
					<p className="text-neo-subtle text-sm mt-1 mb-4">
						Add a renovation, upgrade, or any capital outlay you plan to make.
					</p>
					<button onClick={onAdd} className="btn-primary">
						<PlusIcon />
						Add Investment
					</button>
				</div>
			)}

			{allInvestments.length > 0 && (
				<div className="space-y-3">
					{allInvestments.map((inv) => {
						const date = new Date(inv.plannedDate);
						const isPast = date < today;
						const yearOffset = Math.round(
							(date - today) / (365.25 * 24 * 60 * 60 * 1000),
						);
						const net = inv.valueIncrease - inv.cost;

						return (
							<div
								key={inv.id}
								className="card flex flex-col sm:flex-row sm:items-center gap-4"
							>
								<div
									className={`shrink-0 rounded-xl px-3 py-2 text-center min-w-[72px]
                                  ${isPast ? "bg-neo-bg shadow-neo-inset-sm" : "bg-amber-50 border border-amber-200/80 shadow-neo-inset-sm"}`}
								>
									<p className="text-xs text-neo-muted leading-tight">
										{date.toLocaleDateString("nl-BE", {
											month: "short",
											year: "numeric",
										})}
									</p>
									<p
										className={`text-sm font-bold ${isPast ? "text-neo-muted" : "text-amber-900"}`}
									>
										{isPast
											? "Past"
											: yearOffset === 0
												? "This year"
												: `+${yearOffset}y`}
									</p>
								</div>

								<div className="flex-1 min-w-0">
									<p className="font-semibold text-neo-text truncate">
										{inv.description || "Unnamed investment"}
									</p>
									<p className="text-xs text-neo-muted mt-0.5">
										{inv.propertyName}
									</p>
								</div>

								<div className="flex gap-6 shrink-0 text-right">
									<div>
										<p className="text-xs text-neo-subtle">Cost</p>
										<p className="text-sm font-semibold text-red-400">
											-{fmt(inv.cost)}
										</p>
									</div>
									<div>
										<p className="text-xs text-neo-subtle">Value +</p>
										<p className="text-sm font-semibold text-emerald-400">
											+{fmt(inv.valueIncrease)}
										</p>
									</div>
									<div>
										<p className="text-xs text-neo-subtle">Net</p>
										<p
											className={`text-sm font-bold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}
										>
											{net >= 0 ? "+" : ""}
											{fmt(net)}
										</p>
									</div>
								</div>

								<div className="flex gap-2 shrink-0">
									<button
										onClick={() => onEdit(inv)}
										className="text-neo-muted hover:text-brand-400 transition-colors"
									>
										<EditIcon />
									</button>
									<button
										onClick={() => onDelete(inv.id)}
										className="text-neo-muted hover:text-red-400 transition-colors"
									>
										<TrashIcon />
									</button>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

// ─── Property list card ───────────────────────────────────────────────────────

function PropertyListCard({ property, onView, onEdit, onDelete }) {
	const fmt = (n) =>
		new Intl.NumberFormat("nl-BE", {
			style: "currency",
			currency: "EUR",
			maximumFractionDigits: 0,
		}).format(n ?? 0);

	const STATUS_CONFIG = {
		owner_occupied: { label: "Owner-occupied", bg: "bg-sky-400/15 text-sky-300 border-sky-400/30",          icon: "🏠" },
		rented:         { label: "Rented out",     bg: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30", icon: "🔑" },
		vacant:         { label: "Vacant",         bg: "bg-white/5 text-neo-muted border-white/10",              icon: "⬜" },
		for_sale:       { label: "For sale",       bg: "bg-amber-400/15 text-amber-300 border-amber-400/30",     icon: "🏷️" },
		renovation:     { label: "Renovation",     bg: "bg-orange-400/15 text-orange-300 border-orange-400/30",  icon: "🔨" },
		planned:        { label: "Planned",        bg: "bg-violet-400/15 text-violet-300 border-violet-400/30",  icon: "💡" },
	};

	const cfg = STATUS_CONFIG[property.status] ?? STATUS_CONFIG.owner_occupied;
	const todayISO = new Date().toISOString();
	const todayDate = new Date();

	const totalDebt = (property.loans || []).reduce(
		(s, l) => s + getRemainingBalance(l, todayISO), 0
	);
	const equity = (property.currentValue || 0) - totalDebt;

	const totalMonthlyLoan = (property.loans || []).reduce((s, l) => {
		const { monthlyTotal } = getLoanPaymentSplit(l, todayDate);
		return s + monthlyTotal;
	}, 0);

	const isRented = property.status === "rented";
	const monthlyRent = isRented
		? (Number(property.startRentalIncome) || Number(property.monthlyRentalIncome) || 0)
		: 0;
	const monthlyRunning =
		(property.monthlyExpenses || 0) +
		((property.annualMaintenanceCost || 0) +
			(property.annualInsuranceCost || 0) +
			(property.annualPropertyTax || 0)) / 12;
	const monthlyCF = monthlyRent - monthlyRunning - totalMonthlyLoan;

	// Decide which 4 stats to show
	const stats = [
		{ label: "Market Value", value: fmt(property.currentValue), color: "text-neo-text" },
		{ label: "Equity", value: fmt(equity), color: equity >= 0 ? "text-emerald-400" : "text-red-400" },
	];
	if (totalDebt > 0) {
		stats.push({ label: "Loan Balance", value: fmt(totalDebt), color: "text-amber-300" });
	} else {
		stats.push({ label: "Appreciation", value: `${((property.appreciationRate || 0.02) * 100).toFixed(1)}%/yr`, color: "text-neo-text" });
	}
	if (isRented) {
		stats.push({ label: "Monthly CF", value: fmt(monthlyCF), color: monthlyCF >= 0 ? "text-emerald-400" : "text-red-400" });
	} else {
		stats.push({
			label: "Renovations",
			value: String(property.plannedInvestments?.length || 0),
			color: "text-neo-text",
		});
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 14 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.22 }}
			className="card group cursor-pointer hover:bg-neo-raised/90 transition-all duration-200"
			onClick={onView}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => e.key === "Enter" && onView()}
		>
			{/* ── Header ── */}
			<div className="flex items-start gap-3 mb-4">
				<div className="w-11 h-11 rounded-2xl bg-brand-600/15 border border-brand-500/20 flex items-center justify-center text-xl shrink-0">
					{cfg.icon}
				</div>
				<div className="min-w-0 flex-1">
					<h3 className="font-semibold text-neo-text group-hover:text-brand-400 transition-colors text-base leading-tight truncate">
						{property.name}
					</h3>
					{property.address && (
						<p className="text-xs text-neo-muted truncate mt-0.5">{property.address}</p>
					)}
				</div>
				<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${cfg.bg}`}>
					{cfg.label}
				</span>
			</div>

			{/* ── Stats grid ── */}
			<div className="grid grid-cols-2 gap-2 mb-4">
				{stats.map((s) => (
					<div key={s.label} className="rounded-2xl bg-neo-sunken/60 px-3 py-2.5">
						<p className="text-xs text-neo-muted mb-0.5">{s.label}</p>
						<p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
					</div>
				))}
			</div>

			{/* ── Action row (stops card click) ── */}
			<div
				className="flex items-center gap-2 border-t border-white/[0.06] pt-3"
				onClick={(e) => e.stopPropagation()}
			>
				<button
					onClick={(e) => { e.stopPropagation(); onEdit(); }}
					className="flex-1 py-2.5 rounded-xl text-xs font-medium text-neo-muted hover:text-brand-400 border border-white/[0.06] hover:border-brand-500/30 transition-all active:scale-95"
				>
					Edit
				</button>
				<button
					onClick={(e) => { e.stopPropagation(); onDelete(); }}
					className="py-2.5 px-4 rounded-xl text-xs font-medium text-neo-muted hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 transition-all active:scale-95"
				>
					Delete
				</button>
				<button
					onClick={(e) => { e.stopPropagation(); onView(); }}
					className="flex-1 py-2.5 rounded-xl text-xs font-medium text-brand-400 bg-brand-600/10 border border-brand-500/20 hover:bg-brand-600/20 transition-all active:scale-95"
				>
					Details →
				</button>
			</div>
		</motion.div>
	);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
	return (
		<svg
			className="w-4 h-4"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 4v16m8-8H4"
			/>
		</svg>
	);
}

function EditIcon() {
	return (
		<svg
			className="w-4 h-4"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
			/>
		</svg>
	);
}

function TrashIcon() {
	return (
		<svg
			className="w-4 h-4"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
			/>
		</svg>
	);
}
