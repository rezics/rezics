-- Start transaction
BEGIN TRANSACTION;

-- Disable trigger checks during drop operations
SET session_replication_role = 'replica';

-- Drop all foreign key constraints
DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT conrelid::regclass AS table_name, conname AS constraint_name
    FROM pg_constraint
    WHERE contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %s;', 
                   constraint_record.table_name, 
                   constraint_record.constraint_name);
  END LOOP;
END $$;

-- Drop all tables
DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', table_record.tablename);
  END LOOP;
END $$;

-- Drop all functions
DO $$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT proname, oidvectortypes(proargtypes) AS args
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I(%s) CASCADE;', 
                   function_record.proname, 
                   function_record.args);
  END LOOP;
END $$;

-- Reset session settings
RESET session_replication_role;

-- Commit transaction
COMMIT TRANSACTION;  