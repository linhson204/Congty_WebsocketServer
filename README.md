# WebSocket Server - Post Sharing System

Hệ thống chia sẻ bài post giữa hai bên A và B thông qua WebSocket real-time.

## 🎯 Tính năng

### 📤 Bên A (Gửi Post):
- ✅ Đăng bài post với nội dung rich text
- ✅ Đính kèm multiple files (ảnh, video, tài liệu)
- ✅ Phân loại post theo danh mục
- ✅ Đánh dấu mức độ ưu tiên (khẩn cấp, bình thường)
- ✅ Theo dõi thống kê posts đã gửi
- ✅ Drag & drop file upload

### 📥 Bên B (Nhận Post):
- ✅ Nhận post real-time từ bên A
- ✅ Hiển thị post với UI đẹp mắt
- ✅ Lọc post theo danh mục
- ✅ Tìm kiếm trong nội dung post
- ✅ Thông báo desktop khi có post mới
- ✅ Phản hồi và tương tác với post
- ✅ Quản lý trạng thái đã đọc/chưa đọc

### 🖥️ Server:
- ✅ Phân biệt role A và B
- ✅ Routing tin nhắn theo role
- ✅ Thống kê client theo role
- ✅ Xử lý lỗi gracefully
- ✅ Auto-generate ID cho post và client

## 🚀 Cài đặt và Chạy

### 1. Cài đặt dependencies:
```bash
npm install
```

### 2. Khởi động server:
```bash
npm start
```
Server sẽ chạy tại: `ws://localhost:3001`

### 3. Mở clients:
- **Bên A**: Mở `client-A.html` trong trình duyệt → **Tự động kết nối**
- **Bên B**: Mở `client-B.html` trong trình duyệt → **Tự động kết nối**

**🔄 Auto-Connect Features:**
- Tự động kết nối khi trang load (sau 500ms)
- Auto-reconnect khi mất kết nối (5 lần thử với exponential backoff)
- Thông báo trạng thái kết nối chi tiết

## 📋 Hướng dẫn sử dụng

### Bước 1: Khởi động
1. Khởi động server: `npm start`
2. Mở `client-A.html` → **Tự động kết nối trong 0.5s**
3. Mở `client-B.html` → **Tự động kết nối trong 0.5s**

### Bước 2: Gửi Post (Bên A)
1. Nhập tên tác giả
2. Viết nội dung post
3. Chọn danh mục (Tổng quát, Tin tức, Khẩn cấp, v.v.)
4. Đính kèm file (tùy chọn) - drag & drop hoặc click chọn
5. Nhấn "Gửi Post đến Bên B"

### Bước 3: Nhận Post (Bên B)
1. Post sẽ hiện ngay lập tức
2. Có thể lọc theo danh mục
3. Tìm kiếm trong nội dung
4. Tương tác: đánh dấu đã đọc, phản hồi, xóa

**🔧 Troubleshooting:**
- Nếu không kết nối được, client sẽ tự retry 5 lần
- Nếu server restart, client sẽ tự động kết nối lại
- Có thể bấm "Ngắt kết nối" để tắt auto-reconnect

## 🔧 Cấu trúc Tin nhắn

### Đăng ký Client:
```json
{
  "type": "register",
  "role": "A", // hoặc "B"
  "clientId": "clientA_1234567890"
}
```

### Gửi Post (từ A):
```json
{
  "type": "post",
  "content": "Nội dung bài post...",
  "authorName": "Tên tác giả",
  "authorId": "client_abc123",
  "attachments": [
    {
      "name": "file.pdf",
      "size": 1024000,
      "type": "application/pdf",
      "url": "mock://file/file.pdf"
    }
  ],
  "metadata": {
    "category": "news",
    "priority": "high",
    "source": "WebClient_A"
  }
}
```

### Nhận Post (đến B):
```json
{
  "type": "new_post",
  "postId": "post_xyz789_1234567890",
  "content": "Nội dung bài post...",
  "authorName": "Tên tác giả",
  "authorId": "client_abc123",
  "attachments": [...],
  "timestamp": "2025-07-20T10:30:00.000Z",
  "metadata": {...}
}
```

## 📁 Cấu trúc Files

```
WebSocketServer/
├── server.js              # WebSocket server chính
├── client-A.html          # Client cho bên A (gửi post)
├── client-B.html          # Client cho bên B (nhận post)
├── client.html            # Client chat cơ bản (demo)
├── test-client.html       # Client test đơn giản
├── package.json           # Dependencies
└── README.md             # Hướng dẫn này
```

## 🎨 Screenshots

### Bên A - Gửi Post:
- Form tạo post với editor rich text
- Upload multiple files với drag & drop
- Chọn danh mục và priority
- Thống kê posts đã gửi

### Bên B - Nhận Post:
- Hiển thị posts real-time với animation
- Filter và search functionality
- Post actions (đánh dấu đã đọc, phản hồi, xóa)
- Desktop notifications

## 🚀 Mở rộng

### Có thể thêm:
- **Authentication**: Đăng nhập user
- **Database**: Lưu trữ posts và users
- **Rooms**: Tạo nhiều kênh chat riêng
- **File Upload**: Upload file thật lên server
- **Rich Text Editor**: WYSIWYG editor
- **Admin Panel**: Quản lý users và posts
- **Mobile App**: React Native / Flutter
- **Push Notifications**: Firebase/OneSignal

### Deploy Production:
- **Heroku**: `git push heroku main`
- **AWS**: EC2 + Load Balancer
- **Docker**: Containerize application
- **HTTPS/WSS**: SSL certificates

## 🐛 Xử lý lỗi

### Port đã được sử dụng:
```bash
# Thay đổi port trong server.js
const PORT = process.env.PORT || 3002;
```

### Không kết nối được:
- Kiểm tra server đã khởi động
- Kiểm tra firewall
- Thử port khác

### File không upload được:
- Đây là demo, chỉ hiển thị thông tin file
- Để upload thật cần implement file upload endpoint

## 📞 Demo Test

1. Mở 2 tab: một `client-A.html`, một `client-B.html`
2. Kết nối cả hai
3. Gửi post từ A → thấy ngay ở B
4. Mở nhiều tab B để test broadcast
5. Test các tính năng filter, search, actions
