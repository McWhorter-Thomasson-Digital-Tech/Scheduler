-- Seed script for Supabase
-- You can run this in your Supabase Dashboard SQL Editor

-- 1. Create Mock Auth Users (Requires pgcrypto for password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  employee_id UUID := '11111111-1111-1111-1111-111111111111';
  business_id UUID := '22222222-2222-2222-2222-222222222222';
  individual_id UUID := '33333333-3333-3333-3333-333333333333';
  org_id UUID := '55555555-5555-5555-5555-555555555555';
  manager_role_id UUID;
  employee_role_id UUID;
BEGIN
  -- Insert Employee Auth User
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = employee_id) THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
      '00000000-0000-0000-0000-000000000000', employee_id, 'authenticated', 'authenticated', 'employee@example.com',
      crypt('password123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"full_name": "Jane Doe"}', now(), now()
    );
  END IF;

  -- Insert Business Auth User
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = business_id) THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
      '00000000-0000-0000-0000-000000000000', business_id, 'authenticated', 'authenticated', 'business@example.com',
      crypt('password123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"full_name": "Business Manager"}', now(), now()
    );
  END IF;

  -- Insert Individual Auth User
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = individual_id) THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
      '00000000-0000-0000-0000-000000000000', individual_id, 'authenticated', 'authenticated', 'individual@example.com',
      crypt('password123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"full_name": "John Smith"}', now(), now()
    );
  END IF;

  -- Insert Profiles
  INSERT INTO public.profiles (id, full_name)
  VALUES 
    (employee_id, 'Jane Doe'),
    (business_id, 'Business Manager'),
    (individual_id, 'John Smith')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Organization
  INSERT INTO public.organizations (id, name)
  VALUES (org_id, 'Acme Corp')
  ON CONFLICT (id) DO NOTHING;

  -- Fetch Roles
  SELECT id INTO manager_role_id FROM public.roles WHERE name = 'manager';
  SELECT id INTO employee_role_id FROM public.roles WHERE name = 'employee';

  -- Insert Organization Members
  INSERT INTO public.organization_members (organization_id, user_id, role_id)
  VALUES 
    (org_id, business_id, manager_role_id),
    (org_id, employee_id, employee_role_id)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Insert Positions
  INSERT INTO public.positions (id, title, color_code, owner_organization_id, owner_user_id) 
  VALUES 
    ('44444444-4444-4444-4444-444444444444', 'Morning Shift', '#3b82f6', org_id, NULL),
    (uuid_generate_v4(), 'Afternoon Shift', '#8b5cf6', org_id, NULL),
    (uuid_generate_v4(), 'Personal Training', '#10b981', NULL, individual_id)
  ON CONFLICT (id) DO NOTHING;

  -- Insert Task Events (Assigned to Employee)
  INSERT INTO public.tasks_events (id, title, description, location, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, position_id, assigned_to, owner_organization_id, owner_user_id)
  VALUES 
    (uuid_generate_v4(), 'Morning prep', 'Prepare for opening', 'Main Office', now() - interval '1 hour', now() + interval '3 hours', NULL, NULL, '44444444-4444-4444-4444-444444444444', employee_id, org_id, NULL),
    (uuid_generate_v4(), 'Inventory check', 'Check the stock', 'Warehouse', now() + interval '4 hours', now() + interval '5 hours', NULL, NULL, '44444444-4444-4444-4444-444444444444', employee_id, org_id, NULL),
    (uuid_generate_v4(), 'Gym workout', 'Personal health', 'Local Gym', now() + interval '6 hours', now() + interval '7 hours', NULL, NULL, NULL, NULL, NULL, individual_id)
  ON CONFLICT DO NOTHING;

END $$;
