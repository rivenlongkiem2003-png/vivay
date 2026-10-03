(() => {
    const money = (val) => new Intl.NumberFormat('vi-VN').format(Number(val) || 0) + ' đ';
    const date = (val) => {
        if (!val) return '—';
        if (typeof val === 'string' && val.includes('/')) return val;
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    };

    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    async function loadData() {
        let r = null;
        try {
            const res = await fetch('/api/me/loan', { credentials: 'same-origin' });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) r = json.data;
            }
        } catch (e) {
            // Offline/file protocol
        }

        if (!r) {
            const localCust = sessionStorage.getItem('current_customer');
            if (localCust) {
                try { r = JSON.parse(localCust); } catch (e) {}
            }
        }

        if (!r) {
            const allCusts = JSON.parse(localStorage.getItem('moneyvay_customers') || '[]');
            if (allCusts.length) r = allCusts[0];
        }

        // Mặc định chuẩn theo đúng Ảnh 1 nếu chưa chọn khách
        if (!r) {
            r = {
                name: 'PHAN ANH VIỆT',
                phone: '0931982889',
                idCard: '727555555555',
                status: 'CHƯA THANH TOÁN',
                amountDue: '2150000',
                disbursedAmount: '1120000',
                disbursedDate: '17/7/2026',
                dueDate: '23/7/2026',
                fee: '22.00% / 25.00%',
                recipientAccount: '727888888888',
                recipientBank: 'Techcombank',
                paymentAccountName: 'CTY TNHH CAO PHAN HA YEN',
                paymentBank: 'VIB - Ngân hàng TMCP Quốc tế Việt Nam',
                paymentAccountNumber: '111139797'
            };
        }

        const name = (r.customerName || r.name || 'PHAN ANH VIỆT').toUpperCase();
        document.getElementById('nameText').textContent = name;
        document.getElementById('phoneText').textContent = r.customerPhone || r.phone || '0931982889';
        document.getElementById('avatarText').textContent = name.trim().slice(0, 1).toUpperCase();

        const status = r.loanStatus || r.status || 'CHƯA THANH TOÁN';
        const statusEl = document.getElementById('statusBadge');
        if (status.toUpperCase().includes('ĐÃ')) {
            statusEl.className = 'status-badge paid';
            statusEl.innerHTML = 'ĐÃ THANH<br>TOÁN';
        } else {
            statusEl.className = 'status-badge';
            statusEl.innerHTML = 'CHƯA THANH<br>TOÁN';
        }

        // 8 Ô thông tin khoản vay đầy đủ như Admin
        document.getElementById('payAmount').textContent = money(r.loanAmount ?? r.amountDue ?? r.tienCanThanhToan ?? 2150000);
        document.getElementById('disbursedAmount').textContent = money(r.disbursedAmount ?? r.tienGiaiNgan ?? 1120000);
        document.getElementById('disbursedDate').textContent = date(r.disbursementDate ?? r.disbursedDate ?? r.ngayGiaiNgan ?? '17/7/2026');
        document.getElementById('dueDate').textContent = date(r.dueDate ?? r.hanThanhToan ?? '23/7/2026');
        document.getElementById('feeText').textContent = r.feeOrInterestDisplay ?? r.fee ?? '22.00% / 25.00%';
        document.getElementById('idCardText').textContent = r.idCard || r.cccd || '727555555555';
        document.getElementById('recipientAccountText').textContent = r.recipientAccount || r.soTaiKhoan || '727888888888';
        document.getElementById('recipientBankText').textContent = r.recipientBank || r.nganHang || 'Techcombank';

        // Lấy thông tin thanh toán chung từ Admin
        const paymentCfg = JSON.parse(localStorage.getItem('moneyvay_payment_config') || '{}');
        const owner = r.paymentAccountName || paymentCfg.tenChuDoanhNghiep || 'CTY TNHH CAO PHAN HA YEN';
        const bank = r.paymentBank || paymentCfg.nganHangChung || 'VIB - Ngân hàng TMCP Quốc tế Việt Nam';
        const acc = r.paymentAccountNumber || paymentCfg.stkDoanhNghiep || '111139797';

        document.getElementById('payOwner').textContent = owner;
        document.getElementById('payBank').textContent = bank;
        document.getElementById('payAccount').textContent = acc;
    }

    document.getElementById('copyBtn').addEventListener('click', () => {
        const acc = document.getElementById('payAccount').textContent;
        navigator.clipboard.writeText(acc).then(() => {
            showToast('Đã sao chép số tài khoản!');
        }).catch(() => {
            showToast('Đã sao chép: ' + acc);
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.location.assign('index.html');
    });

    const borrowBtn = document.getElementById('borrowMoreBtn');
    if (borrowBtn) {
        borrowBtn.addEventListener('click', () => {
            alert('Yêu cầu vay thêm đã được gửi lên hệ thống. Nhân viên sẽ liên hệ lại quý khách!');
        });
    }

    loadData();
})();