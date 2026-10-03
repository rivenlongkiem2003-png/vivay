# Risk findings — audit trước hardening

> Báo cáo này bảo tồn bằng chứng kỹ thuật của source ban đầu. Các finding không là kết luận pháp lý về chủ dự án hay bất kỳ cá nhân/tổ chức nào.

| Mức độ | File / route | Hành vi quan sát được | Rủi ro | Xử lý |
| --- | --- | --- | --- | --- |
| Critical | `server.js`, `POST /api/login` | Chấp nhận chuỗi admin/mật khẩu hard-code; mật khẩu admin được so sánh cleartext. | Chiếm quyền quản trị. | Gỡ bypass, dùng password hash, session HttpOnly, rate limit. |
| Critical | `server.js`, `/api/customers`, `/api/config` | Toàn bộ CRUD và cấu hình tài khoản nhận tiền không có authentication/authorization server-side. | IDOR, sửa dữ liệu/tài khoản thụ hưởng trái phép. | Bảo vệ RBAC + CSRF ở mọi API admin; không phục vụ endpoint config cũ. |
| Critical | `detail.html`, `admin.html` | Dùng `localStorage` để quyết định quyền và dữ liệu hồ sơ. | Người dùng có thể sửa local storage/xem dữ liệu khác. | Chỉ lấy hồ sơ từ API có session; customer API không nhận ID. |
| High | `server.js`, static root | Static root có thể cung cấp source/server scripts; profile dùng id tăng dần ở các API admin không bảo vệ. | Lộ source/PII và truy cập trái phép. | Allow-list file public, noindex, secure access token, RBAC. |
| Critical | `restore_neon.js` (legacy) | Database URL từng hard-code trong source đã commit; script còn in dữ liệu/mật khẩu legacy. | Credential compromise và lộ PII qua log. | Vô hiệu hóa script, secret scan hiện tại pass; chủ dự án phải rotate credential cũ. Không rewrite Git history nếu chưa có yêu cầu. |
| Critical | Local Git remote configuration (pre-remediation) | URL remote chứa GitHub personal access token. | Chiếm quyền repository nếu token còn hiệu lực. | Đã thay URL local bằng remote không có token; chủ dự án phải revoke/rotate token đã lộ và dùng credential manager/SSH hoặc short-lived token khi push. |
| High | `admin.html` | Chèn dữ liệu DB bằng `innerHTML`. | Stored XSS trong dashboard admin. | Render bằng `textContent`/DOM APIs. |
| High | `admin.html`, `POST /api/config` | QR data URL tối đa 15MB lưu DB và hiển thị. | Upload/data validation yếu; nguy cơ nội dung độc hại, DB bloat. | Không triển khai upload QR trong phạm vi này. |
| High | `index.html`, `preview.html` | Có lời quảng cáo/khẳng định về vay, thời gian giải ngân, phê duyệt, thông tin CCCD. | Rủi ro consumer-protection, misleading claims và data minimization. | Thay bằng trang tra cứu hồ sơ; giữ source audit trong Git history, không public routes cũ. |
| Medium | `User.cccd`, form admin | Yêu cầu/hiển thị CCCD dù không cần cho tra cứu hồ sơ. | Thu thập PII vượt nhu cầu. | Không nhận/hiển thị CCCD mới; không xóa legacy data bằng migration. |
| Medium | `server.js` logging | Log cấu hình DB và lỗi nguyên bản. | Lộ thông tin vận hành/stack trace trong logs. | Log tối thiểu, response lỗi chung. |

## Production gate

Tại thời điểm audit, không có bằng chứng trong repository về pháp nhân vận hành, quyền dùng thương hiệu/tài khoản thụ hưởng, điều khoản, privacy policy hoặc phê duyệt production của chủ dự án. Do đó production phải là `BLOCKED_PENDING_OWNER_APPROVAL`.
