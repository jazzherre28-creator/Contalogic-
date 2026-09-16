import type { ReportProfile } from "@/lib/pdf-report";
import { classifyTotals } from "@/lib/financial-analytics";

export type TaxSavingTip = {
  id: string;
  title: string;
  article: string;
  description: string;
  potentialSaving: number;
  action: string;
  priority: "alta" | "media" | "baja";
};

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function computeTaxSavings(
  totals: Record<string, number>,
  profile: ReportProfile,
  docType: "balance" | "pnl" = "pnl"
): TaxSavingTip[] {
  const c = classifyTotals(totals);
  const isJuridica = profile.entity_type === "juridica";
  const tarifaRenta = isJuridica ? 0.35 : 0.19;
  const tips: TaxSavingTip[] = [];

  const ingresos = c.ingresos;
  const costos = c.costos;
  const gastos = c.gastos;
  const utilidadNeta = c.utilidadNeta;
  const activosFijos = Object.entries(totals)
    .filter(([k]) => /activo.*fijo|propiedad|planta|equipo|inmovilizado/i.test(k))
    .reduce((s, [, v]) => s + v, 0);

  // IVA descontable
  const ivaDescontable = (costos + gastos) * 0.5 * 0.19;
  if (ivaDescontable > 0) {
    tips.push({
      id: "iva-desc",
      title: "IVA descontable en compras y gastos",
      article: "Art. 485 E.T.",
      description: `Con costos de ${fmtCOP(costos)} y gastos de ${fmtCOP(gastos)}, puedes descontar IVA sobre bienes y servicios gravados adquiridos para la actividad económica.`,
      potentialSaving: ivaDescontable,
      action: "Verifica que todas las facturas de compra tengan IVA discriminado y estén soportadas. Radica la declaración bimestral sin omitir crédito fiscal.",
      priority: "alta",
    });
  }

  // Deducciones ordinarias Art 107
  const deduccOrdinaria = Math.max(0, gastos * 0.08) * tarifaRenta;
  if (gastos > 0) {
    tips.push({
      id: "deducc-107",
      title: "Deducciones ordinarias de gastos",
      article: "Art. 107 E.T.",
      description: "Los gastos necesarios para producir renta son deducibles si están debidamente documentados y relacionados con la actividad.",
      potentialSaving: deduccOrdinaria,
      action: "Clasifica y documenta gastos de nómina, arrendamiento, servicios públicos, asesoría y tecnología. Evita gastos sin factura electrónica.",
      priority: "alta",
    });
  }

  // RST personas naturales
  if (!isJuridica && ingresos > 0) {
    const rstOpt = Math.max(0, utilidadNeta * tarifaRenta - ingresos * 0.055);
    tips.push({
      id: "rst",
      title: "Régimen Simple de Tributación (RST)",
      article: "Art. 905-1 E.T.",
      description: "Si tus ingresos brutos no superan los topes del RST, podrías tributar con tarifa única menor al régimen ordinario.",
      potentialSaving: rstOpt,
      action: "Compara tu carga actual vs. RST con un contador. Evalúa migración si el ahorro supera el 15% de impuesto de renta.",
      priority: rstOpt > 500_000 ? "alta" : "media",
    });
  }

  // Depreciación activos fijos
  if (activosFijos > 0 || docType === "balance") {
    const deprecEst = (activosFijos || c.activosNoCorrientes * 0.6) * 0.1 * tarifaRenta;
    tips.push({
      id: "deprec",
      title: "Depreciación de activos fijos",
      article: "Art. 136-137 E.T.",
      description: "Los activos depreciables generan deducción anual que reduce la base gravable de renta.",
      potentialSaving: deprecEst,
      action: "Actualiza el activo fijo en contabilidad, aplica tarifas legales de depreciación y conserva facturas de adquisición.",
      priority: "media",
    });
  }

  // Retenciones en la fuente
  if (ingresos > 0) {
    tips.push({
      id: "retenciones",
      title: "Optimización de retenciones practicadas",
      article: "Art. 383-401 E.T.",
      description: "Las retenciones que te practican son anticipo de impuesto. Verifica que no haya retenciones indebidas o duplicadas.",
      potentialSaving: ingresos * 0.02,
      action: "Concilia certificados de retención con ingresos facturados. Solicita corrección si hay retenciones por encima de la tarifa legal.",
      priority: "media",
    });
  }

  // Intereses deducibles
  if (c.gastosFinancieros > 0) {
    tips.push({
      id: "intereses",
      title: "Deducción de intereses financieros",
      article: "Art. 118-122 E.T.",
      description: `Gastos financieros detectados: ${fmtCOP(c.gastosFinancieros)}. Los intereses sobre deudas de negocio son deducibles con límites.`,
      potentialSaving: c.gastosFinancieros * tarifaRenta,
      action: "Separa intereses de capital en extractos bancarios. Documenta el destino empresarial del crédito.",
      priority: "media",
    });
  }

  // ICA
  if (ingresos > 0) {
    tips.push({
      id: "ica",
      title: "ICA — verifica tarifa municipal",
      article: "Art. 336-1 E.T.",
      description: "La tarifa de ICA varía por municipio y actividad. Muchas empresas pagan de más por clasificación incorrecta del CIIU.",
      potentialSaving: ingresos * 0.003,
      action: "Revisa el CIIU registrado en RUES y la tarifa en el acuerdo municipal. Solicita devolución o compensación si aplica.",
      priority: "baja",
    });
  }

  // Beneficio tributario jurídicas - renta presuntiva
  if (isJuridica && utilidadNeta > 0) {
    tips.push({
      id: "planeacion",
      title: "Planeación fiscal empresarial",
      article: "Arts. 235-2, 771-5 E.T.",
      description: "Personas jurídicas pueden optimizar mediante provisión de cartera, bonificaciones y distribución de utilidades.",
      potentialSaving: utilidadNeta * 0.05,
      action: "Evalúa provisión de cartera incobrable, bonos de empleados y timing de distribución de dividendos con asesoría profesional.",
      priority: "media",
    });
  }

  // Sin datos de ingresos
  if (tips.length === 0) {
    tips.push({
      id: "general",
      title: "Escanea tu Estado de Resultados",
      article: "Estatuto Tributario",
      description: "Sube un P&L o balance en el Escáner OCR para calcular oportunidades personalizadas de ahorro tributario.",
      potentialSaving: 0,
      action: "Ve a Escáner OCR → carga tu estado financiero → abre la pestaña Ahorro fiscal.",
      priority: "alta",
    });
  }

  return tips.sort((a, b) => b.potentialSaving - a.potentialSaving);
}

export const GENERAL_TAX_TIPS = [
  {
    title: "Facturación electrónica",
    text: "Toda compra deducible requiere factura electrónica válida ante la DIAN. Sin esto, pierdes IVA descontable y deducción de renta.",
  },
  {
    title: "Contabilidad organizada",
    text: "Lleva PUC actualizado y concilia bancos mensualmente. La DIAN cruza información de medios magnéticos con tus declaraciones.",
  },
  {
    title: "Calendario tributario",
    text: "Usa el Calendario DIAN de la app para no incurrir en sanciones por extemporaneidad, que pueden superar el 5% del impuesto.",
  },
  {
    title: "Asesoría profesional",
    text: "La planeación fiscal agresiva sin soporte legal genera sanciones. Valida cada estrategia con contador o abogado tributario.",
  },
];
