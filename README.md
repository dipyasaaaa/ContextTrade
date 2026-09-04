# ContextTrade: The Context-Aware Financial Intelligence Terminal

> A comprehensive, state-aware market data platform engineered to solve information friction for retail investors through dynamic session tracking, algorithmic attention routing, and rigorous security protocols.

## The Problem Statement

Modern retail investing platforms currently operate on static, 24-hour data reset cycles. When users check their portfolios after hours or days of inactivity, they are presented with arbitrary daily changes that fail to answer the most critical question: *What exactly happened to my portfolio since I last logged in?* 

This static architecture forces users to manually reconstruct market movements, leading to cognitive fatigue, information overload, and delayed decision-making. Furthermore, when significant price action occurs, standard watchlists fail to provide the fundamental catalysts driving those changes, leaving users blind to the underlying market mechanics.

## The ContextTrade Solution

ContextTrade transforms the standard watchlist into an intelligent, state-aware terminal. It directly answers the problem statement by bridging the gap between raw data ingestion and actionable, contextual insight. 

* **Session-Based Delta Computation:** Instead of relying on standard daily market closes, the backend engine timestamps the user's exact session. Upon return, the terminal calculates price deltas specifically tailored to their time offline, providing a personalized view of market movement.
* **Contextual Attention Routing Algorithm:** To prevent information overload, the backend dynamically sorts the user's watchlist based on absolute session volatility. The asset that experienced the highest magnitude of price change automatically defaults to the top of the interface.
* **Automated Catalyst Anomaly Detection:** The system programmatically flags underlying fundamental triggers, such as sudden shifts in analyst consensus, quarterly guidance adjustments, or macroeconomic indicators, providing immediate context alongside technical price action.

## Detailed System Architecture

The application is built on a decoupled, risk-oriented hybrid architecture, separating the client presentation state from the high-throughput market data aggregation pipeline.

### Architectural Layers

| Layer | Implementation | Core Functionality |
| :--- | :--- | :--- |
| **Presentation State** | Next.js 15, Tailwind CSS, TypeScript | Manages client-side session synchronization and renders the dynamic user interface without latency lag. |
| **API Gateway** | FastAPI (Python) Middleware | Intercepts all incoming requests, assigns unique UUID trace IDs, and calculates payload execution times. |
| **Business Logic Engine** | FastAPI Core | Executes the Attention Routing algorithm (`O(N log N)` time complexity) and computes custom session deltas. |
| **Market Data Ingestion** | `yfinance` Library | Facilitates direct live exchange integration with intelligent fallback routing and native `.NS` suffix appending for Indian equities (NSE/BSE). |
| **Persistence & Auth** | PostgreSQL (Supabase) | Maintains immutable records of user session timestamps, authentication states, and base watchlist parameters. |

## Enterprise-Grade Security and Forensics

Financial data transmission requires uncompromising transit security and auditability. ContextTrade is engineered with a risk-oriented architecture designed to guarantee payload integrity and defend against common web application vulnerabilities.

### Security Implementation Matrix

| Security Protocol | Technical Implementation | Administrative Purpose |
| :--- | :--- | :--- |
| **Anti-Tamper Integrity** | Dynamic SHA-256 cryptographic hashing | Generates session-specific signatures to guarantee frontend market payloads have not been intercepted or manipulated. |
| **Forensic Audit Logging** | Custom FastAPI Middleware | Injects UUID trace IDs and exact latency metrics into headers to enable production-level digital forensics and secure transaction tracing. |
| **Vulnerability Prevention** | Parameterized routing and Row Level Security | Strictly sanitizes inputs to prevent Cross-Site Scripting (XSS) and SQL Injection (SQLi) attacks on user session data. |

## Local Development and Installation

To deploy and test the application locally, ensure Python 3.10+ and Node.js are installed on your system.

**1. Backend Initialization**
```bash
cd app
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn yfinance supabase requests
uvicorn main:app --reload ```#

## 2. Frontend Initialization

```bash
cd frontend
npm install
npm run dev
