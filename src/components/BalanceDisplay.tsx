/**
 * COMPONENTE: Balance (Estado de Situación Financiera) Reactivo
 * Escucha activa: Se actualiza automáticamente cuando el estado global cambia
 * Sin datos ficticios: 100% dependiente de OCR/manual
 */

import { useFinance, useFinanceListener } from "@/lib/finance-context";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Scale, AlertCircle } from "lucide-react";
import { generateBalanceReport } from "@/lib/pdf-report";

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

export function BalanceDisplay() {
  const { profile } = useAuth();
  const { datos, ultimoCambio } = useFinance();
  
  // ESCUCHA ACTIVA: Forzar re-render cuando el estado cambia
  const [renderVersion, setRenderVersion] = useState(0);
  
  useFinanceListener((nuevoEstado) => {
    console.log("[BalanceDisplay] ⚖️ CAMBIO DETECTADO EN BALANCE - Recalculando...", nuevoEstado);
    setRenderVersion((v) => v + 1);
  });

  // Calcular indicadores en tiempo real
  const indicadores = useMemo(() => {
    const liquidez = datos.pasivos > 0 ? datos.activos / datos.pasivos : 0;
    const endeudamiento = datos.activos > 0 ? (datos.pasivos / datos.activos) * 100 : 0;
    const equidad = datos.activos > 0 ? (datos.patrimonio / datos.activos) * 100 : 0;
    const capitalTrabajo = datos.activosCorrientes - datos.pasivosCorrientes;
    const liquidezCorriente = datos.pasivosCorrientes > 0 ? datos.activosCorrientes / datos.pasivosCorrientes : 0;
    
    // Validar ecuación fundamental
    const diferencia = Math.abs(datos.activos - (datos.pasivos + datos.patrimonio));
    const balanceado = datos.activos === 0 || diferencia <= datos.activos * 0.01;
    
    return {
      liquidez,
      endeudamiento,
      equidad,
      capitalTrabajo,
      liquidezCorriente,
      balanceado,
      diferencia,
    };
  }, [datos.activos, datos.pasivos, datos.patrimonio, datos.activosCorrientes, datos.pasivosCorrientes]);

  const tieneData = datos.activos > 0 || datos.pasivos > 0 || datos.patrimonio > 0;
  const isBalanceReady = datos.docType === "balance" || datos.docType === "mixed";

  const handleDownloadPdf = () => {
    generateBalanceReport({ profile: profile ?? {}, datos });
  };

  return (
    <div className="space-y-4">
      {/* Estado de cambio */}
      {ultimoCambio && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          <span className="text-xs text-blue-200">
            Última actualización: {ultimoCambio.timestamp.toLocaleTimeString("es-CO")} · 
            {ultimoCambio.tipo === "ocr" ? `OCR ${ultimoCambio.docType?.toUpperCase()}` : "Manual"}
          </span>
        </div>
      )}

      {!isBalanceReady ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-400 opacity-60 mb-2" />
          <p className="text-sm text-amber-200">
            No hay un documento de Balance cargado. Este panel muestra solo Estado de Situación Financiera.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Si cargaste un P&L, revisa el panel de Estado de Resultados.
          </p>
        </div>
      ) : !tieneData ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-400 opacity-60 mb-2" />
          <p className="text-sm text-amber-200">
            Carga un PDF de Estado de Situación Financiera en el Escáner para ver datos aquí.
          </p>
        </div>
      ) : (
        <>
          {/* TABLA BALANCE */}
          <div className="glass-neon scanline rounded-xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-neon" />
                <h2 className="text-sm font-semibold tracking-wide">
                  Estado de Situación Financiera · Escucha Activa
                </h2>
              </div>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!isBalanceReady || !tieneData}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-white/10 disabled:opacity-40"
              >
                Descargar PDF
              </button>
            </div>

            {/* Validación de balance */}
            {!indicadores.balanceado && datos.activos > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-200">
                  ⚠️ Balance desbalanceado. Diferencia: {fmtCOP(Math.abs(indicadores.diferencia))}
                </p>
              </div>
            )}

            {/* Tabla Balance */}
            <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/40">
              <table className="w-full text-xs">
                <thead className="bg-slate-950/80 text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="px-4 py-2 text-left">Concepto</th>
                    <th className="px-4 py-2 text-right">Monto COP</th>
                    <th className="px-4 py-2 text-right">% Activos</th>
                    <th className="px-4 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {/* ACTIVOS CORRIENTES */}
                  <tr className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 font-semibold text-emerald-glow">Activos Corrientes</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-glow">
                      {fmtCOP(datos.activosCorrientes)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">
                      {datos.activos > 0 ? `${((datos.activosCorrientes / datos.activos) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-mono text-[9px]">
                        LÍQUIDO
                      </span>
                    </td>
                  </tr>

                  {/* ACTIVOS NO CORRIENTES */}
                  <tr className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-slate-300">Activos No Corrientes</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-blue-300">
                      {fmtCOP(datos.activosNoCorrientes)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-300">
                      {datos.activos > 0 ? `${((datos.activosNoCorrientes / datos.activos) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-blue-500/20 px-2 py-0.5 text-blue-300 font-mono text-[9px]">
                        FIJO
                      </span>
                    </td>
                  </tr>

                  {/* TOTAL ACTIVOS */}
                  <tr className="bg-gradient-to-r from-white/5 to-transparent hover:from-white/10 transition border-y border-neon/20">
                    <td className="px-4 py-3 font-semibold text-neon">
                      <span className="text-muted-foreground">=</span> TOTAL ACTIVOS
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-neon text-base">
                      {fmtCOP(datos.activos)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-neon">100%</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-neon/20 px-2 py-0.5 text-neon font-mono text-[9px]">
                        TOTAL
                      </span>
                    </td>
                  </tr>

                  {/* PASIVOS CORRIENTES */}
                  <tr className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 font-semibold text-rose-400">Pasivos Corrientes</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">
                      {fmtCOP(datos.pasivosCorrientes)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-300">
                      {datos.activos > 0 ? `${((datos.pasivosCorrientes / datos.activos) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-300 font-mono text-[9px]">
                        CP
                      </span>
                    </td>
                  </tr>

                  {/* PASIVOS NO CORRIENTES */}
                  <tr className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-slate-300">Pasivos No Corrientes</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-orange-300">
                      {fmtCOP(datos.pasivosNoCorrientes)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-orange-300">
                      {datos.activos > 0 ? `${((datos.pasivosNoCorrientes / datos.activos) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-orange-500/20 px-2 py-0.5 text-orange-300 font-mono text-[9px]">
                        LP
                      </span>
                    </td>
                  </tr>

                  {/* TOTAL PASIVOS */}
                  <tr className="bg-gradient-to-r from-rose-500/20 to-transparent hover:from-rose-500/30 transition border-y border-rose-500/20">
                    <td className="px-4 py-3 font-semibold text-rose-300">
                      <span className="text-muted-foreground">=</span> TOTAL PASIVOS
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-300 text-base">
                      {fmtCOP(datos.pasivos)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-300">
                      {datos.activos > 0 ? `${((datos.pasivos / datos.activos) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-300 font-mono text-[9px]">
                        DEUDA
                      </span>
                    </td>
                  </tr>

                  {/* PATRIMONIO */}
                  <tr
                    className={`font-bold transition ${
                      datos.patrimonio >= 0
                        ? "bg-gradient-to-r from-amber-500/20 to-transparent hover:from-amber-500/30"
                        : "bg-gradient-to-r from-destructive/20 to-transparent hover:from-destructive/30"
                    }`}
                  >
                    <td className="px-4 py-3 text-lg font-bold">
                      <span className="text-muted-foreground text-sm">=</span> PATRIMONIO
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-lg font-bold ${
                        datos.patrimonio >= 0 ? "text-amber-300" : "text-destructive"
                      }`}
                    >
                      {fmtCOP(datos.patrimonio)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-lg font-bold ${
                        datos.patrimonio >= 0 ? "text-amber-300" : "text-destructive"
                      }`}
                    >
                      {datos.activos > 0 ? `${((datos.patrimonio / datos.activos) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] ${
                          datos.patrimonio >= 0
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-destructive/20 text-destructive"
                        }`}
                      >
                        CAPITAL
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Métricas de solvencia */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-neon/20 bg-neon/5 p-3">
                <div className="text-xs text-muted-foreground">Liquidez (A/P)</div>
                <div className="mt-1 font-mono text-sm font-bold text-neon">
                  {indicadores.liquidez.toFixed(2)}x
                </div>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="text-xs text-muted-foreground">Endeudamiento</div>
                <div className="mt-1 font-mono text-sm font-bold text-rose-300">
                  {indicadores.endeudamiento.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="text-xs text-muted-foreground">Equidad</div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-300">
                  {indicadores.equidad.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="text-xs text-muted-foreground">Liq. Corriente</div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-300">
                  {indicadores.liquidezCorriente.toFixed(2)}x
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
                  • Ecuación A=P+Pt:{" "}
                  <span className={indicadores.balanceado ? "text-emerald-300" : "text-amber-300"}>
                    {indicadores.balanceado ? "✓ Balanceado" : "⚠️ Desbalanceado"}
                  </span>
                </div>
                <div>
                  • Capital de trabajo:{" "}
                  <span className="text-neon">{fmtCOP(indicadores.capitalTrabajo)}</span>
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
