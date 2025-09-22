# Supabase Setup Guide

## The Problem
Your registration is failing because Supabase environment variables are not configured. The app is using a mock client that returns "Supabase not configured" errors.

## Solution Steps

### 1. Create a Supabase Project
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in or create an account
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - **Name**: `momtek` (or your preferred name)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your location
6. Click "Create new project"

### 2. Get Your Project Credentials
1. Once your project is created, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-ref.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### 3. Create Environment File
Create a file named `.env` in your project root with:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the placeholder values with your actual credentials.

### 4. Set Up Database Schema
Run the SQL from `supabase_database_setup.sql` in your Supabase SQL editor:

1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New query"
3. Copy and paste the contents of `supabase_database_setup.sql`
4. Click "Run"

### 5. Configure Authentication
1. Go to **Authentication** → **Settings**
2. Under **Site URL**, add your development URL: `http://localhost:5173`
3. Under **Redirect URLs**, add: `http://localhost:5173/**`
4. Save changes

### 6. Test Registration
1. Restart your development server: `npm run dev`
2. Try creating a new account
3. Check the browser console for any remaining errors

## Troubleshooting

### If you still get errors:
1. **Check console logs**: Open browser dev tools and look for error messages
2. **Verify environment variables**: Make sure `.env` file is in the project root
3. **Check Supabase logs**: Go to your Supabase dashboard → Logs to see server-side errors
4. **Verify database schema**: Ensure all tables were created successfully

### Common Issues:
- **CORS errors**: Make sure your site URL is configured in Supabase
- **Database errors**: Check that the schema was applied correctly
- **Environment variables not loading**: Restart your dev server after creating `.env`

## Your JWT Token
The JWT token you shared (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`) appears to be a Supabase anon key. This should be used as your `VITE_SUPABASE_ANON_KEY` value in the `.env` file.

However, you still need to:
1. Create a Supabase project
2. Get the project URL
3. Set up the database schema
4. Configure the environment variables properly


