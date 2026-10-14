// Multi-format text/data extractors (browser-only, dynamic imports)
import { cleanNumericValue } from "./global-finance-state";

export type LineItem = { label: string; value: number };

export type ExtractResult = {
  text: string;
  totals: Record<string, number>;
  lineItems: LineItem[];
  pages?: number;
  sheetSummary?: Array<{ sheet: string; rows: number }>;
  meta?: {
    entryCount?: number;
    charCount?: number;
    source: string;
    unitLabel?: string;
    unitMultiplier?: number;
  };
};

const AMOUNT_RE = /[-(]?\$?\s?[\d]{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?\)?|[-(]?\$?\s?[\d]+(?:[.,]\d+)?\)?/g;

const FINANCIAL_HINT =
  /ingres|gasto|costo|activ|pasiv|patrim|utilidad|total|subtotal|iva|renta|saldo|cuenta|debe|haber|caja|banco|mercanc|proveed|nomina|arrend|amort|deprec|invent|flujo|\$|cop/i;

const LABEL_BLACKLIST =
  /^(fecha|fech|nit|cedula|cédula|telefono|teléfono|tel|direccion|dirección|correo|email|pagina|página|empresa|cliente|representante|socio|ciudad|departamento|pais|país|codigo|código|regimen|tipo|documento|numero|número|mes|año|ano)$/i;

/**
 * Normaliza un string a número utilizando cleanNumericValue
 * Retorna string para compatibilidad con código existente
 */
function normalizeNumber(numRaw: string): string | null {
  const numeric = cleanNumericValue(numRaw);
  return numeric === 0 && numRaw.trim() !== "0" ? null : String(numeric);
}

function uniqueLabel(base: string, used: Map<string, number>): string {
  const clean = base.trim().replace(/\s{2,}/g, " ").slice(0, 80);
  if (!clean) return "";
  const count = used.get(clean) ?? 0;
  used.set(clean, count + 1);
  return count === 0 ? clean : `${clean} (${count + 1})`;
}

function looksLikeFinancialCandidate(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(trimmed)) return false;
  if (!AMOUNT_RE.test(trimmed)) return false;

  const hasFinancialHint = FINANCIAL_HINT.test(trimmed);
  const firstToken = trimmed.replace(/[:\-|·]/g, "").split(/\s{2,}/)[0] ?? "";
  const isBlacklisted = LABEL_BLACKLIST.test(firstToken.trim());

  return hasFinancialHint || (!isBlacklisted && trimmed.length > 3);
}

function minThreshold(line: string): number {
  return looksLikeFinancialCandidate(line) ? 1 : 50;
}

function extractFromLine(line: string, used: Map<string, number>): LineItem[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2 || !looksLikeFinancialCandidate(trimmed)) return [];

  const threshold = minThreshold(trimmed);
  const matches = [...trimmed.matchAll(AMOUNT_RE)];
  if (matches.length === 0) return [];

  // Múltiples montos en la misma línea (columnas contables)
  if (matches.length > 1) {
    const multi: LineItem[] = [];
    let segmentStart = 0;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const idx = match.index ?? 0;
      const labelRaw = trimmed
        .slice(segmentStart, idx)
        .trim()
        .replace(/[:\-|·]+$/g, "")
        .trim();
      const valueStr = normalizeNumber(match[0]);
      if (valueStr) {
        const value = parseFloat(valueStr);
        if (!isNaN(value) && Math.abs(value) >= threshold) {
          const label = uniqueLabel(labelRaw || `Columna ${i + 1}`, used);
          if (label.length > 0) multi.push({ label, value });
        }
      }
      segmentStart = idx + match[0].length;
    }
    if (multi.length > 0) return multi;
  }

  const items: LineItem[] = [];

  // Pair label: value / label = value
  const keyValueMatches = [...trimmed.matchAll(/([A-Za-zÁÉÍÓÚÑáéíóúñ/&().\-\s]{2,80}?)\s*[:=]\s*([-+]?\$?\s?[\d.,]+)/g)];
  if (keyValueMatches.length > 0) {
    for (const match of keyValueMatches) {
      const valueStr = normalizeNumber(match[2]);
      if (!valueStr) continue;
      const value = parseFloat(valueStr);
      if (!isNaN(value) && Math.abs(value) >= threshold) {
        const label = uniqueLabel(match[1].trim().replace(/[:=]+$/g, ""), used);
        if (label.length > 1) items.push({ label, value });
      }
    }
    if (items.length > 0) return items;
  }

  // Tabular: label ; value
  const semiParts = trimmed.split(";").map((p) => p.trim()).filter(Boolean);
  if (semiParts.length >= 2) {
    const lastPart = semiParts[semiParts.length - 1];
    const lastMatch = lastPart.match(AMOUNT_RE);
    if (lastMatch) {
      const valueStr = normalizeNumber(lastMatch[0]);
      if (valueStr) {
        const value = parseFloat(valueStr);
        if (!isNaN(value) && Math.abs(value) >= threshold) {
          const labelParts = semiParts.slice(0, -1).join(" ").trim();
          const label = uniqueLabel(labelParts || semiParts[0], used);
          if (label.length > 0) items.push({ label, value });
          return items;
        }
      }
    }
  }

  // Tabular: label | value or label\tvalue
  const parts = trimmed.split(/\t|\|/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const lastMatch = lastPart.match(AMOUNT_RE);
    if (lastMatch) {
      const valueStr = normalizeNumber(lastMatch[0]);
      if (valueStr) {
        const value = parseFloat(valueStr);
        if (!isNaN(value) && Math.abs(value) >= threshold) {
          const labelParts = parts.slice(0, -1).join(" ").trim();
          const label = uniqueLabel(labelParts || parts[0], used);
          if (label.length > 1) items.push({ label, value });
          return items;
        }
      }
    }
  }

  // Multiple label-value pairs separated by 2+ spaces (columnar text)
  const colSplit = trimmed.split(/\s{2,}/).filter(Boolean);
  if (colSplit.length >= 2) {
    for (let i = 0; i < colSplit.length - 1; i++) {
      const maybeLabel = colSplit.slice(0, i + 1).join(" ");
      const maybeNum = colSplit[colSplit.length - 1];
      const numMatch = maybeNum.match(AMOUNT_RE);
      if (numMatch && i === colSplit.length - 2) {
        const valueStr = normalizeNumber(numMatch[0]);
        if (valueStr) {
          const value = parseFloat(valueStr);
          if (!isNaN(value) && Math.abs(value) >= threshold) {
            const label = uniqueLabel(maybeLabel, used);
            if (label.length > 1) items.push({ label, value });
          }
        }
        break;
      }
    }
    if (items.length > 0) return items;
  }

  // Default: last number on line, label is everything before it
  const lastMatch = matches[matches.length - 1][0];
  const valueStr = normalizeNumber(lastMatch);
  if (!valueStr) return items;
  const value = parseFloat(valueStr);
  if (isNaN(value) || Math.abs(value) < threshold) return items;

  const labelRaw = trimmed.slice(0, trimmed.lastIndexOf(lastMatch)).trim();
  const label = uniqueLabel(labelRaw, used);
  if (label.length <= 1) return items;
  items.push({ label, value });
  return items;
}

export function parseLineItems(text: string): LineItem[] {
  const used = new Map<string, number>();
  const items: LineItem[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    items.push(...extractFromLine(line, used));
  }

  // Pares "Concepto: valor"
  const inlineRe = /([A-Za-zÁÉÍÓÚÑáéíóúñ/&().\-\s]{2,80}?)\s*[:=]\s*([-+]?\$?\s?[\d.,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = inlineRe.exec(text)) !== null) {
    const valueStr = normalizeNumber(m[2]);
    if (!valueStr) continue;
    const value = parseFloat(valueStr);
    if (isNaN(value) || Math.abs(value) < 1) continue;
    const label = uniqueLabel(m[1].trim(), used);
    if (label.length > 0) items.push({ label, value });
  }

  // Números aislados con contexto de línea anterior (totales al final de sección)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const soloNum = line.match(/^[-($]?\s?[\d.,]+$/);
    if (soloNum && i > 0) {
      const prev = lines[i - 1].trim();
      if (prev.length > 2 && !AMOUNT_RE.test(prev.replace(AMOUNT_RE, ""))) {
        const valueStr = normalizeNumber(soloNum[0]);
        if (valueStr) {
          const value = parseFloat(valueStr);
          if (!isNaN(value) && Math.abs(value) >= 1) {
            const label = uniqueLabel(prev, used);
            if (label.length > 0) items.push({ label, value });
          }
        }
      }
    }
  }

  return items;
}

function mergeLineItems(...batches: LineItem[][]): LineItem[] {
  const used = new Map<string, number>();
  const merged: LineItem[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      const label = uniqueLabel(item.label, used);
      merged.push({ label, value: item.value });
    }
  }
  return merged;
}

function mergeUniqueLineItems(...batches: LineItem[][]): LineItem[] {
  const seen = new Set<string>();
  const merged: LineItem[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      const key = `${item.label.trim().toLowerCase()}|${item.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function looksLikeScannedText(text: string): boolean {
  const letters = (text.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (letters === 0 && digits > 10) return true;
  if (digits > letters * 3 && words < digits / 2) return true;
  if (digits >= 10 && letters < 40 && words < 40) return true;
  return false;
}

export function parseAmounts(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { label, value } of parseLineItems(text)) {
    out[label] = (out[label] ?? 0) + value;
  }
  return out;
}

export function lineItemsToTotals(items: LineItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { label, value } of items) {
    out[label] = (out[label] ?? 0) + value;
  }
  return out;
}

export type ProgressFn = (pct: number, msg?: string) => void;

function buildResult(
  text: string,
  extra: Partial<ExtractResult> = {},
  extraItems: LineItem[] = [],
  options: { structuredOnly?: boolean; unitMultiplier?: number; unitLabel?: string } = {}
): ExtractResult {
  const parsed = options.structuredOnly ? [] : parseLineItems(text);
  const lineItems = mergeUniqueLineItems(parsed, extraItems).map((item) => ({
    ...item,
    value: item.value * (options.unitMultiplier ?? 1),
  }));
  const totals = lineItemsToTotals(lineItems);
  return {
    ...extra,
    text,
    totals,
    lineItems,
    meta: {
      ...extra.meta,
      entryCount: Object.keys(totals).length,
      charCount: text.length,
      source: extra.meta?.source ?? "text",
      ...(options.unitMultiplier && options.unitMultiplier !== 1
        ? { unitLabel: options.unitLabel, unitMultiplier: options.unitMultiplier }
        : {}),
    },
  };
}

type PdfTextRow = { text: string; cells: Array<{ text: string; x: number }> };

function getPdfTextRows(items: Array<{ str?: string; transform?: number[] }>): PdfTextRow[] {
  const rows: Array<{ y: number; cells: Array<{ text: string; x: number }> }> = [];
  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2.5);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ text, x });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map(({ cells }) => {
      const sortedCells = cells.sort((a, b) => a.x - b.x);
      return {
        cells: sortedCells,
        text: sortedCells.map((cell) => cell.text).join("\t"),
      };
    });
}

function parsePdfFinancialRows(rows: PdfTextRow[]): LineItem[] {
  const items: LineItem[] = [];
  for (const row of rows) {
    const amountCells = row.cells.filter(
      ({ text, x }) => x >= 250 && !text.includes("%") && /^[-+]?\(?\$?\s*\d[\d.,\s]*\)?$/.test(text)
    );
    if (amountCells.length === 0) continue;
    const firstAmount = amountCells[0];
    const label = row.cells
      .filter((cell) => cell.x < Math.min(firstAmount.x, 250) && !/^[-+]?\(?\$?\s*\d[\d.,\s]*\)?$/.test(cell.text))
      .map((cell) => cell.text)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!label || label.length < 3) continue;

    const value = cleanNumericValue(firstAmount.text);
    if (!Number.isFinite(value)) continue;
    items.push({ label, value });
  }
  return items;
}

export function parsePdfFinancialItems(
  items: Array<{ str?: string; transform?: number[] }>
): LineItem[] {
  return parsePdfFinancialRows(
    getPdfTextRows(items)
  );
}

async function ocrPdfPages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  onProgress?: ProgressFn,
  startPct = 85
): Promise<string> {
  const Tesseract = (await import("tesseract.js")).default;
  let ocrText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement("canvas");
    const vp = viewport as { width: number; height: number };
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const { data } = await Tesseract.recognize(canvas, "spa+eng");
    ocrText += `\n--- Página ${i} ---\n${data.text ?? ""}\n`;
    onProgress?.(Math.round(startPct + (i / pdf.numPages) * (100 - startPct)), `OCR página ${i}/${pdf.numPages}`);
  }
  return ocrText;
}

export async function extractFromFile(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = file.type;

  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "bmp"].includes(ext)) {
    return await extractImage(file, onProgress);
  }
  if (ext === "pdf" || mime === "application/pdf") {
    return await extractPdf(file, onProgress);
  }
  if (ext === "docx" || mime.includes("wordprocessingml")) {
    return await extractDocx(file, onProgress);
  }
  if (["xlsx", "xls", "csv"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel")) {
    return await extractExcel(file, onProgress);
  }
  throw new Error(`Formato no soportado: .${ext}`);
}

async function extractImage(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  const Tesseract = (await import("tesseract.js")).default;
  const { data } = await Tesseract.recognize(file, "spa+eng", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100), "OCR imagen · análisis completo");
    },
  });
  const text = data.text ?? "";
  return buildResult(text, { meta: { source: "ocr-image" } });
}

async function extractPdf(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  onProgress?.(5, "Cargando PDF");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  const structuredItems: LineItem[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const rows = getPdfTextRows(
      content.items as Array<{ str?: string; transform?: number[] }>
    );
    text += `${rows.map((row) => row.text).join("\n")}\n`;
    structuredItems.push(
      ...parsePdfFinancialRows(rows)
    );
    onProgress?.(Math.round((i / pdf.numPages) * 80), `Página ${i}/${pdf.numPages}`);
  }

  const numericMatches = text.match(/[\d]{3,}/g) ?? [];
  const isScanned = text.trim().length < 120 || numericMatches.length < 6;
  const needsOcr = isScanned || structuredItems.length < 8;

  let combinedText = text;
  let extractedItems = structuredItems;
  let usedOcr = false;
  if (needsOcr && pdf.numPages > 0) {
    onProgress?.(82, isScanned ? "PDF escaneado · OCR profundo" : "Complementando con OCR");
    const ocrText = await ocrPdfPages(pdf, onProgress, 82);
    usedOcr = true;
    const scanned = looksLikeScannedText(text);
    if (scanned) {
      combinedText = ocrText;
      extractedItems = [];
    } else {
      combinedText = [text, ocrText].filter(Boolean).join("\n");
    }
  }

  const hasThousandsOfCOP =
    /\b(miles?\s+de\s+pesos|miles?\s+cop|cifras?\s+en\s+miles)\b/i.test(combinedText);
  onProgress?.(100, "Listo");
  return buildResult(combinedText, {
    pages: pdf.numPages,
    meta: {
      source: isScanned ? "ocr-pdf" : usedOcr ? "pdf-hybrid" : "pdf-text",
    },
  }, extractedItems, {
    structuredOnly: extractedItems.length >= 8,
    unitMultiplier: hasThousandsOfCOP ? 1000 : 1,
    unitLabel: hasThousandsOfCOP ? "COP (fuente expresada en miles de pesos)" : undefined,
  });
}

async function extractDocx(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  onProgress?.(20, "Leyendo Word");
  // @ts-expect-error no types for browser bundle
  const mammoth = await import("mammoth/mammoth.browser.js");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  onProgress?.(100, "Listo");
  const text = result.value ?? "";
  return buildResult(text, { meta: { source: "docx" } });
}

async function extractExcel(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  onProgress?.(15, "Leyendo hoja de cálculo");
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  let text = "";
  const sheetSummary: Array<{ sheet: string; rows: number }> = [];
  const directItems: LineItem[] = [];
  const used = new Map<string, number>();

  wb.SheetNames.forEach((name) => {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    sheetSummary.push({ sheet: name, rows: rows.length });
    text += `\n## Hoja: ${name}\n`;

    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const cells = row.map((c) => (c == null ? "" : String(c).trim())).filter((c) => c !== "");
      if (cells.length === 0) continue;
      text += cells.join(" | ") + "\n";

      // Find numeric cells and use preceding text cells as label
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci];
        let value: number | null = null;
        if (typeof cell === "number" && !isNaN(cell)) {
          value = cell;
        } else if (typeof cell === "string") {
          const vs = normalizeNumber(cell);
          if (vs) {
            const n = parseFloat(vs);
            if (!isNaN(n)) value = n;
          }
        }
        if (value === null || Math.abs(value) < 1) continue;

        const labelParts: string[] = [];
        for (let li = 0; li < ci; li++) {
          const lc = row[li];
          if (lc != null && String(lc).trim()) labelParts.push(String(lc).trim());
        }
        const labelBase = labelParts.join(" - ") || `${name} fila`;
        const label = uniqueLabel(labelBase, used);
        if (label.length > 1) directItems.push({ label, value });
      }
    }
  });

  onProgress?.(100, "Listo");
  const parsedItems = parseLineItems(text);
  const merged = [...directItems, ...parsedItems];
  const totals = lineItemsToTotals(merged);

  return {
    text,
    totals,
    lineItems: merged,
    sheetSummary,
    meta: {
      entryCount: Object.keys(totals).length,
      charCount: text.length,
      source: "excel",
    },
  };
}
