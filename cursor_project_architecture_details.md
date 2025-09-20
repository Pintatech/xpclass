# Project architecture details
_Exported on 8/29/2025 at 09:28:35 GMT+7 from Cursor (1.5.7)_

------

**Cursor**

Tôi sẽ phân tích kiến trúc của dự án này bằng cách đọc các file quan trọng để hiểu rõ cấu trúc và công nghệ được sử dụng.

Bây giờ tôi sẽ đọc thêm một số file quan trọng để hiểu rõ hơn về kiến trúc database và authentication:

Tôi sẽ tạo biểu đồ kiến trúc để thể hiện cấu trúc dự án một cách trực quan:

## Kiến trúc dự án MomTek - Nền tảng học ngôn ngữ

Dựa trên việc phân tích mã nguồn, đây là kiến trúc chi tiết của dự án **MomTek**:

### 🏗️ **Tổng quan kiến trúc**

**MomTek** là một ứng dụng web học ngôn ngữ được xây dựng với kiến trúc **Single Page Application (SPA)** hiện đại, tập trung vào việc học phát âm và từ vựng thông qua các bài tập tương tác.

### 🛠️ **Tech Stack chính**

#### **Frontend Framework:**
- **React 19.1.0** - UI framework chính
- **React Router DOM 7.6.3** - Định tuyến client-side
- **Vite 7.0.4** - Build tool và dev server
- **Tailwind CSS 3.4.0** - Utility-first CSS framework

#### **Backend & Database:**
- **Supabase** - Backend-as-a-Service
  - Authentication service
  - PostgreSQL database
  - Real-time subscriptions
  - Row Level Security (RLS)

#### **Development Tools:**
- **ESLint** - Code linting
- **PostCSS & Autoprefixer** - CSS processing
- **Lucide React** - Icon library

### 📁 **Cấu trúc thư mục**

```
src/
├── components/           # React components
│   ├── auth/            # Đăng nhập/đăng ký
│   ├── dashboard/       # Trang chủ
│   ├── study/           # Module học tập
│   ├── exercises/       # Các bài tập tương tác
│   ├── admin/           # Quản trị hệ thống
│   ├── leaderboard/     # Bảng xếp hạng
│   ├── progress/        # Theo dõi tiến độ
│   ├── support/         # Hỗ trợ khách hàng
│   ├── navigation/      # Điều hướng
│   └── ui/              # UI components tái sử dụng
├── hooks/               # Custom React hooks
├── supabase/           # Cấu hình & database functions
├── utils/              # Utility functions
└── firebase/           # Legacy Firebase code
```

### 🔐 **Hệ thống Authentication**

- **Supabase Auth** làm nhà cung cấp chính
- **Session persistence** với localStorage
- **Auto-refresh tokens**
- **Role-based access control** (User/Admin)
- **Custom user profiles** trong database

### 🎯 **Core Features**

#### **1. Study Module (Học tập)**
- **Flashcard exercises** - Học từ vựng
- **Pronunciation exercises** - Luyện phát âm
- **Audio pronunciation flashcards** - Flashcard có âm thanh
- **Song exercises** - Học qua bài hát
- **Video exercises** - Học qua video
- **Snake & Ladder games** - Game giáo dục
- **Two-player competitive modes** - Chế độ thi đấu

#### **2. Progress Tracking (Theo dõi tiến độ)**
- **Level system** - Hệ thống cấp độ
- **XP (Experience Points)** - Điểm kinh nghiệm
- **Streak tracking** - Theo dõi chuỗi ngày học
- **Practice time** - Thời gian luyện tập
- **Achievement badges** - Huy hiệu thành tích

#### **3. Admin Dashboard (Quản trị)**
- **User management** - Quản lý người dùng
- **Batch student creation** - Tạo học viên hàng loạt
- **Support ticket system** - Hệ thống ticket hỗ trợ
- **Migration tools** - Công cụ migration dữ liệu

### 🗂️ **Database Schema**

#### **Core Tables:**
- **users** - Thông tin người dùng
- **lessons** - Bài học
- **sections** - Phần của bài học
- **exercises** - Bài tập
- **user_progress** - Tiến độ học tập
- **support_tickets** - Ticket hỗ trợ

### 🎨 **UI/UX Design**

- **Mobile-first responsive design**
- **Bottom navigation** cho mobile
- **Modern card-based layout**
- **Gradient backgrounds**
- **Loading states & error handling**
- **Accessibility considerations**

### 🔄 **State Management**

- **React Context API** - Global state management
- **Custom hooks** - Logic tái sử dụng
- **Local component state** - State cục bộ
- **Supabase real-time subscriptions** - Real-time data

### 🚀 **Deployment & Build**

- **Vite build system** - Fast builds và HMR
- **Environment variables** - Configuration management
- **Static asset optimization**
- **Code splitting** - Lazy loading

### 🔧 **Development Workflow**

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Code linting
npm run preview  # Preview production build
```

### 🎮 **Game-based Learning**

Dự án có tích hợp nhiều yếu tố gamification:
- **Snake & Ladder game** với Materials/dice1-6.gif
- **Two-player competitive modes**
- **Leaderboard system**
- **Achievement system**
- **XP and level progression**

### 🔗 **Routing Architecture**

- **Nested routing** cho study module
- **Protected routes** với authentication
- **Dynamic routes** với parameters
- **URL-based navigation state**

Kiến trúc này cho thấy **MomTek** là một ứng dụng học ngôn ngữ được thiết kế tốt với focus mạnh vào **user experience**, **gamification**, và **scalability** thông qua việc sử dụng các công nghệ web hiện đại.

```plaintext
src/
├── components/           # React components
│   ├── auth/            # Đăng nhập/đăng ký
│   ├── dashboard/       # Trang chủ
│   ├── study/           # Module học tập
│   ├── exercises/       # Các bài tập tương tác
│   ├── admin/           # Quản trị hệ thống
│   ├── leaderboard/     # Bảng xếp hạng
│   ├── progress/        # Theo dõi tiến độ
│   ├── support/         # Hỗ trợ khách hàng
│   ├── navigation/      # Điều hướng
│   └── ui/              # UI components tái sử dụng
├── hooks/               # Custom React hooks
├── supabase/           # Cấu hình & database functions
├── utils/              # Utility functions
└── firebase/           # Legacy Firebase code
```

```shellscript
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Code linting
npm run preview  # Preview production build
```

