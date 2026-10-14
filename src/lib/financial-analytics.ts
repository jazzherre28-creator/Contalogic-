/** Clasificación contable y cálculo de indicadores financieros desde totales OCR */

export type ClassifiedTotals = {
  ingresos: number;
  otrosIngresosOperativos: number;
  ingresosFinancieros: number;
  costos: number;
  gastos: number;
  gastosAdmin: number;
  gastosVentas: number;
  gastosFinancieros: number;
  impuestoRenta: number;
  depreciacion: number;
  activos: number;
  activosCorrientes: number;
  activosNoCorrientes: number;
  inventarios: number;
  pasivos: number;
  pasivosCorrientes: number;
  pasivosNoCorrientes: number;
  patrimonio: number;
  utilidadBruta: number;
  utilidadAntesImpuestos: number;
  utilidadNeta: number;
  utilidadOperativa: number;
  hasTotalAssets: boolean;
  hasCurrentAssets: boolean;
  hasNonCurrentAssets: boolean;
  hasTotalLiabilities: boolean;
  hasCurrentLiabilities: boolean;
  hasNonCurrentLiabilities: boolean;
  hasEquity: boolean;
  hasInventory: boolean;
  hasIncomeTax: boolean;
  hasNetIncome: boolean;
  hasGrossProfit: boolean;
  hasOperatingProfit: boolean;
  hasProfitBeforeTax: boolean;
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
const sumAbs = (arr: [string, number][]) => arr.reduce((s, [, v]) => s + Math.abs(v), 0);

const match = (k: string, re: RegExp) =>
  re.test(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());

const isIncome = (k: string) =>
  match(k, /ingres|\bventas?\b|honor|factur|operacional/i) &&
  !match(k, /gasto|costo|egreso|pasiv|activos?\b|deuda|financier|interes|rendimiento|utilidad|resultado|ganancia|margen|ebit|uaii|otros ingresos operativos/i);

const isCost = (k: string) => match(k, /costo|cmv|mercanc|materia|producci/i) && !match(k, /ingres/i);

const isExpense = (k: string) =>
  (match(k, /gasto|marketing|publicidad|comision|arrend|sueld|nomina|deprec|amortiz/i) ||
    (match(k, /servicio|operac/i) && match(k, /gasto|admin/i))) &&
  !match(k,   /ingres|financ|interes|impuesto|tribut|depreciacion acumulada|gastos? pagados por anticipado|activos? por derechos? de uso|propiedades? de inversion/i);

const isAdminExpense = (k: string) => match(k, /admin|gerenc|oficin|legal|contab/i) && match(k, /gasto/i);
const isSalesExpense = (k: string) => match(k, /venta|comercial|marketing|publicidad/i) && match(k, /gasto/i);
const isFinancialExpense = (k: string) =>
  match(k, /gasto.*financ|interes|comision.*banc/i) && !match(k, /ingres|rendimiento/i);
const isFinancialIncome = (k: string) =>
  match(k, /ingres.*financ|ingres.*interes|rendimiento.*financ|interes.*(ganad|recibid)|rendimientos?/i);
const isOtherOperatingIncome = (k: string) => match(k, /otros?\s+ingresos?\s+operativ/i);
const isIncomeTax = (k: string) => match(k, /impuesto.*renta|renta.*impuesto|gasto.*tributario/i);
const isDepreciation = (k: string) => match(k, /deprec|amortiz/i);
const isOperatingExpenseTotal = (k: string) =>
  match(k, /^(gastos?|costos?)\s+operacionales?$/i) || match(k, /^gastos?\s+operativos?$/i);

const isAsset = (k: string) =>
  match(k, /activ|propiedad|planta|equipo|inversion|derechos? de uso|depreciacion acumulada/i) &&
  !match(k, /pasiv|depreciaciones?\s+de\b|gastos? pagados por anticipado/i);
const isNonCurrentAsset = (k: string) =>
  match(k, /no corrien|fijo|propiedad|planta|equipo|inmovilizado|largo plazo|derechos? de uso|depreciacion acumulada/i) &&
  !match(k, /depreciaciones?\s+de\b|gastos? pagados por anticipado/i);
const isInventory = (k: string) => match(k, /invent|existenc|mercanc/i) && !match(k, /costo|cmv/i);
const isLiability = (k: string) =>
  match(k, /pasiv|deuda|oblig|proveed|cuentas?\s+por\s+pagar|impuestos?.*pagar|beneficios.*empleados|acreedor/i) &&
  !match(k, /activ|patrim|capit/i);
const isNonCurrentLiability = (k: string) =>
  match(k, /no corrien|largo plazo|bono|credito.*largo/i) &&
  match(k, /pasiv|deuda|oblig|proveed|cuentas?\s+por\s+pagar/i);
const isEquity = (k: string) =>
  match(k, /patrim|capital|reserv|utilidad.*ejercicio|resultado.*ejercicio/i) && !match(k, /pasiv/i);
const isCurrentAsset = (k: string) =>
  match(k, /corrien|circulante|disponib|caja|banco|efectivo|cartera|deudor|cuentas?\s+por\s+cobrar|invent|anticipad|corto plazo/i) &&
  !match(k, /pasiv/i);
const isCurrentLiability = (k: string) =>
  match(k, /corrien|circulante|proveed|acreed|oblig|cuentas?\s+por\s+pagar|impuestos?.*pagar|beneficios.*empleados/i);
const isNetIncome = (k: string) => match(k, /utilidad.*neta|resultado.*ejercicio|ganancia.*neta/i);
const isGrossProfit = (k: string) => match(k, /utilidad.*bruta|resultado.*bruto/i);
const isOperatingProfit = (k: string) => match(k, /utilidad.*operaci|resultado.*operaci|\bebit\b/i);
const isProfitBeforeTax = (k: string) => match(k, /utilidad.*antes.*impuesto|resultado.*antes.*impuesto|\buaii\b/i);
const isAssetTotal = (k: string) => match(k, /(^|\b)total(es)?\s+activos?(\s+totales?)?$|(^|\b)activos?(\s+totales?)$/i) && !match(k, /corrien|no corrien|no corrientes/i);
const isLiabilityTotal = (k: string) => match(k, /(^|\b)total(es)?\s+pasivos?(\s+totales?)?$|(^|\b)pasivos?(\s+totales?)$/i) && !match(k, /corrien|no corrien|no corrientes/i);
const isEquityTotal = (k: string) =>
  match(k, /(^|\b)patrimonio(\s+neto)?$|(^|\b)total(?:es)?\s+patrimonio(\s+neto)?$|(^|\b)capital\s+contable$|(^|\b)capital\s+propiedad$/i);
const isCurrentAssetTotal = (k: string) => match(k, /^activos?\s+corrientes?$/i);
const isNonCurrentAssetTotal = (k: string) => match(k, /^activos?\s+no\s+corrientes?$/i);
const isCurrentLiabilityTotal = (k: string) => match(k, /^pasivos?\s+corrientes?$/i);
const isNonCurrentLiabilityTotal = (k: string) => match(k, /^pasivos?\s+no\s+corrientes?$/i);

export function classifyTotals(totals: Record<string, number>): ClassifiedTotals {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0);
  const ingresosEntries = entries.filter(([k]) => isIncome(k));
  const costEntries = entries.filter(([k]) => isCost(k));
  const allExpenseEntries = entries.filter(([k]) => isExpense(k));
  const detailExpenseEntries = allExpenseEntries.filter(([k]) => !isOperatingExpenseTotal(k));
  const hasOperatingExpenseTotal = allExpenseEntries.some(([k]) => isOperatingExpenseTotal(k));
  const expenseEntries =
    hasOperatingExpenseTotal && detailExpenseEntries.length > 0 ? detailExpenseEntries : allExpenseEntries;
  const balanceEntries = entries.filter(([k]) => isAsset(k) || isLiability(k) || isEquity(k));
  const classified = new Set([
    ...ingresosEntries.map(([k]) => k),
    ...costEntries.map(([k]) => k),
    ...expenseEntries.map(([k]) => k),
    ...balanceEntries.map(([k]) => k),
    ...entries
      .filter(([k]) =>
        isOtherOperatingIncome(k) ||
        isFinancialIncome(k) ||
        isFinancialExpense(k) ||
        isIncomeTax(k) ||
        isOperatingExpenseTotal(k) ||
        isGrossProfit(k) ||
        isOperatingProfit(k) ||
        isProfitBeforeTax(k) ||
        isNetIncome(k)
      )
      .map(([k]) => k),
  ]);
  const otherEntries = entries.filter(([k]) => !classified.has(k));

  const ingresos = sum(ingresosEntries);
  const otrosIngresosOperativos = sum(entries.filter(([k]) => isOtherOperatingIncome(k)));
  const ingresosFinancieros = sum(entries.filter(([k]) => isFinancialIncome(k)));
  const costos = sumAbs(costEntries);
  const gastos = hasOperatingExpenseTotal
    ? sumAbs(allExpenseEntries.filter(([k]) => isOperatingExpenseTotal(k)))
    : sumAbs(expenseEntries);
  const gastosAdmin = sumAbs(expenseEntries.filter(([k]) => isAdminExpense(k)));
  const gastosVentas = sumAbs(expenseEntries.filter(([k]) => isSalesExpense(k)));
  const gastosFinancieros = sumAbs(entries.filter(([k]) => isFinancialExpense(k)));
  const impuestoRenta = sumAbs(entries.filter(([k]) => isIncomeTax(k)));
  const depreciacion = sumAbs(entries.filter(([k]) => isDepreciation(k)));

  const explicitActivoTotal = entries.filter(([k]) => isAssetTotal(k));
  const explicitPasivoTotal = entries.filter(([k]) => isLiabilityTotal(k));
  const explicitPatrimonioTotal = entries.filter(([k]) => isEquityTotal(k));
  const explicitCurrentAssets = entries.filter(([k]) => isCurrentAssetTotal(k));
  const explicitNonCurrentAssets = entries.filter(([k]) => isNonCurrentAssetTotal(k));
  const explicitCurrentLiabilities = entries.filter(([k]) => isCurrentLiabilityTotal(k));
  const explicitNonCurrentLiabilities = entries.filter(([k]) => isNonCurrentLiabilityTotal(k));

  const currentAssetDetails = entries.filter(([k]) => isCurrentAsset(k) && !isCurrentAssetTotal(k));
  const nonCurrentAssetDetails = entries.filter(([k]) => isNonCurrentAsset(k) && !isNonCurrentAssetTotal(k));
  const currentLiabilityDetails = entries.filter(([k]) => isCurrentLiability(k) && !isCurrentLiabilityTotal(k));
  const nonCurrentLiabilityDetails = entries.filter(([k]) => isNonCurrentLiability(k) && !isNonCurrentLiabilityTotal(k));
  const hasCurrentAssets = explicitCurrentAssets.length > 0 || currentAssetDetails.length > 0;
  const hasCurrentLiabilities = explicitCurrentLiabilities.length > 0 || currentLiabilityDetails.length > 0;
  const hasNonCurrentAssets = explicitNonCurrentAssets.length > 0 || nonCurrentAssetDetails.length > 0;
  const hasNonCurrentLiabilities =
    explicitNonCurrentLiabilities.length > 0 || nonCurrentLiabilityDetails.length > 0;
  const activosCorrientes =
    explicitCurrentAssets.length > 0 ? sum(explicitCurrentAssets) : sum(currentAssetDetails);
  const activosNoCorrientes =
    explicitNonCurrentAssets.length > 0 ? sum(explicitNonCurrentAssets) : sum(nonCurrentAssetDetails);
  const hasTotalAssets =
    explicitActivoTotal.length > 0 || (hasCurrentAssets && hasNonCurrentAssets);
  const activos = explicitActivoTotal.length > 0
    ? sum(explicitActivoTotal)
    : hasTotalAssets
      ? activosCorrientes + activosNoCorrientes
      : 0;
  const pasivosCorrientes =
    explicitCurrentLiabilities.length > 0 ? sum(explicitCurrentLiabilities) : sum(currentLiabilityDetails);
  const pasivosNoCorrientes =
    explicitNonCurrentLiabilities.length > 0
      ? sum(explicitNonCurrentLiabilities)
      : sum(nonCurrentLiabilityDetails);
  const hasTotalLiabilities =
    explicitPasivoTotal.length > 0 || (hasCurrentLiabilities && hasNonCurrentLiabilities);
  const pasivos = explicitPasivoTotal.length > 0
    ? sum(explicitPasivoTotal)
    : hasTotalLiabilities
      ? pasivosCorrientes + pasivosNoCorrientes
      : 0;
  const hasEquity = explicitPatrimonioTotal.length > 0 || entries.some(([k]) => isEquity(k));
  const patrimonio = explicitPatrimonioTotal.length > 0
    ? sum(explicitPatrimonioTotal)
    : sum(entries.filter(([k]) => isEquity(k)));
  const inventarioEntries = entries.filter(([k]) => isInventory(k));
  const inventarios = sum(inventarioEntries);

  const grossProfitEntries = entries.filter(([k]) => isGrossProfit(k));
  const operatingProfitEntries = entries.filter(([k]) => isOperatingProfit(k));
  const pretaxEntries = entries.filter(([k]) => isProfitBeforeTax(k));
  const netIncomeEntries = entries.filter(([k]) => isNetIncome(k));
  const hasGrossProfit = grossProfitEntries.length > 0 || (ingresosEntries.length > 0 && costEntries.length > 0);
  const utilidadBruta = grossProfitEntries.length > 0 ? sum(grossProfitEntries) : ingresos - costos;
  const hasOperatingProfit =
    operatingProfitEntries.length > 0 || (hasGrossProfit && allExpenseEntries.length > 0);
  const utilidadOperativa = operatingProfitEntries.length > 0
    ? sum(operatingProfitEntries)
    : utilidadBruta - gastos + otrosIngresosOperativos;
  const hasProfitBeforeTax =
    pretaxEntries.length > 0 ||
    (operatingProfitEntries.length > 0 &&
      entries.some(([k]) => isFinancialIncome(k) || isFinancialExpense(k) || isIncomeTax(k)));
  const utilidadAntesImpuestos = pretaxEntries.length > 0
    ? sum(pretaxEntries)
    : utilidadOperativa + ingresosFinancieros - gastosFinancieros;
  const hasNetIncome = netIncomeEntries.length > 0 || (hasProfitBeforeTax && entries.some(([k]) => isIncomeTax(k)));
  const utilidadNeta = netIncomeEntries.length > 0
    ? sum(netIncomeEntries)
    : utilidadAntesImpuestos - impuestoRenta;

  return {
    ingresos,
    otrosIngresosOperativos,
    ingresosFinancieros,
    costos,
    gastos,
    gastosAdmin,
    gastosVentas,
    gastosFinancieros,
    impuestoRenta,
    depreciacion,
    activos,
    activosCorrientes,
    activosNoCorrientes,
    inventarios,
    pasivos,
    pasivosCorrientes,
    pasivosNoCorrientes,
    patrimonio,
    utilidadBruta,
    utilidadAntesImpuestos,
    utilidadNeta,
    utilidadOperativa,
    hasTotalAssets,
    hasCurrentAssets,
    hasNonCurrentAssets,
    hasTotalLiabilities,
    hasCurrentLiabilities,
    hasNonCurrentLiabilities,
    hasEquity,
    hasInventory: inventarioEntries.length > 0,
    hasIncomeTax: entries.some(([k]) => isIncomeTax(k)),
    hasNetIncome: netIncomeEntries.length > 0,
    hasGrossProfit: grossProfitEntries.length > 0,
    hasOperatingProfit: operatingProfitEntries.length > 0,
    hasProfitBeforeTax: pretaxEntries.length > 0,
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
  const ac = c.activosCorrientes;
  const pc = c.pasivosCorrientes;
  const inv = c.inventarios;
  const capitalTrabajo = ac - pc;
  const liquidezCorriente = c.hasCurrentAssets && c.hasCurrentLiabilities ? ratio(ac, pc) : null;
  const pruebaAcida =
    c.hasCurrentAssets && c.hasCurrentLiabilities && c.hasInventory ? ratio(ac - inv, pc) : null;
  const solvencia = c.hasTotalAssets && c.hasTotalLiabilities ? ratio(c.activos, c.pasivos) : null;
  const endeudamiento = c.hasTotalAssets && c.hasTotalLiabilities ? pct(c.pasivos, c.activos) : null;
  const endeudamientoPat =
    c.hasTotalLiabilities && c.hasEquity ? ratio(c.pasivos, c.patrimonio) : null;
  const autonomia = c.hasEquity && c.hasTotalAssets ? pct(c.patrimonio, c.activos) : null;
  const roa = c.hasNetIncome && c.hasTotalAssets ? pct(c.utilidadNeta, c.activos) : null;
  const roe = c.hasNetIncome && c.hasEquity ? pct(c.utilidadNeta, c.patrimonio) : null;
  const balanceCuadra =
    c.hasTotalAssets && c.hasTotalLiabilities && c.hasEquity
      ? Math.abs(c.activos - (c.pasivos + c.patrimonio)) / c.activos
      : null;
  const concentracionAC = c.hasCurrentAssets && c.hasTotalAssets ? pct(ac, c.activos) : null;
  const coberturaCT =
    c.hasCurrentAssets && c.hasCurrentLiabilities ? ratio(capitalTrabajo, pc) : null;

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
      display: c.hasCurrentAssets && c.hasCurrentLiabilities ? fmtCOP(capitalTrabajo) : "N/D",
      benchmark: "> 0",
      status:
        !c.hasCurrentAssets || !c.hasCurrentLiabilities
          ? "neutral"
          : capitalTrabajo >= 0
            ? "good"
            : "bad",
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
      status:
        solvencia == null
          ? "neutral"
          : solvencia >= 1.5
            ? "good"
            : solvencia >= 1
              ? "warn"
              : "bad",
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
      status:
        balanceCuadra == null
          ? "neutral"
          : balanceCuadra < 0.05
            ? "good"
            : balanceCuadra < 0.15
              ? "warn"
              : "bad",
      insight:
        balanceCuadra == null
          ? "No se puede comprobar: el documento no presenta los totales de pasivos y patrimonio."
          : "Verifica si la ecuación contable fundamental se cumple con los datos extraídos.",
    },
  ];

  return rows;
}

export function computePnLIndicators(c: ClassifiedTotals): IndicatorRow[] {
  const { ingresos, costos, gastos, gastosAdmin, gastosVentas, gastosFinancieros, depreciacion } = c;
  const gastosOperativos = gastos;
  const utilidadBruta = c.utilidadBruta;
  const utilidadOperativa = c.utilidadOperativa;
  const ebitda = utilidadOperativa + depreciacion;
  const utilidadNeta = c.utilidadNeta;

  const margenBruto = c.hasGrossProfit ? pct(utilidadBruta, ingresos) : null;
  const margenOperativo = c.hasOperatingProfit ? pct(utilidadOperativa, ingresos) : null;
  const margenEbitda = c.hasOperatingProfit ? pct(ebitda, ingresos) : null;
  const margenNeto = c.hasNetIncome ? pct(utilidadNeta, ingresos) : null;
  const costoVentas = pct(costos, ingresos);
  const gastosOp = pct(gastosOperativos, ingresos);
  const gastosAdminPct = pct(gastosAdmin, ingresos);
  const gastosVentasPct = pct(gastosVentas, ingresos);
  const margenContrib = null;
  const puntoEquilibrio = null;
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
  if (!c.hasTotalAssets || !c.hasTotalLiabilities) return [];
  const ac = c.activosCorrientes;
  const pc = c.pasivosCorrientes;
  const liquidity = c.hasCurrentAssets && c.hasCurrentLiabilities ? ratio(ac, pc) ?? undefined : undefined;
  const base = {
    activos: c.activos,
    pasivos: c.pasivos,
    patrimonio: c.patrimonio,
    liquidez: liquidity,
    endeudamiento: pct(c.pasivos, c.activos) ?? undefined,
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
      liquidez: liquidity == null ? undefined : ratio(ac * 0.9, pc * 1.2) ?? undefined,
      endeudamiento: pct(c.pasivos * 1.15, c.activos * 0.95) ?? undefined,
    },
    {
      scenario: "Optimista (+10% activos, −5% pasivos)",
      description: "Escenario favorable: crecimiento de activos y reducción de deuda.",
      activos: c.activos * 1.1,
      pasivos: c.pasivos * 0.95,
      patrimonio: c.activos * 1.1 - c.pasivos * 0.95,
      liquidez: liquidity == null ? undefined : ratio(ac * 1.1, pc * 0.9) ?? undefined,
      endeudamiento: pct(c.pasivos * 0.95, c.activos * 1.1) ?? undefined,
    },
    {
      scenario: "Proyección 12 meses (tendencia +3%/mes activos)",
      description: "Extrapolación conservadora del crecimiento de activos a 12 meses.",
      activos: c.activos * Math.pow(1.03, 12),
      pasivos: c.pasivos * Math.pow(1.02, 12),
      patrimonio: c.activos * Math.pow(1.03, 12) - c.pasivos * Math.pow(1.02, 12),
      liquidez:
        liquidity == null
          ? undefined
          : ratio(ac * Math.pow(1.03, 12), pc * Math.pow(1.02, 12)) ?? undefined,
      endeudamiento: pct(c.pasivos * Math.pow(1.02, 12), c.activos * Math.pow(1.03, 12)) ?? undefined,
    },
  ];
}

export function computePnLScenarios(c: ClassifiedTotals): ScenarioRow[] {
  const baseResult = c.utilidadNeta;

  const mk = (ing: number, cost: number, gast: number, result?: number): ScenarioRow => {
    const u =
      result ??
      baseResult +
        (ing - c.ingresos) -
        (cost - c.costos) -
        (gast - c.gastos);
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
      ...mk(c.ingresos * 12, c.costos * 12, c.gastos * 12, baseResult * 12),
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
