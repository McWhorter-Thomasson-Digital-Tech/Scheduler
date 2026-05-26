-- RLS Policy Fix Migration
-- Replaces the permissive "Enable all access for all users" dev policies
-- with proper user-scoped policies on each table.
-- 
-- IMPORTANT: Run this migration AFTER verifying your app works with these
-- stricter policies. Test thoroughly in a dev environment first.

-- =============================================================
-- 1. ROLES — read-only for all authenticated users
-- =============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.roles;

CREATE POLICY "Authenticated users can read roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================
-- 2. ORGANIZATIONS — members can read their org, no one creates via RLS
-- =============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.organizations;

CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =============================================================
-- 3. ORGANIZATION_MEMBERS — members can view their own org membership
-- =============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.organization_members;

CREATE POLICY "Users can view their own memberships"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view co-members in their orgs"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =============================================================
-- 4. PROFILES — users can read/update their own profile
-- =============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view profiles in their org"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT user_id FROM public.organization_members
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- =============================================================
-- 5. POSITIONS — users can manage their own, view org positions
-- =============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.positions;

CREATE POLICY "Users can view their own positions"
  ON public.positions FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can view their org positions"
  ON public.positions FOR SELECT
  TO authenticated
  USING (
    owner_organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own positions"
  ON public.positions FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    OR owner_organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own positions"
  ON public.positions FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR owner_organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own positions"
  ON public.positions FOR DELETE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR owner_organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =============================================================
-- 6. TASKS_EVENTS — users can manage their own, view assigned/org tasks
-- =============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.tasks_events;

CREATE POLICY "Users can view their own tasks"
  ON public.tasks_events FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can view tasks assigned to them"
  ON public.tasks_events FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Users can view their org tasks"
  ON public.tasks_events FOR SELECT
  TO authenticated
  USING (
    owner_organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own tasks"
  ON public.tasks_events FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    OR owner_organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own tasks"
  ON public.tasks_events FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR assigned_to = auth.uid()
    OR owner_organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks_events FOR DELETE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR owner_organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
