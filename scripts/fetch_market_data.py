"""
fetch_market_data.py
────────────────────
Descarga datos de mercado de FRED (gratis) y los guarda en
public/data/market_snapshot.json.

Configuración:
    export FRED_API_KEY="tu_clave_aqui"   # o pon la clave directamente abajo
    python scripts/fetch_market_data.py

API key gratuita: https://fred.stlouisfed.org/docs/api/api_key.html
"""

import json
import os
import sys
import time
import requests
from datetime import datetime, timezone, date, timedelta
from pathlib import Path

# ── Rutas ──────────────────────────────────────────────────────────────────────
ROOT    = Path(__file__).parent.parent
OUT_DIR = ROOT / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_FILE = OUT_DIR / "market_snapshot.json"

# ── FRED API key ───────────────────────────────────────────────────────────────
FRED_KEY = os.environ.get("FRED_API_KEY", "")
if not FRED_KEY:
    print("⚠️  FRED_API_KEY no configurada. Pon tu clave en la variable de entorno.")
    print("   Obtén una gratis en: https://fred.stlouisfed.org/docs/api/api_key.html")
    sys.exit(1)

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

# ── Helper general ─────────────────────────────────────────────────────────────
def safe(fn):
    try:
        return fn()
    except Exception as e:
        print(f"  ⚠️  {e}")
        return None


# ── FRED helpers ───────────────────────────────────────────────────────────────
def _fred_obs(series_id, start=None, end=None, frequency=None, units=None):
    """Devuelve lista de {date, value} del FRED."""
    params = {
        "series_id":  series_id,
        "api_key":    FRED_KEY,
        "file_type":  "json",
        "sort_order": "asc",
    }
    if start:     params["observation_start"] = start
    if end:       params["observation_end"]   = end
    if frequency: params["frequency"]         = frequency
    if units:     params["units"]             = units

    r = requests.get(FRED_BASE, params=params, timeout=15)
    r.raise_for_status()
    obs = r.json().get("observations", [])
    return [{"date": o["date"], "value": float(o["value"])}
            for o in obs if o["value"] != "."]


def fred_latest(series_id, start="2020-01-01"):
    """Último valor disponible de una serie."""
    obs = _fred_obs(series_id, start=start)
    return obs[-1]["value"] if obs else None


def fred_history(series_id, start="2000-01-01"):
    """Historial completo desde `start`."""
    return _fred_obs(series_id, start=start)


def yoy_pct(obs_list):
    """
    Calcula variación YoY a partir de una lista [{date, value}].
    Busca el valor de hace ~12 meses y calcula (actual - hace12m) / hace12m * 100.
    Devuelve sólo el último valor calculado (float) o None.
    """
    if len(obs_list) < 13:
        return None
    # Tomar últimos 24 puntos para asegurar encontrar hace 12m
    recent = obs_list[-24:]
    last   = recent[-1]
    last_d = datetime.strptime(last["date"], "%Y-%m-%d")
    # Buscar el punto más cercano a 12 meses antes
    target = last_d - timedelta(days=365)
    best   = min(recent[:-1], key=lambda o: abs(
        (datetime.strptime(o["date"], "%Y-%m-%d") - target).days))
    if best["value"] == 0:
        return None
    return round((last["value"] - best["value"]) / best["value"] * 100, 2)


def yoy_history(obs_list):
    """
    Genera serie histórica de variaciones YoY [{date, value}].
    Asume frecuencia mensual (12 obs = 1 año).
    """
    result = []
    for i in range(12, len(obs_list)):
        curr  = obs_list[i]
        prev  = obs_list[i - 12]
        if prev["value"] != 0:
            chg = round((curr["value"] - prev["value"]) / prev["value"] * 100, 2)
            result.append({"date": curr["date"], "value": chg})
    return result


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN: RENTA VARIABLE
# (PE ratios vienen de Refinitiv — por ahora null; PNGs ya están en /charts/)
# ══════════════════════════════════════════════════════════════════════════════
def fetch_equity():
    print("📈 Equity data (PE ratios — Refinitiv, skipped)...")
    return {
        "sp500_pe_fwd":      None,
        "msci_world_pe_fwd": None,
        "msci_em_pe_fwd":    None,
        "msci_eu_pe_fwd":    None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN: RENTA FIJA  (FRED)
# ══════════════════════════════════════════════════════════════════════════════
def fetch_fixed_income():
    print("📉 Fetching fixed income from FRED...")

    # Tipos actuales
    us_3m  = fred_latest("DGS3MO")   # 3-Month Treasury CMT
    us_2y  = fred_latest("DGS2")     # 2-Year
    us_5y  = fred_latest("DGS5")     # 5-Year
    us_10y = fred_latest("DGS10")    # 10-Year
    us_30y = fred_latest("DGS30")    # 30-Year
    # Soberanos europeos (serie mensual OCDE/FRED)
    de_10y = fred_latest("IRLTLT01DEM156N")  # Alemania 10Y
    es_10y = fred_latest("IRLTLT01ESM156N")  # España 10Y

    print(f"   US 3M={us_3m}  2Y={us_2y}  5Y={us_5y}  10Y={us_10y}  30Y={us_30y}")
    print(f"   DE 10Y={de_10y}  ES 10Y={es_10y}")

    # ── Curva histórica EE.UU. (diaria, últimos 5 años) ──────────────────────
    start_hist = (date.today() - timedelta(days=5 * 365)).isoformat()
    h3m  = {o["date"]: o["value"] for o in _fred_obs("DGS3MO", start=start_hist)}
    h2y  = {o["date"]: o["value"] for o in _fred_obs("DGS2",   start=start_hist)}
    h10y = {o["date"]: o["value"] for o in _fred_obs("DGS10",  start=start_hist)}
    h30y = {o["date"]: o["value"] for o in _fred_obs("DGS30",  start=start_hist)}

    # Combinar por fecha (sólo fechas donde hay dato en 10Y)
    yield_curve_history = []
    for d_str, v10 in h10y.items():
        point = {
            "date": d_str,
            "y3m":  h3m.get(d_str),
            "y2y":  h2y.get(d_str),
            "y10y": v10,
            "y30y": h30y.get(d_str),
        }
        if all(v is not None for v in point.values()):
            yield_curve_history.append(point)

    # ── Snapshot curva actual vs hace 1 año ───────────────────────────────────
    tenors = {
        "3M":  "DGS3MO",
        "2Y":  "DGS2",
        "5Y":  "DGS5",
        "10Y": "DGS10",
        "30Y": "DGS30",
    }
    curve_now  = {}
    curve_1y   = {}
    one_year_ago = (date.today() - timedelta(days=370)).isoformat()
    for label, series in tenors.items():
        obs = _fred_obs(series, start=one_year_ago)
        if obs:
            curve_now[label]  = obs[-1]["value"]
            # valor más cercano a hace 1 año
            mid = obs[len(obs) // 2]
            curve_1y[label] = mid["value"]

    print(f"   Yield curve now: {curve_now}")

    return {
        "us_3m":  us_3m,
        "us_2y":  us_2y,
        "us_5y":  us_5y,
        "us_10y": us_10y,
        "us_30y": us_30y,
        "de_10y": de_10y,
        "es_10y": es_10y,
        "curve_now": curve_now,    # {tenor: yield}  para el gráfico de curva
        "curve_1y":  curve_1y,     # misma estructura hace 1 año
        "yield_curve_history": yield_curve_history,   # serie diaria completa
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN: MACRO  (FRED)
# ══════════════════════════════════════════════════════════════════════════════
def fetch_macro():
    print("🌍 Fetching macro from FRED...")

    # ── IPC EE.UU. ────────────────────────────────────────────────────────────
    cpi_hist_raw  = fred_history("CPIAUCSL",  start="1990-01-01")   # nivel mensual
    core_hist_raw = fred_history("CPILFESL",  start="1990-01-01")   # core
    us_cpi_yoy_hist  = yoy_history(cpi_hist_raw)
    us_core_yoy_hist = yoy_history(core_hist_raw)

    us_cpi      = us_cpi_yoy_hist[-1]["value"]  if us_cpi_yoy_hist  else None
    us_cpi_core = us_core_yoy_hist[-1]["value"] if us_core_yoy_hist else None

    # Combinar en {date, cpi, core}
    core_by_date = {o["date"]: o["value"] for o in us_core_yoy_hist}
    us_cpi_history = [
        {"date": o["date"], "cpi": o["value"], "core": core_by_date.get(o["date"])}
        for o in us_cpi_yoy_hist if o["date"] >= "2000-01-01"
    ]

    print(f"   US CPI YoY={us_cpi}%  Core={us_cpi_core}%")

    # ── IPC Eurozona (HICP, nivel 2015=100) ───────────────────────────────────
    # FRED series: HICPREA — HICP: All Items for Euro Area (2015=100, Monthly, NSA)
    eu_cpi_raw  = fred_history("HICPREA",    start="1990-01-01")
    # Core: HICPREA menos energía y alimentos no procesados —
    # FRED: "CP0000EZ19M086NEST" no siempre disponible, usamos CPGRLE01EZQ086NEST
    eu_cpi_yoy_hist = yoy_history(eu_cpi_raw)
    eu_cpi = eu_cpi_yoy_hist[-1]["value"] if eu_cpi_yoy_hist else None

    eu_cpi_history = [
        {"date": o["date"], "cpi": o["value"], "core": None}
        for o in eu_cpi_yoy_hist if o["date"] >= "2000-01-01"
    ]
    print(f"   EU CPI YoY={eu_cpi}%")

    # ── Tipos de interés ──────────────────────────────────────────────────────
    fed_funds   = fred_latest("FEDFUNDS")    # Fed Funds efectivo (mensual)
    ecb_deposit = fred_latest("ECBDFR")      # BCE tipo depósito (diario)
    print(f"   Fed Funds={fed_funds}%  ECB={ecb_deposit}%")

    # ── M2 ────────────────────────────────────────────────────────────────────
    m2_raw     = fred_history("M2SL", start="1990-01-01")   # weekly → convertir a mensual
    # Downsample a mensual (primer dato de cada mes)
    m2_monthly = {}
    for o in m2_raw:
        mon = o["date"][:7]
        if mon not in m2_monthly:
            m2_monthly[mon] = o["value"]
    m2_list  = [{"date": f"{k}-01", "value": v} for k, v in sorted(m2_monthly.items())]
    m2_yoy_hist = yoy_history(m2_list)
    us_m2_yoy   = m2_yoy_hist[-1]["value"] if m2_yoy_hist else None
    m2_history  = [{"date": o["date"], "m2_level": m2_monthly.get(o["date"][:7]),
                     "m2_yoy": o["value"]}
                   for o in m2_yoy_hist if o["date"] >= "2000-01-01"]
    print(f"   M2 YoY={us_m2_yoy}%")

    # ── Desempleo ─────────────────────────────────────────────────────────────
    us_unemp = fred_latest("UNRATE")                   # EE.UU. mensual SA
    eu_unemp = fred_latest("LRHUTTTTEZM156S")          # Eurozona mensual SA
    print(f"   Unemployment US={us_unemp}%  EU={eu_unemp}%")

    return {
        "us_cpi":          us_cpi,
        "us_cpi_core":     us_cpi_core,
        "eu_cpi":          eu_cpi,
        "eu_cpi_core":     None,    # pendiente serie core eurozona
        "fed_funds":       fed_funds,
        "ecb_deposit":     ecb_deposit,
        "us_m2_yoy":       us_m2_yoy,
        "us_pmi":          None,    # PMI no disponible en FRED
        "eu_pmi":          None,
        "us_unemployment": us_unemp,
        "eu_unemployment": eu_unemp,
        # Series históricas
        "us_cpi_history": us_cpi_history,
        "eu_cpi_history": eu_cpi_history,
        "m2_history":     m2_history,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN: SECTORES  (pendiente — necesita Refinitiv o yfinance)
# ══════════════════════════════════════════════════════════════════════════════
def fetch_sectors():
    print("🏭 Sectors skipped (need Refinitiv or yfinance).")
    return {"sp500_sectors": []}


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    print("🚀 Fetching market data...\n")

    snapshot = {
        "updated_at":   datetime.now(timezone.utc).isoformat(),
        "equity":       safe(fetch_equity),
        "fixed_income": safe(fetch_fixed_income),
        "macro":        safe(fetch_macro),
        "sectors":      safe(fetch_sectors),
    }

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2, default=str)

    print(f"\n✅ Guardado en {OUT_FILE}")
    print("   → git add public/data/market_snapshot.json && git commit -m 'data: update market snapshot' && git push")


if __name__ == "__main__":
    main()
