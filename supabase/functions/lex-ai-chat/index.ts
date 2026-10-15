// LEX AI - Asesor legal contable contextual
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, entityType, sector } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("GEMINI_API_KEY no configurada");

    const entidad = entityType === "juridica" ? "Persona Jurídica" : "Persona Natural";
    const enfoqueLegal =
      entityType === "juridica"
        ? "Enfócate en el Art. 107 ET (deducciones empresariales: relación causalidad, necesidad y proporcionalidad), Régimen Ordinario, Renta Presuntiva, ICA, IVA generado/descontable, depreciaciones, retención en la fuente y NIIF para PYMES."
        : "Enfócate en Régimen Simple de Tributación (RST), deducciones personales (dependientes, intereses de vivienda, salud prepagada, AFC/AFP voluntario), cédulas (general, pensiones, dividendos), retención en la fuente para personas naturales y declaración de renta.";

    const sectorMap: Record<string, string> = {
      transporte: "transporte (fletes, ACPM, mantenimiento de flota, peajes, SOAT, RUNT)",
      comercio: "comercio (ventas, mercancía, márgenes, inventarios, IVA en ventas)",
      servicios: "servicios (honorarios, contratos por prestación, retención por servicios)",
      manufactura:
        "manufactura (materia prima, mano de obra, costos indirectos, inventarios PEPS/UEPS)",
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

    const requestModel = (model: string) =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(LOVABLE_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: messages.map((message: { role: string; content: string }) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
          }),
        },
      );
    let response = await requestModel("gemini-3.8-flash");
    if ([404, 429, 503].includes(response.status)) {
      console.warn("Gemini primary model unavailable; retrying with gemini-2.5-flash", {
        status: response.status,
      });
      await response.body?.cancel();
      response = await requestModel("gemini-2.5-flash");
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en un momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados. Recarga en Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errorText = await response.text();
      let upstreamMessage = "";
      try {
        const errorPayload = JSON.parse(errorText);
        if (typeof errorPayload?.error?.message === "string") {
          upstreamMessage = errorPayload.error.message.slice(0, 240);
        }
      } catch {
        upstreamMessage = "";
      }
      console.error("Gemini API error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: `Gemini rechazó la solicitud (HTTP ${response.status}). ${upstreamMessage || "Verifica la API key, el modelo y la cuota."}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";
    if (!text.trim()) {
      console.error("LEX AI chat returned no response:", {
        blockReason: data?.promptFeedback?.blockReason,
        finishReason: data?.candidates?.[0]?.finishReason,
      });
      return new Response(
        JSON.stringify({ error: "LEX AI no devolvió una respuesta. Intenta de nuevo." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const stream = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("lex-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
