// LEX AI - Asesor legal contable contextual
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, entityType, sector } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const entidad = entityType === "juridica" ? "Persona Jurídica" : "Persona Natural";
    const enfoqueLegal =
      entityType === "juridica"
        ? "Enfócate en el Art. 107 ET (deducciones empresariales: relación causalidad, necesidad y proporcionalidad), Régimen Ordinario, Renta Presuntiva, ICA, IVA generado/descontable, depreciaciones, retención en la fuente y NIIF para PYMES."
        : "Enfócate en Régimen Simple de Tributación (RST), deducciones personales (dependientes, intereses de vivienda, salud prepagada, AFC/AFP voluntario), cédulas (general, pensiones, dividendos), retención en la fuente para personas naturales y declaración de renta.";

    const sectorMap: Record<string, string> = {
      transporte: "transporte (fletes, ACPM, mantenimiento de flota, peajes, SOAT, RUNT)",
      comercio: "comercio (ventas, mercancía, márgenes, inventarios, IVA en ventas)",
      servicios: "servicios (honorarios, contratos por prestación, retención por servicios)",
      manufactura: "manufactura (materia prima, mano de obra, costos indirectos, inventarios PEPS/UEPS)",
    };
    const sectorContext = sectorMap[sector] ?? "general";

    const systemPrompt = `Eres LEX AI, asesor legal-contable colombiano de la terminal CONTALOGIC AI+.

CONTEXTO DEL USUARIO:
- Tipo de entidad: ${entidad}
- Sector económico: ${sectorContext}

DIRECTRICES:
${enfoqueLegal}
- Cita siempre la norma específica (Estatuto Tributario, decretos, conceptos DIAN) cuando sea posible.
- Sé concreto, profesional y conciso. Usa viñetas cuando ayuden a la claridad.
- Si la pregunta es ambigua, pide aclaración breve.
- Aclara que tus respuestas son orientativas y no reemplazan a un contador público titulado.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en un momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados. Recarga en Settings → Workspace → Usage." }),
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("lex-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
