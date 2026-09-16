/** Clasificación contable y cálculo de indicadores financieros desde totales OCR */

export type ClassifiedTotals = {
  ingresos: number;
  costos: number;
  gastos: number;
  gastosAdmin: number;
  gastosVentas: number;
  gastosFinancieros: number;
  depreciacion: number;
  activos: number;
  activosCorrientes: number;
  activosNoCorrientes: number;
  inventarios: number;
  pasivos: number;
  pasivosCorrientes: number;
  pasivosNoCorrientes: number;
  patrimonio: number;
  utilidadNeta: number;
  utilidadOperativa: number;
  ingresosEntries: [string, number][];
  costEntries: [string, number][];
  expenseEntries: [string, number][];
  balanceEntries: [string, number][];
  otherEntries: [string, number][];
};

export type IndicatorRow = {
  id: string;
  group: string;
  name: string;
  formula: string;
  value: number | null;
  display: string;
  benchmark?: string;
  status: "good" | "warn" | "bad" | "neutral";
  insight: string;
};

export type ScenarioRow = {
  scenario: string;
  description: string;
  activos?: number;
  pasivos?: number;
  patrimonio?: number;
  liquidez?: number;
  endeudamiento?: number;
  ingresos?: number;
  utilidad?: number;
  margen?: number;
};

const sum = (arr: [string, number][]) => arr.reduce((s, [, v]) => s + v, 0);

const match = (k: string, re: RegExp) => re.test(k);

const isIncome = (k: string) =>
  match(k, /ingres|venta|honor|factur|operacional/i) && !match(k, /gasto|costo|egreso|pasiv|activ|deuda/i);

const isCost = (k: string) => match(k, /costo|cmv|mercanc|materia|producci/i) && !match(k, /ingres/i);

const isExpense = (k: string) =>
  (match(k, /gasto|marketing|publicidad|comision|arrend|sueld|nomina|deprec|amortiz/i) ||
    (match(k, /servicio|operac/i) && match(k, /gasto|admin/i))) &&
  !match(k, /ingres|venta/i);

const isAdminExpense = (k: string) => match(k, /admin|gerenc|oficin|legal|contab/i) && match(k, /gasto/i);
const isSalesExpense = (k: string) => match(k, /venta|comercial|marketing|publicidad/i) && match(k, /gasto/i);
const isFinancialExpense = (k: string) => match(k, /financ|interes|bancar|comision.*banc/i);
const isDepreciation = (k: string) => match(k, /deprec|amortiz/i);

const isAsset = (k: string) => match(k, /activ/i) && !match(k, /pasiv/i);
const isNonCurrentAsset = (k: string) =>
  match(k, /no corrien|fijo|propiedad|planta|equipo|inmovilizado|largo plazo/i) && match(k, /activ/i);
const isInventory = (k: string) => match(k, /invent|existenc|mercanc/i) && !match(k, /costo|cmv/i);
const isLiability = (k: string) => match(k, /pasiv|deuda|oblig/i) && !match(k, /activ|patrim|capit/i);
const isNonCurrentLiability = (k: string) =>
  match(k, /no corrien|largo plazo|bono|credito.*largo/i) && match(k, /pasiv|deuda|oblig/i);
const isEquity = (k: string) => match(k, /patrim|capit|reserv|utilidad.*ejercicio/i);
const isCurrentAsset = (k: string) =>
  match(k, /corrien|circulante|disponib|caja|banco|efectivo|cartera|deudor/i) && !match(k, /pasiv/i);
const isCurrentLiability = (k: string) =>
  match(k, /corrien|circulante|proveed|acreed|oblig/i) && match(k, /pasiv|proveed|acreed|oblig/i);
const isNetIncome = (k: string) => match(k, /utilidad.*neta|resultado.*ejercicio|ganancia.*neta/i);
const isAssetTotal = (k: string) => match(k, /(^|\b)total(es)?\s+activos?(\s+totales?)?$|(^|\b)activos?(\s+totales?)$/i) && !match(k, /corrien|no corrien|no corrientes/i);
const isLiabilityTotal = (k: string) => match(k, /(^|\b)total(es)?\s+pasivos?(\s+totales?)?$|(^|\b)pasivos?(\s+totales?)$/i) && !match(k, /corrien|no corrien|no corrientes/i);
const isEquityTotal = (k: string) => match(k, /(^|\b)patrimonio(\s+neto)?$|(^|\b)capital\s+contable$|(^|\b)capital\s+propiedad$/i);

export function classifyTotals(totals: Record<string, number>): ClassifiedTotals {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0);
  const ingresosEntries = entries.filter(([k]) => isIncome(k));
  const costEntries = entries.filter(([k]) => isCost(k));
  const expenseEntries = entries.filter(([k]) => isExpense(k));
  const balanceEntries = entries.filter(([k]) => isAsset(k) || isLiability(k) || isEquity(k));
  const classified = new Set([
    ...ingresosEntries.map(([k]) => k),
    ...costEntries.map(([k]) => k),
    ...expenseEntries.map(([k]) => k),
    ...balanceEntries.map(([k]) => k),
  ]);
  const otherEntries = entries.filter(([k]) => !classified.has(k));

  const ingresos = sum(ingresosEntries);
  const costos = sum(costEntries);
  const gastos = sum(expenseEntries);
  const gastosAdmin = sum(expenseEntries.filter(([k]) => isAdminExpense(k)));
  const gastosVentas = sum(expenseEntries.filter(([k]) => isSalesExpense(k)));
  const gastosFinancieros = sum(entries.filter(([k]) => isFinancialExpense(k)));
  const depreciacion = sum(entries.filter(([k]) => isDepreciation(k)));

  const explicitActivoTotal = entries.filter(([k]) => isAssetTotal(k));
  const explicitPasivoTotal = entries.filter(([k]) => isLiabilityTotal(k));
  const explicitPatrimonioTotal = entries.filter(([k]) => isEquityTotal(k));

  const activos =
    explicitActivoTotal.length > 0
      ? sum(explicitActivoTotal)
      : entries.filter(([k]) => isAsset(k)).reduce((s, [, v]) => s + v, 0);
  const activosCorrientes = entries.filter(([k]) => isCurrentAsset(k)).reduce((s, [, v]) => s + v, 0);
  const activosNoCorrientes = entries.filter(([k]) => isNonCurrentAsset(k)).reduce((s, [, v]) => s + v, 0);
  const inventarios = entries.filter(([k]) => isInventory(k)).reduce((s, [, v]) => s + v, 0);
  const pasivos =
    explicitPasivoTotal.length > 0
      ? sum(explicitPasivoTotal)
      : entries.filter(([k]) => isLiability(k)).reduce((s, [, v]) => s + v, 0);
  const pasivosCorrientes = entries.filter(([k]) => isCurrentLiability(k)).reduce((s, [, v]) => s + v, 0);
  const pasivosNoCorrientes = entries.filter(([k]) => isNonCurrentLiability(k)).reduce((s, [, v]) => s + v, 0);
  const patrimonio =
    explicitPatrimonioTotal.length > 0
      ? sum(explicitPatrimonioTotal)
      : entries.filter(([k]) => isEquity(k)).reduce((s, [, v]) => s + v, 0);

  const utilidadFromEntries = entries.filter(([k]) => isNetIncome(k)).reduce((s, [, v]) => s + v, 0);
  const utilidadOperativa = ingresos - costos - gastos + gastosFinancieros;
  // Utilidad neta: preferimos la suma detectada explícitamente (si está),
  // si no, calculamos como ingresos - costos - gastos (no restar dos veces gastosFinancieros).
  const utilidadNeta = utilidadFromEntries || ingresos - costos - gastos;

  return {
    ingresos,
    costos,
    gastos,
    gastosAdmin,
    gastosVentas,
    gastosFinancieros,
    depreciacion,
    activos,
    activosCorrientes,
    activosNoCorrientes: activosNoCorrientes || Math.max(0, activos - activosCorrientes),
    inventarios,
    pasivos,
    pasivosCorrientes,
    pasivosNoCorrientes: pasivosNoCorrientes || Math.max(0, pasivos - pasivosCorrientes),
    patrimonio,
    utilidadNeta,
    utilidadOperativa,
    ingresosEntries,
    costEntries,
    expenseEntries,
    balanceEntries,
    otherEntries,
  };
}

function pct(n: number, d: number) {
  return d > 0 ? (n / d) * 100 : null;
}

function ratio(n: number, d: number) {
  return d > 0 ? n / d : null;
}

function fmtPct(n: number | null) {
  return n == null ? "N/D" : `${n.toFixed(1)}%`;
}

function fmtRatio(n: number | null, suffix = "x") {
  return n == null ? "N/D" : `${n.toFixed(2)}${suffix}`;
}

function fmtCOP(n: number | null) {
  if (n == null) return "N/D";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function statusLiquidez(v: number | null): IndicatorRow["status"] {
  if (v == null) return "neutral";
  if (v >= 1.5) return "good";
  if (v >= 1) return "warn";
  return "bad";
}

function statusEndeudamiento(v: number | null): IndicatorRow["status"] {
  if (v == null) return "neutral";
  if (v <= 50) return "good";
  if (v <= 70) return "warn";
  return "bad";
}

function statusMargen(v: number | null): IndicatorRow["status"] {
  if (v == null) return "neutral";
  if (v >= 15) return "good";
  if (v >= 5) return "warn";
  return "bad";
}

export function computeBalanceIndicators(c: ClassifiedTotals): IndicatorRow[] {
  const ac = c.activosCorrientes || (c.activos > 0 ? c.activos * 0.4 : 0);
  const pc = c.pasivosCorrientes || (c.pasivos > 0 ? c.pasivos * 0.5 : 0);
  const inv = c.inventarios;
  const capitalTrabajo = ac - pc;
  const liquidezCorriente = ratio(ac, pc);
  const pruebaAcida = ratio(ac - inv, pc);
  const solvencia = ratio(c.activos, c.pasivos);
  const endeudamiento = pct(c.pasivos, c.activos);
  const endeudamientoPat = ratio(c.pasivos, c.patrimonio);
  const autonomia = pct(c.patrimonio, c.activos);
  const roa = pct(c.utilidadNeta, c.activos);
  const roe = pct(c.utilidadNeta, c.patrimonio);
  const balanceCuadra = c.activos > 0 ? Math.abs(c.activos - (c.pasivos + c.patrimonio)) / c.activos : null;
  const concentracionAC = pct(ac, c.activos);
  const coberturaCT = pc > 0 ? ratio(capitalTrabajo, pc) : null;

  const rows: IndicatorRow[] = [
    {
      id: "liq-corr",
      group: "Liquidez",
      name: "Razón corriente",
      formula: "Activos corrientes ÷ Pasivos corrientes",
      value: liquidezCorriente,
      display: fmtRatio(liquidezCorriente),
      benchmark: "≥ 1.5x",
      status: statusLiquidez(liquidezCorriente),
      insight: "Capacidad de cubrir obligaciones de corto plazo con activos líquidos.",
    },
    {
      id: "prueba-acida",
      group: "Liquidez",
      name: "Prueba ácida",
      formula: "(AC − Inventarios) ÷ Pasivos corrientes",
      value: pruebaAcida,
      display: fmtRatio(pruebaAcida),
      benchmark: "≥ 1.0x",
      status: statusLiquidez(pruebaAcida),
      insight: "Liquidez inmediata sin depender de la venta de inventarios.",
    },
    {
      id: "cap-trabajo",
      group: "Liquidez",
      name: "Capital de trabajo",
      formula: "Activos corrientes − Pasivos corrientes",
      value: capitalTrabajo,
      display: fmtCOP(capitalTrabajo),
      benchmark: "> 0",
      status: capitalTrabajo >= 0 ? "good" : "bad",
      insight: "Recursos disponibles para operar el ciclo corto sin financiación externa.",
    },
    {
      id: "cobertura-ct",
      group: "Liquidez",
      name: "Cobertura capital circulante",
      formula: "Capital de trabajo ÷ Pasivos corrientes",
      value: coberturaCT,
      display: fmtRatio(coberturaCT),
      benchmark: "≥ 0.25x",
      status: coberturaCT != null && coberturaCT >= 0.25 ? "good" : coberturaCT != null && coberturaCT >= 0 ? "warn" : "bad",
      insight: "Margen de seguridad del capital de trabajo frente a deuda corto plazo.",
    },
    {
      id: "solvencia",
      group: "Endeudamiento",
      name: "Solvencia (Activos/Pasivos)",
      formula: "Total activos ÷ Total pasivos",
      value: solvencia,
      display: fmtRatio(solvencia),
      benchmark: "> 1.5x",
      status: solvencia != null && solvencia >= 1.5 ? "good" : solvencia != null && solvencia >= 1 ? "warn" : "bad",
      insight: "Capacidad de la empresa para honrar todas sus deudas con sus activos.",
    },
    {
      id: "endeud",
      group: "Endeudamiento",
      name: "Endeudamiento total",
      formula: "Pasivos ÷ Activos × 100",
      value: endeudamiento,
      display: fmtPct(endeudamiento),
      benchmark: "≤ 60%",
      status: statusEndeudamiento(endeudamiento),
      insight: "Porcentaje de activos financiados con deuda.",
    },
    {
      id: "lev-pat",
      group: "Endeudamiento",
      name: "Apalancamiento (Pasivos/Patrimonio)",
      formula: "Total pasivos ÷ Patrimonio",
      value: endeudamientoPat,
      display: fmtRatio(endeudamientoPat),
      benchmark: "≤ 2.0x",
      status: endeudamientoPat != null && endeudamientoPat <= 2 ? "good" : endeudamientoPat != null && endeudamientoPat <= 3 ? "warn" : "bad",
      insight: "Nivel de deuda respecto al capital propio.",
    },
    {
      id: "autonomia",
      group: "Endeudamiento",
      name: "Autonomía financiera",
      formula: "Patrimonio ÷ Activos × 100",
      value: autonomia,
      display: fmtPct(autonomia),
      benchmark: "≥ 40%",
      status: autonomia != null && autonomia >= 40 ? "good" : autonomia != null && autonomia >= 25 ? "warn" : "bad",
      insight: "Independencia financiera: mayor patrimonio, menor dependencia de crédito.",
    },
    {
      id: "conc-ac",
      group: "Estructura",
      name: "Concentración activos corrientes",
      formula: "AC ÷ Total activos × 100",
      value: concentracionAC,
      display: fmtPct(concentracionAC),
      benchmark: "30–70%",
      status: "neutral",
      insight: "Peso de la liquidez operativa en la estructura de activos.",
    },
    {
      id: "roa",
      group: "Rentabilidad",
      name: "ROA (Retorno sobre activos)",
      formula: "Utilidad neta ÷ Total activos × 100",
      value: roa,
      display: fmtPct(roa),
      benchmark: "≥ 5%",
      status: roa != null && roa >= 5 ? "good" : roa != null && roa >= 0 ? "warn" : "bad",
      insight: "Eficiencia en generar utilidad con los activos totales.",
    },
    {
      id: "roe",
      group: "Rentabilidad",
      name: "ROE (Retorno sobre patrimonio)",
      formula: "Utilidad neta ÷ Patrimonio × 100",
      value: roe,
      display: fmtPct(roe),
      benchmark: "≥ 12%",
      status: roe != null && roe >= 12 ? "good" : roe != null && roe >= 5 ? "warn" : "bad",
      insight: "Rentabilidad para los propietarios sobre el capital invertido.",
    },
    {
      id: "cuadre",
      group: "Validación",
      name: "Cuadre contable A = P + Pat",
      formula: "|Activos − (Pasivos + Patrimonio)| ÷ Activos",
      value: balanceCuadra != null ? balanceCuadra * 100 : null,
      display: balanceCuadra != null ? fmtPct(balanceCuadra * 100) : "N/D",
      benchmark: "< 5%",
      status: balanceCuadra != null && balanceCuadra < 0.05 ? "good" : balanceCuadra != null && balanceCuadra < 0.15 ? "warn" : "bad",
      insight: "Verifica si la ecuación contable fundamental se cumple con los datos extraídos.",
    },
  ];

  return rows;
}

export function computePnLIndicators(c: ClassifiedTotals): IndicatorRow[] {
  const { ingresos, costos, gastos, gastosAdmin, gastosVentas, gastosFinancieros, depreciacion } = c;
  const gastosOperativos = Math.max(0, gastos - gastosFinancieros);
  const utilidadBruta = ingresos - costos;
  const utilidadOperativa = ingresos - costos - gastosOperativos;
  const ebitda = utilidadOperativa + depreciacion;
  const utilidadNeta = utilidadOperativa - gastosFinancieros;

  const margenBruto = pct(utilidadBruta, ingresos);
  const margenOperativo = pct(utilidadOperativa, ingresos);
  const margenEbitda = pct(ebitda, ingresos);
  const margenNeto = pct(utilidadNeta, ingresos);
  const costoVentas = pct(costos, ingresos);
  const gastosOp = pct(gastosOperativos, ingresos);
  const gastosAdminPct = pct(gastosAdmin, ingresos);
  const gastosVentasPct = pct(gastosVentas, ingresos);
  const margenContrib = pct(ingresos - costos, ingresos);
  const puntoEquilibrio = margenContrib && margenContrib > 0 ? gastosOperativos / (margenContrib / 100) : null;
  const eficienciaOp = gastosOperativos > 0 ? ratio(ingresos, gastosOperativos) : null;
  const coberturaIntereses = gastosFinancieros > 0 ? ratio(utilidadOperativa, gastosFinancieros) : null;
  const rotacionCostos = costos > 0 ? ratio(ingresos, costos) : null;

  const rows: IndicatorRow[] = [
    {
      id: "margen-bruto",
      group: "Rentabilidad",
      name: "Margen bruto",
      formula: "(Ingresos − Costos) ÷ Ingresos × 100",
      value: margenBruto,
      display: fmtPct(margenBruto),
      benchmark: "≥ 30%",
      status: statusMargen(margenBruto),
      insight: "Rentabilidad después de costos directos de producción o venta.",
    },
    {
      id: "margen-op",
      group: "Rentabilidad",
      name: "Margen operativo",
      formula: "Utilidad operativa ÷ Ingresos × 100",
      value: margenOperativo,
      display: fmtPct(margenOperativo),
      benchmark: "≥ 10%",
      status: statusMargen(margenOperativo),
      insight: "Eficiencia del negocio antes de gastos financieros e impuestos.",
    },
    {
      id: "margen-ebitda",
      group: "Rentabilidad",
      name: "Margen EBITDA",
      formula: "(U. operativa + Depreciación) ÷ Ingresos × 100",
      value: margenEbitda,
      display: fmtPct(margenEbitda),
      benchmark: "≥ 15%",
      status: statusMargen(margenEbitda),
      insight: "Generación de caja operativa antes de amortizaciones contables.",
    },
    {
      id: "margen-neto",
      group: "Rentabilidad",
      name: "Margen neto",
      formula: "Utilidad neta ÷ Ingresos × 100",
      value: margenNeto,
      display: fmtPct(margenNeto),
      benchmark: "≥ 8%",
      status: statusMargen(margenNeto),
      insight: "Utilidad final disponible después de todos los gastos.",
    },
    {
      id: "costo-ventas",
      group: "Eficiencia",
      name: "Costo de ventas / Ingresos",
      formula: "Costos ÷ Ingresos × 100",
      value: costoVentas,
      display: fmtPct(costoVentas),
      benchmark: "≤ 60%",
      status: costoVentas != null && costoVentas <= 60 ? "good" : costoVentas != null && costoVentas <= 75 ? "warn" : "bad",
      insight: "Peso de los costos directos sobre los ingresos operacionales.",
    },
    {
      id: "gastos-op",
      group: "Eficiencia",
      name: "Gastos operativos / Ingresos",
      formula: "Gastos operativos ÷ Ingresos × 100",
      value: gastosOp,
      display: fmtPct(gastosOp),
      benchmark: "≤ 25%",
      status: gastosOp != null && gastosOp <= 25 ? "good" : gastosOp != null && gastosOp <= 40 ? "warn" : "bad",
      insight: "Control de gastos administrativos y de operación.",
    },
    {
      id: "gastos-admin",
      group: "Gestión",
      name: "Gastos administrativos / Ingresos",
      formula: "Gastos admin ÷ Ingresos × 100",
      value: gastosAdminPct,
      display: gastosAdmin > 0 ? fmtPct(gastosAdminPct) : "N/D",
      benchmark: "≤ 10%",
      status: gastosAdminPct != null && gastosAdminPct <= 10 ? "good" : gastosAdminPct != null && gastosAdminPct <= 15 ? "warn" : "neutral",
      insight: "Eficiencia en estructura administrativa.",
    },
    {
      id: "gastos-ventas",
      group: "Gestión",
      name: "Gastos de ventas / Ingresos",
      formula: "Gastos comerciales ÷ Ingresos × 100",
      value: gastosVentasPct,
      display: gastosVentas > 0 ? fmtPct(gastosVentasPct) : "N/D",
      benchmark: "≤ 15%",
      status: gastosVentasPct != null && gastosVentasPct <= 15 ? "good" : "neutral",
      insight: "Inversión en comercialización respecto a ingresos.",
    },
    {
      id: "punto-eq",
      group: "Gestión",
      name: "Punto de equilibrio",
      formula: "Gastos fijos ÷ Margen de contribución",
      value: puntoEquilibrio,
      display: fmtCOP(puntoEquilibrio),
      benchmark: "< Ingresos",
      status: puntoEquilibrio != null && ingresos > puntoEquilibrio ? "good" : puntoEquilibrio != null ? "warn" : "neutral",
      insight: "Nivel de ingresos mínimo para cubrir gastos operativos fijos.",
    },
    {
      id: "margen-contrib",
      group: "Gestión",
      name: "Margen de contribución",
      formula: "(Ingresos − Costos variables) ÷ Ingresos × 100",
      value: margenContrib,
      display: fmtPct(margenContrib),
      benchmark: "≥ 40%",
      status: statusMargen(margenContrib),
      insight: "Porción de cada peso de ingreso que cubre gastos fijos y utilidad.",
    },
    {
      id: "eficiencia-op",
      group: "Gestión",
      name: "Eficiencia operativa",
      formula: "Ingresos ÷ Gastos operativos",
      value: eficienciaOp,
      display: fmtRatio(eficienciaOp),
      benchmark: "≥ 3.0x",
      status: eficienciaOp != null && eficienciaOp >= 3 ? "good" : eficienciaOp != null && eficienciaOp >= 1.5 ? "warn" : "bad",
      insight: "Cuántos pesos de ingreso genera cada peso de gasto operativo.",
    },
    {
      id: "rotacion-costos",
      group: "Gestión",
      name: "Rotación costo-ingreso",
      formula: "Ingresos ÷ Costos",
      value: rotacionCostos,
      display: fmtRatio(rotacionCostos),
      benchmark: "≥ 1.5x",
      status: rotacionCostos != null && rotacionCostos >= 1.5 ? "good" : rotacionCostos != null && rotacionCostos >= 1 ? "warn" : "bad",
      insight: "Relación entre ventas y costo de lo vendido.",
    },
    {
      id: "cobertura-int",
      group: "Financiero",
      name: "Cobertura de intereses",
      formula: "Utilidad operativa ÷ Gastos financieros",
      value: coberturaIntereses,
      display: gastosFinancieros > 0 ? fmtRatio(coberturaIntereses) : "N/D",
      benchmark: "≥ 3.0x",
      status: coberturaIntereses != null && coberturaIntereses >= 3 ? "good" : coberturaIntereses != null && coberturaIntereses >= 1.5 ? "warn" : "neutral",
      insight: "Capacidad de pagar intereses con la utilidad operativa.",
    },
  ];

  return rows;
}

export function computeBalanceScenarios(c: ClassifiedTotals): ScenarioRow[] {
  const ac = c.activosCorrientes || c.activos * 0.4;
  const pc = c.pasivosCorrientes || c.pasivos * 0.5;
  const base = {
    activos: c.activos,
    pasivos: c.pasivos,
    patrimonio: c.patrimonio,
    liquidez: ratio(ac, pc) ?? 0,
    endeudamiento: pct(c.pasivos, c.activos) ?? 0,
  };

  return [
    {
      scenario: "Base (documento)",
      description: "Valores detectados en el escaneo actual.",
      ...base,
    },
    {
      scenario: "Estrés (−5% activos, +15% pasivos)",
      description: "Escenario adverso: deterioro de activos y mayor endeudamiento.",
      activos: c.activos * 0.95,
      pasivos: c.pasivos * 1.15,
      patrimonio: c.activos * 0.95 - c.pasivos * 1.15,
      liquidez: ratio(ac * 0.9, pc * 1.2) ?? 0,
      endeudamiento: pct(c.pasivos * 1.15, c.activos * 0.95) ?? 0,
    },
    {
      scenario: "Optimista (+10% activos, −5% pasivos)",
      description: "Escenario favorable: crecimiento de activos y reducción de deuda.",
      activos: c.activos * 1.1,
      pasivos: c.pasivos * 0.95,
      patrimonio: c.activos * 1.1 - c.pasivos * 0.95,
      liquidez: ratio(ac * 1.1, pc * 0.9) ?? 0,
      endeudamiento: pct(c.pasivos * 0.95, c.activos * 1.1) ?? 0,
    },
    {
      scenario: "Proyección 12 meses (tendencia +3%/mes activos)",
      description: "Extrapolación conservadora del crecimiento de activos a 12 meses.",
      activos: c.activos * Math.pow(1.03, 12),
      pasivos: c.pasivos * Math.pow(1.02, 12),
      patrimonio: c.activos * Math.pow(1.03, 12) - c.pasivos * Math.pow(1.02, 12),
      liquidez: ratio(ac * Math.pow(1.03, 12), pc * Math.pow(1.02, 12)) ?? 0,
      endeudamiento: pct(c.pasivos * Math.pow(1.02, 12), c.activos * Math.pow(1.03, 12)) ?? 0,
    },
  ];
}

export function computePnLScenarios(c: ClassifiedTotals): ScenarioRow[] {
  const utilidad = c.ingresos - c.costos - c.gastos;

  const mk = (ing: number, cost: number, gast: number): ScenarioRow => {
    const u = ing - cost - gast;
    return {
      scenario: "",
      description: "",
      ingresos: ing,
      utilidad: u,
      margen: pct(u, ing) ?? 0,
    };
  };

  return [
    {
      ...mk(c.ingresos, c.costos, c.gastos),
      scenario: "Base (período escaneado)",
      description: "Resultados del documento tal como fue extraído.",
    },
    {
      ...mk(c.ingresos * 12, c.costos * 12, c.gastos * 12),
      scenario: "Proyección anual lineal (×12)",
      description: "Extrapolación anual asumiendo el mismo resultado mensual/periódico.",
    },
    {
      ...mk(c.ingresos * 0.95, c.costos * 1.08, c.gastos * 1.05),
      scenario: "Estrés (−5% ingresos, +8% costos)",
      description: "Escenario adverso: caída de ventas y presión en costos.",
    },
    {
      ...mk(c.ingresos * 1.12, c.costos * 0.97, c.gastos * 0.98),
      scenario: "Optimista (+12% ingresos, −3% costos)",
      description: "Escenario favorable: expansión de ventas y eficiencia en costos.",
    },
  ];
}

export function dataQualityScore(entryCount: number): {
  score: number;
  label: string;
  insight: string;
} {
  const score = Math.min(100, Math.round((entryCount / 20) * 100));
  const label =
    entryCount >= 15 ? "Alta" : entryCount >= 8 ? "Media" : entryCount >= 3 ? "Básica" : "Limitada";
  return {
    score,
    label,
    insight: `${entryCount} partidas extraídas · calidad ${label.toLowerCase()}. ${
      entryCount < 8
        ? "Sube un PDF con texto seleccionable o Excel para mejores resultados."
        : "Suficiente detalle para análisis de ratios y tributario."
    }`,
  };
}
