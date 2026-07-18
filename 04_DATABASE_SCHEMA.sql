-- 全国下水道使用料適正診断 DBスキーマ案
-- SQLite/PostgreSQLどちらでも移植しやすいように設計する。

CREATE TABLE municipalities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  municipality_code TEXT UNIQUE,
  prefecture_code TEXT,
  prefecture_name TEXT NOT NULL,
  municipality_name TEXT NOT NULL,
  municipality_name_kana TEXT,
  latitude REAL,
  longitude REAL,
  population INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sewer_businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  municipality_id INTEGER NOT NULL,
  business_key TEXT NOT NULL,
  business_name TEXT,
  business_type TEXT,
  accounting_type TEXT NOT NULL CHECK (accounting_type IN ('legal_applied','non_legal_applied')),
  estat_business_category TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (municipality_id) REFERENCES municipalities(id),
  UNIQUE (municipality_id, business_key, accounting_type)
);

-- 一部事務組合などの報告事業体と、実際にサービスを受ける構成市町村の関係。
-- 決算額は sewer_businesses 側に一度だけ保持し、この表では複製しない。
CREATE TABLE sewer_service_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_municipality_id INTEGER NOT NULL,
  business_key TEXT NOT NULL,
  served_municipality_id INTEGER NOT NULL,
  valid_from_survey_year INTEGER,
  valid_to_survey_year INTEGER,
  metric_scope TEXT NOT NULL DEFAULT 'consolidated',
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_checked_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operator_municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE,
  FOREIGN KEY (served_municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE,
  UNIQUE (operator_municipality_id, business_key, served_municipality_id)
);

CREATE INDEX idx_sewer_service_memberships_member
  ON sewer_service_memberships(served_municipality_id, valid_from_survey_year, valid_to_survey_year);

CREATE TABLE source_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_year INTEGER NOT NULL,
  fiscal_year_label TEXT,
  government_stat_code TEXT NOT NULL,
  government_stat_name TEXT NOT NULL,
  provided_stat_name TEXT NOT NULL,
  category_1 TEXT,
  category_2 TEXT,
  table_no INTEGER,
  table_name TEXT,
  accounting_type TEXT CHECK (accounting_type IN ('legal_applied','non_legal_applied')),
  estat_stat_infid TEXT,
  estat_stats_data_id TEXT,
  source_url TEXT,
  local_path TEXT,
  file_format TEXT,
  published_at TEXT,
  downloaded_at TEXT,
  sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (survey_year, accounting_type, table_no, table_name, sha256)
);

CREATE TABLE field_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_year INTEGER NOT NULL,
  accounting_type TEXT NOT NULL CHECK (accounting_type IN ('legal_applied','non_legal_applied')),
  standard_field TEXT NOT NULL,
  table_no INTEGER NOT NULL,
  table_name TEXT,
  row_no INTEGER,
  col_no INTEGER,
  item_name_original TEXT,
  unit TEXT,
  confidence REAL DEFAULT 0.0,
  mapping_source TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (survey_year, accounting_type, standard_field, table_no, row_no, col_no)
);

CREATE TABLE raw_stat_cells (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id INTEGER NOT NULL,
  survey_year INTEGER NOT NULL,
  municipality_code TEXT,
  municipality_name TEXT,
  prefecture_name TEXT,
  business_key TEXT,
  business_name TEXT,
  business_type TEXT,
  accounting_type TEXT NOT NULL,
  table_no INTEGER NOT NULL,
  row_no INTEGER,
  col_no INTEGER,
  item_name_original TEXT,
  value_raw TEXT,
  value_numeric REAL,
  unit TEXT,
  sheet_name TEXT,
  cell_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_file_id) REFERENCES source_files(id)
);

CREATE INDEX idx_raw_stat_cells_lookup ON raw_stat_cells(survey_year, accounting_type, table_no, municipality_code, business_key);

CREATE TABLE annual_financials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sewer_business_id INTEGER NOT NULL,
  survey_year INTEGER NOT NULL,
  fiscal_year_label TEXT,
  accounting_type TEXT NOT NULL,

  sewer_fee_revenue REAL,
  annual_billable_volume REAL,
  wastewater_treatment_cost REAL,
  opex_component REAL,
  capital_cost_component REAL,

  operating_revenue REAL,
  operating_expense REAL,
  ordinary_revenue REAL,
  ordinary_expense REAL,
  ordinary_profit_loss REAL,
  net_income REAL,
  accumulated_deficit REAL,

  total_revenue_non_legal REAL,
  total_expense_non_legal REAL,
  real_balance REAL,
  revenue_expenditure_ratio REAL,

  general_account_transfer REAL,
  standard_transfer REAL,
  non_standard_transfer REAL,

  bond_balance REAL,
  bond_issued REAL,
  bond_redemption REAL,

  service_population REAL,
  connected_population REAL,
  treated_volume REAL,

  data_quality_status TEXT DEFAULT 'unchecked',
  flags_json TEXT,
  source_trace_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sewer_business_id) REFERENCES sewer_businesses(id),
  UNIQUE (sewer_business_id, survey_year)
);

-- 法適用事業の公式決算様式（第20表・第21表・第22表）の構造化値。
-- 同じ勘定定義を持たない法非適用事業には作成しない。金額単位は千円。
CREATE TABLE financial_statement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annual_financial_id INTEGER NOT NULL,
  source_file_id INTEGER NOT NULL,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('income_statement','cost_structure','balance_sheet')),
  section TEXT NOT NULL,
  item_code TEXT NOT NULL,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  parent_item_code TEXT,
  display_order INTEGER NOT NULL,
  table_no INTEGER NOT NULL,
  row_no INTEGER NOT NULL,
  col_no INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'thousand_yen',
  source_trace_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (annual_financial_id) REFERENCES annual_financials(id) ON DELETE CASCADE,
  FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE RESTRICT,
  UNIQUE (annual_financial_id, statement_type, item_code)
);

CREATE INDEX idx_financial_statement_items_annual
  ON financial_statement_items(annual_financial_id, statement_type, section, display_order);
CREATE INDEX idx_financial_statement_items_source
  ON financial_statement_items(source_file_id);
CREATE INDEX idx_financial_statement_items_code
  ON financial_statement_items(statement_type, item_code);

CREATE TABLE diagnosis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annual_financial_id INTEGER NOT NULL,
  sewer_business_id INTEGER NOT NULL,
  survey_year INTEGER NOT NULL,

  fee_unit_price_yen_per_m3 REAL,
  treatment_cost_yen_per_m3 REAL,
  expense_recovery_rate REAL,
  required_revision_rate_to_80 REAL,
  required_revision_rate_to_100 REAL,
  required_revision_rate_to_150yen REAL,

  accounting_balance_label TEXT,
  fee_adequacy_label TEXT,
  revision_risk_score INTEGER,
  revision_risk_label TEXT,
  diagnosis_comment TEXT,
  calculation_trace_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (annual_financial_id) REFERENCES annual_financials(id),
  FOREIGN KEY (sewer_business_id) REFERENCES sewer_businesses(id),
  UNIQUE (annual_financial_id)
);

CREATE TABLE fee_revision_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  municipality_id INTEGER NOT NULL,
  sewer_business_id INTEGER,
  status TEXT NOT NULL,
  effective_date TEXT,
  announced_date TEXT,
  average_revision_rate REAL,
  target_business TEXT,
  title TEXT,
  summary TEXT,
  source_url TEXT NOT NULL,
  source_type TEXT DEFAULT 'municipality_official',
  extraction_confidence REAL DEFAULT 0.0,
  checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (municipality_id) REFERENCES municipalities(id),
  FOREIGN KEY (sewer_business_id) REFERENCES sewer_businesses(id)
);

CREATE TABLE tariff_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fee_revision_event_id INTEGER,
  municipality_id INTEGER NOT NULL,
  sewer_business_id INTEGER,
  effective_date TEXT,
  customer_category TEXT,
  water_volume_from_m3 REAL,
  water_volume_to_m3 REAL,
  base_fee_yen REAL,
  metered_fee_yen REAL,
  tax_included INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fee_revision_event_id) REFERENCES fee_revision_events(id),
  FOREIGN KEY (municipality_id) REFERENCES municipalities(id),
  FOREIGN KEY (sewer_business_id) REFERENCES sewer_businesses(id)
);

CREATE TABLE etl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  log_json TEXT,
  error_message TEXT
);
