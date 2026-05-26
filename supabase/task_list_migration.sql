-- Task List Feature Migration
-- Run this against your Supabase database

-- =============================================================
-- 1. tasks_events — new columns
-- =============================================================
ALTER TABLE public.tasks_events
  ADD COLUMN IF NOT EXISTS show_on_calendar BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_task_list BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_list_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- =============================================================
-- 2. profiles — tracker visibility preferences
-- =============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_reading_tracker BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_assignment_tracker BOOLEAN DEFAULT true;

-- =============================================================
-- 3. tracker_items — new table for reading & assignment trackers
-- =============================================================
CREATE TABLE IF NOT EXISTS public.tracker_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('reading', 'assignment')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    progress INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    due_date DATE,
    color_code VARCHAR(50) DEFAULT '#3b82f6',
    owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tracker_items ENABLE ROW LEVEL SECURITY;

-- User-scoped policies: users can only access their own tracker items
CREATE POLICY "Users can view their own tracker items"
  ON public.tracker_items FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can insert their own tracker items"
  ON public.tracker_items FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update their own tracker items"
  ON public.tracker_items FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can delete their own tracker items"
  ON public.tracker_items FOR DELETE
  USING (owner_user_id = auth.uid());
