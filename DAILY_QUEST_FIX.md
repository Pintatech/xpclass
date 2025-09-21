# Daily Quest Fix - Stop Repeating Same Exercise

## Problem
The daily quest system was assigning the same exercise every day because the `get_today_daily_quest_simple` function was missing or didn't have proper randomization logic.

## Solution
Created a new database function with proper exercise rotation that:
- Avoids repeating exercises used in the last 7 days
- Randomly selects from available exercises
- Falls back to any exercise if all have been used recently
- Provides different XP rewards based on exercise type

## How to Apply the Fix

1. **Run the SQL script in your Supabase database:**
   ```bash
   # Option 1: Using Supabase CLI
   supabase db reset --local

   # Option 2: Copy and paste the content of fix_daily_quest_system.sql
   # into your Supabase SQL editor and run it
   ```

2. **Or manually execute the SQL:**
   - Open your Supabase project dashboard
   - Go to SQL Editor
   - Copy the contents of `src/supabase/fix_daily_quest_system.sql`
   - Paste and execute

## What the Fix Does

### Randomization Logic
- **7-day exclusion**: Won't repeat exercises used in the last 7 days
- **Random selection**: Uses `ORDER BY RANDOM()` for true randomization
- **Fallback mechanism**: If all exercises used recently, allows any exercise

### XP Rewards by Exercise Type
- Video exercises: 150 XP
- Multiple choice: 120 XP
- Audio flashcard: 100 XP
- Other types: 80 XP

### Database Structure
- Ensures proper table structure for `daily_quests` and `daily_quest_progress`
- Sets up Row Level Security (RLS) policies
- Creates proper indexes and constraints

## Testing
After applying the fix:
1. Clear any existing daily quest for today (optional)
2. Refresh the dashboard page
3. Check that a new, different exercise is assigned
4. Wait until tomorrow to verify it picks a different exercise

## Files Modified
- ✅ `src/supabase/fix_daily_quest_system.sql` - New SQL script with the fix
- ✅ `DAILY_QUEST_FIX.md` - This instruction file

The daily quest should now properly rotate through different exercises instead of repeating the same one every day!