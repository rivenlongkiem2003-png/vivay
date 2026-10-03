# Vercel + Supabase deployment

Trạng thái: cấu hình đã sẵn sàng; public production vẫn bị khóa cho đến khi hoàn tất `LEGAL_DEPLOYMENT_CHECKLIST.md`.

## Kiến trúc

Vercel phục vụ cả giao diện và API qua `index.js` (Express Function). Supabase chỉ cung cấp PostgreSQL; không đưa Supabase service-role key hoặc database URL ra trình duyệt.

## 1. Tạo database Supabase

1. Tạo một project Supabase.
2. Mở **Connect → Session pooler** và sao chép connection string cổng `5432` cho `DATABASE_URL`. Session pooler tương thích với Prisma migrations và tránh kết nối IPv6 trực tiếp trên các gói không có IPv4.
3. Thay phần `[YOUR-PASSWORD]` bằng database password của project. Không commit chuỗi này.

## 2. Chạy migration

Đặt tạm `DATABASE_URL` trong file `.env` local (file này đã bị ignore), sau đó chạy:

```powershell
npm ci
npx prisma migrate deploy
```

Không chạy `prisma migrate reset` trên project Supabase có dữ liệu.

## 3. Liên kết GitHub với Vercel

1. Vào Vercel → **Add New Project** → import `y038910080827-commits/vivay`.
2. Framework chọn **Other**, Build Command để `npm run build`, Output Directory để trống.
3. Vercel sẽ nhận `vercel.json`, build root `index.js` thành Express Function và tự deploy mỗi lần push vào `main`.

## 4. Environment Variables trên Vercel

Đặt cho **Production** và Preview phù hợp:

| Tên | Giá trị |
| --- | --- |
| `DATABASE_URL` | Supabase Session pooler connection string |
| `DATABASE_SSL` | `true` |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 bytes |
| `DB_POOL_MAX` | `3` |
| `BOOTSTRAP_ADMIN_USERNAME` | Tài khoản admin khởi tạo một lần |
| `BOOTSTRAP_ADMIN_PASSWORD` | Mật khẩu mạnh khởi tạo một lần |
| `OWNER_PRODUCTION_APPROVED` | `false` cho đến khi checklist pháp lý hoàn tất |
| `PUBLIC_ORIGIN` | Để trống ở lần deploy đầu; điền HTTPS domain sau khi gắn custom domain |

Không cần `SUPABASE_ANON_KEY` hoặc `SUPABASE_SERVICE_ROLE_KEY` cho backend này. Không đặt chúng trong `NEXT_PUBLIC_*` hay bất kỳ biến frontend nào.

## 5. Deploy và kiểm tra

Sau khi đủ biến môi trường, Vercel sẽ tự build từ commit trên GitHub. Kiểm tra:

- `GET /health` trả `{"status":"ok"}`.
- Đăng nhập admin và tạo một hồ sơ demo không chứa dữ liệu thật.
- Đăng nhập customer bằng loan code và access code được chuyển qua kênh riêng tư.
- Kiểm tra log Vercel và Supabase trước khi mở public.

Sau lần bootstrap admin thành công, xoá `BOOTSTRAP_ADMIN_USERNAME` và `BOOTSTRAP_ADMIN_PASSWORD` khỏi Vercel rồi redeploy. Giữ `OWNER_PRODUCTION_APPROVED=false` cho đến khi chủ dự án có phê duyệt bằng văn bản và hoàn tất checklist pháp lý.
