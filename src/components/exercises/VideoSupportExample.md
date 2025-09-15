# Hỗ trợ Video Đa dạng trong Flashcard Exercise

## Các định dạng video được hỗ trợ

Flashcard exercise hiện đã hỗ trợ nhiều định dạng video khác nhau:

### 1. Video URLs Array (Định dạng mới - Khuyến nghị)
```json
{
  "id": "card1",
  "front": "Cat",
  "back": "Con mèo",
  "image": "/images/cat.jpg",
  "videoUrls": [
    "/videos/cat1.mp4",
    "/videos/cat2.mp4",
    "/videos/cat3.mp4"
  ]
}
```

### 2. Single Video URL
```json
{
  "id": "card2",
  "front": "Dog",
  "back": "Con chó",
  "image": "/images/dog.jpg",
  "videoUrl": "/videos/dog.mp4"
}
```

### 3. Legacy Video URL
```json
{
  "id": "card3",
  "front": "Bird",
  "back": "Con chim",
  "image": "/images/bird.jpg",
  "video_url": "/videos/bird.mp4"
}
```

### 4. Videos Array (Alternative)
```json
{
  "id": "card4",
  "front": "Fish",
  "back": "Con cá",
  "image": "/images/fish.jpg",
  "videos": [
    "/videos/fish1.mp4",
    "/videos/fish2.mp4"
  ]
}
```

### 5. Video Object with Sources
```json
{
  "id": "card5",
  "front": "Horse",
  "back": "Con ngựa",
  "image": "/images/horse.jpg",
  "video": {
    "sources": [
      "/videos/horse1.mp4",
      "/videos/horse2.mp4",
      "/videos/horse3.mp4"
    ]
  }
}
```

### 6. Video Object with Single URL
```json
{
  "id": "card6",
  "front": "Cow",
  "back": "Con bò",
  "image": "/images/cow.jpg",
  "video": {
    "url": "/videos/cow.mp4"
  }
}
```

## Tính năng mới

### 1. Video Thumbnail Preview
- Tự động tạo thumbnail từ video
- Hiển thị thumbnail strip để điều hướng nhanh
- Fallback icon khi không tạo được thumbnail

### 2. Video Navigation
- Nút Previous/Next video
- Click trực tiếp vào thumbnail để chuyển video
- Video counter hiển thị vị trí hiện tại

### 3. Video Settings
- **Tự động phát**: Video sẽ tự động phát khi load
- **Lặp lại**: Video sẽ lặp lại khi kết thúc
- **Âm lượng**: Điều chỉnh âm lượng từ 0-100%

### 4. Loading States & Error Handling
- Loading spinner khi video đang tải
- Error message khi video không tải được
- Nút "Thử lại" để reload video

### 5. Video Controls
- Video controls mặc định của browser
- Poster image từ thumbnail
- Auto-play next video khi không loop

## Cách sử dụng

1. **Thêm video vào flashcard data** theo một trong các định dạng trên
2. **Video sẽ hiển thị ở mặt sau** của flashcard khi user click flip
3. **Nếu có nhiều video**, user có thể:
   - Click nút Previous/Next
   - Click trực tiếp vào thumbnail
   - Sử dụng video settings để điều chỉnh
4. **Video settings** được lưu trong session và áp dụng cho tất cả video

## Lưu ý

- Video URLs phải bắt đầu với `http`, `/`, hoặc `./`
- Thumbnail generation có thể mất thời gian với video lớn
- Autoplay có thể bị chặn bởi browser policy
- Video sẽ tự động mute khi autoplay để tuân thủ browser policy
