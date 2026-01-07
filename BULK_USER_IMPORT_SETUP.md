# Bulk User Import Setup Instructions

## Overview
The bulk user import feature requires a Supabase Edge Function to securely create users with the service role key.

## Setup Steps

## Method 1: Deploy via Supabase Dashboard (No CLI Required) ⭐ RECOMMENDED

### 1. Go to Supabase Dashboard
- Open your project at https://supabase.com/dashboard
- Navigate to **Edge Functions** (in the left sidebar)

### 2. Create New Function
- Click **"Create a new function"**
- Function name: `bulk-create-users`
- Click **"Create function"**

### 3. Copy the Function Code
- Open the file: `supabase/functions/bulk-create-users/index.ts`
- Copy all the code from that file
- Paste it into the function editor in the dashboard
- Click **"Deploy"**

### 4. Test the Feature
1. Navigate to Admin Dashboard → Users
2. Click "Thêm người dùng" (Add Users)
3. Upload the sample CSV file or download the template
4. Review the preview and click Import

---

## Method 2: Deploy via Supabase CLI

### 1. Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link Your Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

To find your project ref:
- Go to your Supabase Dashboard
- Settings → General
- Copy the "Reference ID"

### 4. Deploy the Edge Function

```bash
supabase functions deploy bulk-create-users
```

### 5. Verify Deployment

After deployment, you should see the function URL. It will look like:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/bulk-create-users
```

## Troubleshooting

### 403 Forbidden Error
- Make sure the Edge Function is deployed
- Check that your Supabase service role key is set correctly in the project

### Function Not Found
- Run `supabase functions list` to verify the function is deployed
- Redeploy if necessary: `supabase functions deploy bulk-create-users`

### CORS Errors
- The Edge Function includes CORS headers
- Make sure you're calling from an allowed origin

## Alternative: Manual SQL Method (Without Edge Function)

If you prefer not to use Edge Functions, you can create users directly via SQL in the Supabase SQL Editor:

```sql
-- Example: Create a single user
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert into auth.users (requires service role)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'student1@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Student One","username":"student1"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Insert into public.users
  INSERT INTO public.users (id, email, username, full_name, role)
  VALUES (new_user_id, 'student1@example.com', 'student1', 'Student One', 'user');
END $$;
```

## CSV Format

```csv
email,password,username,full_name,avatar,role,cohort
student1@example.com,password123,student1,Student One,https://example.com/avatar.jpg,user,Class A
teacher1@example.com,teacher123,teacher1,Teacher One,,teacher,
```

### Required Columns:
- **email**: Valid email address
- **password**: Minimum 6 characters
- **username**: Unique username
- **full_name**: User's full name

### Optional Columns:
- **avatar**: URL to avatar image
- **role**: user, teacher, or admin (default: user)
- **cohort**: Cohort name to assign user to
