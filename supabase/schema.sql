-- Create a sequence for custom event IDs if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- POSITIONS TABLE
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    color_code VARCHAR(50) DEFAULT '#3b82f6', -- default blue
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PROFILES (Users/Employees/Business/Individuals)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'individual' CHECK (role IN ('business', 'employee', 'individual')),
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TASKS / EVENTS TABLE
CREATE TABLE public.tasks_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    
    scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_events ENABLE ROW LEVEL SECURITY;

-- Note: For Dev/Testing, you can add permissive policies, e.g.:
CREATE POLICY "Enable read access for all users" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Enable all access for all users" ON public.tasks_events FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.profiles FOR ALL USING (true);
