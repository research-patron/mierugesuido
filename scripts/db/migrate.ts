import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { INTERMUNICIPAL_SEWER_SERVICE_AREAS } from "./intermunicipalServiceAreas";

const dbPath = databasePathFromUrl(process.env.DATABASE_URL ?? "file:./dev.db");
mkdirSync(path.dirname(dbPath), { recursive: true });

backupIncompatibleDatabase(dbPath);

const diff = spawnSync(
  "pnpm",
  [
    "exec",
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script"
  ],
  {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db" }
  }
);

if (diff.status !== 0) {
  console.error(diff.stderr || diff.stdout);
  process.exit(diff.status ?? 1);
}

const sql = diff.stdout
  .replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ")
  .replace(/CREATE UNIQUE INDEX /g, "CREATE UNIQUE INDEX IF NOT EXISTS ")
  .replace(/CREATE INDEX /g, "CREATE INDEX IF NOT EXISTS ");

const result = spawnSync("sqlite3", [dbPath], {
  input: sql,
  encoding: "utf8"
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

ensureAdditiveColumns(dbPath, [
  {
    table: "annual_financials",
    column: "household_fee_20m3_yen",
    sql: "ALTER TABLE annual_financials ADD COLUMN household_fee_20m3_yen REAL"
  }
]);

syncIntermunicipalServiceAreas(dbPath);

console.log(`SQLite schema is ready at ${dbPath}${existsSync(dbPath) ? "" : " (created)"}`);

function ensureAdditiveColumns(
  filePath: string,
  columns: Array<{ table: string; column: string; sql: string }>
) {
  for (const migration of columns) {
    const tableInfo = spawnSync("sqlite3", [filePath, `PRAGMA table_info(${migration.table});`], {
      encoding: "utf8"
    });
    if (tableInfo.status !== 0) {
      console.error(tableInfo.stderr || tableInfo.stdout);
      process.exit(tableInfo.status ?? 1);
    }
    const exists = tableInfo.stdout
      .split("\n")
      .some((line) => line.split("|")[1] === migration.column);
    if (exists) continue;
    const altered = spawnSync("sqlite3", [filePath, migration.sql], { encoding: "utf8" });
    if (altered.status !== 0) {
      console.error(altered.stderr || altered.stdout);
      process.exit(altered.status ?? 1);
    }
  }
}

function databasePathFromUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Only SQLite file: DATABASE_URL values are supported by scripts/db/migrate.ts.");
  }
  const raw = databaseUrl.replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.resolve("prisma", raw);
}

function syncIntermunicipalServiceAreas(filePath: string) {
  for (const area of INTERMUNICIPAL_SEWER_SERVICE_AREAS) {
    const sql = `
      INSERT INTO sewer_service_memberships (
        operator_municipality_id,
        business_key,
        served_municipality_id,
        valid_from_survey_year,
        valid_to_survey_year,
        metric_scope,
        source_url,
        source_label,
        source_checked_at,
        notes,
        created_at,
        updated_at
      )
      SELECT
        operator.id,
        ${sqlText(area.businessKey)},
        served.id,
        ${sqlNumber(area.validFromSurveyYear)},
        ${sqlNumber(area.validToSurveyYear)},
        'consolidated',
        ${sqlText(area.sourceUrl)},
        ${sqlText(area.sourceLabel)},
        ${sqlText(area.sourceCheckedAt)},
        ${sqlText(area.notes)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM municipalities operator
      JOIN municipalities served ON served.municipality_code = ${sqlText(area.servedMunicipalityCode)}
      WHERE operator.municipality_code = ${sqlText(area.operatorMunicipalityCode)}
      ON CONFLICT(operator_municipality_id, business_key, served_municipality_id) DO UPDATE SET
        valid_from_survey_year = excluded.valid_from_survey_year,
        valid_to_survey_year = excluded.valid_to_survey_year,
        metric_scope = excluded.metric_scope,
        source_url = excluded.source_url,
        source_label = excluded.source_label,
        source_checked_at = excluded.source_checked_at,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP;
    `;
    const result = spawnSync("sqlite3", [filePath, sql], { encoding: "utf8" });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      process.exit(result.status ?? 1);
    }
  }
}

function sqlText(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNumber(value: number | null) {
  return value == null ? "NULL" : String(value);
}

function backupIncompatibleDatabase(filePath: string) {
  if (!existsSync(filePath)) return;
  const pragma = spawnSync("sqlite3", [filePath, "PRAGMA table_info(etl_runs);"], {
    encoding: "utf8"
  });
  if (pragma.status !== 0 || !pragma.stdout) return;
  const hasTextStartedAt = pragma.stdout
    .split("\n")
    .some((line) => line.includes("|started_at|TEXT|"));
  if (!hasTextStartedAt) return;

  const backupPath = `${filePath}.incompatible-${Date.now()}`;
  renameSync(filePath, backupPath);
  console.warn(`Existing incompatible SQLite file was moved to ${backupPath}`);
}
