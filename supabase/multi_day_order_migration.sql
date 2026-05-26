-- Migration to implement per-day task reordering for multi-day tasks
-- Run this against your Supabase database

-- 1. Add the new task_list_orders column if it doesn't exist
ALTER TABLE public.tasks_events ADD COLUMN IF NOT EXISTS task_list_orders JSONB DEFAULT '{}'::jsonb;

-- 2. Populate task_list_orders from legacy task_list_order column using start date
UPDATE public.tasks_events
SET task_list_orders = jsonb_build_object(scheduled_start_time::date::text, task_list_order)
WHERE task_list_order IS NOT NULL;

-- 3. Drop the legacy task_list_order column
ALTER TABLE public.tasks_events DROP COLUMN IF EXISTS task_list_order;

-- 4. Recreate bulk_update_task_orders RPC with the target_day parameter
CREATE OR REPLACE FUNCTION public.bulk_update_task_orders(updates jsonb, target_day text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_record record;
BEGIN
  -- updates should be a JSON array like:
  -- [{"id": "uuid-here", "order": 1}, {"id": "uuid-here", "order": 2}]
  FOR update_record IN SELECT * FROM jsonb_to_recordset(updates) AS x(id uuid, "order" integer)
  LOOP
    UPDATE public.tasks_events 
    SET task_list_orders = coalesce(task_list_orders, '{}'::jsonb) || jsonb_build_object(target_day, update_record.order)
    WHERE id = update_record.id;
  END LOOP;
END;
$$;
