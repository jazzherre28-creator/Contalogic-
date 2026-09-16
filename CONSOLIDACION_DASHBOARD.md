/**
 * DOCUMENTO DE CONSOLIDACIÓN - DASHBOARD FINANCIERO UNIFICADO
 * ============================================================
 * 
 * ARQUITECTURA MEJORADA IMPLEMENTADA
 * 
 * PROBLEMA ORIGINAL:
 * ✗ Datos ficticios dispersos (2246, 1030, 1158)
 * ✗ Múltiples fuentes de verdad (OCR, manual, contexto)
 * ✗ Inconsistencias entre indicadores y partidas
 * ✗ Números hardcodeados en componentes
 * ✗ Sin sincronización central
 * 
 * SOLUCIÓN IMPLEMENTADA:
 * ✓ Estado global único: DatosFinancierosGlobales
 * ✓ Función centralizada de limpieza de números
 * ✓ Mapeo automático OCR → Estado global
 * ✓ Cálculo de indicadores desde estado único
 * ✓ Sincronización total entre componentes
 * 
 * 
 * ARCHIVOS CREADOS/MODIFICADOS
 * =====================================
 * 
 * [NUEVO] src/lib/global-finance-state.ts
 * ─────────────────────────────────────────
 * - Interface: DatosFinancierosGlobales
 * - Función: cleanNumericValue(string|number) → number
 *   Convierte: "$539.000.000" → 539000000
 *            "$1.234,50" → 1234.5
 *            "1030" → 1030
 * - Función: crearEstadoDesdeOCR(totals, docType)
 * - Función: calcularIndicadores(datos)
 * - Función: validarConsistencia(datos)
 * - Constante: ESTADO_INICIAL (sin datos ficticios)
 * 
 * [NUEVO] src/lib/finance-context.tsx
 * ─────────────────────────────────────────
 * - React Context: FinanceContext
 * - Provider: FinanceProvider
 * - Hook: useFinance()
 * - Acciones:
 *   • actualizarDesdeOCR(totals, docType)
 *   • actualizarManual(parcial)
 *   • limpiar()
 *   • validar()
 * 
 * [MODIFICADO] src/routes/__root.tsx
 * ─────────────────────────────────────────
 * - Importa: FinanceProvider
 * - Envuelve: <Outlet /> con FinanceProvider
 * 
 * [MODIFICADO] src/lib/file-extractors.ts
 * ─────────────────────────────────────────
 * - Importa: cleanNumericValue del global-finance-state
 * - Reemplaza: normalizeNumber() usa cleanNumericValue
 * 
 * [MODIFICADO] src/routes/_app.scanner.tsx
 * ─────────────────────────────────────────
 * - Importa: useFinance
 * - En handleFile: llama actualizarDesdeOCR(totals, docType)
 * - Resultado: Estado global se sincroniza al cargar OCR
 * 
 * [MODIFICADO] src/routes/_app.dashboard.tsx
 * ─────────────────────────────────────────
 * - Importa: useFinance
 * - Lógica: displayTotals (prioridad: OCR > Balance > Manual)
 * - Resultado: Indicadores leen del estado global
 * 
 * 
 * FLUJO DE DATOS - ANTES vs DESPUÉS
 * =====================================
 * 
 * ANTES (PROBLEMA):
 * ┌─────────────┐
 * │  OCR Upload │
 * └──────┬──────┘
 *        │
 *        ├─→ Supabase (almacenado)
 *        ├─→ AdvancedAnalytics (calcula)
 *        └─→ NADA (sin sincronización)
 *
 * DESPUÉS (SOLUCIÓN):
 * ┌─────────────┐
 * │  OCR Upload │
 * └──────┬──────┘
 *        │
 *        ├─→ extractFromFile (usa cleanNumericValue)
 *        │   └─→ Números limpios
 *        │
 *        ├─→ Supabase (almacenado)
 *        │
 *        └─→ actualizarDesdeOCR()
 *            └─→ DatosFinancierosGlobales
 *                ├─→ Mapeo automático
 *                ├─→ Cálculo de indicadores
 *                └─→ React Context (disponible globalmente)
 * 
 * ┌─────────────┐        ┌──────────────────────┐
 * │  Dashboard  │─────→  │ useFinance()         │
 * │  Scanner    │       │ datos.ingresos       │
 * │  Analytics  │       │ datos.margenNeto     │
 * │  Reports    │       │ datos.liquidez       │
 * └─────────────┘        └──────────────────────┘
 *                               ↓
 *                      ÚNICA FUENTE DE VERDAD
 * 
 * 
 * CÓMO USAR EN COMPONENTES
 * =====================================
 * 
 * import { useFinance } from "@/lib/finance-context";
 * 
 * function MiComponente() {
 *   const { datos, actualizarDesdeOCR, validar } = useFinance();
 * 
 *   // Leer datos
 *   console.log(datos.ingresos);        // 539000000
 *   console.log(datos.margenNeto);       // 25.5
 *   console.log(datos.utilidadNeta);     // 135000000
 * 
 *   // Actualizar desde OCR
 *   const totals = { "Ingresos": 539000000, "Costos": 403500000 };
 *   actualizarDesdeOCR(totals, "pnl");
 * 
 *   // Validar consistencia
 *   const { valido, errores } = validar();
 *   if (!valido) console.log("Errores:", errores);
 * }
 * 
 * 
 * LIMPIEZA DE NÚMEROS - EJEMPLOS
 * =====================================
 * 
 * import { cleanNumericValue } from "@/lib/global-finance-state";
 * 
 * cleanNumericValue("$539.000.000")       // → 539000000
 * cleanNumericValue("$1.234,50")           // → 1234.5
 * cleanNumericValue("1030")                 // → 1030
 * cleanNumericValue("(123)")                // → -123
 * cleanNumericValue("USD 50,000.99")       // → 50000.99
 * cleanNumericValue("€1.234.567,89")      // → 1234567.89
 * cleanNumericValue(null)                   // → 0
 * cleanNumericValue("")                     // → 0
 * 
 * 
 * VALIDACIÓN DE CONSISTENCIA
 * =====================================
 * 
 * Balance: Activos = Pasivos + Patrimonio
 *   Ej: 1000000 = 600000 + 400000 ✓
 * 
 * P&L: Utilidad Neta = Ingresos - Costos - Gastos
 *   Ej: 135000000 = 539000000 - 403500000 - 0 ✓
 * 
 * Proporcionalidad:
 *   - Activos Corrientes < Activos Totales
 *   - Pasivos Corrientes < Pasivos Totales
 *   - Costos < Ingresos (generalmente)
 * 
 * 
 * INDICADORES CALCULADOS AUTOMÁTICAMENTE
 * =====================================
 * 
 * P&L INDICATORS:
 *   - Utilidad Bruta = Ingresos - Costos
 *   - Utilidad Neta = Ingresos - Costos - Gastos
 *   - Margen Bruto = (Utilidad Bruta / Ingresos) * 100
 *   - Margen Neto = (Utilidad Neta / Ingresos) * 100
 * 
 * BALANCE INDICATORS:
 *   - Liquidez = Activos / Pasivos
 *   - Endeudamiento = (Pasivos / Activos) * 100
 *   - Liquidez Corriente = Activos Corrientes / Pasivos Corrientes
 *   - Capital de Trabajo = Activos Corrientes - Pasivos Corrientes
 * 
 * 
 * MIGRACIÓN DESDE CÓDIGO ANTERIOR
 * =====================================
 * 
 * SI TU COMPONENTE TENÍA ESTO:
 * ──────────────────────────────
 * const [totals, setTotals] = useState({});
 * const margenNeto = (utilidad / ingresos) * 100;
 * 
 * AHORA DEBE SER:
 * ───────────────
 * const { datos } = useFinance();
 * const margenNeto = datos.margenNeto; // Ya calculado
 * 
 * 
 * SINCRONIZACIÓN GARANTIZADA
 * =====================================
 * 
 * ✓ OCR → Estado Global → Dashboard
 *   Si carga un PDF: AdvancedAnalytics verá los mismos datos
 * 
 * ✓ Manual → Estado Global → AdvancedAnalytics
 *   Si actualiza manualmente: Se recalculan indicadores automáticamente
 * 
 * ✓ Todos los componentes ven los mismos datos
 *   No hay desincronización posible
 * 
 * ✓ Indicadores = Partidas
 *   Los números superiores coinciden 100% con los detalles
 * 
 * 
 * VERIFICACIÓN: LISTA DE VALIDACIÓN
 * =====================================
 * 
 * [ ] No hay constantes hardcodeadas (2246, 1030, 1158)
 * [ ] cleanNumericValue convierte "$539.000.000" a 539000000
 * [ ] OCR actualiza el estado global automáticamente
 * [ ] Dashboard muestra datos del estado global
 * [ ] AdvancedAnalytics lee del estado global
 * [ ] Indicadores se calculan automáticamente
 * [ ] Sin datos ficticios, solo 0 o valores reales
 * [ ] Validación detecta inconsistencias
 * [ ] Todos los componentes sincronizados
 * 
 * 
 * DEBUGGING / TROUBLESHOOTING
 * =====================================
 * 
 * Para ver el estado global en consola:
 * ────────────────────────────────────
 * const { datos } = useFinance();
 * console.log("Estado global:", datos);
 * 
 * Para validar datos:
 * ───────────────────
 * const { validar } = useFinance();
 * const { valido, errores } = validar();
 * console.log("¿Válido?", valido);
 * if (!valido) console.log("Errores:", errores);
 * 
 * Para resetear estado:
 * ─────────────────────
 * const { limpiar } = useFinance();
 * limpiar(); // Vuelve a ESTADO_INICIAL
 */

// Este archivo es solo documentación - no contiene código ejecutable
// Consulta este documento como referencia de arquitectura
