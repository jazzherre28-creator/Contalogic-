/**
 * COMPONENTE: Estado de Resultados (P&L) Reactivo
 * Escucha activa: Se actualiza automáticamente cuando el estado global cambia
 * Sin datos ficticios: 100% dependiente de OCR/manual
 */

import { useFinance, useFinanceListener } from "@/lib/finance-context";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { generatePnLReport } from "@/lib/pdf-report";

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

export function PnLDisplay() {
  const { profile } = useAuth();
  const { datos, ultimoCambio } = useFinance();
  
  // ESCUCHA ACTIVA: Forzar re-render cuando el estado cambia
  const [renderVersion, setRenderVersion] = useState(0);
  
  useFinanceListener((nuevoEstado) => {
    console.log("[PnLDisplay] 📊 CAMBIO DETECTADO EN P&L - Recalculando...", nuevoEstado);
    setRenderVersion((v) => v + 1);
  });

  // Calcular cascada en tiempo real
  const cascada = useMemo(() => {
    const utilidadBruta = datos.ingresos - datos.costos;
    const utilidadNeta = datos.ingresos - datos.costos - datos.gastos;
    const margenBruto = datos.ingresos > 0 ? (utilidadBruta / datos.ingresos) * 100 : 0;
    const margenNeto = datos.ingresos > 0 ? (utilidadNeta / datos.ingresos) * 100 : 0;
    
    return { utilidadBruta, utilidadNeta, margenBruto, margenNeto };
  }, [datos.ingresos, datos.costos, datos.gastos]);

  const tieneData = datos.ingresos > 0 || datos.costos > 0 || datos.gastos > 0;
  const isPnlReady = datos.docType === "pnl" || datos.docType === "mixed";

  const handleDownloadPdf = () => {
    generatePnLReport({ profile: profile ?? {}, datos });
  };

  return (
    <div className="space-y-4">
      {/* Estado de cambio */}
      {ultimoCambio && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-xs text-emerald-200">
            Última actualización: {ultimoCambio.timestamp.toLocaleTimeString("es-CO")} · 
            {ultimoCambio.tipo === "ocr" ? `OCR ${ultimoCambio.docType?.toUpperCase()}` : "Manual"}
          </span>
        </div>
      )}

      {!isPnlReady ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-400 opacity-60 mb-2" />
          <p className="text-sm text-amber-200">
            No hay un documento P&L cargado. Este panel muestra solo datos de Estado de Resultados.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Si cargaste un Balance, revisa el panel de Estado de Situación Financiera.
          </p>
        </div>
      ) : !tieneData ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-400 opacity-60 mb-2" />
          <p className="text-sm text-amber-200">
            Carga un PDF de Estado de Resultados o P&L en el Escáner para ver datos aquí.
          </p>
        </div>
      ) : (
        <>
          {/* TABLA P&L - Estado de Resultados */}
          <div className="glass-neon scanline rounded-xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-neon" />
                <h2 className="text-sm font-semibold tracking-wide">
                  Estado de Resultados (P&L) · Recalculado en cascada
                </h2>
              </div>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!isPnlReady || !tieneData}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-white/10 disabled:opacity-40"
              >
                Descargar PDF
              </button>
            </div>

            {/* Tabla P&L */}
            <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/40">
              <table className="w-full text-xs">
                <thead className="bg-slate-950/80 text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="px-4 py-2 text-left">Concepto</th>
                    <th className="px-4 py-2 text-right">Monto COP</th>
                    <th className="px-4 py-2 text-right">% Ingresos</th>
                    <th className="px-4 py-2 text-right">Indicador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {/* INGRESOS */}
                  <tr className="hover:bg-white/[0.02] transition border-b border-white/5">
                    <td className="px-4 py-3 font-semibold text-emerald-glow">Ingresos Totales</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-glow">
                      {fmtCOP(datos.ingresos)}
                    </td>
                    <td className="px-4 py-3 text-right">100%</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-mono text-[9px]">
                        BASE
                      </span>
                    </td>
                  </tr>

                  {/* COSTOS */}
                  <tr className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-slate-300">
                      <span className="text-muted-foreground">menos</span> Costos de Venta
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">
                      ({fmtCOP(datos.costos)})
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-300">
                      {datos.ingresos > 0 ? `${((datos.costos / datos.ingresos) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-300 font-mono text-[9px]">
                        VARIABLE
                      </span>
                    </td>
                  </tr>

                  {/* UTILIDAD BRUTA */}
                  <tr className="bg-gradient-to-r from-white/5 to-transparent hover:from-white/10 transition border-y border-neon/20">
                    <td className="px-4 py-3 font-semibold text-neon">
                      <span className="text-muted-foreground">=</span> Utilidad Bruta
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-neon">
                      {fmtCOP(cascada.utilidadBruta)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-neon">
                      {cascada.margenBruto.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-neon/20 px-2 py-0.5 text-neon font-mono text-[9px]">
                        MARGEN
                      </span>
                    </td>
                  </tr>

                  {/* GASTOS */}
                  <tr className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-slate-300">
                      <span className="text-muted-foreground">menos</span> Gastos Operacionales
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                      ({fmtCOP(datos.gastos)})
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-300">
                      {datos.ingresos > 0 ? `${((datos.gastos / datos.ingresos) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300 font-mono text-[9px]">
                        ESTRUCTURA
                      </span>
                    </td>
                  </tr>

                  {/* UTILIDAD NETA */}
                  <tr
                    className={`font-bold transition ${
                      cascada.utilidadNeta >= 0
                        ? "bg-gradient-to-r from-emerald-500/20 to-transparent hover:from-emerald-500/30"
                        : "bg-gradient-to-r from-destructive/20 to-transparent hover:from-destructive/30"
                    }`}
                  >
                    <td className="px-4 py-3 text-lg font-bold">
                      <span className="text-muted-foreground text-sm">=</span> Utilidad Neta
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-lg font-bold ${
                        cascada.utilidadNeta >= 0 ? "text-emerald-glow" : "text-destructive"
                      }`}
                    >
                      {fmtCOP(cascada.utilidadNeta)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-lg font-bold ${
                        cascada.margenNeto >= 0 ? "text-neon" : "text-destructive"
                      }`}
                    >
                      {cascada.margenNeto.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      {cascada.utilidadNeta >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-400 inline" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive inline" />
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Métricas de eficiencia */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-neon/20 bg-neon/5 p-3">
                <div className="text-xs text-muted-foreground">Margen Bruto</div>
                <div className="mt-1 font-mono text-sm font-bold text-neon">
                  {cascada.margenBruto.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="text-xs text-muted-foreground">Ratio Gastos</div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-300">
                  {datos.ingresos > 0 ? `${((datos.gastos / datos.ingresos) * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="text-xs text-muted-foreground">Margen Neto</div>
                <div
                  className={`mt-1 font-mono text-sm font-bold ${
                    cascada.margenNeto >= 0 ? "text-emerald-glow" : "text-destructive"
                  }`}
                >
                  {cascada.margenNeto.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="text-xs text-muted-foreground">Rentabilidad</div>
                <div
                  className={`mt-1 font-mono text-sm font-bold ${
                    (cascada.utilidadNeta / datos.ingresos) * 100 >= 0 ? "text-emerald-glow" : "text-destructive"
                  }`}
                >
                  {datos.ingresos > 0 ? `${((cascada.utilidadNeta / datos.ingresos) * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>

            {/* Info de debug/estado */}
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Estado de recálculo (Escucha Activa)
              </div>
              <div className="mt-2 text-xs space-y-1 text-slate-400">
                <div>
                  • Versión de render: <span className="text-neon">{renderVersion}</span>
                </div>
                <div>
                  • Tipo de documento:{" "}
                  <span className="text-emerald-300">
                    {datos.docType === "pnl" ? "P&L (Estado de Resultados)" : datos.docType === "balance" ? "Balance" : "Mixto"}
                  </span>
                </div>
                <div>
                  • Calidad de datos:{" "}
                  <span className="text-neon">{datos.calidadDatos}%</span>
                </div>
                <div>
                  • Última extracción:{" "}
                  <span className="text-slate-300">
                    {datos.fechaExtraccion ? new Date(datos.fechaExtraccion).toLocaleString("es-CO") : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
