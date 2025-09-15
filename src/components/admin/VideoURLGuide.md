# Hướng dẫn thêm Video URLs trong Admin Interface

## Cách thêm nhiều video cho flashcard

### 1. Truy cập Admin Interface
1. Đăng nhập với tài khoản admin
2. Vào **Exercise Management**
3. Chọn **Tạo mới** hoặc **Chỉnh sửa** một flashcard exercise

### 2. Thêm Video URLs cho Card

#### Bước 1: Tạo/Chỉnh sửa Card
- Trong phần **Flashcard Cards**, click **+ Thêm Card** để tạo card mới
- Hoặc chỉnh sửa card hiện có

#### Bước 2: Thêm Video URLs
1. **Tìm phần "Video URLs (hiển thị khi flip)"**
2. **Thêm video URL đầu tiên:**
   - Nhập URL video vào ô input đầu tiên
   - Ví dụ: `https://example.com/video1.mp4`
   - Video preview sẽ hiển thị ngay bên dưới

3. **Thêm video URL thứ hai:**
   - Click nút **"+ Thêm Video URL"**
   - Nhập URL video thứ hai
   - Ví dụ: `https://example.com/video2.mp4`

4. **Thêm nhiều video hơn:**
   - Tiếp tục click **"+ Thêm Video URL"** để thêm video
   - Mỗi video sẽ có preview riêng

#### Bước 3: Quản lý Video URLs
- **Xóa video:** Click nút **✕** bên cạnh video URL muốn xóa
- **Sửa video:** Chỉnh sửa trực tiếp trong ô input
- **Preview video:** Video sẽ tự động preview khi có URL hợp lệ

### 3. Chuyển đổi từ định dạng cũ

Nếu card đang sử dụng `videoUrl` (định dạng cũ):
1. Sẽ thấy thông báo màu vàng
2. Click **"Chuyển sang videoUrls"**
3. Video cũ sẽ được chuyển sang định dạng mới
4. Có thể thêm video mới sau đó

### 4. Lưu và Test

1. **Lưu exercise:** Click **"Tạo mới"** hoặc **"Cập nhật"**
2. **Test trong app:** Vào study mode để xem video hoạt động
3. **Kiểm tra navigation:** Video sẽ có nút Previous/Next và thumbnail strip

## Ví dụ cấu trúc dữ liệu

### Card với nhiều video:
```json
{
  "id": "card1",
  "front": "Cat",
  "back": "Con mèo",
  "image": "/images/cat.jpg",
  "videoUrls": [
    "https://example.com/cat1.mp4",
    "https://example.com/cat2.mp4",
    "https://example.com/cat3.mp4"
  ]
}
```

### Card với một video:
```json
{
  "id": "card2",
  "front": "Dog",
  "back": "Con chó",
  "image": "/images/dog.jpg",
  "videoUrls": [
    "https://example.com/dog.mp4"
  ]
}
```

## Lưu ý quan trọng

1. **Định dạng URL:** Sử dụng URL đầy đủ (https://) hoặc đường dẫn tương đối (/videos/)
2. **Định dạng video:** Hỗ trợ MP4, WebM, OGG
3. **Kích thước:** Video nên được tối ưu cho web
4. **Tương thích:** Test trên nhiều trình duyệt khác nhau
5. **Fallback:** Nếu video không load, sẽ hiển thị hình ảnh thay thế

## Troubleshooting

### Video không hiển thị:
- Kiểm tra URL có đúng không
- Kiểm tra video có tồn tại không
- Kiểm tra CORS policy nếu video từ domain khác

### Video không autoplay:
- Một số trình duyệt chặn autoplay
- Cần user interaction trước khi autoplay

### Thumbnail không tạo được:
- Video cần có metadata
- Có thể do CORS hoặc video format không hỗ trợ
