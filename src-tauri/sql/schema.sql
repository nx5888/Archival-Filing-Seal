-- sql/schema.sql
-- 电子档案归档章印制工具 - SQLite 建表脚本

-- 档案类型模板表（核心新增）
CREATE TABLE IF NOT EXISTS archive_templates (
    id                 INTEGER PRIMARY KEY,
    code               TEXT NOT NULL UNIQUE,
    name               TEXT NOT NULL,
    description        TEXT,
    is_builtin         INTEGER DEFAULT 0,
    folder_mapping     TEXT NOT NULL,
    filename_regex     TEXT NOT NULL,
    field_registry     TEXT NOT NULL,
    stamp_schema       TEXT NOT NULL,
    page_number_config TEXT NOT NULL,
    created_at         TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at         TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 配置方案表
CREATE TABLE IF NOT EXISTS config_schemes (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    template_id INTEGER REFERENCES archive_templates(id) ON DELETE SET NULL,
    scheme_json TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    root_path   TEXT NOT NULL,
    schema_json TEXT NOT NULL,
    config_json TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 批次表（多全宗多年度隔离）
CREATE TABLE IF NOT EXISTS batches (
    id               INTEGER PRIMARY KEY,
    project_id       INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    template_id      INTEGER REFERENCES archive_templates(id),
    batch_name       TEXT NOT NULL,
    fonds_code       TEXT,
    year             TEXT,
    retention        TEXT,
    file_count       INTEGER DEFAULT 0,
    status           TEXT DEFAULT 'pending',
    created_at       TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 文件表
CREATE TABLE IF NOT EXISTS files (
    id               INTEGER PRIMARY KEY,
    batch_id         INTEGER REFERENCES batches(id) ON DELETE CASCADE,
    project_id       INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    template_id      INTEGER REFERENCES archive_templates(id),
    file_path        TEXT NOT NULL,
    abs_path         TEXT NOT NULL UNIQUE,
    file_mtime       INTEGER NOT NULL,
    status           TEXT DEFAULT 'pending',
    error_msg        TEXT,
    extracted_json   TEXT,
    manual_x_mm      REAL,
    manual_y_mm      REAL,
    schema_version   TEXT,
    stamped_at       TEXT,
    created_at       TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at       TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_files_abs_path  ON files(abs_path);
CREATE INDEX IF NOT EXISTS idx_files_status    ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_batch     ON files(batch_id);
CREATE INDEX IF NOT EXISTS idx_files_template  ON files(template_id);
CREATE INDEX IF NOT EXISTS idx_files_project   ON files(project_id);

-- 印章表
CREATE TABLE IF NOT EXISTS seals (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    file_path   TEXT NOT NULL UNIQUE,
    width_mm    REAL,
    height_mm   REAL,
    created_at  TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT DEFAULT (datetime('now', 'localtime'))
);
