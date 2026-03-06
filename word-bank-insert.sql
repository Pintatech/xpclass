-- Insert word bank entries into Supabase words table
-- All words with proper Vietnamese diacritics
-- Levels: 1 (beginner) → 4 (advanced)

INSERT INTO words (word, hint, difficulty, min_level, is_active) VALUES
-- Transport
('taxi', 'Xe taxi', 'easy', 1, true),
('bicycle', 'Xe đạp', 'easy', 1, true),
('motorcycle', 'Xe máy', 'easy', 2, true),
('tractor', 'Máy kéo', 'easy', 2, true),
('subway', 'Tàu điện ngầm', 'medium', 3, true),
('ambulance', 'Xe cứu thương', 'medium', 3, true),
('canoe', 'Thuyền độc mộc', 'medium', 3, true),
('helicopter', 'Trực thăng', 'medium', 4, true),

-- Furniture
('desk', 'Bàn làm việc', 'easy', 1, true),
('shelf', 'Kệ / Giá', 'easy', 1, true),
('couch', 'Ghế dài', 'easy', 1, true),
('drawer', 'Ngăn kéo', 'easy', 2, true),
('curtain', 'Rèm cửa', 'easy', 2, true),
('stool', 'Ghế đẩu', 'easy', 2, true),
('mattress', 'Nệm', 'easy', 3, true),
('bookcase', 'Tủ sách', 'easy', 3, true),
('cushion', 'Gối đệm', 'easy', 3, true),
('wardrobe', 'Tủ quần áo', 'medium', 4, true),

-- Weather
('rainy', 'Có mưa', 'easy', 1, true),
('windy', 'Có gió', 'easy', 1, true),
('foggy', 'Có sương mù', 'easy', 2, true),
('typhoon', 'Bão', 'easy', 2, true),
('humid', 'Ẩm ướt', 'easy', 3, true),
('breeze', 'Gió nhẹ', 'easy', 3, true),
('lightning', 'Tia chớp', 'medium', 4, true),
('drought', 'Hạn hán', 'medium', 4, true),

-- Numbers & Math
('zero', 'Số không', 'easy', 1, true),
('half', 'Một nửa', 'easy', 1, true),
('double', 'Gấp đôi', 'easy', 1, true),
('hundred', 'Một trăm', 'easy', 2, true),
('thousand', 'Một ngàn', 'easy', 2, true),
('minus', 'Trừ', 'easy', 2, true),
('dozen', 'Tá (12)', 'easy', 3, true),
('total', 'Tổng cộng', 'easy', 3, true),
('million', 'Một triệu', 'easy', 3, true),
('equal', 'Bằng nhau', 'easy', 4, true),

-- Shapes
('star', 'Hình ngôi sao', 'easy', 1, true),
('cross', 'Hình chữ thập', 'easy', 1, true),
('arrow', 'Hình mũi tên', 'easy', 2, true),
('oval', 'Hình bầu dục', 'easy', 2, true),
('cone', 'Hình nón', 'easy', 3, true),
('sphere', 'Hình cầu', 'easy', 3, true),
('cylinder', 'Hình trụ', 'medium', 4, true),
('pyramid', 'Hình chóp', 'medium', 4, true),

-- Music & Instruments
('flute', 'Sáo / Ống sáo', 'easy', 1, true),
('melody', 'Giai điệu', 'easy', 2, true),
('lyrics', 'Lời bài hát', 'easy', 2, true),
('harmony', 'Hòa âm', 'easy', 3, true),
('violin', 'Đàn vi cầm', 'medium', 3, true),
('trumpet', 'Kèn trumpet', 'medium', 4, true),

-- Holidays & Festivals
('balloon', 'Bóng bay', 'easy', 1, true),
('costume', 'Trang phục', 'easy', 1, true),
('festival', 'Lễ hội', 'easy', 2, true),
('parade', 'Diễu hành', 'easy', 2, true),
('lantern', 'Đèn lồng', 'easy', 2, true),
('ribbon', 'Dải ruy băng', 'easy', 3, true),
('carnival', 'Hội chợ', 'easy', 3, true),
('christmas', 'Lễ Giáng Sinh', 'medium', 3, true),
('halloween', 'Lễ Halloween', 'medium', 4, true),
('easter', 'Lễ Phục Sinh', 'medium', 4, true),

-- Ocean & Sea Life
('diver', 'Thợ lặn', 'easy', 1, true),
('clam', 'Con ngao', 'easy', 1, true),
('squid', 'Con mực', 'easy', 2, true),
('seahorse', 'Cá ngựa', 'easy', 2, true),
('seaweed', 'Rong biển', 'easy', 2, true),
('iceberg', 'Tảng băng', 'easy', 3, true),
('tide', 'Thủy triều', 'easy', 3, true),
('lighthouse', 'Ngọn hải đăng', 'medium', 4, true),
('submarine', 'Tàu ngầm', 'medium', 4, true),

-- Insects
('beetle', 'Bọ cánh cứng', 'easy', 1, true),
('mosquito', 'Con muỗi', 'easy', 1, true),
('ladybug', 'Bọ rùa', 'easy', 2, true),
('firefly', 'Đom đóm', 'easy', 2, true),
('cricket', 'Con dế', 'easy', 3, true),
('cockroach', 'Con gián', 'easy', 3, true),
('grasshopper', 'Châu chấu', 'medium', 4, true),
('caterpillar', 'Sâu bướm', 'medium', 4, true),

-- Kitchen
('freezer', 'Tủ đông đá', 'easy', 1, true),
('chopstick', 'Đũa (ăn)', 'easy', 2, true),
('blender', 'Máy xay sinh tố', 'easy', 2, true),
('apron', 'Tạp dề', 'easy', 3, true),
('toaster', 'Máy nướng bánh mì', 'medium', 3, true),
('microwave', 'Lò vi sóng', 'medium', 4, true),

-- Emotions
('excited', 'Hào hứng', 'easy', 1, true),
('lonely', 'Cô đơn', 'easy', 1, true),
('proud', 'Tự hào', 'easy', 1, true),
('nervous', 'Lo lắng', 'easy', 2, true),
('curious', 'Tò mò', 'easy', 2, true),
('confused', 'Bối rối', 'easy', 2, true),
('cheerful', 'Vui tươi', 'easy', 3, true),
('jealous', 'Ghen tị', 'easy', 3, true),
('grateful', 'Biết ơn', 'easy', 4, true),
('grumpy', 'Cáu kỉnh', 'easy', 4, true),

-- Greetings & Phrases
('hello', 'Xin chào', 'easy', 1, true),
('goodbye', 'Tạm biệt', 'easy', 1, true),
('please', 'Làm ơn', 'easy', 1, true),
('sorry', 'Xin lỗi', 'easy', 1, true),
('thanks', 'Cảm ơn', 'easy', 1, true),
('welcome', 'Chào mừng', 'easy', 2, true),
('excuse', 'Xin phép', 'easy', 2, true),
('cheers', 'Chúc mừng', 'easy', 3, true),
('congrats', 'Xin chúc mừng', 'easy', 3, true),
('farewell', 'Chia tay', 'easy', 4, true)
ON CONFLICT (word) DO UPDATE SET hint = EXCLUDED.hint, is_active = true;
