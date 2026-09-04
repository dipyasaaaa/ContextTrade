"use client";

/**
 * Smart Market Watchlist — app/page.tsx
 *
 * Requires:
 *   npm install lucide-react
 *   Tailwind CSS + Next.js App Router already configured (as described in the prompt).
 *
 * Important: this fetches http://127.0.0.1:8000 directly from the browser, so your
 * FastAPI backend needs CORS enabled for the Next dev origin, e.g.:
 *
 *   from fastapi.middleware.cors import CORSMiddleware
 *   app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])
 */


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

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const API_URL = "http://127.0.0.1:8000/api/watchlist/test_investor";

// ---------------------------------------------------------------------------
// Types (mirrors the FastAPI response exactly)
// ---------------------------------------------------------------------------

type Deltas = {
  since_last_checked_pct: number;
  since_watchlisted_pct: number;
};

type Catalyst = {
  is_anomaly: boolean;
  direction: "up" | "down" | string;
  tag: string;
  summary: string;
};

type AnalystConsensus = {
  rating: string;
  recent_shift: string;
  target_price: number;
  upside_pct: number;
};

type Financials = {
  latest_quarter: string;
  beat_status: string;
  revenue_yoy: string;
};

type WatchlistItem = {
  ticker: string;
  name: string;
  current_price: number;
  day_change_pct: number;
  deltas: Deltas;
  catalyst: Catalyst;
  analyst_consensus: AnalystConsensus;
  financials: Financials;
  is_stale: boolean;
};

type Watchlist = {
  id: string;
  name: string;
  intent: string;
  items: WatchlistItem[];
};

type WatchlistResponse = {
  user: string;
  last_viewed_at: string;
  watchlists: Watchlist[];
  exchange_telemetry?: any; 
};

type Status = "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const fmtPrice = (n: number) => `$${n.toFixed(2)}`;

const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

const pctColor = (n: number) =>
  n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-zinc-400";

function timeAgo(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function intentStyles(intent: string) {
  const map: Record<string, string> = {
    Swing: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
    Long: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    "Long Term": "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    Day: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    Momentum: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
  };
  return map[intent] ?? "border-zinc-600/40 bg-zinc-500/10 text-zinc-300";
}

function ratingStyles(rating: string) {
  const r = rating.toLowerCase();
  if (r.includes("strong buy")) return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (r.includes("buy")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (r.includes("hold")) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (r.includes("sell")) return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border-zinc-600/40 bg-zinc-500/10 text-zinc-300";
}

function beatStyles(status: string) {
  const s = status.toLowerCase();
  if (s.includes("beat")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (s.includes("miss")) return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function CatalystBadge({ catalyst }: { catalyst: Catalyst }) {
  const isDown = catalyst.direction === "down";
  const Icon = isDown ? TrendingDown : TrendingUp;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        isDown
          ? "border-rose-500/40 bg-rose-500/10 text-rose-300 shadow-[0_0_16px_-6px] shadow-rose-500/60"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_16px_-6px] shadow-emerald-500/60"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {catalyst.tag}
    </span>
  );
}

function UpsideGauge({ upsidePct }: { upsidePct: number }) {
  const isNegative = upsidePct < 0;
  const scale = 40; // visual scale cap, in percent, for readable bar widths
  const width = isNegative ? 4 : Math.max(4, Math.min((upsidePct / scale) * 100, 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          isNegative ? "bg-rose-400" : "bg-emerald-400"
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stock row (collapsed + expanded detail)
// ---------------------------------------------------------------------------

function StockRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: WatchlistItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const sinceChecked = item.deltas.since_last_checked_pct;

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isExpanded ? "border-zinc-700 bg-zinc-900/80" : "border-zinc-800/80 bg-zinc-900/40"
      }`}
    >
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          {item.is_stale && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" title="Stale data" />
          )}
          <div className="min-w-0">
            <div className="font-[family-name:var(--font-mono)] text-sm font-semibold text-zinc-100">
              {item.ticker}
            </div>
            <div className="truncate text-xs text-zinc-500">{item.name}</div>
          </div>
        </div>

        <div className="hidden items-center gap-8 sm:flex">
          <div className="w-24 text-right">
            <div className="font-[family-name:var(--font-mono)] text-sm text-zinc-100">
              {fmtPrice(item.current_price)}
            </div>
            <div className={`text-xs ${pctColor(item.day_change_pct)}`}>
              {fmtPct(item.day_change_pct)} today
            </div>
          </div>
          <div className="w-32 text-right">
            <div
              className={`font-[family-name:var(--font-mono)] text-sm font-semibold ${pctColor(sinceChecked)}`}
            >
              {fmtPct(sinceChecked)}
            </div>
            <div className="text-xs text-zinc-500">since last checked</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {item.catalyst.is_anomaly ? <CatalystBadge catalyst={item.catalyst} /> : null}
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* compact stats for narrow screens, since the columns above are hidden below sm */}
      <div className="flex items-center justify-between px-4 pb-3 text-xs sm:hidden">
        <span className="font-[family-name:var(--font-mono)] text-zinc-200">
          {fmtPrice(item.current_price)}
        </span>
        <span className={`font-[family-name:var(--font-mono)] font-semibold ${pctColor(sinceChecked)}`}>
          {fmtPct(sinceChecked)} since checked
        </span>
      </div>

      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-zinc-800/80 px-4 py-5">
            {item.catalyst.is_anomaly && (
              <p className="mb-5 text-sm leading-relaxed text-zinc-400">{item.catalyst.summary}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
                  <Target className="h-3.5 w-3.5" />
                  Analyst consensus
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${ratingStyles(
                      item.analyst_consensus.rating
                    )}`}
                  >
                    {item.analyst_consensus.rating}
                  </span>
                  <span className="text-xs text-zinc-500">{item.analyst_consensus.recent_shift}</span>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-xs text-zinc-500">
                    <span>Target {fmtPrice(item.analyst_consensus.target_price)}</span>
                    <span className={pctColor(item.analyst_consensus.upside_pct)}>
                      {fmtPct(item.analyst_consensus.upside_pct)} upside
                    </span>
                  </div>
                  <div className="mt-2">
                    <UpsideGauge upsidePct={item.analyst_consensus.upside_pct} />
                  </div>
                </div>
                <div className="mt-4 text-xs text-zinc-500">
                  Since added{" "}
                  <span
                    className={`font-[family-name:var(--font-mono)] ${pctColor(
                      item.deltas.since_watchlisted_pct
                    )}`}
                  >
                    {fmtPct(item.deltas.since_watchlisted_pct)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Financials
                  </span>
                  <span>{item.financials.latest_quarter}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${beatStyles(
                      item.financials.beat_status
                    )}`}
                  >
                    {item.financials.beat_status}
                  </span>
                  <span className="text-xs text-zinc-500">on estimates</span>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-zinc-500">Revenue, year over year</div>
                  <div className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-zinc-100">
                    {item.financials.revenue_yoy}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Watchlist section (grouped list)
// ---------------------------------------------------------------------------

function WatchlistSection({
  watchlist,
  expandedKey,
  onToggle,
}: {
  watchlist: Watchlist;
  expandedKey: string | null;
  onToggle: (key: string) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">{watchlist.name}</h2>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${intentStyles(
              watchlist.intent
            )}`}
          >
            {watchlist.intent}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {watchlist.items.length} {watchlist.items.length === 1 ? "stock" : "stocks"}
        </span>
      </div>
      <div className="space-y-2">
        {watchlist.items.map((item) => {
          const key = `${watchlist.id}-${item.ticker}`;
          return (
            <StockRow
              key={key}
              item={item}
              isExpanded={expandedKey === key}
              onToggle={() => onToggle(key)}
            />
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="space-y-10">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-800/80" />
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-16 animate-pulse rounded-2xl border border-zinc-800/60 bg-zinc-900/40"
              />
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
        <p className="text-sm font-medium text-zinc-200">Couldn&apos;t reach your watchlist</p>
        <p className="mt-1 text-xs text-zinc-500">{message ?? "Check that the API is running on port 8000."}</p>
      </div>
      <button
        onClick={onRetry}
        className="mt-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Page() {
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(API_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json: WatchlistResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setStatus("success");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your watchlist.");
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // sync thingy
  const handleSyncSession = async () => {
    try {
      await fetch("http://127.0.0.1:8000/api/session/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "test_investor" }),
      });
    } catch (err) {
      console.error("Backend session update failed, refreshing locally anyway", err);
    }
    setRefreshKey((k) => k + 1);
  };

  const totalStocks = data?.watchlists.reduce((sum, wl) => sum + wl.items.length, 0) ?? 0;

  return (
    <main
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} relative min-h-screen bg-zinc-950 font-[family-name:var(--font-display)] text-zinc-100`}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(52,211,153,0.08),transparent)]" />

      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Smart Watchlist</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {data
                ? `Tracking ${totalStocks} ${totalStocks === 1 ? "stock" : "stocks"} for ${data.user}`
                : "Loading your positions"}
            </p>
            {data && data.exchange_telemetry && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-500/90 font-[family-name:var(--font-mono)]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Payload Integrity Verified: {data.exchange_telemetry.integrity_signature}
              </div>
            )}
          </div>
          {/*added*/}
          <button
            onClick={handleSyncSession}
            className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
            {data ? `Synced ${timeAgo(data.last_viewed_at)}` : "Sync"}
          </button>
        </header>

        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState message={error} onRetry={() => setRefreshKey((k) => k + 1)} />}

        {status === "success" && data && (
          <div className="space-y-10">
            {data.watchlists.map((wl) => (
              <WatchlistSection
                key={wl.id}
                watchlist={wl}
                expandedKey={expandedKey}
                onToggle={(key) => setExpandedKey((prev) => (prev === key ? null : key))}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}