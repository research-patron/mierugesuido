export const YAML_FIELD_MAPPING_SOURCE = "03_FIELD_MAPPING.yml";

export const VERIFIED_EXACT_MAPPING_FIELDS = new Set([
  "household_fee_20m3_yen",
  "opex_component",
  "capital_cost_component",
  "wastewater_treatment_cost"
]);

export type KnownPosition = {
  rowNo: number;
  colNo: number;
  sourceNote?: string;
};

type MappingRow = {
  id: number;
  standardField: string;
  tableNo: number;
  rowNo: number | null;
  colNo: number | null;
  mappingSource: string | null;
};

export function readKnownPositions(preferred: unknown): KnownPosition[] {
  if (!preferred || typeof preferred !== "object") return [];
  const examples = (preferred as { known_position_examples?: unknown }).known_position_examples;
  if (!Array.isArray(examples)) return [];

  return examples.flatMap((example) => {
    if (!example || typeof example !== "object") return [];
    const values = example as { row_no?: unknown; col_no?: unknown; source_note?: unknown };
    const rowNo = Number(values.row_no);
    const colNo = Number(values.col_no);
    if (!Number.isInteger(rowNo) || rowNo <= 0 || !Number.isInteger(colNo) || colNo <= 0) return [];
    return [{
      rowNo,
      colNo,
      sourceNote: typeof values.source_note === "string" ? values.source_note : undefined
    }];
  });
}

export function staleVerifiedMappingIds(
  rows: MappingRow[],
  standardField: string,
  tableNo: number,
  positions: KnownPosition[]
) {
  if (!VERIFIED_EXACT_MAPPING_FIELDS.has(standardField) || positions.length === 0) return [];
  const allowedCoordinates = new Set(positions.map((position) => `${tableNo}:${position.rowNo}:${position.colNo}`));

  return rows
    .filter((row) =>
      row.standardField === standardField
      && row.mappingSource === YAML_FIELD_MAPPING_SOURCE
      && !allowedCoordinates.has(`${row.tableNo}:${row.rowNo}:${row.colNo}`)
    )
    .map((row) => row.id);
}
