-- Migration: 001_create_user_trigger.sql
-- This migration updates/creates the database function and trigger to link auth.users to public.users on creation.
-- It assumes public.users already exists and populates key user metadata, including their email.

-- Function that inserts a profile row for a newly created auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        assigned_region,
        assigned_district
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'viewer',
        COALESCE(NEW.raw_user_meta_data->>'assigned_region', ''),
        COALESCE(NEW.raw_user_meta_data->>'assigned_district', '')
    )
    ON CONFLICT (id) DO NOTHING;  -- safety in case the row already exists
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger that runs after a new auth user is inserted
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
