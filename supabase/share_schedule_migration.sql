-- 1. Create shared_schedules table
CREATE TABLE IF NOT EXISTS public.shared_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    payload JSONB NOT NULL
);

-- 2. Add hide_details_in_share to tasks_events
ALTER TABLE public.tasks_events ADD COLUMN IF NOT EXISTS hide_details_in_share BOOLEAN DEFAULT false;

-- 3. Enable RLS on shared_schedules
ALTER TABLE public.shared_schedules ENABLE ROW LEVEL SECURITY;

-- 4. Policies for shared_schedules
-- Allow the creator to manage their shared schedules
CREATE POLICY "Users can manage their own shared schedules" 
    ON public.shared_schedules 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Allow anyone (even anonymous) to read active schedules
CREATE POLICY "Anyone can view active shared schedules" 
    ON public.shared_schedules 
    FOR SELECT 
    USING (expires_at > NOW());

-- 5. Set up pg_cron to delete expired schedules
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup job to run every day at midnight
SELECT cron.schedule('delete-expired-shares', '0 0 * * *', $$
    DELETE FROM public.shared_schedules WHERE expires_at < NOW();
$$);
