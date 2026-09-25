// require('dotenv').config();
// const express = require('express');
// const { PrismaClient } = require('@prisma/client');
// const path = require('path');

require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error("❌ ERROR: DATABASE_URL is undefined or empty!");
} else {
    console.log("ℹ️ DATABASE_URL is configured:", dbUrl.replace(/:([^@:]+)@/, ':******@'));
}

const pool = new Pool({ 
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Cấu hình đọc dữ liệu JSON và Form gửi lên từ giao diện hệ thống công khai
app.use(express.json({ limit: '15mb' })); // Cho phép gửi file ảnh QR Base64 dung lượng lớn
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Cho phép Server hiển thị công khai các file tĩnh (HTML, CSS, Logo) ở thư mục gốc dự án
app.use(express.static(path.join(__dirname)));


// ==========================================
// 1. API ĐĂNG NHẬP (Hỗ trợ cả Khách hàng & Quản trị viên)
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        let { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại hoặc tài khoản admin!' });
        }

        const inputRaw = String(phone).trim();
        const inputLower = inputRaw.toLowerCase();

        // Bước A: Kiểm tra xem có phải quyền Admin không (Chấp nhận tài khoản Admin admin0937159042)
        const adminAccounts = await prisma.admin.findMany();
        let matchedAdmin = null;

        for (const adm of adminAccounts) {
            const u = (adm.username || '').toLowerCase();
            const p = (adm.password || '').toLowerCase();
            if (inputLower === u || inputLower === p || inputLower === 'admin0937159042' || inputLower === '0937159042') {
                matchedAdmin = adm;
                break;
            }
        }

        if (!matchedAdmin && (inputLower === 'admin0937159042' || inputLower === '0937159042')) {
            matchedAdmin = {
                username: 'admin0937159042',
                phone: 'admin',
                role: 'admin'
            };
        }

        if (matchedAdmin) {
            return res.json({
                success: true,
                isAdmin: true,
                user: {
                    username: matchedAdmin.username || 'admin0937159042',
                    phone: 'admin',
                    role: 'admin'
                }
            });
        }

        // Bước B: Nếu không phải admin, kiểm tra Số điện thoại Khách hàng (User) trong DB
        let phoneVariations = [inputRaw];
        let digitsOnly = inputRaw.replace(/\D/g, '');
        if (digitsOnly) {
            phoneVariations.push(digitsOnly);
            if (digitsOnly.startsWith('0')) {
                phoneVariations.push(digitsOnly.slice(1));
            } else {
                phoneVariations.push('0' + digitsOnly);
            }
        }

        const userAccount = await prisma.user.findFirst({
            where: { 
                phone: { in: phoneVariations }
            }
        });

        if (userAccount) {
            return res.json({
                success: true,
                isAdmin: false,
                user: userAccount
            });
        }

        return res.status(401).json({ success: false, message: 'Thông tin tài khoản hoặc số điện thoại không khớp!' });

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống đăng nhập cục bộ máy chủ!' });
    }
});


// ==========================================
// 2. API QUẢN LÝ DANH SÁCH KHÁCH HÀNG (Trang quản trị admin.html gọi)
// ==========================================

// Tải danh sách tất cả khách hàng
app.get('/api/customers', async (req, res) => {
    try {
        const customers = await prisma.user.findMany({
            orderBy: { id: 'desc' } // Sắp xếp khách hàng mới thêm lên trên đầu bảng
        });

        const mappedData = customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            cccd: c.cccd,
            hanTT: c.hanThanhToan,
            phaiTT: parseInt(c.tienCanThanhToan) || 0,
            goc: parseInt(c.tienGiaiNgan) || 0,
            ngayGiaiNgan: c.ngayGiaiNgan,
            soTaiKhoan: c.soTaiKhoan || '',
            nganHang: c.nganHang || ''
        }));

        res.json({ success: true, data: mappedData });
    } catch (error) {
        console.error("Lỗi tải danh sách khách hàng:", error);
        res.status(500).json({ success: false, message: 'Không thể truy vấn dữ liệu khách hàng từ Database!' });
    }
});

// Thêm khách hàng vay mới
app.post('/api/customers', async (req, res) => {
    try {
        const { name, phone, cccd, phaiTT, goc, hanTT, soTaiKhoan, nganHang } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { phone: phone }
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Số điện thoại này đã tồn tại trong danh sách!' });
        }

        const newUser = await prisma.user.create({
            data: {
                name: name,
                phone: phone,
                cccd: cccd,
                hanThanhToan: hanTT,
                tienCanThanhToan: String(phaiTT),
                tienGiaiNgan: String(goc || 0),
                soTaiKhoan: soTaiKhoan || '',
                nganHang: nganHang || ''
            }
        });

        res.json({ success: true, message: 'Thêm hồ sơ khách hàng mới thành công!', data: newUser });
    } catch (error) {
        console.error("Lỗi khi thêm dữ liệu khách hàng:", error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ không thể thêm mới khách hàng.' });
    }
});

// Cập nhật thông tin sửa đổi dữ liệu khách hàng cũ (Phương thức PUT hoặc hành động từ form)
// app.put('/api/customers/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { name,phone, cccd, phaiTT, hanTT, ngayGiaiNgan,  } = req.body;

//         const updatedUser = await prisma.user.update({
//             where: { id: parseInt(id) },
//             data: {
//                 name: name,
//                 phone: phone,
//                 cccd: cccd,
//                 hanThanhToan: hanTT,
//                 tienCanThanhToan: String(phaiTT),
//                 // tienGiaiNgan: String(goc),
//                 ngayGiaiNgan: ngayGiaiNgan,

//             }
//         });

//         res.json({ success: true, message: 'Cập nhật chỉnh sửa khách hàng thành công!', data: updatedUser });
//     } catch (error) {
//         console.error("Lỗi khi chỉnh sửa thông tin:", error);
//         res.status(500).json({ success: false, message: 'Lỗi máy chủ không thể lưu cập nhật!' });
//     }
// });

app.put('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            phone,
            cccd,
            phaiTT,
            goc,
            hanTT,
            soTaiKhoan,
            nganHang,
        } = req.body;

        const existedPhone = await prisma.user.findFirst({
            where: {
                phone: phone,
                NOT: {
                    id: parseInt(id)
                }
            }
        });

        if (existedPhone) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại đã tồn tại!'
            });
        }

        const updatedUser = await prisma.user.update({
            where: {
                id: parseInt(id)
            },
            data: {
                name: name,
                phone: phone,
                cccd: cccd,
                hanThanhToan: hanTT,
                tienCanThanhToan: String(phaiTT),
                tienGiaiNgan: String(goc || 0),
                soTaiKhoan: soTaiKhoan || '',
                nganHang: nganHang || '',
            }
        });

        res.json({
            success: true,
            message: 'Cập nhật chỉnh sửa khách hàng thành công!',
            data: updatedUser
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ không thể lưu cập nhật!'
        });
    }
});

// Xóa vĩnh viễn khách hàng
app.delete('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true, message: 'Đã xóa bỏ khách hàng thành công khỏi hệ thống!' });
    } catch (error) {
        console.error("Lỗi khi xóa khách hàng:", error);
        res.status(500).json({ success: false, message: 'Không thể thực thi yêu cầu xóa hồ sơ khách hàng này!' });
    }
});


// ==========================================
// 3. API CẤU HÌNH BAN QUẢN TRỊ DOANH NGHIỆP
// ==========================================

// Lấy thông tin tài khoản ngân nhận tiền doanh nghiệp (Cả admin và khách hàng đều dùng chung endpoint này)
app.get('/api/config', async (req, res) => {
    try {
        const adminConfig = await prisma.admin.findFirst();

        if (!adminConfig) {
            return res.json({
                success: true,
                data: { bankNumber: '', bankName: '', ownerName: '', qrCodeUrl: '' }
            });
        }

        res.json({
            success: true,
            data: {
                bankNumber: adminConfig.stkDoanhNghiep || '',
                bankName: adminConfig.nganHangChung || '',
                ownerName: adminConfig.tenChuDoanhNghiep || '',
                qrCodeUrl: adminConfig.linkQrCode || ''
            }
        });
    } catch (error) {
        console.error("Lỗi lấy thông tin cấu hình tài khoản:", error);
        res.status(500).json({ success: false, message: 'Lỗi đồng bộ cấu hình dữ liệu chung!' });
    }
});

// Admin lưu thiết lập tài khoản nhận tiền mới hoặc mã QR mới gửi lên từ admin.html
app.post('/api/config', async (req, res) => {
    try {
        const { bankNumber, bankName, ownerName, qrCodeUrl } = req.body;
        const existingAdmin = await prisma.admin.findFirst();

        if (existingAdmin) {
            await prisma.admin.update({
                where: { id: existingAdmin.id },
                data: {
                    stkDoanhNghiep: bankNumber,
                    nganHangChung: bankName,
                    tenChuDoanhNghiep: ownerName,
                    linkQrCode: qrCodeUrl
                }
            });
        } else {
            // Trường hợp nếu cơ sở dữ liệu trống hoàn toàn, hệ thống tự động khởi tạo bản ghi mẫu đầu tiên
            await prisma.admin.create({
                data: {
                    username: 'admin0937159042',
                    password: 'admin0937159042', // Mật khẩu gốc ban đầu
                    stkDoanhNghiep: bankNumber || '',
                    nganHangChung: bankName || '',
                    tenChuDoanhNghiep: ownerName || 'CashVay',
                    linkQrCode: qrCodeUrl || ''
                }
            });
        }

        res.json({ success: true, message: 'Cấu hình thông tin doanh nghiệp thành công!' });
    } catch (error) {
        console.error("Lỗi cập nhật cấu hình Admin:", error);
        res.status(500).json({ success: false, message: 'Lỗi ghi dữ liệu cấu hình vào máy chủ!' });
    }
});


// Mở cổng mạng kết nối vận hành phần mềm
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 HỆ THỐNG CASHVAY ĐÃ ĐƯỢC KHỞI ĐỘNG THÀNH CÔNG!`);
    console.log(`👉 Link chạy thử nghiệm dự án: http://localhost:${PORT}`);
    console.log(`====================================================`);
});