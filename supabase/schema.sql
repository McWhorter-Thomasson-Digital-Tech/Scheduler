-- Create a sequence for custom event IDs if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES TABLE
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default roles
INSERT INTO public.roles (name) VALUES ('manager'), ('employee');

-- ORGANIZATIONS TABLE
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PROFILES (Users/Individuals)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ORGANIZATION MEMBERS TABLE
CREATE TABLE public.organization_members (
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (organization_id, user_id)
);

-- POSITIONS TABLE
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    color_code VARCHAR(50) DEFAULT '#3b82f6', -- default blue
    
    owner_organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    daily_hours_goal NUMERIC(5,2),
    weekly_hours_goal NUMERIC(5,2),
    monthly_hours_goal NUMERIC(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT positions_owner_check CHECK (
        (owner_organization_id IS NOT NULL AND owner_user_id IS NULL) OR
        (owner_organization_id IS NULL AND owner_user_id IS NOT NULL)
    )
);

-- TASKS / EVENTS TABLE
CREATE TABLE public.tasks_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    color_code VARCHAR(50),
    
    scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    
    is_all_day BOOLEAN DEFAULT false,
    
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    owner_organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT tasks_events_owner_check CHECK (
        (owner_organization_id IS NOT NULL AND owner_user_id IS NULL) OR
        (owner_organization_id IS NULL AND owner_user_id IS NOT NULL)
    )
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_events ENABLE ROW LEVEL SECURITY;

-- Note: For Dev/Testing, you can add permissive policies, e.g.:
CREATE POLICY "Enable all access for all users" ON public.roles FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.organizations FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.organization_members FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.positions FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.tasks_events FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.profiles FOR ALL USING (true);
