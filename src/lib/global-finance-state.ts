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

  // Remover símbolos de moneda y caracteres especiales
  let cleaned = strVal.replace(/[$€¥£¢]/g, "").trim();
  
  // Detectar formato: punto como mil y coma decimal vs. coma como mil y punto decimal
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (dotCount > 0 && commaCount > 0) {
    // Ambos separadores presentes: detectar por posición
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    
    if (lastComma > lastDot) {
      // Formato latinoamericano: 1.234.567,89
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato anglosajón: 1,234,567.89
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (commaCount > 0 && dotCount === 0) {
    // Solo comas: determinar si son decimales o miles
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length === 2 || parts[parts.length - 1].length === 3) {
      // Parece decimal: "1000,50" o "1000,5"
      cleaned = cleaned.replace(",", ".");
    } else {
      // Parece miles: "1,000,000"
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (dotCount > 0 && commaCount === 0) {
    // Solo puntos: determinar si son decimales o miles
    const parts = cleaned.split(".");
    if (parts[parts.length - 1].length <= 3 && parts.length > 1) {
      const beforeDot = parts.slice(0, -1).join("");
      if (beforeDot.length >= 3) {
        // Parece miles: "1.000.000"
        cleaned = cleaned.replace(/\./g, "");
      } else {
        // Parece decimal: "12.5"
        // Dejar como está
      }
    }
  }

  // Remover caracteres no numéricos excepto punto
  cleaned = cleaned.replace(/[^0-9.-]/g, "");

  // Manejar negativos entre paréntesis: (123) → -123
  if (/^\(.*\)$/.test(cleaned)) {
    cleaned = "-" + cleaned.slice(1, -1);
  }

  const numeric = parseFloat(cleaned);
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
  
  // ========== P&L (Estado de Resultados) ==========
  ingresos: number;
  costos: number;
  gastos: number;
  gastosAdmin?: number;
  gastosVentas?: number;
  gastosFinancieros?: number;
  
  // ========== DERIVADOS (Cálculos) ==========
  utilidadBruta?: number;
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
    if (estado.costos > 0) {
      estado.utilidadBruta = estado.ingresos - estado.costos;
    }
    if (estado.utilidadBruta == null) {
      estado.utilidadBruta = estado.ingresos - estado.costos;
    }

    if (estado.costos > 0 || estado.gastos > 0) {
      estado.utilidadNeta = estado.ingresos - estado.costos - estado.gastos;
    }

    if (estado.utilidadBruta != null) {
      estado.margenBruto = (estado.utilidadBruta / estado.ingresos) * 100;
    }
    if (estado.utilidadNeta != null) {
      estado.margenNeto = (estado.utilidadNeta / estado.ingresos) * 100;
    }
  }

  // Balance Derivados
  if (estado.pasivos > 0 && estado.activos > 0) {
    estado.liquidez = estado.activos / estado.pasivos;
    estado.endeudamiento = (estado.pasivos / estado.activos) * 100;
  } else if (estado.pasivos > 0) {
    // Evitar división por cero: si activos === 0, marcar endeudamiento como infinito práctico
    estado.liquidez = estado.activos > 0 ? estado.activos / estado.pasivos : 0;
    estado.endeudamiento = Number.POSITIVE_INFINITY;
  }
  
  if (estado.pasivosCorrientes > 0) {
    estado.liquidezCorriente = estado.activosCorrientes / estado.pasivosCorrientes;
  }
  
  estado.capitalTrabajo = estado.activosCorrientes - estado.pasivosCorrientes;

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
  const estado: DatosFinancierosGlobales = {
    ...ESTADO_INICIAL,
    docType,
    fechaExtraccion: new Date(),
    source: "ocr",
  };

  const lineItemsTotals: Record<string, number> = {};
  for (const item of parsed.lineItems ?? []) {
    lineItemsTotals[item.label] = (lineItemsTotals[item.label] ?? 0) + item.value;
  }

  const totals: Record<string, number> = {
    ...lineItemsTotals,
    ...parsed.totals,
  };

  const addAmount = (current: number | undefined, value: number) => Math.max(0, (current ?? 0) + value);

  const inferred: Partial<Record<keyof DatosFinancierosGlobales, number>> = {};
  const inferField = (field: keyof DatosFinancierosGlobales, value: number) => {
    inferred[field] = (inferred[field] ?? 0) + value;
  };

  const fallbackClassifier = (lowerLabel: string, value: number) => {
    if (docType === "balance") {
      if (/(caja|banco|disponib|efectivo|cartera|clientes|deudor|deudores|inventario|existenc|mercanc|documentos a cobrar)/i.test(lowerLabel)) {
        inferField("activosCorrientes", value);
      }
      if (/(propiedad|planta|equipo|fijo|inmovilizado|intangible|largo plazo|no corriente|no corrien)/i.test(lowerLabel)) {
        inferField("activosNoCorrientes", value);
      }
      if (/(proveedor|acreedor|obligacion a corto|obligac.*corto|credito corto|pasivo corrien|corriente)/i.test(lowerLabel)) {
        inferField("pasivosCorrientes", value);
      }
      if (/(largo plazo|no corrien|no corriente|bono|credito.*largo|deuda.*largo|obligacion.*largo)/i.test(lowerLabel)) {
        inferField("pasivosNoCorrientes", value);
      }
      if (/(capital social|reservas|utilidad retenida|resultado del ejercicio|resultado.*ejercicio|patrimonio|capital contable)/i.test(lowerLabel)) {
        inferField("patrimonio", value);
      }
    }

    if (docType === "pnl") {
      if (/(ingres|venta|honorario|factur|servicio prestado)/i.test(lowerLabel) && !/(costo|gasto|utilidad|pasivo|patrimonio)/i.test(lowerLabel)) {
        inferField("ingresos", value);
      }
      if (/(cmv|costo de ventas|costo ventas|costo.*venta|costos?|venta.*costo|gasto variable)/i.test(lowerLabel)) {
        inferField("costos", value);
      }
      if (/(gastos?.*(operativ|admin|administr|ventas|financieros?|personal|comercial)|deprec|amortiz|interes|financ)/i.test(lowerLabel) && !/(ingres|venta)/i.test(lowerLabel)) {
        inferField("gastos", value);
      }
    }
  };

  // Mapeo de etiquetas OCR a campos (sensible a mayúsculas)
  // Importante: los patrones específicos deben aparecer antes que los genéricos.
  const etiquetaMap: Record<string, (e: DatosFinancierosGlobales, v: number) => void> = {
    // ACTIVOS específicos y totales
    "^activos?\s*(totales?)?$": (e, v) => (e.activos = v),
    "total.*activ": (e, v) => (e.activos = v),
    "activo.*corrien": (e, v) => (e.activosCorrientes = v),
    "activo.*no corrien": (e, v) => (e.activosNoCorrientes = v),
    "activos?\s+corrien": (e, v) => (e.activosCorrientes = v),
    "activos?\s+no corrien": (e, v) => (e.activosNoCorrientes = v),

    // PASIVOS específicos y totales
    "^pasivos?\s*(totales?)?$": (e, v) => (e.pasivos = v),
    "total.*pasiv": (e, v) => (e.pasivos = v),
    "pasivo.*corrien": (e, v) => (e.pasivosCorrientes = v),
    "pasivo.*no corrien": (e, v) => (e.pasivosNoCorrientes = v),

    // PATRIMONIO
    "^patrimonio$": (e, v) => (e.patrimonio = v),
    "total.*patrim": (e, v) => (e.patrimonio = v),
    "total.*patrimonio": (e, v) => (e.patrimonio = v),
    "^capital.*propiedad$": (e, v) => (e.patrimonio = v),
    "^capital.*contable$": (e, v) => (e.patrimonio = v),

    // P&L
    "^ingres.*$": (e, v) => (e.ingresos = addAmount(e.ingresos, v)),
    "^ventas?( netas?)?$": (e, v) => (e.ingresos = addAmount(e.ingresos, v)),
    "^ventas?( brutas?)?$": (e, v) => (e.ingresos = addAmount(e.ingresos, v)),
    "^honorarios?$": (e, v) => (e.ingresos = addAmount(e.ingresos, v)),
    "cmv": (e, v) => (e.costos = addAmount(e.costos, v)),
    "mercanc": (e, v) => (e.costos = addAmount(e.costos, v)),
    "costo": (e, v) => (e.costos = addAmount(e.costos, v)),
    "costo.*vent": (e, v) => (e.costos = addAmount(e.costos, v)),
    "gastos? operativ": (e, v) => {
      e.gastos = addAmount(e.gastos, v);
    },
    "gastos? de administr": (e, v) => {
      e.gastosAdmin = addAmount(e.gastosAdmin, v);
      e.gastos = addAmount(e.gastos, v);
    },
    "gastos? de vent": (e, v) => {
      e.gastosVentas = addAmount(e.gastosVentas, v);
      e.gastos = addAmount(e.gastos, v);
    },
    "gastos? financieros?": (e, v) => {
      e.gastosFinancieros = addAmount(e.gastosFinancieros, v);
      e.gastos = addAmount(e.gastos, v);
    },
    "financ": (e, v) => {
      e.gastosFinancieros = addAmount(e.gastosFinancieros, v);
      e.gastos = addAmount(e.gastos, v);
    },
    "admin": (e, v) => {
      e.gastosAdmin = addAmount(e.gastosAdmin, v);
      e.gastos = addAmount(e.gastos, v);
    },
    "venta.*gasto": (e, v) => {
      e.gastosVentas = addAmount(e.gastosVentas, v);
      e.gastos = addAmount(e.gastos, v);
    },
    "^gasto[s]?$": (e, v) => (e.gastos = addAmount(e.gastos, v)),
    "^gasto[s]?.*varia": (e, v) => (e.costos = addAmount(e.costos, v)),
    "utilidad.*bruta": (e, v) => (e.utilidadBruta = addAmount(e.utilidadBruta, v)),
    "utilidad.*operativ": (e, v) => {
      e.utilidadBruta = e.utilidadBruta ?? 0;
      e.utilidadNeta = addAmount(e.utilidadNeta, v);
    },
    "utilidad.*neta": (e, v) => (e.utilidadNeta = addAmount(e.utilidadNeta, v)),
  };

  // Aplicar mapeo a totales y partidas individuales
  for (const [label, value] of Object.entries(totals)) {
    const cleanValue = cleanNumericValue(value);
    const lowerLabel = String(label).toLowerCase();
    let matched = false;

    for (const [pattern, setter] of Object.entries(etiquetaMap)) {
      if (new RegExp(pattern, "i").test(lowerLabel)) {
        setter(estado, cleanValue);
        matched = true;
        break;
      }
    }

    if (!matched) {
      fallbackClassifier(lowerLabel, cleanValue);
    }
  }

  // Si no hay total de activos/pasivos totales, consolidar desde corrientes/no corrientes.
  if (estado.activos === 0 && estado.activosCorrientes > 0 && estado.activosNoCorrientes > 0) {
    estado.activos = estado.activosCorrientes + estado.activosNoCorrientes;
  }
  if (estado.pasivos === 0 && estado.pasivosCorrientes > 0 && estado.pasivosNoCorrientes > 0) {
    estado.pasivos = estado.pasivosCorrientes + estado.pasivosNoCorrientes;
  }
  if (estado.patrimonio === 0 && estado.activos > 0 && estado.pasivos > 0) {
    estado.patrimonio = Math.max(0, estado.activos - estado.pasivos);
  }

  // Si no hay total de activos/pasivos totales, consolidar desde corrientes/no corrientes.
  if (estado.activos === 0 && estado.activosCorrientes > 0 && estado.activosNoCorrientes > 0) {
    estado.activos = estado.activosCorrientes + estado.activosNoCorrientes;
  }
  if (estado.pasivos === 0 && estado.pasivosCorrientes > 0 && estado.pasivosNoCorrientes > 0) {
    estado.pasivos = estado.pasivosCorrientes + estado.pasivosNoCorrientes;
  }
  if (estado.patrimonio === 0 && estado.activos > 0 && estado.pasivos > 0) {
    estado.patrimonio = Math.max(0, estado.activos - estado.pasivos);
  }

  // Si aún faltan campos clave y hay lineItems, usar el primer match directo
  for (const item of parsed.lineItems ?? []) {
    const cleanValue = cleanNumericValue(item.value);
    const lowerLabel = item.label.toLowerCase();
    let matched = false;
    for (const [pattern, setter] of Object.entries(etiquetaMap)) {
      if (new RegExp(pattern, "i").test(lowerLabel)) {
        setter(estado, cleanValue);
        matched = true;
        break;
      }
    }
    if (!matched) {
      fallbackClassifier(lowerLabel, cleanValue);
    }
  }

  // Si no detectó gastos pero tiene ingresos y costos, calcular
  if (estado.gastos === 0 && estado.ingresos > 0 && estado.costos > 0) {
    estado.gastos = 0; // Mantener en 0, el usuario puede actualizar
  }

  // Calcular indicadores derivados
  return calcularIndicadores(estado);
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
    // Validar ecuación fundamental: A = P + Pt
    const diferencia = Math.abs(datos.activos - (datos.pasivos + datos.patrimonio));
    const toleranciaBalance = Math.max(1, datos.activos * 0.01);
    if (datos.activos > 0 && diferencia > toleranciaBalance) {
      errores.push(`Balance desbalanceado: Activos ${datos.activos} ≠ Pasivos ${datos.pasivos} + Patrimonio ${datos.patrimonio}`);
    }

    // Validar que activos corrientes < activos totales
    if (datos.activosCorrientes > datos.activos && datos.activos > 0) {
      errores.push("Activos corrientes > Activos totales");
    }

    // Validar que pasivos corrientes < pasivos totales
    if (datos.pasivosCorrientes > datos.pasivos && datos.pasivos > 0) {
      errores.push("Pasivos corrientes > Pasivos totales");
    }
  }

  if (datos.docType === "pnl" || datos.docType === "mixed") {
    // Validar que utilidad neta = ingresos - costos - gastos
    if (datos.ingresos > 0 || datos.costos > 0 || datos.gastos > 0) {
      const utilidadEsperada = datos.ingresos - datos.costos - datos.gastos;
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
