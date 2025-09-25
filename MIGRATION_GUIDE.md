# Migration Guide: Simplified Student Levels

## 🎯 Mục tiêu
Đơn giản hóa hệ thống level bằng cách loại bỏ các cột thừa `xp_range_min` và `xp_range_max`, chỉ giữ lại `xp_required`.

## 📋 Các bước thực hiện

### 1. Chạy Migration Script
```sql
-- Chạy file migration
\i src/supabase/migrate_to_simplified_levels.sql
```

### 2. Kiểm tra Migration
```sql
-- Chạy test script
\i src/supabase/test_simplified_levels.sql
```

### 3. Cập nhật Code
- ✅ `useStudentLevels.jsx` đã được cập nhật
- ✅ `Profile.jsx` đã được cập nhật
- ✅ `App.jsx` đã được cập nhật

## 🔄 Thay đổi chính

### Schema cũ:
```sql
CREATE TABLE student_levels (
  level_number integer,
  xp_required integer,      -- XP cần để đạt level
  xp_range_min integer,     -- XP tối thiểu (thừa)
  xp_range_max integer,     -- XP tối đa (thừa)
  -- ... other columns
);
```

### Schema mới:
```sql
CREATE TABLE student_levels (
  level_number integer,
  xp_required integer,      -- Chỉ cần cột này
  -- ... other columns
);
```

## 🧮 Logic mới

### Cách tính level hiện tại:
```javascript
// Cũ: userXp >= xp_range_min && userXp <= xp_range_max
// Mới: userXp >= xp_required (lấy level cao nhất)

const currentLevel = studentLevels
  .filter(level => userXp >= level.xp_required)
  .sort((a, b) => b.level_number - a.level_number)[0]
```

### Cách tính tiến trình:
```javascript
// Cũ: (userXp - xp_range_min) / (xp_range_max - xp_range_min)
// Mới: (userXp - current.xp_required) / (next.xp_required - current.xp_required)

const progressPercentage = (userXp - current.xp_required) / (next.xp_required - current.xp_required) * 100
```

## ✅ Lợi ích

1. **Đơn giản hơn**: Chỉ cần 1 cột thay vì 3 cột
2. **Dễ maintain**: Không cần sync nhiều cột
3. **Ít lỗi**: Logic đơn giản hơn
4. **Performance tốt hơn**: Ít dữ liệu cần xử lý

## 🧪 Test Cases

### Test với các mức XP khác nhau:
- 0 XP → Level 1 (Newcomer)
- 500 XP → Level 2 (Rookie)  
- 1500 XP → Level 3 (Learner)
- 5000 XP → Level 6 (Advanced)
- 100000 XP → Level 15 (Transcendent)

### Test edge cases:
- XP âm → Level 1
- XP vượt quá level cao nhất → Level 15
- XP chính xác bằng xp_required → Level đó

## 🔧 Rollback (nếu cần)

Nếu cần rollback, có thể khôi phục từ backup:
```sql
-- Khôi phục từ backup
DROP TABLE IF EXISTS public.student_levels;
ALTER TABLE public.student_levels_backup RENAME TO student_levels;
```

## 📁 Files đã tạo/cập nhật

### Mới:
- `src/supabase/migrate_to_simplified_levels.sql` - Migration script
- `src/supabase/test_simplified_levels.sql` - Test script
- `src/supabase/simplified_student_levels.sql` - Schema mới
- `MIGRATION_GUIDE.md` - Hướng dẫn này

### Đã cập nhật:
- `src/hooks/useStudentLevels.jsx` - Logic mới
- `src/components/profile/Profile.jsx` - Đã tương thích
- `src/App.jsx` - Đã có StudentLevelsProvider

## 🚀 Sẵn sàng chạy!

Migration đã sẵn sàng. Chỉ cần chạy script migration trong Supabase SQL Editor là xong!
