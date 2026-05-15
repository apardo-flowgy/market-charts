"""
fetch_market_data.py
────────────────────
Descarga datos de mercado de LSEG Refinitiv y FRED,
y los guarda en public/data/market_snapshot.json.

Uso:
    python scripts/fetch_market_data.py

Luego haz commit del JSON generado y push para actualizar la web.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

# ── Rutas ──────────────────────────────────────────────────────────────────────
ROOT    = Path(__file__).parent.parent
OUT_DIR = ROOT / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_FILE = OUT_DIR / "market_snapshot.json"

# ── Helpers ────────────────────────────────────────────────────────────────────
def safe(fn):
    """Ejecuta fn y devuelve None si falla (para no romper todo el script)."""
    try:
        return fn()
    except Exception as e:
        print(f"  ⚠️  {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN: RENTA VARIABLE
# ══════════════════════════════════════════════════════════════════════════════
def fetch_equity():
    """
    Devuelve dict con:
      - sp500_pe_fwd, msci_world_pe_fwd, msci_em_pe_fwd, msci_eu_pe_fwd
      - pe_curve: { "S&P 500": [{cum_weight, pe}, ...], "MSCI World": [...], ... }
      - bull_bear: [{date, price, phase}, ...]   (MSCI World)
      - top15_marketcap: [{year, rank, company, market_cap}, ...]
      - forecast_eps: { "S&P 500": [{year, eps_est}, ...], ... }
    """
    print("📈 Fetching equity data...")

    # TODO: importar lseg.data y sustituir los valores de ejemplo
    # import lseg.data as ld
    # ld.open_session()
    # sp500_pe = ld.get_data("0#.SPX", fields=["TR.PE.FWDPE"])  # ejemplo

    equity = {
        "sp500_pe_fwd":      None,   # e.g. 21.3
        "msci_world_pe_fwd": None,   # e.g. 18.7
        "msci_em_pe_fwd":    None,   # e.g. 12.1
        "msci_eu_pe_fwd":    None,   # e.g. 14.2

        # Curva P/E ponderado: lista de puntos (cum_weight 0-1, pe)
        # Una lista por índice
        "pe_curve": {
            "S&P 500":    [],   # [{cum_weight: 0.01, pe: 8.2}, ...]
            "MSCI World": [],
            "MSCI EM":    [],
            "MSCI Europe":[],
        },

        # Serie temporal MSCI World para bull/bear
        "bull_bear": [],    # [{date: "2020-03-01", price: 1800.2, phase: "bear"}, ...]

        # Top 15 market caps por año
        "top15_marketcap": [],   # [{year: 2024, rank: 1, company: "Apple", market_cap: 3.1e12}, ...]

        # Forecast BPA a 5 años
        "forecast_eps": {
            "S&P 500":    [],   # [{year: 2025, eps_est: 240.0}, ...]
            "MSCI World": [],
        },
    }

    # ── Aquí va el código real de Refinitiv ────────────────────────────────
    # Ejemplo de cómo añadir datos reales:
    #
    # df = ld.get_data("0#.SPX", fields=["TR.CompanyName", "TR.PE.FwdPE", "TR.CompanyMarketCap"])
    # for _, row in df.iterrows():
    #     ...
    # ──────────────────────────────────────────────────────────────────────

    return equity


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN: RENTA FIJA
# ══════════════════════════════════════════════════════════════════════════════
def fetch_fixed_income():
    """
    Devuelve dict con:
      - us_3m, us_2y, us_5y, us_10y, us_30y  (yields actuales)
      - de_10y, es_10y                         (soberanos europeos)
      - us_yield_curve_history: [{date, 3m, 2y, 10y, 30y}, ...]
    """
    print("📉 Fetching fixed income data...")

    # TODO: FRED es gratis — https://fred.stlouisfed.org/docs/api/
    # import requests
    # FRED_KEY = os.environ.get("FRED_API_KEY", "")
    # def fred(series): ...

    fixed_income = {
        "us_3m":  None,
        "us_2y":  None,
        "us_5y":  None,
        "us_10y": None,
        "us_30y": None,
        "de_10y": None,
        "es_10y": None,
        "us_yield_curve_history": [],  # [{date, 3m, 2y, 10y, 30y}, ...]
        "yield_vs_sp500": [],          # [{date, spread_10m3m, sp500_fwd_12m}, ...]
    }

    return fixed_income


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN: MACRO
# ══════════════════════════════════════════════════════════════════════════════
def fetch_macro():
    """
    Devuelve dict con inflación, tipos de interés, PMI, M2.
    Fuente principal: FRED (gratis).
    """
    print("🌍 Fetching macro data...")

    macro = {
        "us_cpi":       None,   # YoY %
        "us_cpi_core":  None,
        "eu_cpi":       None,
        "eu_cpi_core":  None,
        "fed_funds":    None,
        "ecb_deposit":  None,
        "us_m2_yoy":    None,
        "us_pmi":       None,
        "eu_pmi":       None,
        "us_unemployment": None,
        "eu_unemployment": None,
        # Series históricas
        "us_cpi_history":  [],  # [{date, cpi, core}, ...]
        "eu_cpi_history":  [],
        "m2_history":      [],
    }

    return macro


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN: SECTORES
# ══════════════════════════════════════════════════════════════════════════════
def fetch_sectors():
    """
    Rentabilidad, P/E y pesos sectoriales del S&P 500 por sector GICS.
    """
    print("🏭 Fetching sector data...")

    sectors = {
        # [{sector, return_ytd, return_1m, pe_fwd, weight}, ...]
        "sp500_sectors": [],
    }

    return sectors


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

    print(f"\n✅ Saved to {OUT_FILE}")
    print("   → git add public/data/market_snapshot.json && git commit -m 'data: update market snapshot' && git push")


if __name__ == "__main__":
    main()
