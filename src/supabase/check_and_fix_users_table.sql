-- Check and fix users table structure
-- Kiểm tra và sửa cấu trúc bảng users

-- 1. Kiểm tra cấu trúc bảng users hiện tại
SELECT '=== CHECKING USERS TABLE STRUCTURE ===' as info;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Kiểm tra xem có cột level không
SELECT '=== CHECKING FOR LEVEL COLUMN ===' as info;
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'users' 
    AND table_schema = 'public' 
    AND column_name = 'level'
) as has_level_column;

-- 3. Nếu không có cột level, thêm nó
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
      AND table_schema = 'public' 
      AND column_name = 'level'
  ) THEN
    ALTER TABLE public.users ADD COLUMN level integer DEFAULT 1;
    RAISE NOTICE 'Added level column to users table';
  ELSE
    RAISE NOTICE 'Level column already exists';
  END IF;
END $$;

-- 4. Kiểm tra lại cấu trúc sau khi thêm
SELECT '=== USERS TABLE STRUCTURE AFTER FIX ===' as info;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Cập nhật function claim reward với cấu trúc đúng
CREATE OR REPLACE FUNCTION public.claim_daily_quest_reward_simple(quest_uuid uuid)
RETURNS json AS $$
DECLARE
  quest_record record;
  user_uuid uuid;
  xp_earned integer;
  new_xp integer;
  new_level integer;
  current_xp integer;
  current_level integer;
BEGIN
  -- Lấy thông tin quest
  SELECT * INTO quest_record FROM public.daily_quests WHERE id = quest_uuid;
  
  IF quest_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Quest not found');
  END IF;
  
  IF quest_record.status != 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Quest not completed yet');
  END IF;
  
  user_uuid := quest_record.user_id;
  xp_earned := quest_record.xp_reward;
  
  -- Lấy XP và level hiện tại
  SELECT xp, level INTO current_xp, current_level 
  FROM public.users 
  WHERE id = user_uuid;
  
  -- Tính toán XP và level mới
  new_xp := current_xp + xp_earned;
  new_level := CASE 
    WHEN new_xp >= 1000 THEN FLOOR(new_xp / 1000) + 1
    ELSE current_level
  END;
  
  -- Cập nhật XP và level cho user
  UPDATE public.users 
  SET 
    xp = new_xp,
    level = new_level,
    updated_at = now()
  WHERE id = user_uuid;
  
  -- Tạo progress record
  INSERT INTO public.daily_quest_progress (daily_quest_id, user_id, xp_earned)
  VALUES (quest_uuid, user_uuid, xp_earned);
  
  -- Cập nhật trạng thái quest thành claimed
  UPDATE public.daily_quests 
  SET status = 'claimed', updated_at = now()
  WHERE id = quest_uuid;
  
  RETURN json_build_object(
    'success', true, 
    'xp_earned', xp_earned,
    'new_total_xp', new_xp,
    'new_level', new_level
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Test function
SELECT '=== TESTING FUNCTION ===' as info;

-- Kiểm tra quest hiện tại
SELECT 
  id,
  user_id,
  status,
  xp_reward
FROM public.daily_quests 
WHERE status = 'completed'
ORDER BY updated_at DESC
LIMIT 1;

-- Kiểm tra XP hiện tại của user
SELECT 
  id,
  email,
  xp,
  level
FROM public.users 
WHERE id = (SELECT user_id FROM public.daily_quests WHERE status = 'completed' LIMIT 1);

SELECT 'All fixes applied! Function should work now.' as message;
