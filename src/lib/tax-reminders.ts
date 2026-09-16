import type { EntityType } from "@/lib/sectors";

export type ReminderPriority = "urgent" | "soon" | "upcoming" | "info";
export type ReminderCategory = "dian" | "pagos" | "reportes" | "pendiente";

export type TaxReminder = {
  id: string;
  title: string;
  description: string;
  category: ReminderCategory;
  priority: ReminderPriority;
  dueDate: string; // ISO date
  entityTypes?: EntityType[];
  tip?: string;
  link?: string;
  linkLabel?: string;
};

export type TaxReform = {
  id: string;
  title: string;
  summary: string;
  effectiveDate: string;
  impact: "alto" | "medio" | "bajo";
  tags: string[];
};

export type DidacticTip = {
  id: string;
  icon: "lightbulb" | "shield" | "calendar" | "book";
  title: string;
  body: string;
};

const ALL: EntityType[] = ["natural", "juridica"];

export const TAX_REMINDERS: TaxReminder[] = [
  {
    id: "iva-jul-ago",
    title: "Declaración y pago IVA — Bimestre jul-ago 2026",
    description:
      "Presenta el formulario 300 y paga el IVA del bimestre. Verifica saldos a favor del periodo anterior.",
    category: "pagos",
    priority: "urgent",
    dueDate: "2026-08-16",
    entityTypes: ["juridica"],
    tip: "Revisa que tus facturas electrónicas estén validadas en la DIAN antes de declarar.",
    link: "https://www.dian.gov.co",
    linkLabel: "Portal DIAN",
  },
  {
    id: "retencion-jul-ago",
    title: "Retención en la fuente — Bimestre jul-ago 2026",
    description:
      "Declara retenciones practicadas en compras, servicios y honorarios. Formulario 350.",
    category: "pagos",
    priority: "urgent",
    dueDate: "2026-08-16",
    entityTypes: ["juridica"],
    tip: "Cruza certificados de retención con tus proveedores para evizar inconsistencias.",
  },
  {
    id: "ica-agosto",
    title: "ICA — Autorretención / Declaración mensual",
    description:
      "Si estás obligado, declara el Impuesto de Industria y Comercio ante la Secretaría de Hacienda municipal.",
    category: "pagos",
    priority: "soon",
    dueDate: "2026-08-15",
    entityTypes: ALL,
    tip: "Las tarifas ICA varían por municipio. Consulta el acuerdo local de tu ciudad.",
  },
  {
    id: "pila-agosto",
    title: "PILA — Aportes seguridad social agosto",
    description:
      "Paga salud, pensión y riesgos laborales de empleados y contratistas antes del vencimiento.",
    category: "pagos",
    priority: "soon",
    dueDate: "2026-08-20",
    entityTypes: ["juridica"],
    tip: "Los morosos en PILA pueden generar sanciones y bloqueos ante la DIAN.",
  },
  {
    id: "fe-validacion",
    title: "Facturación electrónica — Validación continua",
    description:
      "Todas las operaciones deben emitirse por FE. Revisa rechazos y notas crédito pendientes en el MUISCA.",
    category: "dian",
    priority: "info",
    dueDate: "2026-08-31",
    entityTypes: ALL,
    tip: "Una factura rechazada no es deducible. Corrige en máximo 10 días hábiles.",
    link: "https://www.dian.gov.co/facturacion-electronica",
    linkLabel: "Guía FE DIAN",
  },
  {
    id: "exogena-prep",
    title: "Información exógena 2026 — Preparación",
    description:
      "Organiza formatos 1001, 1003, 1005, 1007, 1008 y 1009. La entrega formal es en marzo 2027.",
    category: "reportes",
    priority: "upcoming",
    dueDate: "2027-03-15",
    entityTypes: ["juridica"],
    tip: "Empieza a consolidar pagos a terceros desde ahora. Evita correr en febrero.",
  },
  {
    id: "medios-magneticos",
    title: "Medios magnéticos — Validación previa",
    description:
      "Verifica que los datos de retenciones, IVA y compras coincidan con lo reportado en formularios.",
    category: "reportes",
    priority: "upcoming",
    dueDate: "2027-03-31",
    entityTypes: ["juridica"],
    tip: "Usa el prevalidador DIAN antes de enviar los archivos XML.",
  },
  {
    id: "renta-natural",
    title: "Renta persona natural 2025 — Año gravable",
    description:
      "Si superaste topes de ingresos o patrimonio, prepara declaración anual. Vence en octubre 2026.",
    category: "reportes",
    priority: "upcoming",
    dueDate: "2026-10-23",
    entityTypes: ["natural"],
    tip: "En RST puedes deducir aportes a salud y pensiones. Guarda soportes.",
  },
  {
    id: "rst-bimestral",
    title: "RST — Declaración bimestral",
    description:
      "Personas naturales en Régimen Simple: declara ingresos y paga impuesto unificado bimestral.",
    category: "pagos",
    priority: "soon",
    dueDate: "2026-08-16",
    entityTypes: ["natural"],
    tip: "El RST unifica IVA, renta e ICA en una sola declaración simplificada.",
  },
  {
    id: "libros-contables",
    title: "Libros contables electrónicos",
    description:
      "Mantén actualizados libro diario, mayor e inventarios en formato exigido por la DIAN.",
    category: "pendiente",
    priority: "info",
    dueDate: "2026-08-31",
    entityTypes: ["juridica"],
    tip: "Los libros deben estar disponibles para fiscalización en cualquier momento.",
  },
  {
    id: "rut-actualizado",
    title: "RUT — Revisión de datos",
    description:
      "Confirma actividad económica, responsabilidades y correo electrónico registrado en el RUT.",
    category: "dian",
    priority: "info",
    dueDate: "2026-09-30",
    entityTypes: ALL,
    tip: "Un RUT desactualizado puede bloquear facturación o generar sanciones.",
    link: "https://muisca.dian.gov.co",
    linkLabel: "Actualizar RUT",
  },
  {
    id: "4x1000",
    title: "Gravamen 4×1000 — Retenciones",
    description:
      "Si eres agente retenedor del GMF, declara y consigna retenciones del mes anterior.",
    category: "pagos",
    priority: "soon",
    dueDate: "2026-08-15",
    entityTypes: ["juridica"],
    tip: "Aplica a movimientos en cuentas corrientes y de ahorro superiores al umbral.",
  },
];

export const TAX_REFORMS: TaxReform[] = [
  {
    id: "ley-2277",
    title: "Ley 2277 de 2022 — Reforma tributaria",
    summary:
      "Modificó tarifas de renta (35% empresas), creó el impuesto a la renta para personas naturales con tarifa progresiva, y estableció el impuesto saludable sobre ultraprocesados y bebidas azucaradas.",
    effectiveDate: "2023-01-01",
    impact: "alto",
    tags: ["Renta", "IVA", "Saludable"],
  },
  {
    id: "ley-2380",
    title: "Ley 2380 de 2024 — Modernización tributaria",
    summary:
      "Refuerza la lucha contra la evasión, amplía intercambio automático de información y endurece sanciones por incumplimiento de facturación electrónica y reporte oportuno.",
    effectiveDate: "2025-01-01",
    impact: "alto",
    tags: ["DIAN", "Sanciones", "FE"],
  },
  {
    id: "uvt-2026",
    title: "UVT 2026 — $49.799",
    summary:
      "La Unidad de Valor Tributario subió para 2026. Afecta topes de deducciones, sanciones mínimas, umbrales de obligación de declarar y beneficios del RST.",
    effectiveDate: "2026-01-01",
    impact: "medio",
    tags: ["UVT", "Topes", "RST"],
  },
  {
    id: "fe-obligatoria",
    title: "Facturación electrónica — 100% obligatoria",
    summary:
      "Todos los contribuyentes deben facturar electrónicamente. El incumplimiento genera multas de hasta 15 UVT por documento y puede impedir deducibilidad de costos.",
    effectiveDate: "2024-01-01",
    impact: "alto",
    tags: ["Facturación", "DIAN"],
  },
  {
    id: "impuesto-patrimonio",
    title: "Impuesto al patrimonio — Personas naturales",
    summary:
      "Grava patrimonio líquido superior a 72.000 UVT (~$3.585 millones en 2026). Tarifa del 1% sobre el excedente. Declaración anual en el mismo periodo de renta.",
    effectiveDate: "2023-01-01",
    impact: "medio",
    tags: ["Patrimonio", "PN"],
  },
  {
    id: "regimen-simple",
    title: "RST — Actualizaciones 2025-2026",
    summary:
      "El Régimen Simple mantiene tarifas unificadas por actividad. Nuevos topes de ingresos brutos y requisitos de transparencia para evitar re-caracterización al régimen ordinario.",
    effectiveDate: "2026-01-01",
    impact: "medio",
    tags: ["RST", "PN", "PyME"],
  },
];

export const DIDACTIC_TIPS: DidacticTip[] = [
  {
    id: "tip-1",
    icon: "calendar",
    title: "Calendario tributario",
    body: "Las fechas de vencimiento dependen del último dígito de tu NIT. Consulta siempre el calendario oficial de la DIAN para tu grupo.",
  },
  {
    id: "tip-2",
    icon: "shield",
    title: "Conserva soportes 5 años",
    body: "La DIAN puede fiscalizar hasta 5 años atrás. Guarda facturas, extractos, nómina y contratos de forma organizada y respaldada.",
  },
  {
    id: "tip-3",
    icon: "lightbulb",
    title: "Conciliación mensual",
    body: "Cruza bancos, DIAN y contabilidad cada mes. Detectar diferencias a tiempo evita sanciones y correcciones costosas.",
  },
  {
    id: "tip-4",
    icon: "book",
    title: "¿Régimen Simple u Ordinario?",
    body: "RST simplifica IVA + renta + ICA. Si superas topes de ingresos o tienes operaciones complejas, evalúa migrar al régimen ordinario con asesoría.",
  },
];

export function daysUntil(isoDate: string, from = new Date()): number {
  const due = new Date(isoDate + "T23:59:59");
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function filterRemindersForEntity(entityType?: EntityType | null): TaxReminder[] {
  if (!entityType) return TAX_REMINDERS;
  return TAX_REMINDERS.filter(
    (r) => !r.entityTypes || r.entityTypes.includes(entityType),
  );
}

export function sortByUrgency(reminders: TaxReminder[]): TaxReminder[] {
  const priorityOrder: Record<ReminderPriority, number> = {
    urgent: 0,
    soon: 1,
    upcoming: 2,
    info: 3,
  };
  return [...reminders].sort((a, b) => {
    const pa = priorityOrder[a.priority];
    const pb = priorityOrder[b.priority];
    if (pa !== pb) return pa - pb;
    return daysUntil(a.dueDate) - daysUntil(b.dueDate);
  });
}

export const CATEGORY_LABEL: Record<ReminderCategory, string> = {
  dian: "DIAN",
  pagos: "Pagos",
  reportes: "Reportes",
  pendiente: "Pendientes",
};

export const PRIORITY_LABEL: Record<ReminderPriority, string> = {
  urgent: "Urgente",
  soon: "Próximo",
  upcoming: "Programado",
  info: "Informativo",
};
