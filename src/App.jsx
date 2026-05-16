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

const BASE = import.meta.env.BASE_URL;

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

// ── Yield curve (tenores vs yield, dos líneas: hoy vs hace 1 año) ─────────────
function YieldCurveChart({ curveNow, curve1y }) {
  if (!curveNow || Object.keys(curveNow).length === 0) {
    return <ChartPlaceholder label="Yield curve — spot vs hace 1 año" />;
  }
  const TENORS = ["3M", "2Y", "5Y", "10Y", "30Y"];
  const W = 600, H = 220, PAD = { t: 20, r: 20, b: 36, l: 48 };
  const inner = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b };

  const nowVals = TENORS.map(t => curveNow[t] ?? null).filter(v => v != null);
  const allVals = [
    ...nowVals,
    ...TENORS.map(t => curve1y?.[t] ?? null).filter(v => v != null),
  ];
  const minY = Math.min(...allVals) - 0.2;
  const maxY = Math.max(...allVals) + 0.2;

  const xPos  = (i) => PAD.l + (i / (TENORS.length - 1)) * inner.w;
  const yPos  = (v) => PAD.t + ((maxY - v) / (maxY - minY)) * inner.h;

  const makePath = (vals) => {
    const pts = TENORS.map((t, i) => {
      const v = vals[t];
      return v != null ? [xPos(i), yPos(v)] : null;
    }).filter(Boolean);
    if (pts.length < 2) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  };

  const gridYs = [];
  const step = (maxY - minY) > 4 ? 1 : 0.5;
  for (let v = Math.ceil(minY * 2) / 2; v <= maxY; v += step) {
    gridYs.push(parseFloat(v.toFixed(1)));
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
      {/* grid */}
      {gridYs.map(v => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yPos(v)} y2={yPos(v)}
                stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
          <text x={PAD.l - 6} y={yPos(v) + 4} textAnchor="end"
                fontSize="10" fill="#6B7A8D">{v.toFixed(1)}%</text>
        </g>
      ))}
      {/* lines */}
      {curve1y && <path d={makePath(curve1y)} fill="none" stroke="#9AAABB" strokeWidth="2" strokeDasharray="5,3" />}
      <path d={makePath(curveNow)} fill="none" stroke="#1D4E89" strokeWidth="2" />
      {/* dots hoy */}
      {TENORS.map((t, i) => curveNow[t] != null && (
        <circle key={t} cx={xPos(i)} cy={yPos(curveNow[t])} r="4"
                fill="#1D4E89" stroke="#FFFFFF" strokeWidth="1.5" />
      ))}
      {/* X axis labels */}
      {TENORS.map((t, i) => (
        <text key={t} x={xPos(i)} y={H - 6} textAnchor="middle"
              fontSize="11" fill="#6B7A8D">{t}</text>
      ))}
      {/* legend */}
      <line x1={W - 120} x2={W - 100} y1={PAD.t + 10} y2={PAD.t + 10} stroke="#1D4E89" strokeWidth="2" />
      <text x={W - 96} y={PAD.t + 14} fontSize="10" fill="#3A4A5C">Hoy</text>
      {curve1y && <>
        <line x1={W - 120} x2={W - 100} y1={PAD.t + 26} y2={PAD.t + 26}
              stroke="#9AAABB" strokeWidth="2" strokeDasharray="5,3" />
        <text x={W - 96} y={PAD.t + 30} fontSize="10" fill="#6B7A8D">Hace 1 año</text>
      </>}
    </svg>
  );
}

// ── Spread histórico 10Y-3M ───────────────────────────────────────────────────
function SpreadHistoryChart({ history }) {
  if (!history || history.length < 2) {
    return <ChartPlaceholder label="Spread 10Y-3M histórico" />;
  }
  // Subsample a ~300 puntos
  const step  = Math.max(1, Math.floor(history.length / 300));
  const data  = history.filter((_, i) => i % step === 0);
  const W = 700, H = 200, PAD = { t: 20, r: 20, b: 36, l: 52 };
  const inner = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b };

  const spreads = data.map(d => (d.y10y ?? 0) - (d.y3m ?? 0));
  const minS    = Math.min(...spreads, 0) - 0.2;
  const maxS    = Math.max(...spreads, 0) + 0.2;
  const xPos    = (i) => PAD.l + (i / (data.length - 1)) * inner.w;
  const yPos    = (v) => PAD.t + ((maxS - v) / (maxS - minS)) * inner.h;
  const y0      = yPos(0);

  // Build area path (positive = blue/green, negative = red) — simpler: one path
  const pts = spreads.map((s, i) => [xPos(i), yPos(s)]);
  const areaPath = `M${pts[0][0]},${y0} ` +
    pts.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") +
    ` L${pts[pts.length - 1][0]},${y0} Z`;
  const linePath = pts.map((p, i) =>
    `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  const years = [...new Set(data.map(d => d.date.slice(0, 4)))]
    .filter(y => y % 5 === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
      <defs>
        <linearGradient id="spreadGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1D4E89" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#1D4E89" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1={PAD.l} x2={W - PAD.r} y1={y0} y2={y0}
            stroke="#A33B2A" strokeWidth="1" strokeDasharray="4,3" />
      {/* area */}
      <path d={areaPath} fill="url(#spreadGrad)" />
      {/* line */}
      <path d={linePath} fill="none" stroke="#1D4E89" strokeWidth="1.5" />
      {/* Y axis labels */}
      {[-3, -2, -1, 0, 1, 2, 3].filter(v => v >= minS && v <= maxS).map(v => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yPos(v)} y2={yPos(v)}
                stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
          <text x={PAD.l - 6} y={yPos(v) + 4} textAnchor="end"
                fontSize="10" fill="#6B7A8D">{v >= 0 ? `+${v}` : v}pp</text>
        </g>
      ))}
      {/* X axis years */}
      {years.map(y => {
        const idx = data.findIndex(d => d.date.startsWith(y));
        if (idx < 0) return null;
        return (
          <text key={y} x={xPos(idx)} y={H - 6} textAnchor="middle"
                fontSize="10" fill="#6B7A8D">{y}</text>
        );
      })}
    </svg>
  );
}

// ── Gráfico de líneas genérico (series históricas) ────────────────────────────
function MultiLineChart({ series, yLabel = "%", yMin, yMax, startYear = "2000", refLine }) {
  // series: [{label, color, dash, data: [{date, value}]}]
  const allPts = series.flatMap(s => s.data.map(d => d.value)).filter(v => v != null);
  if (allPts.length < 2) return <ChartPlaceholder label="Sin datos" />;

  const step  = Math.max(1, Math.floor(allPts.length / 400));
  const W = 700, H = 220, PAD = { t: 20, r: 20, b: 40, l: 52 };
  const inner = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b };

  const allDates = [...new Set(series.flatMap(s => s.data.map(d => d.date)))].sort();
  const dates    = allDates.filter(d => d >= `${startYear}-01-01`);
  const minV     = yMin ?? Math.min(...allPts) - 0.3;
  const maxV     = yMax ?? Math.max(...allPts) + 0.3;

  const xPos = (d) => PAD.l + (dates.indexOf(d) / (dates.length - 1)) * inner.w;
  const yPos = (v) => PAD.t + ((maxV - v) / (maxV - minV)) * inner.h;

  const makePath = (data) => {
    const filtered = data.filter(d => d.date >= `${startYear}-01-01`);
    const sub = filtered.filter((_, i) => i % step === 0);
    return sub.map((d, i) =>
      `${i === 0 ? "M" : "L"}${xPos(d.date).toFixed(1)},${yPos(d.value).toFixed(1)}`
    ).join(" ");
  };

  const gridRange = Math.ceil(maxV) - Math.floor(minV);
  const gridStep  = gridRange > 10 ? 2 : gridRange > 5 ? 1 : 0.5;
  const gridVals  = [];
  for (let v = Math.ceil(minV); v <= maxV; v += gridStep) gridVals.push(v);

  const yearTicks = ["2000","2005","2010","2015","2020","2024"]
    .filter(y => dates.some(d => d.startsWith(y)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
      {/* grid */}
      {gridVals.map(v => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yPos(v)} y2={yPos(v)}
                stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
          <text x={PAD.l - 6} y={yPos(v) + 4} textAnchor="end"
                fontSize="10" fill="#6B7A8D">{v}{yLabel}</text>
        </g>
      ))}
      {/* reference line */}
      {refLine != null && (
        <line x1={PAD.l} x2={W - PAD.r} y1={yPos(refLine)} y2={yPos(refLine)}
              stroke="#9A7A2E" strokeWidth="1" strokeDasharray="5,3" />
      )}
      {/* series */}
      {series.map((s) => (
        <path key={s.label} d={makePath(s.data)} fill="none"
              stroke={s.color} strokeWidth={s.width ?? 1.8}
              strokeDasharray={s.dash ?? "none"} />
      ))}
      {/* latest dot + label for each series */}
      {series.map((s) => {
        const last = s.data.filter(d => d.date >= `${startYear}-01-01`).at(-1);
        if (!last) return null;
        return (
          <g key={s.label + "_dot"}>
            <circle cx={xPos(last.date)} cy={yPos(last.value)} r="4"
                    fill={s.color} stroke="#FFFFFF" strokeWidth="1.5" />
            <text x={xPos(last.date) - 6} y={yPos(last.value) - 8}
                  textAnchor="end" fontSize="10" fill={s.color} fontWeight="700">
              {last.value.toFixed(1)}{yLabel}
            </text>
          </g>
        );
      })}
      {/* X axis */}
      {yearTicks.map(y => {
        const d = dates.find(dd => dd.startsWith(y));
        if (!d) return null;
        return (
          <text key={y} x={xPos(d)} y={H - 6} textAnchor="middle"
                fontSize="10" fill="#6B7A8D">{y}</text>
        );
      })}
      {/* legend */}
      {series.map((s, i) => (
        <g key={s.label + "_leg"} transform={`translate(${PAD.l + i * 130}, ${H - 8})`}>
          <line x1="0" x2="16" y1="-4" y2="-4"
                stroke={s.color} strokeWidth="2" strokeDasharray={s.dash ?? "none"} />
          <text x="20" y="0" fontSize="10" fill="#3A4A5C">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── PNG chart image ───────────────────────────────────────────────────────────
function ChartImage({ file, alt }) {
  return (
    <img
      src={`${BASE}charts/${encodeURIComponent(file)}`}
      alt={alt}
      style={{ width: "100%", height: "auto", display: "block", borderRadius: "6px" }}
    />
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

      {/* P/E histórico por índice — 2 columnas */}
      <p className="section-eyebrow">P/E histórico por índice</p>
      <div className="chart-grid-2">
        <ChartCard
          title="S&P 500 — P/E histórico"
          subtitle="Evolución del P/E y rentabilidad implícita (earnings yield)"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="S&P 500PE.png" alt="S&P 500 P/E histórico" />
        </ChartCard>
        <ChartCard
          title="S&P 500 — Rentabilidad vs P/E"
          subtitle="Relación entre el nivel de valoración y la rentabilidad posterior"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="S&P 500RETPE.png" alt="S&P 500 rentabilidad vs P/E" />
        </ChartCard>

        <ChartCard
          title="MSCI AC World — P/E histórico"
          subtitle="Evolución del P/E del índice global de renta variable"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="MSCI AC WORLDPE.png" alt="MSCI World P/E" />
        </ChartCard>
        <ChartCard
          title="MSCI AC World — Rentabilidad vs P/E"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="MSCI AC WORLDRETPE.png" alt="MSCI World rentabilidad vs P/E" />
        </ChartCard>

        <ChartCard
          title="MSCI Europe — P/E histórico"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="MSCI EuropePE.png" alt="MSCI Europe P/E" />
        </ChartCard>
        <ChartCard
          title="MSCI Europe — Rentabilidad vs P/E"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="MSCI EuropeRETPE.png" alt="MSCI Europe rentabilidad vs P/E" />
        </ChartCard>

        <ChartCard
          title="MSCI Emergentes — P/E histórico"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="MSCI EmergentesPE.png" alt="MSCI EM P/E" />
        </ChartCard>
        <ChartCard
          title="MSCI Emergentes — Rentabilidad vs P/E"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="MSCI EmergentesRETPE.png" alt="MSCI EM rentabilidad vs P/E" />
        </ChartCard>

        <ChartCard
          title="Hang Seng — P/E histórico"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="Hang Seng IndexPE.png" alt="Hang Seng P/E" />
        </ChartCard>
        <ChartCard
          title="Hang Seng — Rentabilidad vs P/E"
          note="Fuente: LSEG Refinitiv · marzo 2025"
        >
          <ChartImage file="Hang Seng IndexRETPE.png" alt="Hang Seng rentabilidad vs P/E" />
        </ChartCard>
      </div>

      {/* Placeholders para próximos gráficos */}
      <p className="section-eyebrow" style={{ marginTop: 8 }}>Próximamente</p>
      <div className="chart-grid-2">
        <ChartCard title="Top 15 market caps por año" subtitle="Evolución histórica desde 1980">
          <ChartPlaceholder label="Top 15 market caps" />
        </ChartCard>
        <ChartCard title="Curva P/E ponderado por índice" subtitle="Distribución del P/E por peso en el índice">
          <ChartPlaceholder label="Curva P/E ponderado" />
        </ChartCard>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB: RENTA FIJA
// ════════════════════════════════════════════════════════════════════════════════
function TabFixedIncome({ data }) {
  const fi = data?.fixed_income ?? {};
  const spread = fi.us_10y != null && fi.us_3m != null ? fi.us_10y - fi.us_3m : null;

  return (
    <>
      <div className="metric-strip">
        <MetricChip label="T-Bill 3M"    value={fi.us_3m  != null ? fmtNum(fi.us_3m)  + "%" : null} sub="EE.UU." />
        <MetricChip label="Treasury 2Y"  value={fi.us_2y  != null ? fmtNum(fi.us_2y)  + "%" : null} sub="EE.UU." />
        <MetricChip label="Treasury 10Y" value={fi.us_10y != null ? fmtNum(fi.us_10y) + "%" : null} sub="EE.UU." />
        <MetricChip label="Bund 10Y"     value={fi.de_10y != null ? fmtNum(fi.de_10y) + "%" : null} sub="Alemania" />
        <MetricChip label="Bono ES 10Y"  value={fi.es_10y != null ? fmtNum(fi.es_10y) + "%" : null} sub="España" />
        <MetricChip
          label="Spread 10Y-3M"
          value={spread != null ? (spread >= 0 ? "+" : "") + fmtNum(spread) + "pp" : null}
          sub="EE.UU."
          colorClass={spread != null && spread < 0 ? "text-red" : "text-green"}
        />
      </div>

      <ChartCard
        title="Curva de tipos EE.UU."
        subtitle="Rendimientos del Tesoro americano de 3M a 30 años — hoy vs hace 1 año"
        note="Fuente: FRED / US Treasury"
      >
        <YieldCurveChart curveNow={fi.curve_now} curve1y={fi.curve_1y} />
      </ChartCard>

      <ChartCard
        title="Spread 10Y-3M — histórico"
        subtitle="Diferencial invertido (< 0) ha precedido recesiones históricamente · línea roja = 0"
        note="Fuente: FRED / US Treasury"
      >
        <SpreadHistoryChart history={fi.yield_curve_history} />
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

  const usCpiSeries = [
    { label: "IPC total",     color: "#1D4E89", data: (macro.us_cpi_history ?? []).map(d => ({ date: d.date, value: d.cpi })) },
    { label: "IPC subyacente",color: "#9A7A2E", dash: "5,3", data: (macro.us_cpi_history ?? []).map(d => ({ date: d.date, value: d.core })).filter(d => d.value != null) },
  ];
  const euCpiSeries = [
    { label: "HICP total", color: "#2E7D5A", data: (macro.eu_cpi_history ?? []).map(d => ({ date: d.date, value: d.cpi })) },
  ];
  const m2Series = [
    { label: "M2 YoY EE.UU.", color: "#5A4E9A", data: (macro.m2_history ?? []).map(d => ({ date: d.date, value: d.m2_yoy })) },
  ];

  return (
    <>
      <div className="metric-strip">
        <MetricChip label="IPC EE.UU."    value={macro.us_cpi     != null ? fmtNum(macro.us_cpi)     + "%" : null} sub="YoY" />
        <MetricChip label="Core EE.UU."   value={macro.us_cpi_core!= null ? fmtNum(macro.us_cpi_core)+ "%" : null} sub="YoY excl. alimentos y energía" />
        <MetricChip label="HICP Eurozona" value={macro.eu_cpi     != null ? fmtNum(macro.eu_cpi)     + "%" : null} sub="YoY" />
        <MetricChip label="Fed Funds"     value={macro.fed_funds  != null ? fmtNum(macro.fed_funds)  + "%" : null} sub="Tipo efectivo" />
        <MetricChip label="BCE Depósito"  value={macro.ecb_deposit!= null ? fmtNum(macro.ecb_deposit)+ "%" : null} sub="Tipo depósito" />
        <MetricChip label="Paro EE.UU."   value={macro.us_unemployment != null ? fmtNum(macro.us_unemployment) + "%" : null} sub="SA" />
        <MetricChip label="Paro Eurozona" value={macro.eu_unemployment != null ? fmtNum(macro.eu_unemployment) + "%" : null} sub="SA" />
      </div>

      <div className="chart-grid-2">
        <ChartCard title="Inflación EE.UU. — IPC YoY"
                   subtitle="Total y subyacente desde 2000 · línea naranja = objetivo 2%"
                   note="Fuente: FRED / BLS">
          <MultiLineChart series={usCpiSeries} yLabel="%" refLine={2} />
        </ChartCard>
        <ChartCard title="Inflación Eurozona — HICP YoY"
                   subtitle="Total desde 2000 · línea naranja = objetivo 2%"
                   note="Fuente: FRED / Eurostat">
          <MultiLineChart series={euCpiSeries} yLabel="%" refLine={2} />
        </ChartCard>
      </div>

      <ChartCard
        title="M2 — crecimiento interanual EE.UU."
        subtitle="Expansión de la masa monetaria M2 — históricamente correlacionada con activos de riesgo"
        note="Fuente: FRED / Fed Reserve"
      >
        <MultiLineChart series={m2Series} yLabel="%" refLine={0} />
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
