-- Cleanup script để xóa các bảng từ lần tạo trước đó không thành công
-- Chạy script này trước khi chạy add_daily_quest_system.sql

-- Kiểm tra và xóa bảng quest_exercise_assignments nếu tồn tại
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quest_exercise_assignments') THEN
        DROP TABLE IF EXISTS public.quest_exercise_assignments CASCADE;
        RAISE NOTICE 'Đã xóa bảng quest_exercise_assignments';
    ELSE
        RAISE NOTICE 'Bảng quest_exercise_assignments không tồn tại';
    END IF;
END $$;

-- Kiểm tra và xóa bảng user_daily_quest_progress nếu tồn tại
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_daily_quest_progress') THEN
        DROP TABLE IF EXISTS public.user_daily_quest_progress CASCADE;
        RAISE NOTICE 'Đã xóa bảng user_daily_quest_progress';
    ELSE
        RAISE NOTICE 'Bảng user_daily_quest_progress không tồn tại';
    END IF;
END $$;

-- Kiểm tra và xóa bảng daily_quests nếu tồn tại (để tạo lại)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_quests') THEN
        DROP TABLE IF EXISTS public.daily_quests CASCADE;
        RAISE NOTICE 'Đã xóa bảng daily_quests cũ';
    ELSE
        RAISE NOTICE 'Bảng daily_quests không tồn tại';
    END IF;
END $$;

-- Kiểm tra và xóa bảng daily_quest_progress nếu tồn tại (để tạo lại)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_quest_progress') THEN
        DROP TABLE IF EXISTS public.daily_quest_progress CASCADE;
        RAISE NOTICE 'Đã xóa bảng daily_quest_progress cũ';
    ELSE
        RAISE NOTICE 'Bảng daily_quest_progress không tồn tại';
    END IF;
END $$;

-- Xóa các functions liên quan nếu tồn tại
DROP FUNCTION IF EXISTS public.create_daily_quest(uuid, date);
DROP FUNCTION IF EXISTS public.complete_daily_quest(uuid);
DROP FUNCTION IF EXISTS public.claim_daily_quest_reward(uuid);
DROP FUNCTION IF EXISTS public.get_today_daily_quest(uuid);

-- Xóa các policies liên quan nếu tồn tại (chỉ khi bảng tồn tại)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_quests') THEN
        DROP POLICY IF EXISTS "Users can read own daily quests" ON public.daily_quests;
        DROP POLICY IF EXISTS "Users can update own daily quests" ON public.daily_quests;
        RAISE NOTICE 'Đã xóa policies của daily_quests';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_quest_progress') THEN
        DROP POLICY IF EXISTS "Users can read own daily quest progress" ON public.daily_quest_progress;
        DROP POLICY IF EXISTS "Users can insert own daily quest progress" ON public.daily_quest_progress;
        RAISE NOTICE 'Đã xóa policies của daily_quest_progress';
    END IF;
END $$;

-- Xóa các triggers liên quan nếu tồn tại (chỉ khi bảng tồn tại)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_quests') THEN
        DROP TRIGGER IF EXISTS update_daily_quests_updated_at ON public.daily_quests;
        RAISE NOTICE 'Đã xóa trigger của daily_quests';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_quest_progress') THEN
        DROP TRIGGER IF EXISTS update_daily_quest_progress_updated_at ON public.daily_quest_progress;
        RAISE NOTICE 'Đã xóa trigger của daily_quest_progress';
    END IF;
END $$;

-- Thông báo hoàn thành
SELECT 'Cleanup hoàn thành! Bây giờ bạn có thể chạy add_daily_quest_system.sql' as message;
