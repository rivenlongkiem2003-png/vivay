# VÍ VAY — quản lý hồ sơ khoản vay

Ứng dụng này là cổng quản lý và tra cứu hồ sơ có kiểm soát truy cập. Nó không nhận đơn vay, không phê duyệt khoản vay và không đưa ra cam kết tài chính.

## Chạy local

1. Sao chép `.env.example` thành `.env` và đặt các biến cần thiết. Không commit `.env`.
2. Chạy migration trên database local/staging đã được backup: `npx prisma migrate deploy`.
3. Chạy `npm start`.

Kiểm thử: `npm test`, `npm run lint`, `npm run secret:scan`, `npm run build`.

## Neon Functions deployment

Production bị chặn ở cấp runtime cho đến khi `OWNER_PRODUCTION_APPROVED=true`. Chỉ đặt biến này sau khi chủ dự án hoàn tất [checklist triển khai pháp lý](docs/LEGAL_DEPLOYMENT_CHECKLIST.md), xác nhận bằng văn bản và có backup database đã kiểm chứng.

Các giới hạn/rủi ro kỹ thuật và compliance hiện có trong [LEGAL_REVIEW.md](docs/LEGAL_REVIEW.md), [RISK_FINDINGS.md](docs/RISK_FINDINGS.md) và [IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md).

Giao diện và API cùng chạy trong một Neon Function; cấu hình đầy đủ ở `neon.ts`. Xem [NEON_DEPLOYMENT.md](docs/NEON_DEPLOYMENT.md) để tạo project, khai báo GitHub secrets, chạy Prisma migration và deploy.
