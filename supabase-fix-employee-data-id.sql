-- Fix EmployeeData: NULL id column so Update/Delete can match rows
-- Run in Supabase Dashboard → SQL Editor. Then refresh app and retest.

-- 1) Enable pgcrypto (gen_random_uuid is built-in in PG13+ but this ensures compatibility)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Check your id column type in Table Editor:
--    - If id is UUID: run section A below.
--    - If id is int4/int8 (integer): run section B below.

-- ========== SECTION A: id is already UUID type ==========
-- Backfill NULL ids with new UUIDs
UPDATE "EmployeeData"
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE "EmployeeData"
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE "EmployeeData"
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add primary key if missing (ignore error if it already exists)
ALTER TABLE "EmployeeData" ADD PRIMARY KEY (id);

-- ========== SECTION B: id is integer/bigint (Supabase default) ==========
-- Run only if Section A fails (e.g. "column id is of type integer but expression is of type uuid").
-- Create sequence, backfill NULLs with nextval, then set NOT NULL and default:
/*
CREATE SEQUENCE IF NOT EXISTS "EmployeeData_id_seq";
SELECT setval('"EmployeeData_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "EmployeeData"));
UPDATE "EmployeeData" SET id = nextval('"EmployeeData_id_seq"') WHERE id IS NULL;
ALTER TABLE "EmployeeData" ALTER COLUMN id SET NOT NULL;
ALTER TABLE "EmployeeData" ALTER COLUMN id SET DEFAULT nextval('"EmployeeData_id_seq"');
ALTER TABLE "EmployeeData" ADD PRIMARY KEY (id);
*/

-- Verify (run after): SELECT id, employee_data FROM "EmployeeData" LIMIT 5;
