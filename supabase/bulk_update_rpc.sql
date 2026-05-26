-- Migration to add a bulk update RPC for task list ordering
-- This allows updating multiple task orders in a single database roundtrip.

CREATE OR REPLACE FUNCTION bulk_update_task_orders(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_record record;
BEGIN
  -- updates should be a JSON array like:
  -- [{"id": "uuid-here", "task_list_order": 1}, {"id": "uuid-here", "task_list_order": 2}]
  FOR update_record IN SELECT * FROM jsonb_to_recordset(updates) AS x(id uuid, task_list_order integer)
  LOOP
    UPDATE public.tasks_events 
    SET task_list_order = update_record.task_list_order 
    WHERE id = update_record.id;
  END LOOP;
END;
$$;
