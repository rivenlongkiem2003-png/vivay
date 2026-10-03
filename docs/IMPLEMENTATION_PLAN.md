# Kế hoạch triển khai VÍ VAY

## Phạm vi kỹ thuật

Chuyển ứng dụng hiện có từ trang chào mời vay sang công cụ quản lý và tra cứu **hồ sơ khoản vay**. Ứng dụng không đưa ra lời mời vay, phê duyệt, giải ngân hay yêu cầu thanh toán. Nội dung, điều kiện tài chính và thông tin thụ hưởng do chủ dự án chịu trách nhiệm xác nhận trước khi công khai.

## Các bước

1. Lưu bản sao trước thay đổi và audit source/secret hiện tại.
2. Lập tài liệu rủi ro, checklist pháp lý, provenance asset và trách nhiệm chủ dự án.
3. Thay branding VÍ VAY, logo khách hàng cung cấp, metadata và giao diện tra cứu hồ sơ mobile-first.
4. Thay xác thực phía client bằng session HttpOnly phía server; giới hạn tốc độ đăng nhập, CSRF, RBAC và kiểm soát IDOR.
5. Bổ sung các trường hồ sơ do admin quản lý, mã khoản vay tự sinh, access code ngẫu nhiên và audit log.
6. Bỏ thu thập/hiển thị CCCD và chức năng upload QR không cần thiết; giữ dữ liệu legacy nguyên trạng trong DB để tránh mất dữ liệu.
7. Thêm security headers, noindex, allow-list static assets, quản lý secrets và cấu hình Vercel Function an toàn.
8. Chạy unit/API/UI/E2E/responsive/security smoke tests; ghi kết quả thực tế.
9. Không push/deploy production khi chưa có repository/Vercel/Supabase access và các xác nhận của chủ dự án trong checklist pháp lý.

## Nguyên tắc migration

Migration chỉ thêm cột/bảng/index; không drop/reset database và không ghi đè dữ liệu hiện có. Mọi migration production phải được chủ dự án xác nhận backup trước khi chạy.
