"""Completa la Ficha Técnica FSE-32 con datos de Contalogic AI+."""
from docx import Document

SRC = r"c:\Users\jazz2\Downloads\Ficha Tecnica Oficial Completa - Formato FSE-32 Definitiva.docx"
OUT = r"c:\Users\jazz2\Downloads\Ficha Tecnica Contalogic AI+ - Formato FSE-32 Completada.docx"


def set_cell(table_idx: int, row: int, col: int, text: str, doc: Document) -> None:
    cell = doc.tables[table_idx].rows[row].cells[col]
    if cell.paragraphs:
        cell.paragraphs[0].clear()
        cell.paragraphs[0].add_run(text)
    else:
        cell.text = text


def fill_value_cells(table_idx: int, row: int, value: str, doc: Document, start_col: int = 1) -> None:
    """Rellena celdas de valor preservando la etiqueta en la columna 0."""
    for cell in doc.tables[table_idx].rows[row].cells[start_col:]:
        if cell.paragraphs:
            cell.paragraphs[0].clear()
            cell.paragraphs[0].add_run(value)
        else:
            cell.text = value


def main() -> None:
    doc = Document(SRC)

    # 2. Características del producto
    fill_value_cells(1, 0, "Contalogic AI+ — Terminal Financiera Universal", doc)
    fill_value_cells(1, 1, "Plataforma Web SaaS / Fintech Contable-Tributaria", doc)
    set_cell(1, 2, 1, "v1.0 (Beta)", doc)
    set_cell(1, 2, 3, "v2.0 (Definitiva)", doc)
    fill_value_cells(
        1,
        3,
        "Autenticación (Supabase Auth), Escáner OCR, Dashboard Financiero, Calculadora, "
        "LEX AI, Ahorro Tributario, Calendario DIAN, Diccionario Tributario y Consola de Administración",
        doc,
    )

    # 3. Descripción general y objetivo
    set_cell(
        2,
        0,
        1,
        "Plataforma web modular para análisis financiero y tributario en Colombia. "
        "Permite extraer datos contables mediante OCR de estados financieros (Balance y P&L) "
        "en formatos PDF, Excel, Word e imágenes; gestionar registros de ingresos y gastos "
        "por sector económico; consultar normativa con asistente de IA (LEX AI); recibir "
        "alertas de vencimientos DIAN; aplicar estrategias de ahorro fiscal y generar "
        "reportes exportables en PDF y Excel.",
        doc,
    )
    set_cell(
        2,
        1,
        1,
        "Optimizar la gestión financiera y tributaria de personas naturales y jurídicas, "
        "garantizar trazabilidad de documentos contables, validación automática de ecuaciones "
        "contables (Activos = Pasivos + Patrimonio), control de acceso basado en roles (RBAC: "
        "super_admin, admin, user) y proveer tableros de control gerencial con analítica avanzada.",
        doc,
    )

    # 4. Arquitectura
    set_cell(
        3,
        0,
        1,
        "Arquitectura cliente-servidor desacoplada: frontend SPA/SSR con React 19, TypeScript, "
        "TanStack Router/Start, Vite 7 y Tailwind CSS 4; backend como servicio (BaaS) con "
        "Supabase (PostgreSQL, Auth JWT, Row Level Security, Edge Functions para IA); "
        "despliegue serverless en Cloudflare Workers mediante Wrangler/Nitro.",
        doc,
    )

    # 5. Requisitos del producto
    set_cell(
        4,
        1,
        1,
        "Supabase Cloud (PostgreSQL gestionado) y Cloudflare Workers (edge computing serverless).",
        doc,
    )
    set_cell(
        4,
        2,
        1,
        "PostgreSQL 15+ (Supabase), Node.js 20+ (Edge Functions), Cloudflare Workers runtime con nodejs_compat.",
        doc,
    )
    set_cell(
        4,
        3,
        1,
        "HTTPS/TLS, autenticación JWT vía Supabase Auth, políticas RLS por usuario, "
        "variables de entorno segregadas y respaldo automático de base de datos.",
        doc,
    )
    set_cell(
        4,
        5,
        1,
        "PC, laptop o dispositivo móvil con conexión a Internet estable (mínimo 4 Mbps recomendado).",
        doc,
    )
    set_cell(
        4,
        6,
        1,
        "Navegador web moderno actualizado (Google Chrome 120+, Mozilla Firefox 120+, "
        "Microsoft Edge 120+, Safari 17+). JavaScript habilitado.",
        doc,
    )
    set_cell(
        4,
        7,
        1,
        "Sesión autenticada con tokens JWT, recuperación de contraseña, onboarding por tipo de "
        "entidad (natural/jurídica) y sector económico (transporte, comercio, servicios, manufactura).",
        doc,
    )

    # 6. Requerimientos y especificaciones adicionales
    set_cell(
        5,
        0,
        1,
        "Autenticación y perfiles con roles (super_admin, admin, user); onboarding personalizado; "
        "escaneo OCR multi-formato de Balance y P&L; estado financiero global unificado; "
        "calculadora de ingresos/gastos por categoría sectorial; asistente LEX AI con respuesta "
        "en streaming; recomendaciones de ahorro tributario; calendario DIAN; diccionario "
        "tributario; exportación PDF/Excel; consola de administración de usuarios.",
        doc,
    )
    set_cell(
        5,
        1,
        1,
        "Procesamiento OCR en navegador (Tesseract.js, pdf.js, mammoth, xlsx); analítica avanzada "
        "con proyecciones y escenarios; sincronización automática OCR→Dashboard; ticker de "
        "indicadores económicos; notificaciones de recordatorios tributarios; validación contable "
        "automática post-OCR.",
        doc,
    )
    set_cell(
        5,
        2,
        1,
        "Estatuto Tributario colombiano (Ley 1607/2012 y reformas), normativa DIAN vigente, "
        "Ley 1581 de 2012 (protección de datos personales) y Decreto 1377 de 2013.",
        doc,
    )
    set_cell(
        5,
        3,
        1,
        "Contadores públicos, empresarios, personas naturales y jurídicas, auxiliares contables, "
        "administradores tributarios y consultores fiscales en Colombia.",
        doc,
    )

    # 7. Documentos de referencia
    set_cell(
        6,
        0,
        0,
        "• Estatuto Tributario colombiano (Ley 1607/2012 y reformas).\n"
        "• Resoluciones y circulares DIAN vigentes.\n"
        "• Ley 1581 de 2012 — Protección de Datos Personales.\n"
        "• Guía institucional para la elaboración de fichas técnicas de software (Formato FSE-32).\n"
        "• Documentación técnica del proyecto Contalogic AI+ (CONSOLIDACION_DASHBOARD.md, CAMBIOS_REALIZADOS.md).",
        doc,
    )

    # 8. Historia de modificaciones
    set_cell(
        7,
        1,
        1,
        "Versión inicial con módulos de autenticación, escáner OCR, calculadora financiera, LEX AI y dashboard básico.",
        doc,
    )
    set_cell(
        7,
        2,
        1,
        "Consolidación integral del dashboard con estado financiero global unificado, eliminación "
        "de datos ficticios, validación contable automática y sincronización OCR→Dashboard al 100%.",
        doc,
    )

    doc.save(OUT)
    print(f"Documento generado: {OUT}")


if __name__ == "__main__":
    main()
