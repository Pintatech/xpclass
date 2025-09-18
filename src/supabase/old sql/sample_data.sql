-- Sample data for MomTek Language Learning App
-- Run this after creating the main schema

-- Insert sample levels
INSERT INTO public.levels (id, title, description, level_number, difficulty_label, color_theme, unlock_requirement) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Cơ bản', 'Học các từ vựng và cấu trúc cơ bản nhất để bắt đầu giao tiếp', 1, 'Beginner', 'green', 0),
('550e8400-e29b-41d4-a716-446655440002', 'Trung cấp', 'Phát triển kỹ năng giao tiếp và hiểu biết sâu hơn', 2, 'Intermediate', 'blue', 500),
('550e8400-e29b-41d4-a716-446655440003', 'Nâng cao', 'Hoàn thiện kỹ năng ngôn ngữ và giao tiếp phức tạp', 3, 'Advanced', 'purple', 1500);

-- Insert sample units for Level 1 (Cơ bản)
INSERT INTO public.units (id, level_id, title, description, unit_number, color_theme, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'Giới thiệu bản thân', 'Học cách chào hỏi và giới thiệu về bản thân', 1, 'green', 45),
('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'Gia đình', 'Từ vựng về gia đình và mối quan hệ', 2, 'green', 60),
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'Số đếm và thời gian', 'Học cách đếm số và nói về thời gian', 3, 'green', 50);

-- Insert sample units for Level 2 (Trung cấp)
INSERT INTO public.units (id, level_id, title, description, unit_number, color_theme, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440002', 'Mua sắm', 'Giao tiếp khi mua sắm và hỏi giá cả', 1, 'blue', 75),
('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440002', 'Du lịch', 'Từ vựng và cụm từ khi đi du lịch', 2, 'blue', 90),
('550e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440002', 'Ăn uống', 'Gọi món và nói về đồ ăn', 3, 'blue', 80);

-- Insert sample sessions for Unit 1.1 (Giới thiệu bản thân)
INSERT INTO public.sessions (id, unit_id, title, description, session_number, session_type, difficulty_level, xp_reward, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440011', 'Chào hỏi cơ bản', 'Học cách chào hỏi trong các tình huống khác nhau', 1, 'vocabulary', 1, 50, 15),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440011', 'Nói về tuổi và quê quán', 'Học cách nói về thông tin cá nhân cơ bản', 2, 'mixed', 2, 60, 20),
('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440011', 'Nghề nghiệp', 'Từ vựng về các nghề nghiệp phổ biến', 3, 'vocabulary', 2, 55, 18);

-- Insert sample sessions for Unit 1.2 (Gia đình)
INSERT INTO public.sessions (id, unit_id, title, description, session_number, session_type, difficulty_level, xp_reward, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440012', 'Thành viên gia đình', 'Từ vựng về các thành viên trong gia đình', 1, 'vocabulary', 1, 50, 15),
('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440012', 'Miêu tả ngoại hình', 'Học cách miêu tả ngoại hình của người khác', 2, 'mixed', 2, 65, 25),
('550e8400-e29b-41d4-a716-446655440043', '550e8400-e29b-41d4-a716-446655440012', 'Hoạt động gia đình', 'Nói về các hoạt động cùng gia đình', 3, 'listening', 3, 70, 22);

-- Insert sample sessions for Unit 2.1 (Mua sắm)
INSERT INTO public.sessions (id, unit_id, title, description, session_number, session_type, difficulty_level, xp_reward, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440021', 'Hỏi giá cả', 'Học cách hỏi và thương lượng giá cả', 1, 'pronunciation', 2, 75, 20),
('550e8400-e29b-41d4-a716-446655440052', '550e8400-e29b-41d4-a716-446655440021', 'Các loại cửa hàng', 'Từ vựng về các loại cửa hàng và sản phẩm', 2, 'vocabulary', 2, 60, 18),
('550e8400-e29b-41d4-a716-446655440053', '550e8400-e29b-41d4-a716-446655440021', 'Thanh toán', 'Giao tiếp khi thanh toán và nhận hóa đơn', 3, 'mixed', 3, 80, 25);

-- Insert sample exercises for Session 1.1.1 (Chào hỏi cơ bản)
INSERT INTO public.exercises (id, session_id, title, exercise_type, content, difficulty_level, xp_reward, order_index, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440031', 'Flashcard Chào hỏi', 'flashcard', 
'{"cards": [
  {"front": "Hello", "back": "Xin chào", "pronunciation": "/həˈloʊ/", "example": "Hello, how are you?"},
  {"front": "Good morning", "back": "Chào buổi sáng", "pronunciation": "/ɡʊd ˈmɔːrnɪŋ/", "example": "Good morning, teacher!"},
  {"front": "Good afternoon", "back": "Chào buổi chiều", "pronunciation": "/ɡʊd ˌæftərˈnuːn/", "example": "Good afternoon, everyone!"},
  {"front": "Good evening", "back": "Chào buổi tối", "pronunciation": "/ɡʊd ˈiːvnɪŋ/", "example": "Good evening, sir!"},
  {"front": "Goodbye", "back": "Tạm biệt", "pronunciation": "/ɡʊdˈbaɪ/", "example": "Goodbye, see you tomorrow!"}
]}', 1, 10, 1, 5),

('550e8400-e29b-41d4-a716-446655440062', '550e8400-e29b-41d4-a716-446655440031', 'Luyện phát âm chào hỏi', 'pronunciation', 
'{"words": [
  {"text": "Hello", "pronunciation": "/həˈloʊ/", "audio_url": null},
  {"text": "Hi", "pronunciation": "/haɪ/", "audio_url": null},
  {"text": "Good morning", "pronunciation": "/ɡʊd ˈmɔːrnɪŋ/", "audio_url": null},
  {"text": "How are you?", "pronunciation": "/haʊ ɑːr juː/", "audio_url": null}
]}', 2, 15, 2, 8),

('550e8400-e29b-41d4-a716-446655440063', '550e8400-e29b-41d4-a716-446655440031', 'Flashcard Chào hỏi 2', 'flashcard', 
'{"cards": [
  {"front": "Xin chào", "back": "Hello", "pronunciation": "/həˈloʊ/", "example": "Xin chào, tôi là Nam."},
  {"front": "Chào buổi sáng", "back": "Good morning", "pronunciation": "/ɡʊd ˈmɔːrnɪŋ/", "example": "Chào buổi sáng, bà ngoại!"},
  {"front": "Bạn có khỏe không?", "back": "How are you?", "pronunciation": "/haʊ ɑːr juː/", "example": "Bạn có khỏe không? Tôi khỏe, cảm ơn."}
]}', 1, 20, 3, 10);

-- Insert sample exercises for Session 1.1.2 (Nói về tuổi và quê quán)
INSERT INTO public.exercises (id, session_id, title, exercise_type, content, difficulty_level, xp_reward, order_index, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440071', '550e8400-e29b-41d4-a716-446655440032', 'Flashcard Tuổi tác', 'flashcard',
'{"cards": [
  {"front": "How old are you?", "back": "Bạn bao nhiêu tuổi?", "pronunciation": "/haʊ oʊld ɑːr juː/", "example": "How old are you? I am 25 years old."},
  {"front": "I am ... years old", "back": "Tôi ... tuổi", "pronunciation": "/aɪ æm ... jɪrz oʊld/", "example": "I am twenty-five years old."},
  {"front": "Where are you from?", "back": "Bạn đến từ đâu?", "pronunciation": "/wer ɑːr juː frʌm/", "example": "Where are you from? I am from Vietnam."},
  {"front": "I am from...", "back": "Tôi đến từ...", "pronunciation": "/aɪ æm frʌm/", "example": "I am from Ho Chi Minh City."}
]}', 2, 12, 1, 6),

('550e8400-e29b-41d4-a716-446655440072', '550e8400-e29b-41d4-a716-446655440032', 'Audio Flashcard Quê quán', 'audio_flashcard',
'{"cards": [
  {"text": "Vietnam", "pronunciation": "/ˌviɛtˈnɑm/", "meaning": "Việt Nam", "audio_url": null},
  {"text": "Ho Chi Minh City", "pronunciation": "/hoʊ tʃi mɪn ˈsɪti/", "meaning": "Thành phố Hồ Chí Minh", "audio_url": null},
  {"text": "Hanoi", "pronunciation": "/hæˈnɔɪ/", "meaning": "Hà Nội", "audio_url": null},
  {"text": "Da Nang", "pronunciation": "/da næŋ/", "meaning": "Đà Nẵng", "audio_url": null}
]}', 2, 15, 2, 8);

-- Insert sample exercises for Session 1.2.1 (Thành viên gia đình)
INSERT INTO public.exercises (id, session_id, title, exercise_type, content, difficulty_level, xp_reward, order_index, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440081', '550e8400-e29b-41d4-a716-446655440041', 'Flashcard Gia đình', 'flashcard',
'{"cards": [
  {"front": "Father", "back": "Bố", "pronunciation": "/ˈfɑðər/", "example": "My father is a teacher."},
  {"front": "Mother", "back": "Mẹ", "pronunciation": "/ˈmʌðər/", "example": "My mother is very kind."},
  {"front": "Brother", "back": "Anh/Em trai", "pronunciation": "/ˈbrʌðər/", "example": "I have one younger brother."},
  {"front": "Sister", "back": "Chị/Em gái", "pronunciation": "/ˈsɪstər/", "example": "My sister loves music."},
  {"front": "Grandmother", "back": "Bà", "pronunciation": "/ˈɡrænˌmʌðər/", "example": "My grandmother tells great stories."}
]}', 1, 10, 1, 5),

('550e8400-e29b-41d4-a716-446655440082', '550e8400-e29b-41d4-a716-446655440041', 'Bài hát gia đình', 'flashcard',
'{"song_title": "Family Song", "lyrics": [
  {"line": "Father, mother, sister, brother", "translation": "Bố, mẹ, chị/em gái, anh/em trai"},
  {"line": "Hand in hand with one another", "translation": "Nắm tay nhau cùng nhau"},
  {"line": "We are family, we are one", "translation": "Chúng ta là gia đình, chúng ta là một"},
  {"line": "Together we have so much fun", "translation": "Cùng nhau chúng ta có nhiều niềm vui"}
], "audio_url": null}', 1, 20, 2, 10);

-- Insert sample exercises for Session 2.1.1 (Hỏi giá cả)
INSERT INTO public.exercises (id, session_id, title, exercise_type, content, difficulty_level, xp_reward, order_index, estimated_duration) VALUES
('550e8400-e29b-41d4-a716-446655440091', '550e8400-e29b-41d4-a716-446655440051', 'Video Mua sắm', 'video',
'{"video_title": "Shopping Conversation", "video_url": null, "duration": 180, "subtitles": [
  {"time": 0, "text": "Excuse me, how much is this shirt?", "translation": "Xin lỗi, cái áo này giá bao nhiêu?"},
  {"time": 3, "text": "This shirt costs 25 dollars.", "translation": "Cái áo này giá 25 đô la."},
  {"time": 6, "text": "Can you give me a discount?", "translation": "Bạn có thể giảm giá cho tôi không?"},
  {"time": 9, "text": "I can give you 20 dollars.", "translation": "Tôi có thể bán cho bạn 20 đô la."}
], "questions": [
  {"question": "How much does the shirt cost originally?", "options": ["20 dollars", "25 dollars", "30 dollars", "15 dollars"], "correct": 1}
]}', 3, 25, 1, 12),

('550e8400-e29b-41d4-a716-446655440092', '550e8400-e29b-41d4-a716-446655440051', 'Flashcard Mua sắm 2', 'flashcard',
'{"cards": [
  {"front": "How much?", "back": "Bao nhiêu tiền?", "pronunciation": "/haʊ mʌtʃ/", "example": "How much does this cost?"},
  {"front": "Discount", "back": "Giảm giá", "pronunciation": "/ˈdɪskaʊnt/", "example": "I got a 20% discount."},
  {"front": "Clothing store", "back": "Cửa hàng quần áo", "pronunciation": "/ˈkloʊðɪŋ stɔːr/", "example": "I bought this at the clothing store."}
]}', 2, 30, 2, 15);

-- Create some initial progress records for users
-- Note: These will need actual user IDs after users sign up

-- Sample achievements
INSERT INTO public.achievements (id, title, description, icon, criteria, xp_reward, badge_color) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'First Steps', 'Hoàn thành exercise đầu tiên', '🎯', '{"type": "exercise_completed", "count": 1}', 50, 'green'),
('660e8400-e29b-41d4-a716-446655440002', 'Learning Streak', 'Học 3 ngày liên tiếp', '🔥', '{"type": "daily_streak", "count": 3}', 100, 'orange'),
('660e8400-e29b-41d4-a716-446655440003', 'Pronunciation Master', 'Hoàn thành 10 bài phát âm', '🎤', '{"type": "pronunciation_completed", "count": 10}', 200, 'red'),
('660e8400-e29b-41d4-a716-446655440004', 'Vocabulary Builder', 'Học 50 từ vựng mới', '📚', '{"type": "vocabulary_learned", "count": 50}', 150, 'blue'),
('660e8400-e29b-41d4-a716-446655440005', 'Level Complete', 'Hoàn thành một level', '🏆', '{"type": "level_completed", "count": 1}', 500, 'gold');
