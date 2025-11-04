# Supabase "Database Error Saving New User" Fix

## Problem
Users are successfully signing up (receiving confirmation emails and appearing in the database), but they see a "database error saving new user" message. This indicates the **auth signup is working**, but a **database trigger or policy is failing**.

## Root Cause
When a user signs up in Supabase, there's likely a database trigger that automatically creates a profile record in a `profiles` or `users` table. This trigger is failing due to one of these reasons:

1. **Missing profiles table**
2. **RLS (Row Level Security) policy blocking the insert**
3. **Trigger has incorrect permissions**
4. **Column constraints not being met**

## Solution

### Step 1: Check Your Supabase Project

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project (vstxdwkdsuhlazzgyiux)
3. Go to **Table Editor**
4. Look for a table named `profiles`, `users`, or similar

### Step 2: Check for Database Triggers

1. In Supabase dashboard, go to **Database** → **Functions**
2. Look for a trigger function like `handle_new_user()` or similar
3. Check if it exists and what it's trying to do

### Step 3: Common Fix - Create/Fix Profiles Table

Run this SQL in your Supabase SQL Editor (**Database** → **SQL Editor**):

```sql
-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create trigger function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent errors on duplicate
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the auth signup
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow service role to insert during signup
CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);
```

### Step 4: Test the Fix

1. Run the SQL above in Supabase SQL Editor
2. Try creating a new test account
3. The "database error" should no longer appear

### Step 5: Alternative - Remove Profile Creation Entirely

If you don't need a profiles table at all, you can simply remove the trigger:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

Then users will only exist in `auth.users` (which is sufficient for basic authentication).

## Frontend Fix Applied

I've already updated `frontend/auth.js` to:
- Handle the error more gracefully
- Show a helpful message if database errors occur
- Inform users to check their email even if there's an error
- Provide better error context

## Verification

After applying the Supabase fix:

1. Create a new test account
2. You should NOT see "database error saving new user"
3. You SHOULD receive a confirmation email
4. After confirming email, you SHOULD be able to sign in
5. Check that a profile record was created in `public.profiles` (if using that approach)

## Need More Help?

If the issue persists:
1. Check Supabase logs: **Logs** → **Database** in your dashboard
2. Look for error messages during signup
3. Share the specific error from Supabase logs for more targeted help
