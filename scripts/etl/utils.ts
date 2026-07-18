import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_YEARS } from "./constants";

export function parseCliArgs(argv: string[]) {
  const command = argv[2] ?? "all";
  const yearFlag = valueForFlag(argv, "--year");
  const yearsFlag = valueForFlag(argv, "--years");
  const years = yearsFlag
    ? yearsFlag.split(",").map((value) => Number(value.trim())).filter(Boolean)
    : yearFlag
      ? [Number(yearFlag)]
      : DEFAULT_YEARS;

  return {
    command,
    years,
    manual: argv.includes("--manual"),
    allowManualFallback: command === "all"
  };
}

export function valueForFlag(argv: string[], flag: string) {
  const prefix = `${flag}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function ensureDir(fileOrDirPath: string, isFile = false) {
  const dir = isFile ? path.dirname(fileOrDirPath) : fileOrDirPath;
  mkdirSync(dir, { recursive: true });
}

export function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function sha256Buffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function fileExists(filePath: string | null | undefined) {
  return Boolean(filePath && existsSync(filePath) && statSync(filePath).isFile());
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

export function parseCsvObjects(text: string) {
  const rows = parseCsv(text);
  const [headers, ...body] = rows;
  if (!headers) return [];
  return body.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), (cells[index] ?? "").trim()]))
  );
}

export function readCsvObjects(filePath: string) {
  return parseCsvObjects(readFileSync(filePath, "utf8"));
}

export function writeJson(filePath: string, value: unknown) {
  ensureDir(filePath, true);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function toNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .trim()
    .replace(/,/g, "")
    .replace(/[％%]$/, "");
  if (!normalized || normalized === "-" || normalized === "－") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function readString(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return fallback;
}

export function readNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(row[key]);
    if (value != null) return value;
  }
  return null;
}

export function safeFileName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
}

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function collectStrings(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item));
  if (typeof value === "object") return Object.values(value).flatMap((item) => collectStrings(item));
  return [];
}

export function pickText(value: unknown) {
  return collectStrings(value).join(" ").replace(/\s+/g, " ").trim();
}

export function parseAccountingType(text: string): "legal_applied" | "non_legal_applied" | null {
  if (/法.?非.?適用|非適用/.test(text)) return "non_legal_applied";
  if (/法.?適用/.test(text)) return "legal_applied";
  return null;
}

export function parseTableNo(text: string) {
  const match = text.match(/(?:表|第)?\s*(\d{1,2})\s*(?:表|号)?/);
  return match ? Number(match[1]) : null;
}

export async function fetchWithRetry(url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "sewer-fee-diagnosis-etl/0.1"
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError;
}
