import { useState, useEffect } from "react";
import "./styles.css";

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtPct   = (v, decimals = 1) => v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(decimals)}%`;
const fmtNum   = (v, decimals = 1) => v == null ? "—" : v.toLocaleString("es-ES", { maximumFractionDigits: decimals });
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";

// ── Nav sections ──────────────────────────────────────────────────────────────
const TABS = [
  { id: "equity",   label: "Renta Variable" },
  { id: "fixed",    label: "Renta Fija" },
  { id: "macro",    label: "Macro" },
  { id: "sectors",  label: "Sectores" },
];

// ── Placeholder component ─────────────────────────────────────────────────────
function ChartPlaceholder({ label }) {
  return (
    <div className="chart-placeholder">
      <span className="chart-placeholder-icon">📊</span>
      <span>{label}</span>
      <span style={{ fontSize: "0.72rem", opacity: 0.6 }}>Próximamente</span>
    </div>
  );
}

// ── Metric chip ───────────────────────────────────────────────────────────────
function MetricChip({ label, value, sub, colorClass }) {
  return (
    <div className="metric-chip">
      <div className="metric-chip-label">{label}</div>
      <div className={`metric-chip-value ${colorClass ?? ""}`}>{value ?? "—"}</div>
      {sub && <div className="metric-chip-sub">{sub}</div>}
    </div>
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, note, children, style }) {
  return (
    <div className="chart-card" style={style}>
      <div className="chart-card-header">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
      {note && <p className="chart-note">{note}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB: RENTA VARIABLE
// ════════════════════════════════════════════════════════════════════════════════
function TabEquity({ data }) {
  const eq = data?.equity ?? {};

  return (
    <>
      {/* Métricas rápidas */}
      <div className="metric-strip">
        <MetricChip label="S&P 500 P/E Fwd" value={eq.sp500_pe_fwd ? fmtNum(eq.sp500_pe_fwd) + "x" : null} sub="Forward 12m" />
        <MetricChip label="MSCI World P/E Fwd" value={eq.msci_world_pe_fwd ? fmtNum(eq.msci_world_pe_fwd) + "x" : null} sub="Forward 12m" />
        <MetricChip label="MSCI EM P/E Fwd" value={eq.msci_em_pe_fwd ? fmtNum(eq.msci_em_pe_fwd) + "x" : null} sub="Forward 12m" />
        <MetricChip label="MSCI Europe P/E Fwd" value={eq.msci_eu_pe_fwd ? fmtNum(eq.msci_eu_pe_fwd) + "x" : null} sub="Forward 12m" />
      </div>

      {/* Curva de PER ponderado */}
      <ChartCard
        title="Distribución del P/E ponderado por índice"
        subtitle="Para cada índice, % de peso acumulado vs P/E forward de los componentes ordenados de menor a mayor"
        note="Fuente: LSEG Refinitiv · datos al último cierre"
      >
        <ChartPlaceholder label="Curva P/E ponderado — S&P 500, MSCI World, EM, Europa" />
      </ChartCard>

      {/* Bull / Bear periods */}
      <ChartCard
        title="Periodos alcistas y bajistas — MSCI World"
        subtitle="Precio del índice con áreas coloreadas según fase de mercado (≥20% desde mínimo = bull, ≤-20% desde máximo = bear)"
        note="Fuente: LSEG Refinitiv"
      >
        <ChartPlaceholder label="Bull / Bear market periods" />
      </ChartCard>

      {/* Grid 2 columnas */}
      <div className="chart-grid-2">
        <ChartCard
          title="Top 15 market caps por año"
          subtitle="Las 15 mayores empresas por capitalización en cada año desde 1980"
        >
          <ChartPlaceholder label="Top 15 market caps — evolución histórica" />
        </ChartCard>

        <ChartCard
          title="Evolución empleados — grandes empresas S&P 500"
          subtitle="Número de empleados de las mayores corporaciones a lo largo del tiempo"
        >
          <ChartPlaceholder label="Empleados grandes empresas S&P 500" />
        </ChartCard>
      </div>

      <ChartCard
        title="Previsión de beneficios a 5 años"
        subtitle="Estimaciones de consenso de BPA para los próximos 5 años por índice"
        note="Basado en estimaciones IBES · Fuente: LSEG Refinitiv"
      >
        <ChartPlaceholder label="Forecast BPA 5 años — S&P 500, MSCI World" />
      </ChartCard>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB: RENTA FIJA
// ════════════════════════════════════════════════════════════════════════════════
function TabFixedIncome({ data }) {
  const fi = data?.fixed_income ?? {};

  return (
    <>
      <div className="metric-strip">
        <MetricChip label="T-Bill 3M" value={fi.us_3m ? fmtNum(fi.us_3m) + "%" : null} sub="EE.UU." />
        <MetricChip label="Treasury 10Y" value={fi.us_10y ? fmtNum(fi.us_10y) + "%" : null} sub="EE.UU." />
        <MetricChip label="Bund 10Y" value={fi.de_10y ? fmtNum(fi.de_10y) + "%" : null} sub="Alemania" />
        <MetricChip
          label="Spread 10Y-3M"
          value={fi.us_10y != null && fi.us_3m != null ? fmtNum(fi.us_10y - fi.us_3m) + "pp" : null}
          sub="EE.UU."
          colorClass={fi.us_10y != null && fi.us_3m != null && fi.us_10y - fi.us_3m < 0 ? "text-red" : "text-green"}
        />
      </div>

      <ChartCard
        title="Curva de tipos EE.UU."
        subtitle="Rendimientos del Tesoro americano de 3 meses a 30 años · fecha actual vs hace 1 año"
        note="Fuente: FRED / US Treasury"
      >
        <ChartPlaceholder label="Yield curve — spot vs hace 1 año" />
      </ChartCard>

      <ChartCard
        title="Spread 10Y-3M vs rentabilidad futura del S&P 500"
        subtitle="El diferencial invertido históricamente ha precedido recesiones y bajas rentabilidades a 12-24 meses"
        note="Fuente: LSEG Refinitiv + FRED"
      >
        <ChartPlaceholder label="Yield curve (10Y-3M) vs rentabilidad futura S&P 500" />
      </ChartCard>

      <div className="chart-grid-2">
        <ChartCard title="Curva de tipos zona euro" subtitle="Tipos soberanos desde 3M hasta 30Y">
          <ChartPlaceholder label="Yield curve EUR" />
        </ChartCard>
        <ChartCard title="Spreads de crédito" subtitle="Investment grade y high yield — EE.UU. y Europa">
          <ChartPlaceholder label="Credit spreads IG / HY" />
        </ChartCard>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB: MACRO
// ════════════════════════════════════════════════════════════════════════════════
function TabMacro({ data }) {
  const macro = data?.macro ?? {};

  return (
    <>
      <div className="metric-strip">
        <MetricChip label="IPC EE.UU." value={macro.us_cpi ? fmtNum(macro.us_cpi) + "%" : null} sub="YoY" />
        <MetricChip label="IPC Eurozona" value={macro.eu_cpi ? fmtNum(macro.eu_cpi) + "%" : null} sub="YoY" />
        <MetricChip label="Fed Funds" value={macro.fed_funds ? fmtNum(macro.fed_funds) + "%" : null} sub="Límite superior" />
        <MetricChip label="BCE Depósito" value={macro.ecb_deposit ? fmtNum(macro.ecb_deposit) + "%" : null} sub="Tipo depósito" />
      </div>

      <div className="chart-grid-2">
        <ChartCard title="Inflación EE.UU. — IPC YoY" subtitle="Inflación total y subyacente desde 2000">
          <ChartPlaceholder label="CPI total vs core — EE.UU." />
        </ChartCard>
        <ChartCard title="Inflación Eurozona — HICP YoY" subtitle="Inflación total y subyacente">
          <ChartPlaceholder label="HICP total vs core — Eurozona" />
        </ChartCard>
      </div>

      <ChartCard
        title="M2 y liquidez global"
        subtitle="Masa monetaria M2 en EE.UU. y Europa — correlación histórica con activos de riesgo"
        note="Fuente: FRED"
      >
        <ChartPlaceholder label="M2 EE.UU. + M2 Eurozona" />
      </ChartCard>

      <div className="chart-grid-2">
        <ChartCard title="PMI manufacturero global" subtitle="Composite PMI de principales economías">
          <ChartPlaceholder label="PMI manufacturero — EE.UU., Europa, China" />
        </ChartCard>
        <ChartCard title="Desempleo" subtitle="Tasa de paro en EE.UU. y Eurozona">
          <ChartPlaceholder label="Unemployment rate EE.UU. vs Eurozona" />
        </ChartCard>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB: SECTORES
// ════════════════════════════════════════════════════════════════════════════════
function TabSectors({ data }) {
  return (
    <>
      <ChartCard
        title="Rentabilidad sectorial YTD — S&P 500"
        subtitle="Retorno total de cada sector GICS en lo que va de año"
        note="Fuente: LSEG Refinitiv"
      >
        <ChartPlaceholder label="Sector returns YTD — S&P 500" />
      </ChartCard>

      <div className="chart-grid-2">
        <ChartCard title="P/E por sector — S&P 500" subtitle="Forward P/E de cada sector vs media histórica">
          <ChartPlaceholder label="Sector P/E vs histórico" />
        </ChartCard>
        <ChartCard title="Peso sectorial — S&P 500" subtitle="Composición del índice por sector GICS">
          <ChartPlaceholder label="Sector weights S&P 500" />
        </ChartCard>
      </div>

      <ChartCard
        title="Rotación sectorial — momentum relativo"
        subtitle="Rendimiento relativo de sectores vs índice en distintos horizontes temporales (1m, 3m, 6m, 12m)"
      >
        <ChartPlaceholder label="Relative sector momentum" />
      </ChartCard>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [activeTab, setActiveTab] = useState("equity");
  const [data, setData]           = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/market_snapshot.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) {
          setData(json);
          setLastUpdated(json.updated_at ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "equity":  return <TabEquity data={data} />;
      case "fixed":   return <TabFixedIncome data={data} />;
      case "macro":   return <TabMacro data={data} />;
      case "sectors": return <TabSectors data={data} />;
      default:        return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="header-logo">Market<span>Charts</span></span>
            <nav className="nav-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`nav-tab${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="header-meta">
            {lastUpdated
              ? <><strong>Actualizado</strong><br />{fmtDate(lastUpdated)}</>
              : <span>Sin datos cargados</span>
            }
          </div>
        </div>
      </header>

      <main className="app-main" style={{ flex: 1 }}>
        {renderTab()}
      </main>

      <footer className="app-footer">
        <div className="footer-inner">
          <p className="footer-text">
            Datos: LSEG Refinitiv · FRED · US Treasury · Solo para uso informativo, no constituye asesoramiento de inversión.
          </p>
          <p className="footer-text" style={{ opacity: 0.5 }}>
            market-charts · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
