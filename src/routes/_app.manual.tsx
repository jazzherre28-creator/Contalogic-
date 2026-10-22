import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookMarked,
  Activity,
  Calculator,
  ScanLine,
  Sparkles,
  CalendarDays,
  BookOpen,
  Crown,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Bell,
  FileDown,
  HelpCircle,
  Rocket,
  Truck,
} from "lucide-react";

export const Route = createFileRoute("/_app/manual")({
  component: ManualPage,
});

const STEPS = [
  {
    n: 1,
    title: "Configura tu perfil",
    body: "Al ingresar por primera vez completas el onboarding: tipo de persona (natural/jurídica), sector económico y NIT. Esto adapta TODA la app: calendario, calculadora, dictionary y consejos LEX AI cambian según tu naturaleza.",
  },
  {
    n: 2,
    title: "Registra tus movimientos",
    body: "En la Calculadora ingresas ingresos y egresos categorizados según tu sector. Cada categoría está alineada al Estatuto Tributario. Las cifras alimentan el Dashboard automáticamente.",
  },
  {
    n: 3,
    title: "Sube tus estados financieros",
    body: "En Escáner OCR elige Estado de Situación Financiera o Estado de Resultados y carga una imagen, PDF, Word, Excel o CSV. Verifica periodo, moneda y unidad (pesos, miles o millones): Datos conserva las cifras impresas; los indicadores se normalizan a COP cuando aplica.",
  },
  {
    n: 4,
    title: "Activa recordatorios DIAN",
    body: "En el Calendario Tributario marca 🔔 las obligaciones que te aplican (filtradas por tu naturaleza, sector y último dígito de NIT). Recibirás notificación in-app a 3 y 1 día del vencimiento.",
  },
  {
    n: 5,
    title: "Descarga informes PDF",
    body: "Usa el botón PDF del módulo para descargar un informe. El reporte OCR incluye partidas extraídas, periodo, unidad, gráfica y alertas aritméticas; el de CalcuTrans incluye el viaje, gastos, caja, carga e indicadores.",
  },
  {
    n: 6,
    title: "Consulta a LEX AI",
    body: "LEX AI analiza el texto OCR y sus cifras, o responde preguntas sobre IVA, retefuente, renta, RST e ICA. Revisa sus alertas frente al PDF y confirma las normas vigentes: es orientación, no reemplaza al contador.",
  },
];

const FAQ = [
  {
    q: "¿Por qué no me llegan notificaciones?",
    a: "Debes activar el 🔔 en una obligación del Calendario. El cron diario (7am Bogotá) revisa tus recordatorios y dispara alerta cuando faltan 3 o 1 día. Si quieres probar el sistema, abre la campanita y toca 'Probar notificación'.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Cada movimiento, documento y notificación está protegido con Row-Level Security. Solo tú ves tus datos. El super admin puede ver agregados solo con propósito de soporte.",
  },
  {
    q: "¿LEX AI reemplaza a mi contador?",
    a: "No. Es una herramienta de análisis y referencia al Estatuto Tributario. Las decisiones tributarias finales requieren la firma de un contador público titulado.",
  },
  {
    q: "¿Cómo funciona el OCR de facturas?",
    a: "El Escáner acepta imágenes, PDF, Word, Excel y CSV. Extrae texto y estructura contable de los formatos compatibles. Para mejores resultados usa un archivo legible, completo y sin inclinación. Revisa la pestaña Datos contra el documento antes de usar los indicadores o el análisis.",
  },
  {
    q: "¿Por qué los valores del análisis pueden tener más ceros que los del PDF?",
    a: "El resumen puede normalizar cifras expresadas en miles o millones a COP para calcular indicadores. La pestaña Datos y la tabla de partidas del PDF conservan el valor como aparece en la fuente y muestran su unidad. Comprueba esa unidad antes de comparar cifras.",
  },
  {
    q: "¿Qué hago si LEX AI no devuelve el análisis?",
    a: "Comprueba que tu perfil esté cargado, que haya conexión y que el documento contenga texto legible. Vuelve a intentarlo. Si recibes un mensaje de cuota, configuración o servicio, guarda el documento y el error para soporte; el reporte PDF básico puede generarse sin LEX AI.",
  },
  {
    q: "¿Cómo se calculan los indicadores de CalcuTrans?",
    a: "Ingresos del viaje = flete + recargos; costos = suma de los gastos registrados; utilidad operativa = ingresos - costos; km totales = km cargados + vacíos. El punto de equilibrio descuenta los recargos de los costos. La tarifa objetivo usa el margen elegido. Indicadores por km, tonelada-km y combustible requieren distancias, carga y litros válidos.",
  },
  {
    q: "¿Qué cambia si soy persona natural vs jurídica?",
    a: "Cambian el contexto de LEX AI y las obligaciones o estimaciones aplicables. Las tarifas y deducciones dependen del régimen, periodo, base gravable y requisitos vigentes; valida cada resultado con los soportes y un contador.",
  },
  {
    q: "¿Cómo recupero mi contraseña?",
    a: "En la pantalla de inicio de sesión toca '¿Olvidaste tu contraseña?'. Recibirás un enlace al correo. Al abrirlo definirás una nueva contraseña.",
  },
];

const SECTIONS = [
  {
    icon: Activity,
    to: "/dashboard",
    title: "Dashboard",
    chip: "TERMINAL PRINCIPAL",
    body: [
      "Vista general de ingresos, egresos y utilidad neta consolidada por período.",
      "Gráfico de velas con tu flujo financiero diario / semanal / mensual.",
      "Indicadores clave: margen operativo, tasa de variación y comparativos.",
      "Botón 'PDF' para descargar informe ejecutivo con proyección tributaria.",
    ],
  },
  {
    icon: Calculator,
    to: "/calculator",
    title: "Calculadora",
    chip: "REGISTRO RÁPIDO",
    body: [
      "Captura de ingresos y egresos categorizados según tu sector económico.",
      "Cada categoría está alineada al Estatuto Tributario (Art. 107 ET).",
      "Las cifras alimentan automáticamente el Dashboard y el gráfico de velas.",
      "Genera PDF con histórico de movimientos y estimación de impuestos.",
    ],
  },
  {
    icon: TrendingDown,
    to: "/tax-savings",
    title: "Ahorro de impuestos",
    chip: "REVISIÓN ORIENTATIVA",
    body: [
      "Revisa oportunidades y conceptos tributarios según el perfil y las cifras registradas o cargadas.",
      "Abre cada recomendación, identifica sus requisitos y reúne facturas, certificados y soportes antes de aplicarla.",
      "Las estimaciones no son una liquidación ni garantizan un ahorro; confírmalas según régimen, periodo, municipio y norma vigente con tu contador.",
    ],
  },
  {
    icon: ScanLine,
    to: "/scanner",
    title: "Escáner OCR + LEX AI",
    chip: "ANÁLISIS INTELIGENTE",
    body: [
      "Sube foto de Estado de Situación Financiera, Estado de Resultados (P&L) o facturas.",
      "Tesseract.js extrae texto y reconoce valores numéricos automáticamente.",
      "La pestaña Datos conserva importes fuente y comparativos cuando se detectan; verifica la unidad y el periodo antes de interpretar el resumen normalizado a COP.",
      "El reporte PDF reúne partidas, gráficas y validaciones determinísticas; no reemplaza el documento fuente.",
      "Analizar con LEX AI agrega observaciones, pero debes contrastar cifras y recomendaciones con el archivo original.",
    ],
  },
  {
    icon: Truck,
    to: "/calcutrans",
    title: "CalcuTrans · Control de viajes",
    chip: "OPERACIÓN DE TRANSPORTE",
    body: [
      "Registra fecha, origen, destino, vehículo, conductor, kilómetros cargados y vacíos, capacidad y combustible.",
      "Ingresa flete y recargos, recaudos del cliente, retenciones reportadas, anticipos y gastos por categoría; marca si cada gasto salió de caja del conductor.",
      "Añade líneas de carga con descripción, remesa, bultos, peso, valor declarado y estado de entrega. No reemplaza manifiestos ni documentos legales.",
      "Consulta ingresos, costos, utilidad y margen del viaje; punto de equilibrio y flete para el margen objetivo; caja del conductor, capacidad, costo/km y combustible.",
      "Guarda el viaje para el historial, edítalo o expórtalo a PDF desde el formulario o desde su registro. Corrige datos faltantes si la validación lo indica.",
    ],
  },
  {
    icon: Sparkles,
    to: "/lex-ai",
    title: "LEX AI Chat",
    chip: "ASESOR LEGAL CONTABLE",
    body: [
      "Chat contextual: LEX AI conoce tu tipo de persona y tu sector.",
      "Pregunta libre sobre IVA, ReteFuente, Renta, RST, ICA, Información Exógena.",
      "Respuestas con cita al Estatuto Tributario (Art. XXX ET).",
      "Streaming en tiempo real; orientativo, no reemplaza al contador titulado.",
    ],
  },
  {
    icon: CalendarDays,
    to: "/calendar",
    title: "Calendario Tributario",
    chip: "DIAN 2026",
    body: [
      "Vencimientos fiscales DIAN 2026 filtrados por tu tipo de persona, sector y último dígito de NIT.",
      "Alertas visuales: vencidos (rojo), urgentes ≤7 días (amarillo), futuros.",
      "Activa recordatorio personal con la campanita 🔔; recibirás aviso a 3 y 1 día del vencimiento.",
      "Cada vencimiento cita el artículo del Estatuto Tributario relacionado.",
    ],
  },
  {
    icon: BookOpen,
    to: "/dictionary",
    title: "Diccionario Tributario",
    chip: "GLOSARIO ESTATUTO",
    body: [
      "30+ términos del Estatuto Tributario con definición práctica.",
      "Filtrado por sector (Transporte, Comercio, Servicios, Manufactura) o todos.",
      "Búsqueda por término, definición o número de artículo.",
      "Ideal para entender beneficios, deducciones y obligaciones aplicables.",
    ],
  },
  {
    icon: Bell,
    to: "/dashboard",
    title: "Notificaciones In-App",
    chip: "CAMPANITA",
    body: [
      "Badge en el header con contador de no leídas (animado).",
      "Cron diario revisa tus recordatorios activos del calendario.",
      "Dispara alerta tipo 'warning' a 3 días y 'danger' a 1 día del vencimiento.",
      "Toca 'Probar notificación' en el dropdown vacío para verificar el sistema.",
    ],
  },
  {
    icon: Crown,
    to: "/admin",
    title: "Consola Maestra (Super Admin)",
    chip: "MANO MAESTRA",
    body: [
      "Acceso restringido al Super Administrador.",
      "Lista global de usuarios y terminales activas en la plataforma.",
      "Otorgar o revocar permisos de administrador a otros usuarios.",
      "Botón 'Super Ojito' para previsualizar cualquier terminal por sector.",
    ],
  },
];

function ManualPage() {
  return (
    <div className="space-y-4">
      <div className="glass-neon p-5">
        <span className="chip chip-neon">
          <BookMarked className="h-3 w-3" /> MANUAL DE USUARIO · CONTALOGIC AI+
        </span>
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">Cómo opera tu terminal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guía completa de cada módulo. Toca cualquier sección para ir directamente al módulo.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <TrendingUp className="h-4 w-4 text-neon" />
            <div className="mt-1 text-xs font-semibold">Adaptativa</div>
            <div className="text-[10px] text-muted-foreground">
              Cambia según tu sector y tipo de persona
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <ShieldCheck className="h-4 w-4 text-emerald-glow" />
            <div className="mt-1 text-xs font-semibold">Estatuto Tributario</div>
            <div className="text-[10px] text-muted-foreground">
              Cada función cita el artículo aplicable
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <Sparkles className="h-4 w-4 text-neon" />
            <div className="mt-1 text-xs font-semibold">LEX AI</div>
            <div className="text-[10px] text-muted-foreground">
              Análisis inteligente de documentos
            </div>
          </div>
        </div>
      </div>

      {/* Cómo empezar paso a paso */}
      <div className="glass p-5">
        <div className="mb-4 flex items-center gap-2">
          <Rocket className="h-5 w-5 text-emerald-glow" />
          <h2 className="text-lg font-bold">Cómo empezar paso a paso</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="flex items-start gap-3">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--gradient-neon)] font-mono text-xs font-bold text-[oklch(0.12_0.02_260)]">
                  {s.n}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neon">{s.title}</div>
                  <div className="mt-1 text-xs text-foreground/75">{s.body}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map(({ icon: Icon, title, chip, body, to }) => (
          <Link
            key={`${to}-${title}`}
            to={to}
            className="glass group block space-y-3 p-5 transition hover:border-[oklch(0.7_0.22_245/0.5)] hover:shadow-[var(--shadow-neon)]"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-[oklch(0.7_0.22_245/0.4)] bg-[oklch(0.7_0.22_245/0.1)] p-2.5 text-neon transition group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="chip text-[9px]">{chip}</span>
                <h2 className="mt-1 text-base font-bold">{title}</h2>
              </div>
            </div>
            <ul className="space-y-1.5 pl-1 text-sm text-foreground/80">
              {body.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neon" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>

      {/* PDF capabilities */}
      <div className="glass p-5">
        <div className="mb-3 flex items-center gap-2">
          <FileDown className="h-5 w-5 text-emerald-glow" />
          <h2 className="text-lg font-bold">Informes PDF descargables</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Informes ejecutivos, listos para compartir con tu contador o en juntas directivas:
        </p>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-xs font-semibold text-neon">Dashboard</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Resumen ejecutivo · gráfica 30 días · proyección IVA/Renta/ICA · oportunidades.
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-xs font-semibold text-neon">Calculadora</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Histórico completo de movimientos · totales · estimación tributaria.
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-xs font-semibold text-neon">Escáner OCR</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Partidas de origen · unidades y periodos · validaciones · gráfica · LEX AI opcional.
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-xs font-semibold text-neon">CalcuTrans</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Control por viaje · gastos y caja · carga · indicadores · descarga PDF.
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="glass p-5">
        <div className="mb-3 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-neon" />
          <h2 className="text-lg font-bold">Preguntas frecuentes</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <details
              key={i}
              className="group rounded-lg border border-white/10 bg-black/30 p-3 transition open:border-[oklch(0.7_0.22_245/0.4)]"
            >
              <summary className="cursor-pointer text-sm font-semibold text-foreground/90 marker:hidden">
                <span className="text-neon">▸</span> {f.q}
              </summary>
              <div className="mt-2 pl-4 text-xs text-muted-foreground">{f.a}</div>
            </details>
          ))}
        </div>
      </div>

      <div className="glass p-5 text-center">
        <p className="text-xs text-muted-foreground">
          Toda asesoría es orientativa y no reemplaza la firma de un contador público titulado.
          Estatuto Tributario actualizado a 2026 · UVT $49.799 COP.
        </p>
      </div>
    </div>
  );
}
