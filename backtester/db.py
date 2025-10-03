"""SQLite persistence layer for backtest runs.

Schema (version 1):
  runs(run_id TEXT PRIMARY KEY, started_utc TEXT, mode TEXT, config_json TEXT)
  strategies(id INTEGER PK, run_id TEXT, symbol TEXT,
             rsi_period INTEGER, rsi_buy_below REAL, rsi_sell_above REAL,
             params_json TEXT, metrics_json TEXT,
             total_return REAL, cagr REAL, sharpe REAL, sortino REAL,
             vol REAL, maxdd REAL, win_rate REAL, net_win_rate REAL, avg_trade_pnl REAL,
             FOREIGN KEY(run_id) REFERENCES runs(run_id))
  portfolio(id INTEGER PK, run_id TEXT UNIQUE, metrics_json TEXT,
            total_return REAL, cagr REAL, sharpe REAL, sortino REAL,
            vol REAL, maxdd REAL,
            FOREIGN KEY(run_id) REFERENCES runs(run_id))
  portfolio_weights(id INTEGER PK, run_id TEXT, symbol TEXT, weight REAL,
                    FOREIGN KEY(run_id) REFERENCES runs(run_id))

Lightweight helper functions:
  init_db(db_path) -> ensures schema
  ensure_run_row(run_id, mode, config_dict)
  insert_strategy_metrics(run_id, symbol, params, metrics)
  insert_portfolio_metrics(run_id, metrics, weights_dict)

Design goals:
  - Keep common numeric metrics in dedicated columns for fast filtering.
  - Preserve full metrics/params as JSON for forward compatibility (new metrics won't break schema).
  - Avoid long-lived connections; open per operation (sufficient for modest run sizes).
"""
from __future__ import annotations
import os, json, sqlite3, time, threading
from typing import Dict, Any, List

_lock = threading.Lock()

# ------------ Path handling ------------
def _normalize_path(path: str) -> str:
    if path.lower().endswith((".db", ".sqlite")):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path
    os.makedirs(path, exist_ok=True)
    return os.path.join(path, "backtests.db")

# ------------ Init ------------
def init_db(db_path: str) -> str:
    """Initialize database with unified schema. Handles legacy conflicts by schema reset if needed."""
    db_file = _normalize_path(db_path)
    
    with _lock, sqlite3.connect(db_file) as con:
        cur = con.cursor()
        
        # Check if we have legacy schema conflicts that can't be migrated cleanly
        needs_reset = False
        try:
            # Check portfolio_weights table
            cur.execute("PRAGMA table_info(portfolio_weights);")
            pw_cols = {row[1] for row in cur.fetchall()}
            if pw_cols and "target_weight" not in pw_cols:
                needs_reset = True
            
            # Check runs table for missing completed_at
            cur.execute("PRAGMA table_info(runs);")
            runs_cols = {row[1] for row in cur.fetchall()}
            if runs_cols and "completed_at" not in runs_cols:
                needs_reset = True
            
            # Check portfolio table for missing metric columns
            cur.execute("PRAGMA table_info(portfolio);")
            p_cols = {row[1] for row in cur.fetchall()}
            if p_cols and ("win_rate" not in p_cols or "created_at" not in p_cols):
                needs_reset = True
                
            if needs_reset:
                print("[DB] Detected legacy schema conflicts. Resetting database schema...")
        except sqlite3.OperationalError:
            pass
        
        if needs_reset:
            # Backup existing data and recreate with unified schema
            backup_data = {}
            try:
                # Get runs table structure first
                cur.execute("PRAGMA table_info(runs);")
                runs_cols = [row[1] for row in cur.fetchall()]
                backup_data['runs'] = cur.execute("SELECT * FROM runs").fetchall()
                backup_data['runs_cols'] = runs_cols
            except: pass
            try:
                backup_data['strategies'] = cur.execute("SELECT * FROM strategies").fetchall()
            except: pass
            
            # Drop ALL tables for clean reset (runs table may also need schema update)
            for table in ['portfolio', 'portfolio_weights', 'trades', 'runs', 'strategies']:
                try:
                    cur.execute(f"DROP TABLE IF EXISTS {table}")
                except: pass
        
        # Create unified schema
        cur.execute("""
        CREATE TABLE IF NOT EXISTS runs(
          run_id TEXT PRIMARY KEY,
          notes TEXT,
          mode TEXT,
          started_at REAL,
          completed_at REAL,
          benchmark_equity_json TEXT,
          config_json TEXT
        );""")
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS strategies(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT,
          ticker TEXT,
          total_return REAL,
          cagr REAL,
          sharpe REAL,
          sortino REAL,
          vol REAL,
          maxdd REAL,
          win_rate REAL,
          net_win_rate REAL,
          avg_trade_pnl REAL,
          trades_total INTEGER,
          params_json TEXT,
          metrics_json TEXT,
          equity_json TEXT,
          events_json TEXT,
          created_at REAL,
          FOREIGN KEY(run_id) REFERENCES runs(run_id)
        );""")
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS portfolio(
          run_id TEXT PRIMARY KEY,
          total_return REAL,
          cagr REAL,
          sharpe REAL,
          sortino REAL,
          vol REAL,
          maxdd REAL,
          win_rate REAL,
          net_win_rate REAL,
          avg_trade_pnl REAL,
          trades_total INTEGER,
          metrics_json TEXT,
          equity_json TEXT,
          buyhold_equity_json TEXT,
          per_ticker_equity_json TEXT,
          created_at REAL,
          FOREIGN KEY(run_id) REFERENCES runs(run_id)
        );""")
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_weights(
          run_id TEXT,
          ticker TEXT,
          target_weight REAL,
          PRIMARY KEY(run_id, ticker),
          FOREIGN KEY(run_id) REFERENCES runs(run_id)
        );""")
        
        cur.execute("""
        CREATE TABLE IF NOT EXISTS trades(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT,
          ticker TEXT,
          side TEXT,
          dt TEXT,
          shares INTEGER,
          price REAL,
          fees REAL,
          pnl REAL,
          extra_json TEXT,
          FOREIGN KEY(run_id) REFERENCES runs(run_id)
        );""")
        
        # Restore backup data if we reset
        if needs_reset and backup_data:
            try:
                if 'runs' in backup_data:
                    # Map old runs data to new schema (handle missing columns)
                    old_cols = backup_data.get('runs_cols', [])
                    for row in backup_data['runs']:
                        # Default values for potentially missing columns
                        run_id = row[0] if len(row) > 0 else None
                        notes = row[1] if len(row) > 1 and len(old_cols) > 1 else ""
                        mode = row[2] if len(row) > 2 and len(old_cols) > 2 else "unknown"
                        started_at = row[3] if len(row) > 3 and len(old_cols) > 3 else time.time()
                        completed_at = row[4] if len(row) > 4 and len(old_cols) > 4 else None
                        
                        if run_id:
                            cur.execute("INSERT OR IGNORE INTO runs VALUES (?,?,?,?,?)", 
                                      (run_id, notes, mode, started_at, completed_at))
            except Exception as e:
                print(f"[DB] Warning: Could not restore runs backup: {e}")
                pass
        
        # Create indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_strat_run ON strategies(run_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_strat_run_ticker ON strategies(run_id, ticker);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_trades_run ON trades(run_id);")
        
        con.commit()
    return db_file# ------------ Run bookkeeping ------------
def ensure_run(db_file: str, run_id: str, mode: str, notes: str = ""):
    now = time.time()
    with _lock, sqlite3.connect(db_file) as con:
        cur = con.cursor()
        cur.execute("SELECT 1 FROM runs WHERE run_id=?;", (run_id,))
        if cur.fetchone() is None:
            cur.execute("INSERT INTO runs(run_id,notes,mode,started_at,completed_at) VALUES (?,?,?,?,NULL)",
                        (run_id, notes, mode, now))
        con.commit()

def finalize_run(db_file: str, run_id: str):
    with _lock, sqlite3.connect(db_file) as con:
        con.execute("UPDATE runs SET completed_at=? WHERE run_id=?;", (time.time(), run_id))
        con.commit()

def update_run_benchmark(db_file: str, run_id: str, benchmark_equity_json: str = None, config_json: str = None):
    """Update run with benchmark equity curve and config snapshot."""
    with _lock, sqlite3.connect(db_file) as con:
        con.execute("""
            UPDATE runs 
            SET benchmark_equity_json=?, config_json=? 
            WHERE run_id=?
        """, (benchmark_equity_json, config_json, run_id))
        con.commit()

# ------------ Helpers ------------
def _json(obj: Any) -> str:
    return json.dumps(obj, separators=(",", ":"), default=str)

# ------------ Inserts ------------
def insert_strategy_metrics(db_file: str, run_id: str, ticker: str,
                            params: Dict[str, Any], metrics: Dict[str, Any],
                            equity_json: str = None, events_json: str = None,
                            buyhold_json: str = None):
    core = {k: metrics.get(k) for k in [
        "total_return","cagr","sharpe","sortino","vol","maxdd",
        "win_rate","net_win_rate","avg_trade_pnl","trades_total"
    ]}
    with _lock, sqlite3.connect(db_file) as con:
        con.execute("""
        INSERT INTO strategies(run_id,ticker,total_return,cagr,sharpe,sortino,vol,maxdd,
                               win_rate,net_win_rate,avg_trade_pnl,trades_total,
                               params_json,metrics_json,created_at,equity_json,events_json,buyhold_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            run_id, ticker,
            core["total_return"], core["cagr"], core["sharpe"], core["sortino"],
            core["vol"], core["maxdd"], core["win_rate"], core["net_win_rate"],
            core["avg_trade_pnl"], core["trades_total"],
            _json(params), _json(metrics), time.time(), equity_json, events_json, buyhold_json
        ))
        con.commit()

def insert_portfolio_metrics(db_file: str, run_id: str, metrics: Dict[str, Any],
                            equity_json: str = None, buyhold_equity_json: str = None,
                            per_ticker_equity_json: str = None):
    core = {k: metrics.get(k) for k in [
        "total_return","cagr","sharpe","sortino","vol","maxdd",
        "win_rate","net_win_rate","avg_trade_pnl","trades_total"
    ]}
    with _lock, sqlite3.connect(db_file) as con:
        con.execute("""
        INSERT OR REPLACE INTO portfolio(run_id,total_return,cagr,sharpe,sortino,vol,maxdd,
                                         win_rate,net_win_rate,avg_trade_pnl,trades_total,
                                         metrics_json,equity_json,buyhold_equity_json,
                                         per_ticker_equity_json,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            run_id,
            core["total_return"], core["cagr"], core["sharpe"], core["sortino"],
            core["vol"], core["maxdd"], core["win_rate"], core["net_win_rate"],
            core["avg_trade_pnl"], core["trades_total"],
            _json(metrics), equity_json, buyhold_equity_json, per_ticker_equity_json, time.time()
        ))
        con.commit()

def insert_portfolio_weights(db_file: str, run_id: str, weights: Dict[str, float]):
    if not weights: return
    rows = [(run_id, t, float(w)) for t, w in weights.items()]
    with _lock, sqlite3.connect(db_file) as con:
        con.executemany(
            "INSERT OR REPLACE INTO portfolio_weights(run_id, ticker, target_weight) VALUES (?,?,?)",
            rows
        )
        con.commit()

def insert_trades(db_file: str, run_id: str, trades: List[Dict[str, Any]]):
    if not trades: return
    rows = []
    for tr in trades:
        dt = tr.get("date")
        if hasattr(dt, "isoformat"): dt = dt.isoformat()
        rows.append((
            run_id,
            tr.get("ticker"),
            tr.get("side"),
            dt,
            tr.get("shares"),
            tr.get("price"),
            tr.get("fees", 0.0),
            tr.get("pnl"),
            _json({k:v for k,v in tr.items()
                   if k not in {"date","ticker","side","shares","price","fees","pnl"}})
        ))
    with _lock, sqlite3.connect(db_file) as con:
        con.executemany("""
        INSERT INTO trades(run_id,ticker,side,dt,shares,price,fees,pnl,extra_json)
        VALUES (?,?,?,?,?,?,?,?,?)""", rows)
        con.commit()

__all__ = [
    "init_db","ensure_run","finalize_run","update_run_benchmark",
    "insert_strategy_metrics","insert_portfolio_metrics",
    "insert_portfolio_weights","insert_trades"
]
