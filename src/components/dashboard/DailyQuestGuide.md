# Hướng dẫn Daily Quest System

## Tổng quan
Hệ thống Daily Quest cho phép học sinh nhận một bài tập hàng ngày để kiếm XP. Quest sẽ được làm mới mỗi ngày lúc 00:00.

## Tính năng chính

### 1. Quest Hàng Ngày
- Mỗi ngày, học sinh sẽ nhận được 1 quest duy nhất
- Quest bắt đầu từ Level 1, Unit 1, Session 1, Exercise 1
- Nếu không có đủ dữ liệu, hệ thống sẽ random một exercise bất kỳ
- Quest có thời hạn 1 ngày (từ 00:00 đến 23:49)

### 2. Trạng thái Quest
- **Available**: Quest sẵn sàng để thực hiện
- **Completed**: Quest đã hoàn thành, chờ nhận thưởng
- **Claimed**: Quest đã nhận thưởng

### 3. Phần thưởng XP
- Mỗi quest hoàn thành sẽ nhận được 50 XP
- XP được cộng vào tài khoản ngay khi nhận thưởng
- Chỉ có thể nhận thưởng 1 lần cho mỗi quest

## Cách sử dụng

### 1. Xem Quest
- Truy cập Dashboard để xem quest hàng ngày
- Quest hiển thị thông tin: Level, Unit, Session, Exercise
- Hiển thị trạng thái hiện tại và phần thưởng XP

### 2. Thực hiện Quest
- Nhấn nút "Bắt đầu Quest" để chuyển đến bài tập
- Hoàn thành bài tập như bình thường
- Hệ thống tự động cập nhật trạng thái quest khi hoàn thành

### 3. Nhận thưởng
- Sau khi hoàn thành quest, nhấn nút "Nhận Thưởng"
- XP sẽ được cộng vào tài khoản
- Quest sẽ chuyển sang trạng thái "Đã nhận thưởng"

## Cấu trúc Database

### Bảng daily_quests
```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users)
- quest_date: Date (Ngày của quest)
- level_id: UUID (Foreign Key to levels)
- unit_id: UUID (Foreign Key to units)
- session_id: UUID (Foreign Key to sessions)
- exercise_id: UUID (Foreign Key to exercises)
- status: Text (available/completed/claimed)
- xp_reward: Integer (Phần thưởng XP)
```

### Bảng daily_quest_progress
```sql
- id: UUID (Primary Key)
- daily_quest_id: UUID (Foreign Key to daily_quests)
- user_id: UUID (Foreign Key to users)
- exercise_progress_id: UUID (Foreign Key to user_progress)
- completed_at: Timestamp
- xp_earned: Integer
```

## Functions Database

### 1. create_daily_quest(user_uuid, quest_date)
- Tạo quest mới cho user trong ngày chỉ định
- Tự động chọn exercise từ Level 1, Unit 1, Session 1, Exercise 1
- Trả về ID của quest được tạo

### 2. complete_daily_quest(quest_uuid)
- Đánh dấu quest là hoàn thành
- Cập nhật XP cho user
- Trả về thông tin XP đã nhận

### 3. claim_daily_quest_reward(quest_uuid)
- Nhận thưởng XP cho quest đã hoàn thành
- Chuyển trạng thái quest thành "claimed"

### 4. get_today_daily_quest(user_uuid)
- Lấy quest của ngày hôm nay cho user
- Tự động tạo quest mới nếu chưa có
- Trả về thông tin đầy đủ của quest

## Cài đặt

### 1. Chạy SQL Migration
```sql
-- Chạy file add_daily_quest_system.sql trong Supabase
```

### 2. Import Component
```jsx
import DailyQuest from './components/dashboard/DailyQuest'
```

### 3. Sử dụng trong Dashboard
```jsx
<DailyQuest />
```

## Lưu ý quan trọng

1. **Thời gian**: Quest được làm mới theo múi giờ UTC, cần điều chỉnh cho múi giờ Việt Nam
2. **Performance**: Hệ thống tự động tối ưu để tránh tạo quest trùng lặp
3. **Error Handling**: Có xử lý lỗi đầy đủ cho các trường hợp edge case
4. **Security**: Sử dụng RLS để đảm bảo user chỉ truy cập quest của mình

## Troubleshooting

### Quest không hiển thị
- Kiểm tra user đã đăng nhập chưa
- Kiểm tra database connection
- Xem console log để debug

### Không nhận được XP
- Kiểm tra quest đã hoàn thành chưa
- Kiểm tra trạng thái quest
- Xem log trong database

### Quest không cập nhật
- Kiểm tra function completeExerciseWithXP có gọi checkDailyQuestCompletion
- Kiểm tra exercise_id có khớp với quest không


