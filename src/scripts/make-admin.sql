-- Script to make a user admin
-- Replace 'your-email@example.com' with your actual email

UPDATE public.users 
SET role = 'admin' 
WHERE email = 'kuten01@example.com';

-- Verify the change
SELECT id, email, full_name, role, created_at 
FROM public.users 
WHERE role = 'admin';


