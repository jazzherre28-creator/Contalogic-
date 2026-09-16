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
    const { rawText, totals, lineItems, docType, entityType, sector } = await req.json();
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

    const textPreview = (rawText ?? "").slice(0, 4500);

    const systemPrompt = `Eres LEX AI, analista tributario colombiano especialista en el Estatuto Tributario.
Recibirás el texto de un documento contable de un contribuyente y debes:

1. RESUMEN: 1-2 frases sobre lo que detectaste.
2. OPORTUNIDADES DE AHORRO: lista 3-6 oportunidades concretas de optimización tributaria aplicables a este contribuyente, citando el artículo del Estatuto Tributario.
3. BENEFICIOS APLICABLES: lista beneficios, descuentos o exenciones que aplican según su sector y tipo de persona.
4. ALERTAS: posibles riesgos, sanciones o errores que detectaste (si los hay).
5. PRÓXIMOS PASOS: 2-3 acciones concretas que debe tomar.

SI EL DOCUMENTO ES ESTADO DE SITUACIÓN FINANCIERA:
- Resume la posición de activos, pasivos y patrimonio.
- Indica si hay potencial para ahorro de impuestos mediante mejor manejo de costos, gastos o valoración de activos.
- Incluye una cifra estimada de ahorro tributario relacionada con IVA descontable, deducciones o base gravable.

SI EL DOCUMENTO ES P&L:
- Identifica explícitamente Ingresos, Costos, Gastos operativos, Utilidad bruta y Utilidad neta.
- Indica si faltan valores claros o si el OCR no cubrió todas las líneas del documento.

REGLAS:
- Responde en español neutro, profesional y conciso.
- Cita siempre el artículo del Estatuto Tributario (ej: "Art. 107 ET").
- Da cifras estimadas en COP cuando sea posible.
- Aclara al final que es orientativo y no reemplaza a un contador titulado.
- Devuelve el resultado en MARKDOWN limpio con encabezados ## y viñetas.`;

    const userPrompt = `CONTRIBUYENTE: ${entidad} — Sector ${sectorContext}
DOCUMENTO: ${docName}${totalsBlock}${lineItemsBlock}

TEXTO RECONOCIDO POR OCR (extracto):
"""
${textPreview}
"""

Analiza este documento siguiendo la estructura indicada.`;

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
