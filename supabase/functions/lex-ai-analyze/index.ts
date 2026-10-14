// LEX AI Analyze - Examina texto OCR (Balance/P&L/factura) y devuelve oportunidades de ahorro
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { rawText, totals, lineItems, docType, entityType, sector, meta } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("GEMINI_API_KEY no configurada");

    const entidad = entityType === "juridica" ? "Persona Jurídica" : "Persona Natural";
    const docName =
      docType === "balance"
        ? "Estado de Situación Financiera"
        : docType === "pnl"
          ? "Estado de Resultados (P&L)"
          : "Factura / Documento contable";

    const sectorMap: Record<string, string> = {
      transporte: "transporte de carga (fletes, ACPM, mantenimiento, peajes)",
      comercio: "comercio (ventas, mercancía, márgenes, IVA)",
      servicios: "servicios profesionales (honorarios, contratos, retenciones)",
      manufactura: "manufactura (materia prima, mano de obra, producción)",
    };
    const sectorContext = sectorMap[sector] ?? "general";

    const totalsBlock = totals && Object.keys(totals).length > 0
      ? `\n\nVALORES NUMÉRICOS DETECTADOS:\n${Object.entries(totals as Record<string, number>)
          .slice(0, 25)
          .map(([k, v]) => `- ${k}: ${new Intl.NumberFormat("es-CO").format(v)}`)
          .join("\n")}`
      : "";

    const lineItemsBlock = Array.isArray(lineItems) && lineItems.length > 0
      ? `\n\nPARTIDAS ESTRUCTURADAS EXTRAÍDAS:\n${(lineItems as Array<{ label: string; value: number }>).slice(0, 60)
          .map(({ label, value }) => `- ${label}: ${new Intl.NumberFormat("es-CO").format(value)}`)
          .join("\n")}`
      : "";

    const textPreview = (rawText ?? "").slice(0, 18000);
    const unitContext = meta?.unitLabel
      ? `Los valores estructurados se normalizaron a COP. La fuente expresa sus importes en ${meta.unitLabel}; aplica el factor solo a las cifras de la fuente, no vuelvas a multiplicar los valores estructurados.`
      : "Verifica en el documento la moneda y la unidad (pesos, miles o millones) antes de calcular o presentar cifras.";

    const systemPrompt = `Eres LEX AI, analista financiero-contable y tributario colombiano.
Antes de emitir conclusiones, concilia las cifras estructuradas con el texto fuente. Trata paréntesis como valores negativos, distingue subtotales de sus partidas componentes y no sumes ambos. No confundas variaciones porcentuales, fechas, NIT o números de página con importes contables.

ESTADO DE SITUACIÓN FINANCIERA:
- Presenta activos, pasivos y patrimonio solo si el documento informa esos totales; no derives el patrimonio como diferencia para ocultar datos faltantes.
- Calcula razón corriente = activos corrientes / pasivos corrientes; prueba ácida = (activos corrientes - inventarios) / pasivos corrientes; capital de trabajo = activos corrientes - pasivos corrientes.
- Calcula solvencia, endeudamiento, autonomía y A = P + patrimonio solo si están disponibles los totales requeridos. Si falta alguno, escribe "N/D" y explica cuál falta.
- Comprueba la suma de componentes frente a subtotales y el total de activos frente a las secciones corriente y no corriente.

ESTADO DE RESULTADOS:
- Identifica ingresos, costos directos, utilidad bruta, gastos operacionales, otros ingresos operativos, EBIT/utilidad operacional, ingresos y gastos financieros, utilidad antes de impuestos, impuesto y utilidad neta.
- Calcula utilidad bruta = ingresos - costos; EBIT = utilidad bruta - gastos operacionales + otros ingresos operativos; antes de impuestos = EBIT + ingresos financieros - gastos financieros; neta = antes de impuestos - impuesto.
- Si el documento presenta un subtotal explícito, compáralo con la fórmula y conserva el valor reportado como tal; informa la diferencia, no la corrijas silenciosamente.
- Usa el comparativo solo si las columnas y periodos se identifican claramente. Calcula variación absoluta y porcentual con la base del periodo anterior; si la base es cero o negativa, adviértelo.
- No declares que el impuesto indicado corresponde a una tarifa si el importe no coincide con esa tarifa y su base.

ANÁLISIS Y LÍMITES:
- Separa hechos extraídos, cálculos derivados, estimaciones y datos ausentes. No inventes cifras, partidas, comparativos, tasas, deducciones ni supuestos.
- No presentes proyecciones de IVA/ICA, ahorro o carga tributaria como importes exactos a partir de estados financieros: dependen de facturas, municipio, actividad, régimen, periodo y requisitos legales. Expón los datos adicionales necesarios.
- Recomienda oportunidades tributarias solo si son aplicables y están sustentadas. Cita artículos ET únicamente cuando estés seguro de su vigencia y pertinencia; de lo contrario indica que debe verificarse.
- Responde en español profesional con los encabezados ## Resumen, ## Cifras y fórmulas, ## Validaciones y alertas, ## Información faltante, ## Recomendaciones y próximos pasos.
- Aclara que el análisis es orientativo y requiere validación por un contador público con soportes completos.`;

    const userPrompt = `CONTRIBUYENTE: ${entidad} — Sector ${sectorContext}
DOCUMENTO: ${docName}
UNIDADES: ${unitContext}${totalsBlock}${lineItemsBlock}

TEXTO RECONOCIDO DEL DOCUMENTO:
"""
${textPreview}
"""

Analiza todas las cifras disponibles de este documento y verifica la consistencia aritmética de cada subtotal y total. No omitas alertas de conciliación ni reemplaces los datos reportados por cifras supuestas.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(LOVABLE_API_KEY)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
          ["Authorization"]: "",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Intenta en un momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos LEX AI agotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const analysis =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "Sin respuesta del modelo.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lex-ai-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
