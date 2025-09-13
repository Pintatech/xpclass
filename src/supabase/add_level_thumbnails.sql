-- Add thumbnail URLs to existing levels
-- This script adds sample thumbnail URLs for the levels

-- Update Level 1 (Cơ bản - Beginner)
UPDATE public.levels 
SET thumbnail_url = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=400&fit=crop&crop=center'
WHERE id = '550e8400-e29b-41d4-a716-446655440001';

-- Update Level 2 (Trung cấp - Intermediate)  
UPDATE public.levels 
SET thumbnail_url = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=400&fit=crop&crop=center'
WHERE id = '550e8400-e29b-41d4-a716-446655440002';

-- Update Level 3 (Nâng cao - Advanced)
UPDATE public.levels 
SET thumbnail_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=center'
WHERE id = '550e8400-e29b-41d4-a716-446655440003';

-- If you have more levels, you can add them here
-- Example for additional levels:
-- UPDATE public.levels 
-- SET thumbnail_url = 'https://images.unsplash.com/photo-xxxxx?w=400&h=400&fit=crop&crop=center'
-- WHERE level_number = 4;

-- Verify the updates
SELECT id, title, level_number, difficulty_label, thumbnail_url 
FROM public.levels 
ORDER BY level_number;
