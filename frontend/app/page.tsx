"use client";

import { useEffect, useState } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

// const API_BASE = "http://localhost:8000";
const API_BASE = "http://127.0.0.1:8000";
const API_URL = `${API_BASE}/api/watchlist/test_investor`;

type Deltas = { since_last_checked_pct: number; since_watchlisted_pct: number; };
type Catalyst = { is_anomaly: boolean; direction: string; tag: string; summary: string; };
type AnalystConsensus = { rating: string; recent_shift: string; target_price: number; upside_pct: number; };
type Financials = { latest_quarter: string; beat_status: string; revenue_yoy: string; };
type WatchlistItem = { id: string; ticker: string; name: string; current_price: number; day_change_pct: number; deltas: Deltas; catalyst: Catalyst; analyst_consensus: AnalystConsensus; financials: Financials; is_stale: boolean; };
type Watchlist = { id: string; name: string; intent: string; items: WatchlistItem[]; };
type WatchlistResponse = { user: string; last_viewed_at: string; watchlists: Watchlist[]; exchange_telemetry?: any; };
type Status = "loading" | "success" | "error";

const fmtPrice = (n?: number) => (typeof n === "number" ? `$${n.toFixed(2)}` : "$0.00");
const fmtPct = (n?: number) => (typeof n === "number" ? `${n > 0 ? "+" : ""}${n.toFixed(2)}%` : "0.00%");
const pctColor = (n?: number) => typeof n === "number" && n > 0 ? "text-emerald-400" : typeof n === "number" && n < 0 ? "text-rose-400" : "text-zinc-400";

function intentStyles(intent: string) { return "border-zinc-600/40 bg-zinc-500/10 text-zinc-300"; }
function ratingStyles(rating: string) {
  const r = rating.toLowerCase();
  if (r.includes("strong buy")) return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (r.includes("buy")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (r.includes("hold")) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-zinc-600/40 bg-zinc-500/10 text-zinc-300";
}
function beatStyles(status: string) {
  const s = status.toLowerCase();
  if (s.includes("beat")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (s.includes("miss")) return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function CatalystBadge({ catalyst }: { catalyst: Catalyst }) {
  const isDown = catalyst.direction === "down";
  const Icon = isDown ? TrendingDown : TrendingUp;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${isDown ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
      <Icon className="h-3.5 w-3.5" />
      {catalyst.tag}
    </span>
  );
}

function UpsideGauge({ upsidePct }: { upsidePct: number }) {
  const isNegative = upsidePct < 0;
  const width = isNegative ? 4 : Math.max(4, Math.min((upsidePct / 40) * 100, 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={`h-full rounded-full transition-all duration-500 ${isNegative ? "bg-rose-400" : "bg-emerald-400"}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function StockRow({ item, isExpanded, onToggle, onRemove }: { item: WatchlistItem; isExpanded: boolean; onToggle: () => void; onRemove: (id: string) => void; }) {
  const sinceChecked = item?.deltas?.since_last_checked_pct ?? 0;
  const sinceWatchlisted = item?.deltas?.since_watchlisted_pct ?? 0;
  const dayChange = item?.day_change_pct ?? 0;
  const currentPrice = item?.current_price ?? 0;
  const catalyst = item?.catalyst || { is_anomaly: false, direction: "up", tag: "", summary: "" };
  const analyst_consensus = item?.analyst_consensus || { rating: "Hold", recent_shift: "Tracking", target_price: currentPrice, upside_pct: 0 };
  const financials = item?.financials || { latest_quarter: "Current", beat_status: "Pending", revenue_yoy: "N/A" };

  return (
    <div className={`rounded-2xl border transition-colors ${isExpanded ? "border-zinc-700 bg-zinc-900/80" : "border-zinc-800/80 bg-zinc-900/40"}`}>
      <div className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left cursor-pointer" onClick={onToggle}>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0">
            <div className="font-[family-name:var(--font-mono)] text-sm font-semibold text-zinc-100">{item.ticker}</div>
          </div>
        </div>
        <div className="hidden items-center gap-8 sm:flex">
          <div className="w-24 text-right">
            <div className="font-[family-name:var(--font-mono)] text-sm text-zinc-100">{fmtPrice(currentPrice)}</div>
            <div className={`text-xs ${pctColor(dayChange)}`}>{fmtPct(dayChange)} today</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {catalyst.is_anomaly ? <CatalystBadge catalyst={catalyst} /> : null}
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} 
            className="rounded border border-transparent px-2 py-1 text-xs text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all z-10">
            Remove
          </button>
          <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>
      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-zinc-800/80 px-4 py-5">
            {catalyst.is_anomaly && <p className="mb-5 text-sm leading-relaxed text-zinc-400">{catalyst.summary}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500"><Target className="h-3.5 w-3.5" />Analyst consensus</div>
                <div className="flex items-center justify-between">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${ratingStyles(analyst_consensus.rating)}`}>{analyst_consensus.rating}</span>
                  <span className="text-xs text-zinc-500">{analyst_consensus.recent_shift}</span>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-xs text-zinc-500">
                    <span>Target {fmtPrice(analyst_consensus.target_price)}</span>
                    <span className={pctColor(analyst_consensus.upside_pct)}>{fmtPct(analyst_consensus.upside_pct)} upside</span>
                  </div>
                  <div className="mt-2"><UpsideGauge upsidePct={analyst_consensus.upside_pct} /></div>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-zinc-500"><span className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" />Financials</span><span>{financials.latest_quarter}</span></div>
                <div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${beatStyles(financials.beat_status)}`}>{financials.beat_status}</span></div>
                <div className="mt-4">
                  <div className="text-xs text-zinc-500">Revenue YoY</div>
                  <div className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-zinc-100">{financials.revenue_yoy}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchlistSection({ watchlist, expandedKey, onToggle, onRemove }: { watchlist: Watchlist; expandedKey: string | null; onToggle: (key: string) => void; onRemove: (id: string) => void; }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">{watchlist.name}</h2>
        <span className="text-xs text-zinc-500">{watchlist.items.length} stocks</span>
      </div>
      <div className="space-y-2">
        {watchlist.items.map((item) => {
          const key = `${watchlist.id}-${item.ticker}`;
          return <StockRow key={key} item={item} isExpanded={expandedKey === key} onToggle={() => onToggle(key)} onRemove={onRemove} />;
        })}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-10">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-800/80" />
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-2xl border border-zinc-800/60 bg-zinc-900/40" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-6 py-10 text-center">
      <AlertCircle className="h-6 w-6 text-rose-400" />
      <div>
        <p className="text-sm font-medium text-zinc-200">Couldn&apos;t reach your data</p>
        <p className="mt-1 text-xs text-zinc-500">{message}</p>
      </div>
      <button onClick={onRetry} className="mt-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800">
        Try again
      </button>
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const [wlRes, catRes] = await Promise.all([ 
          fetch(API_URL, { cache: "no-store" }), 
          fetch(`${API_BASE}/api/market/catalog`, { cache: "no-store" }) 
        ]);
        const json = await wlRes.json();
        const catJson = await catRes.json();
        if (!cancelled) { setData(json); setCatalog(catJson); setStatus("success"); }
      } catch (err) { 
        if (!cancelled) setStatus("error"); 
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleSyncSession = async () => {
    await fetch(`${API_BASE}/api/session/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "test_investor" }) });
    setRefreshKey((k) => k + 1);
  };

  const handleAddToWatchlist = async (ticker: string) => {
    const defaultWlId = data?.watchlists?.[0]?.id;
    if (defaultWlId) {
      await fetch(`${API_BASE}/api/watchlist/add`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "test_investor", watchlist_id: defaultWlId, ticker }) });
      setRefreshKey((k) => k + 1);
    }
  };

  const handleRemoveFromWatchlist = async (itemId: string) => {
    await fetch(`${API_BASE}/api/watchlist/remove/${itemId}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
  };

  const totalStocks = data?.watchlists?.reduce((sum, wl) => sum + wl.items.length, 0) ?? 0;

  return (
    <main className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} relative min-h-screen bg-zinc-950 font-[family-name:var(--font-display)] text-zinc-100`}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(52,211,153,0.08),transparent)]" />
      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Smart Watchlist</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {data ? `Tracking ${totalStocks} ${totalStocks === 1 ? "stock" : "stocks"} for ${data.user}` : "Initializing secure connection..."}
            </p>
          </div>
          <button onClick={handleSyncSession} className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            <RefreshCw className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} /> Sync
          </button>
        </header>

        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState message="Could not load backend data." onRetry={() => setRefreshKey((k) => k + 1)} />}

        {status === "success" && catalog.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Market Feed
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {catalog.filter((item) => !data?.watchlists?.some((wl) => wl.items.some((wlItem) => wlItem.ticker === item.ticker))).map((item) => (
                <div key={item.ticker} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-[family-name:var(--font-mono)] font-semibold text-zinc-100">{item.ticker}</span>
                    <span className={`text-xs ${pctColor(item.day_change_pct)}`}>{fmtPct(item.day_change_pct)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="font-[family-name:var(--font-mono)] text-sm">{fmtPrice(item.current_price)}</span>
                    <button onClick={() => handleAddToWatchlist(item.ticker)} className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">+ Add</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {status === "success" && data && (
          <div className="space-y-10">
            {data.watchlists.map((wl) => (
              <WatchlistSection key={wl.id} watchlist={wl} expandedKey={expandedKey} onToggle={(key) => setExpandedKey((prev) => (prev === key ? null : key))} onRemove={handleRemoveFromWatchlist} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}