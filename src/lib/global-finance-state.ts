import { classifyTotals } from "./financial-analytics";

/**
 * ESTADO FINANCIERO GLOBAL UNIFICADO
 * Única fuente de verdad para todos los datos financieros del dashboard
 * Estructura: Balance (A/P/Patrimonio) y P&L (Ingresos/Costos/Gastos)
 */

/**
 * Convierte strings de moneda a números puros
 * Ej: "$539.000.000" → 539000000
 * Ej: "$1.234,50" → 1234.50
 * Ej: "1030" → 1030
 */
export function cleanNumericValue(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isNaN(value) ? 0 : value;

  const strVal = String(value).trim();
  if (!strVal || strVal === "-" || strVal === ".") return 0;

  const isNegative = /^\s*-/.test(strVal) || /^\s*\(.*\)\s*$/.test(strVal);
  let cleaned = strVal.replace(/[$€¥£¢]/g, "").replace(/[()\s]/g, "").replace(/[^0-9.,+-]/g, "");
  cleaned = cleaned.replace(/^[+-]/, "");
  if (!cleaned || !/\d/.test(cleaned)) return 0;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";
    const decimalDigits = cleaned.length - cleaned.lastIndexOf(decimalSeparator) - 1;
    if (decimalDigits > 0 && decimalDigits <= 2) {
      cleaned = cleaned.split(thousandsSeparator).join("");
      cleaned = cleaned.slice(0, cleaned.lastIndexOf(decimalSeparator)).replace(decimalSeparator, "") +
        "." + cleaned.slice(cleaned.lastIndexOf(decimalSeparator) + 1);
    } else {
      cleaned = cleaned.replace(/[.,]/g, "");
    }
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? "." : ",";
    const parts = cleaned.split(separator);
    const groupedThousands =
      parts.length > 1 &&
      parts[0].length >= 1 &&
      parts[0].length <= 3 &&
      parts.slice(1).every((part) => part.length === 3);

    if (groupedThousands || parts.length > 2) {
      cleaned = parts.join("");
    } else if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = `${parts[0]}.${parts[1]}`;
    } else {
      cleaned = parts.join("");
    }
  }

  const parsed = Number(cleaned);
  const numeric = isNegative ? -parsed : parsed;
  return Number.isNaN(numeric) ? 0 : numeric;
}

/**
 * Estructura principal del estado financiero global
 */
export interface DatosFinancierosGlobales {
  // ========== BALANCE (Estado de Situación Financiera) ==========
  activos: number;
  activosCorrientes: number;
  activosNoCorrientes: number;
  pasivos: number;
  pasivosCorrientes: number;
  pasivosNoCorrientes: number;
  patrimonio: number;
  tieneTotalActivos?: boolean;
  tieneActivosCorrientes?: boolean;
  tieneActivosNoCorrientes?: boolean;
  tieneTotalPasivos?: boolean;
  tienePasivosCorrientes?: boolean;
  tienePasivosNoCorrientes?: boolean;
  tienePatrimonio?: boolean;
  
  // ========== P&L (Estado de Resultados) ==========
  ingresos: number;
  costos: number;
  gastos: number;
  gastosAdmin?: number;
  gastosVentas?: number;
  gastosFinancieros?: number;
  otrosIngresosOperativos?: number;
  ingresosFinancieros?: number;
  impuestoRenta?: number;
  tieneImpuestoRenta?: boolean;
  tieneUtilidadNeta?: boolean;
  
  // ========== DERIVADOS (Cálculos) ==========
  utilidadBruta?: number;
  utilidadOperativa?: number;
  utilidadNeta?: number;
  margenBruto?: number;
  margenNeto?: number;
  
  // ========== INDICADORES DE LIQUIDEZ Y SOLVENCIA ==========
  liquidez?: number; // Activos / Pasivos
  endeudamiento?: number; // (Pasivos / Activos) * 100
  liquidezCorriente?: number; // Activos corrientes / Pasivos corrientes
  capitalTrabajo?: number; // Activos corrientes - Pasivos corrientes
  
  // ========== METADATOS ==========
  docType?: "balance" | "pnl" | "mixed";
  fechaExtraccion?: Date;
  source?: "ocr" | "manual" | "database";
  calidadDatos?: number; // 0-100, porcentaje de confianza
}

/**
 * Estado inicial vacío (sin datos ficticios)
 */
export const ESTADO_INICIAL: DatosFinancierosGlobales = {
  activos: 0,
  activosCorrientes: 0,
  activosNoCorrientes: 0,
  pasivos: 0,
  pasivosCorrientes: 0,
  pasivosNoCorrientes: 0,
  patrimonio: 0,
  tieneTotalActivos: false,
  tieneActivosCorrientes: false,
  tieneActivosNoCorrientes: false,
  tieneTotalPasivos: false,
  tienePasivosCorrientes: false,
  tienePasivosNoCorrientes: false,
  tienePatrimonio: false,
  tieneImpuestoRenta: false,
  tieneUtilidadNeta: false,
  ingresos: 0,
  costos: 0,
  gastos: 0,
  utilidadBruta: 0,
  utilidadNeta: 0,
  margenBruto: 0,
  margenNeto: 0,
  liquidez: 0,
  endeudamiento: 0,
  liquidezCorriente: 0,
  capitalTrabajo: 0,
  docType: undefined,
  calidadDatos: 0,
};

/**
 * Calcula todos los indicadores derivados a partir de valores base
 * NOTA: Llama a esta función después de actualizar los valores principales
 */
export function calcularIndicadores(datos: DatosFinancierosGlobales): DatosFinancierosGlobales {
  const estado = { ...datos };

  // P&L Derivados
  if (estado.ingresos > 0) {
    estado.utilidadBruta = estado.ingresos - estado.costos;
    const gastoOperativo = Math.max(
      0,
      estado.gastos - (estado.gastosFinancieros ?? 0) - (estado.impuestoRenta ?? 0)
    );
    estado.utilidadOperativa =
      estado.utilidadOperativa ?? estado.utilidadBruta - gastoOperativo + (estado.otrosIngresosOperativos ?? 0);
    estado.utilidadNeta =
      estado.utilidadOperativa +
      (estado.ingresosFinancieros ?? 0) -
      (estado.gastosFinancieros ?? 0) -
      (estado.impuestoRenta ?? 0);

    if (estado.utilidadBruta != null) {
      estado.margenBruto = (estado.utilidadBruta / estado.ingresos) * 100;
    }
    if (estado.utilidadNeta != null) {
      estado.margenNeto = (estado.utilidadNeta / estado.ingresos) * 100;
    }
  }

  // Balance Derivados
  const hasBalanceTotals =
    estado.source !== "ocr" ||
    (estado.tieneTotalPasivos === true && estado.tieneTotalActivos === true);
  if (estado.pasivos > 0 && estado.activos > 0 && hasBalanceTotals) {
    estado.liquidez = estado.activos / estado.pasivos;
    estado.endeudamiento = (estado.pasivos / estado.activos) * 100;
  } else if (estado.pasivos > 0 && (estado.source !== "ocr" || estado.tieneTotalPasivos === true)) {
    // Evitar división por cero: si activos === 0, marcar endeudamiento como infinito práctico
    estado.liquidez = estado.activos > 0 ? estado.activos / estado.pasivos : 0;
    estado.endeudamiento = Number.POSITIVE_INFINITY;
  }
  
  const hasCurrentTotals =
    estado.source !== "ocr" ||
    (estado.tieneActivosCorrientes === true && estado.tienePasivosCorrientes === true);
  if (estado.pasivosCorrientes > 0 && hasCurrentTotals) {
    estado.liquidezCorriente = estado.activosCorrientes / estado.pasivosCorrientes;
  } else {
    estado.liquidezCorriente = undefined;
  }
  
  estado.capitalTrabajo =
    !hasCurrentTotals
      ? undefined
      : estado.activosCorrientes - estado.pasivosCorrientes;

  return estado;
}

/**
 * Crea un nuevo estado desde un diccionario de OCR
 * Limpia automáticamente valores y calcula indicadores
 */
export interface OCRParsedData {
  totals?: Record<string, number>;
  lineItems?: Array<{ label: string; value: number }>;
}

export function crearEstadoDesdeOCR(
  parsed: OCRParsedData,
  docType: "balance" | "pnl" = "pnl"
): DatosFinancierosGlobales {
  const lineItemsTotals: Record<string, number> = {};
  for (const item of parsed.lineItems ?? []) {
    lineItemsTotals[item.label] = (lineItemsTotals[item.label] ?? 0) + item.value;
  }
  const totals = parsed.totals ?? lineItemsTotals;
  const classified = classifyTotals(totals);
  const estado: DatosFinancierosGlobales = {
    ...ESTADO_INICIAL,
    docType,
    fechaExtraccion: new Date(),
    source: "ocr",
    activos: classified.activos,
    activosCorrientes: classified.activosCorrientes,
    activosNoCorrientes: classified.activosNoCorrientes,
    pasivos: classified.pasivos,
    pasivosCorrientes: classified.pasivosCorrientes,
    pasivosNoCorrientes: classified.pasivosNoCorrientes,
    patrimonio: classified.patrimonio,
    tieneTotalActivos: classified.hasTotalAssets,
    tieneActivosCorrientes: classified.hasCurrentAssets,
    tieneActivosNoCorrientes: classified.hasNonCurrentAssets,
    tieneTotalPasivos: classified.hasTotalLiabilities,
    tienePasivosCorrientes: classified.hasCurrentLiabilities,
    tienePasivosNoCorrientes: classified.hasNonCurrentLiabilities,
    tienePatrimonio: classified.hasEquity,
    ingresos: classified.ingresos,
    costos: classified.costos,
    gastos: classified.gastos + classified.gastosFinancieros + classified.impuestoRenta,
    gastosAdmin: classified.gastosAdmin,
    gastosVentas: classified.gastosVentas,
    gastosFinancieros: classified.gastosFinancieros,
    otrosIngresosOperativos: classified.otrosIngresosOperativos,
    ingresosFinancieros: classified.ingresosFinancieros,
    impuestoRenta: classified.impuestoRenta,
    tieneImpuestoRenta: classified.hasIncomeTax,
    tieneUtilidadNeta: classified.hasNetIncome,
    utilidadBruta: classified.utilidadBruta,
    utilidadNeta: classified.utilidadNeta,
    utilidadOperativa: classified.utilidadOperativa,
    calidadDatos: Math.min(100, Math.round((Object.keys(totals).length / 20) * 100)),
  };
  const calculated = calcularIndicadores(estado);
  if (docType === "pnl") {
    calculated.utilidadBruta = classified.utilidadBruta;
    calculated.utilidadNeta = classified.utilidadNeta;
    calculated.margenBruto =
      classified.ingresos > 0 ? (classified.utilidadBruta / classified.ingresos) * 100 : 0;
    calculated.margenNeto =
      classified.ingresos > 0 ? (classified.utilidadNeta / classified.ingresos) * 100 : 0;
  }
  return calculated;
}

/**
 * Verifica si el estado tiene datos significativos (no está vacío)
 */
export function tieneDatos(datos: DatosFinancierosGlobales): boolean {
  return (
    datos.activos !== 0 ||
    datos.pasivos !== 0 ||
    datos.patrimonio !== 0 ||
    datos.ingresos !== 0 ||
    datos.costos !== 0 ||
    datos.gastos !== 0
  );
}

/**
 * Valida que los datos sean coherentes según el tipo de documento
 */
export function validarConsistencia(datos: DatosFinancierosGlobales): {
  valido: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  if (datos.docType === "balance" || datos.docType === "mixed") {
    const completeBalance =
      datos.source !== "ocr" ||
      (datos.tieneTotalActivos === true &&
        datos.tieneTotalPasivos === true &&
        datos.tienePatrimonio === true);
    if (completeBalance) {
      const diferencia = Math.abs(datos.activos - (datos.pasivos + datos.patrimonio));
      const toleranciaBalance = Math.max(1, datos.activos * 0.01);
      if (datos.activos > 0 && diferencia > toleranciaBalance) {
        errores.push(
          `Balance desbalanceado: Activos ${datos.activos} ≠ Pasivos ${datos.pasivos} + Patrimonio ${datos.patrimonio}`
        );
      }
    } else {
      errores.push("No se puede comprobar A = P + Patrimonio: el documento no presenta los tres totales.");
    }

    // Validar que activos corrientes < activos totales
    if (
      datos.tieneActivosCorrientes !== false &&
      datos.tieneTotalActivos !== false &&
      datos.activosCorrientes > datos.activos &&
      datos.activos > 0
    ) {
      errores.push("Activos corrientes > Activos totales");
    }

    // Validar que pasivos corrientes < pasivos totales
    if (
      datos.tienePasivosCorrientes !== false &&
      datos.tieneTotalPasivos !== false &&
      datos.pasivosCorrientes > datos.pasivos &&
      datos.pasivos > 0
    ) {
      errores.push("Pasivos corrientes > Pasivos totales");
    }
  }

  if (datos.docType === "pnl" || datos.docType === "mixed") {
    if (datos.ingresos > 0 || datos.costos > 0 || datos.gastos > 0) {
      const utilidadEsperada =
        datos.utilidadOperativa != null
          ? datos.utilidadOperativa +
            (datos.ingresosFinancieros ?? 0) -
            (datos.gastosFinancieros ?? 0) -
            (datos.impuestoRenta ?? 0)
          : datos.ingresos - datos.costos - datos.gastos;
      const diferenciaUtilidad = Math.abs((datos.utilidadNeta ?? utilidadEsperada) - utilidadEsperada);
      const tolerancia = Math.max(1, Math.abs(utilidadEsperada) * 0.01);
      if (diferenciaUtilidad > tolerancia) {
        errores.push(
          `Inconsistencia P&L: utilidad neta calculada ${utilidadEsperada} no coincide con valor registrado ${datos.utilidadNeta ?? 0}`,
        );
      }
    }

    // Validar que costos < ingresos (regla general, no siempre cierta)
    // Omitida porque puede haber pérdidas operativas
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}
