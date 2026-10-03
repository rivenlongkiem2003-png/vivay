(() => {
    const dialog = document.getElementById('customerDialog');
    const paymentDialog = document.getElementById('paymentDialog');
    const form = document.getElementById('customerForm');
    const recordsBody = document.getElementById('recordsBody');
    const dialogFeedback = document.getElementById('dialogFeedback');
    const paymentFeedback = document.getElementById('paymentFeedback');

    const csrf = () => sessionStorage.getItem('vivay_csrf') || '';
    const money = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + ' đ';

    let customers = [];
    let paymentConfig = {
        tenChuDoanhNghiep: 'CTY TNHH CAO PHAN HA YEN',
        nganHangChung: 'VIB - Ngân hàng TMCP Quốc tế Việt Nam',
        stkDoanhNghiep: '111139797'
    };

    function initSampleData() {
        const saved = localStorage.getItem('moneyvay_customers');
        if (saved) {
            try { customers = JSON.parse(saved); } catch (e) { customers = []; }
        }
        if (!customers || !customers.length) {
            customers = [
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
            localStorage.setItem('moneyvay_customers', JSON.stringify(customers));
        }

        const savedCfg = localStorage.getItem('moneyvay_payment_config');
        if (savedCfg) {
            try { paymentConfig = JSON.parse(savedCfg); } catch (e) {}
        }
    }

    async function api(url, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrf();
        const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không thể xử lý yêu cầu.');
        return result;
    }

    function renderRecords() {
        recordsBody.replaceChildren();
        if (!customers.length) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="10" style="text-align:center; padding:24px; color:#64748b;">Chưa có khách hàng nào.</td>';
            recordsBody.appendChild(tr);
        }

        customers.forEach((c) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="bold-white">${c.customerName || c.name || '—'}</td>
                <td><span class="phone-chip">${c.customerPhone || c.phone || '—'}</span></td>
                <td>${c.idCard || c.cccd || '—'}</td>
                <!-- CỘT NGÀY GIẢI NGÂN (ẢNH 2) -->
                <td class="cell-disburse">${c.disbursementDate || c.ngayGiaiNgan || '—'}</td>
                <td>${c.dueDate || c.hanThanhToan || '—'}</td>
                <td class="gold-amount">${money(c.loanAmount ?? c.tienCanThanhToan)}</td>
                <td class="bold-white">${money(c.disbursedAmount ?? c.tienGiaiNgan)}</td>
                <td>${c.recipientAccount || c.soTaiKhoan || '—'}</td>
                <td>${c.recipientBank || c.nganHang || '—'}</td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="btn-row-action edit" data-id="${c.id}" title="Chỉnh sửa">
                            <svg viewBox="0 0 24 24"><path d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/></svg>
                        </button>
                        <button type="button" class="btn-row-action delete" data-id="${c.id}" title="Xóa">
                            <svg viewBox="0 0 24 24"><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12z"/></svg>
                        </button>
                    </div>
                </td>
            `;
            recordsBody.appendChild(tr);
        });

        // Cập nhật thống kê
        document.getElementById('statCustomers').textContent = String(customers.length);
        const totalPrincipal = customers.reduce((sum, c) => sum + (Number(c.disbursedAmount ?? c.tienGiaiNgan) || 0), 0);
        const totalDue = customers.reduce((sum, c) => sum + (Number(c.loanAmount ?? c.tienCanThanhToan) || 0), 0);
        document.getElementById('statPrincipal').textContent = money(totalPrincipal);
        document.getElementById('statDue').textContent = money(totalDue);
    }

    async function loadRecords() {
        try {
            const res = await api('/api/admin/customers');
            if (res.data && res.data.length) {
                customers = res.data;
                localStorage.setItem('moneyvay_customers', JSON.stringify(customers));
            }
        } catch (e) {
            // Sử dụng dữ liệu trong localStorage
        }
        renderRecords();
    }

    async function loadPaymentConfig() {
        try {
            const res = await api('/api/admin/payment-config');
            if (res.data) paymentConfig = res.data;
        } catch (e) {
            // Sử dụng dữ liệu trong localStorage
        }
    }

    function openCreate() {
        form.reset();
        document.getElementById('fieldId').value = '';
        document.getElementById('dialogTitle').textContent = 'Thêm khách hàng';
        document.getElementById('fieldStatus').value = 'CHƯA THANH TOÁN';
        dialogFeedback.textContent = '';
        dialog.showModal();
        document.getElementById('fieldName').focus();
    }

    function openEdit(id) {
        const c = customers.find((item) => String(item.id) === String(id));
        if (!c) return;
        document.getElementById('fieldId').value = c.id;
        document.getElementById('dialogTitle').textContent = 'Chỉnh sửa khách hàng';
        document.getElementById('fieldName').value = c.customerName || c.name || '';
        document.getElementById('fieldPhone').value = c.customerPhone || c.phone || '';
        document.getElementById('fieldIdCard').value = c.idCard || c.cccd || '';
        // Điền ngày giải ngân
        document.getElementById('fieldDisbursedDate').value = c.disbursementDate || c.ngayGiaiNgan || '';
        document.getElementById('fieldDueDate').value = c.dueDate || c.hanThanhToan || '';
        document.getElementById('fieldLoanAmount').value = c.loanAmount ?? c.tienCanThanhToan ?? 0;
        document.getElementById('fieldDisbursedAmount').value = c.disbursedAmount ?? c.tienGiaiNgan ?? 0;
        document.getElementById('fieldFee').value = c.feeOrInterestDisplay ?? c.fee ?? '22.00% / 25.00%';
        document.getElementById('fieldStatus').value = c.loanStatus || c.status || 'CHƯA THANH TOÁN';
        document.getElementById('fieldRecipientAccount').value = c.recipientAccount || c.soTaiKhoan || '';
        document.getElementById('fieldRecipientBank').value = c.recipientBank || c.nganHang || '';
        dialogFeedback.textContent = '';
        dialog.showModal();
    }

    async function deleteRecord(id) {
        if (!confirm('Bạn có chắc chắn muốn xóa khách hàng này khỏi hệ thống?')) return;
        try {
            await api(`/api/admin/customers/${id}`, { method: 'DELETE' });
        } catch (e) {
            // Local fallback
        }
        customers = customers.filter((item) => String(item.id) !== String(id));
        localStorage.setItem('moneyvay_customers', JSON.stringify(customers));
        renderRecords();
    }

    async function saveCustomer(e) {
        e.preventDefault();
        const id = document.getElementById('fieldId').value;
        const payload = {
            customerName: document.getElementById('fieldName').value.trim().toUpperCase(),
            name: document.getElementById('fieldName').value.trim().toUpperCase(),
            customerPhone: document.getElementById('fieldPhone').value.trim(),
            phone: document.getElementById('fieldPhone').value.trim(),
            idCard: document.getElementById('fieldIdCard').value.trim(),
            cccd: document.getElementById('fieldIdCard').value.trim(),
            disbursementDate: document.getElementById('fieldDisbursedDate').value.trim(),
            ngayGiaiNgan: document.getElementById('fieldDisbursedDate').value.trim(),
            dueDate: document.getElementById('fieldDueDate').value.trim(),
            hanThanhToan: document.getElementById('fieldDueDate').value.trim(),
            loanAmount: document.getElementById('fieldLoanAmount').value.trim(),
            tienCanThanhToan: document.getElementById('fieldLoanAmount').value.trim(),
            disbursedAmount: document.getElementById('fieldDisbursedAmount').value.trim(),
            tienGiaiNgan: document.getElementById('fieldDisbursedAmount').value.trim(),
            feeOrInterestDisplay: document.getElementById('fieldFee').value.trim() || '22.00% / 25.00%',
            fee: document.getElementById('fieldFee').value.trim() || '22.00% / 25.00%',
            loanStatus: document.getElementById('fieldStatus').value,
            status: document.getElementById('fieldStatus').value,
            recipientAccount: document.getElementById('fieldRecipientAccount').value.trim(),
            soTaiKhoan: document.getElementById('fieldRecipientAccount').value.trim(),
            recipientBank: document.getElementById('fieldRecipientBank').value.trim(),
            nganHang: document.getElementById('fieldRecipientBank').value.trim()
        };

        const saveBtn = document.getElementById('saveRecordBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu…';
        dialogFeedback.textContent = '';

        try {
            if (id) {
                const res = await api(`/api/admin/customers/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const updated = res.data;
                const idx = customers.findIndex((item) => String(item.id) === String(id));
                if (idx !== -1) customers[idx] = { ...customers[idx], ...payload, ...updated };
            } else {
                const res = await api('/api/admin/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.data) customers.unshift({ ...payload, ...res.data });
            }
            localStorage.setItem('moneyvay_customers', JSON.stringify(customers));
            dialog.close();
            renderRecords();
        } catch (err) {
            // Local fallback
            if (id) {
                const idx = customers.findIndex((item) => String(item.id) === String(id));
                if (idx !== -1) customers[idx] = { ...customers[idx], ...payload, id };
            } else {
                customers.unshift({ id: Date.now(), ...payload });
            }
            localStorage.setItem('moneyvay_customers', JSON.stringify(customers));
            dialog.close();
            renderRecords();
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Lưu thông tin';
        }
    }

    function openPaymentDialog() {
        document.getElementById('cfgOwner').value = paymentConfig.tenChuDoanhNghiep || '';
        document.getElementById('cfgBank').value = paymentConfig.nganHangChung || '';
        document.getElementById('cfgAccount').value = paymentConfig.stkDoanhNghiep || '';
        paymentFeedback.textContent = '';
        paymentDialog.showModal();
    }

    async function savePayment(e) {
        e.preventDefault();
        const payload = {
            tenChuDoanhNghiep: document.getElementById('cfgOwner').value.trim(),
            nganHangChung: document.getElementById('cfgBank').value.trim(),
            stkDoanhNghiep: document.getElementById('cfgAccount').value.trim()
        };
        try {
            await api('/api/admin/payment-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            // Local fallback
        }
        paymentConfig = { ...paymentConfig, ...payload };
        localStorage.setItem('moneyvay_payment_config', JSON.stringify(paymentConfig));
        paymentDialog.close();
        alert('Cập nhật thông tin thanh toán chung thành công!');
    }

    async function logout() {
        try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
        sessionStorage.removeItem('vivay_csrf');
        window.location.assign('index.html');
    }

    async function initialize() {
        initSampleData();
        try {
            const session = await api('/api/session');
            if (session.role !== 'admin') throw new Error();
            sessionStorage.setItem('vivay_csrf', session.csrfToken);
        } catch (e) {
            // Allow viewing locally
        }
        await loadPaymentConfig();
        await loadRecords();
    }

    document.getElementById('newRecordBtn').addEventListener('click', openCreate);
    document.getElementById('closeDialogBtn').addEventListener('click', () => dialog.close());
    document.getElementById('cancelDialogBtn').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', saveCustomer);

    document.getElementById('editPaymentBtn').addEventListener('click', openPaymentDialog);
    document.getElementById('closePaymentBtn').addEventListener('click', () => paymentDialog.close());
    document.getElementById('cancelPaymentBtn').addEventListener('click', () => paymentDialog.close());
    document.getElementById('paymentForm').addEventListener('submit', savePayment);

    document.getElementById('logoutBtn').addEventListener('click', logout);

    recordsBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-row-action.edit');
        if (editBtn) {
            openEdit(editBtn.dataset.id);
            return;
        }
        const delBtn = e.target.closest('.btn-row-action.delete');
        if (delBtn) {
            deleteRecord(delBtn.dataset.id);
            return;
        }
    });

    initialize();
})();
