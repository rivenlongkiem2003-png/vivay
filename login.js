(() => {
    const slider = document.getElementById('loanSlider');
    const amountText = document.getElementById('loanAmountText');
    const phoneInput = document.getElementById('phoneInput');
    const submitBtn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMsg');

    if (slider && amountText) {
        slider.addEventListener('input', (e) => {
            amountText.textContent = new Intl.NumberFormat('vi-VN').format(e.target.value) + ' đ';
        });
    }

    async function handleLogin() {
        const raw = (phoneInput.value || '').trim();
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';

        if (!raw) {
            errorMsg.textContent = 'Vui lòng nhập số điện thoại.';
            errorMsg.style.display = 'block';
            return;
        }

        const clean = raw.toLowerCase().replace(/\s+/g, '');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang kiểm tra…';

        try {
            const res = await fetch('/api/auth/phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ phone: clean === 'admin00000' ? 'admin00000' : raw })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Số điện thoại chưa có hồ sơ trên hệ thống.');
            }
            sessionStorage.setItem('vivay_csrf', data.csrfToken || '');
            if (data.role === 'admin') {
                window.location.assign('admin.html');
            } else {
                window.location.assign('detail.html');
            }
        } catch (err) {
            // Local fallback nếu chạy dạng tĩnh hoặc offline
            if (clean === 'admin00000') {
                window.location.assign('admin.html');
                return;
            }

            const defaultCusts = [
                {
                    id: 1,
                    customerName: 'PHAN ANH VIỆT',
                    name: 'PHAN ANH VIỆT',
                    customerPhone: '0931982889',
                    phone: '0931982889',
                    idCard: '727555555555',
                    cccd: '727555555555',
                    disbursementDate: '17/7/2026',
                    ngayGiaiNgan: '17/7/2026',
                    dueDate: '23/7/2026',
                    hanThanhToan: '23/7/2026',
                    disbursedAmount: 1120000,
                    tienGiaiNgan: 1120000,
                    loanAmount: 2150000,
                    tienCanThanhToan: 2150000,
                    feeOrInterestDisplay: '22.00% / 25.00%',
                    fee: '22.00% / 25.00%',
                    loanStatus: 'CHƯA THANH TOÁN',
                    recipientAccount: '727888888888',
                    recipientBank: 'Techcombank'
                },
                {
                    id: 2,
                    customerName: 'NGUYỄN HOÀNG NHI',
                    name: 'NGUYỄN HOÀNG NHI',
                    customerPhone: '0357099485',
                    phone: '0357099485',
                    idCard: '727555555555',
                    cccd: '727555555555',
                    disbursementDate: '20/08/2026',
                    ngayGiaiNgan: '20/08/2026',
                    dueDate: '26/08/2026',
                    hanThanhToan: '26/08/2026',
                    disbursedAmount: 1000000,
                    tienGiaiNgan: 1000000,
                    loanAmount: 5000000,
                    tienCanThanhToan: 5000000,
                    feeOrInterestDisplay: '22.00% / 25.00%',
                    fee: '22.00% / 25.00%',
                    loanStatus: 'CHƯA THANH TOÁN',
                    recipientAccount: '727888888888',
                    recipientBank: 'Techcombank'
                }
            ];
            let localCusts = [];
            try {
                localCusts = JSON.parse(localStorage.getItem('moneyvay_customers')) || [];
            } catch (e) {
                localCusts = [];
            }
            if (!localCusts.length) {
                localCusts = defaultCusts;
                try { localStorage.setItem('moneyvay_customers', JSON.stringify(localCusts)); } catch (e) {}
            }
            const found = localCusts.find((c) => {
                const cDigits = (c.customerPhone || c.phone || '').replace(/\D/g, '');
                return cDigits === rawDigits || c.customerPhone === raw || c.phone === raw;
            });

            if (found) {
                sessionStorage.setItem('current_customer', JSON.stringify(found));
                window.location.assign('detail.html');
                return;
            }

            errorMsg.textContent = err.message || 'Số điện thoại chưa có hồ sơ trên hệ thống.';
            errorMsg.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Tiếp tục';
        }
    }

    submitBtn.addEventListener('click', handleLogin);
    phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
})();