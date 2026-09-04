from datetime import datetime, timezone
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.database import supabase
from app.models import UserSessionUpdate, WatchlistItemAdd

app = FastAPI(title="Smart Market Watchlist Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MARKET_DATA: Dict[str, Dict[str, Any]] = {
    "MSFT": {
        "name": "Microsoft Corp",
        "current_price": 510.12,
        "day_change_pct": -1.24,
        "historical_hourly_price": 525.10,
        "catalyst": {
            "is_anomaly": True,
            "direction": "down",
            "tag": "Guidance Lowered",
            "summary": "Lowered Q3 cloud margin guidance during tech summit.",
            "news_headline": "Tech pulls back as bond yields surge amid rate concerns."
        },
        "analyst_consensus": {
            "rating": "Strong Buy",
            "recent_shift": "Maintained",
            "target_price": 571.38,
            "upside_pct": 12.01,
            "breakdown": {"strong_buy": 41, "buy": 15, "hold": 5, "sell": 0, "strong_sell": 0}
        },
        "financials": {
            "latest_quarter": "Q2 2026",
            "beat_status": "Beat",
            "revenue_yoy": "+18%",
            "eps_actual": 3.10,
            "eps_expected": 2.95
        }
    },
    "NVDA": {
        "name": "Nvidia Corporation",
        "current_price": 228.45,
        "day_change_pct": 1.80,
        "historical_hourly_price": 222.10,
        "catalyst": {
            "is_anomaly": True,
            "direction": "up",
            "tag": "Data Center Demand",
            "summary": "Announced next-gen AI rack architecture with hyperscaler pre-orders.",
            "news_headline": "Semiconductor sector rallies led by enterprise AI infrastructure demand."
        },
        "analyst_consensus": {
            "rating": "Strong Buy",
            "recent_shift": "Upgraded",
            "target_price": 265.00,
            "upside_pct": 16.00,
            "breakdown": {"strong_buy": 48, "buy": 10, "hold": 2, "sell": 0, "strong_sell": 0}
        },
        "financials": {
            "latest_quarter": "Q2 2026",
            "beat_status": "Beat",
            "revenue_yoy": "+122%",
            "eps_actual": 0.68,
            "eps_expected": 0.64
        }
    },
    "COST": {
        "name": "Costco Wholesale",
        "current_price": 925.41,
        "day_change_pct": -0.33,
        "historical_hourly_price": 927.00,
        "catalyst": {
            "is_anomaly": False,
            "direction": "down",
            "tag": "Earnings Ahead",
            "summary": "Consensus anticipates 6% comp sales growth ahead of earnings release.",
            "news_headline": "Retailers steady as consumer spending metrics hold firm."
        },
        "analyst_consensus": {
            "rating": "Buy",
            "recent_shift": "Maintained",
            "target_price": 960.00,
            "upside_pct": 3.74,
            "breakdown": {"strong_buy": 22, "buy": 14, "hold": 8, "sell": 1, "strong_sell": 0}
        },
        "financials": {
            "latest_quarter": "Q3 2026",
            "beat_status": "Beat",
            "revenue_yoy": "+9.1%",
            "eps_actual": 3.78,
            "eps_expected": 3.70
        }
    }
}

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Backend engine is active", "timestamp": datetime.now(timezone.utc)}

@app.get("/api/watchlist/{username}")
def get_smart_watchlist(username: str):
    user_res = supabase.table("users").select("*").eq("username", username).execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = user_res.data[0]
    user_id = user["id"]
    last_viewed_at_str = user.get("last_viewed_at")

    watchlists_res = supabase.table("watchlists").select("*").eq("user_id", user_id).execute()
    watchlists_data = watchlists_res.data or []

    result_watchlists = []

    for wl in watchlists_data:
        items_res = supabase.table("watchlist_items").select("*").eq("watchlist_id", wl["id"]).execute()
        items = items_res.data or []
        enriched_items = []

        for item in items:
            ticker = item["ticker"]
            market = MARKET_DATA.get(ticker, {
                "name": ticker,
                "current_price": float(item["watchlisted_price"]),
                "day_change_pct": 0.0,
                "historical_hourly_price": float(item["watchlisted_price"]),
                "catalyst": {"is_anomaly": False, "tag": "Standard Tracking", "summary": "No notable catalysts detected."},
                "analyst_consensus": {"rating": "Hold", "target_price": float(item["watchlisted_price"]), "upside_pct": 0.0, "breakdown": {}},
                "financials": {"latest_quarter": "N/A", "beat_status": "In-Line", "revenue_yoy": "0%", "eps_actual": 0, "eps_expected": 0}
            })

            curr_price = market["current_price"]
            entry_price = float(item["watchlisted_price"])
            session_baseline = market["historical_hourly_price"]

            since_watchlisted_pct = round(((curr_price - entry_price) / entry_price) * 100, 2)
            since_last_checked_pct = round(((curr_price - session_baseline) / session_baseline) * 100, 2)

            enriched_items.append({
                "ticker": ticker,
                "name": market["name"],
                "current_price": curr_price,
                "day_change_pct": market["day_change_pct"],
                "deltas": {
                    "since_last_checked_pct": since_last_checked_pct,
                    "last_checked_at": last_viewed_at_str,
                    "since_watchlisted_pct": since_watchlisted_pct,
                    "watchlisted_at": item["watchlisted_at"]
                },
                "catalyst": market["catalyst"],
                "analyst_consensus": market["analyst_consensus"],
                "financials": market["financials"],
                "is_stale": False
            })

        result_watchlists.append({
            "id": wl["id"],
            "name": wl["name"],
            "intent": wl.get("intent", "General"),
            "items": enriched_items
        })

    return {
        "user": username,
        "last_viewed_at": last_viewed_at_str,
        "watchlists": result_watchlists
    }

@app.post("/api/session/update")
def update_last_viewed(session: UserSessionUpdate):
    now_iso = datetime.now(timezone.utc).isoformat()
    response = supabase.table("users").update({"last_viewed_at": now_iso}).eq("username", session.username).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "last_viewed_at": response.data[0]["last_viewed_at"]}