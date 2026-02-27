-- Run this in Supabase Dashboard → SQL Editor if EmployeeData table has RLS enabled
-- and you get permission errors. These are permissive policies for development/testing.
-- If a policy already exists, run the DROP POLICY lines below first, then create again.

-- Enable RLS on EmployeeData (skip if already enabled)
ALTER TABLE IF EXISTS "EmployeeData" ENABLE ROW LEVEL SECURITY;

-- If policies already exist, uncomment and run these first:
-- DROP POLICY IF EXISTS "Allow all SELECT EmployeeData" ON "EmployeeData";
-- DROP POLICY IF EXISTS "Allow all INSERT EmployeeData" ON "EmployeeData";
-- DROP POLICY IF EXISTS "Allow all UPDATE EmployeeData" ON "EmployeeData";
-- DROP POLICY IF EXISTS "Allow all DELETE EmployeeData" ON "EmployeeData";

-- Permissive policies (using true = allow for all; tighten in production)
CREATE POLICY "Allow all SELECT EmployeeData" ON "EmployeeData"
  FOR SELECT USING (true);

CREATE POLICY "Allow all INSERT EmployeeData" ON "EmployeeData"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all UPDATE EmployeeData" ON "EmployeeData"
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow all DELETE EmployeeData" ON "EmployeeData"
  FOR DELETE USING (true);
