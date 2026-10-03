(() => {
    const csrf = () => sessionStorage.getItem('vivay_csrf') || '';
    const money = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + ' đ';
    const date = (value) => {
        if (!value) return 'Chưa xác định';
        const parsed = new Date(`${value}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('vi-VN').format(parsed);
    };
    const maskPhone = (value) => value && value.length > 5 ? `${value.slice(0, 3)}***${value.slice(-3)}` : value || '—';
    const text = (id, value, fallback = 'Chưa công bố') => { document.getElementById(id).textContent = value || fallback; };

    async function api(url, options = {}) {
        const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.headers || {}), 'X-CSRF-Token': csrf() } });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không thể tải dữ liệu.');
        return result;
    }

    function render(record) {
        const initial = (record.customerName || 'V').trim().slice(0, 1).toUpperCase();
        text('avatar', initial, 'V');
        text('customer-name', record.customerName, 'Hồ sơ khoản vay');
        text('customer-phone', maskPhone(record.customerPhone), '');
        text('loan-status', record.loanStatus);
        text('loan-amount', money(record.loanAmount), '0 đ');
        text('disbursed-amount', money(record.disbursedAmount), '0 đ');
        text('disbursement-date', date(record.disbursementDate));
        text('due-date', date(record.dueDate));
        text('fee-interest', record.feeOrInterestDisplay);
        text('payment-owner', record.paymentAccountName);
        text('payment-bank', record.paymentBank);
        text('payment-account', record.paymentAccountNumber);
        const copyButton = document.getElementById('copy-account');
        copyButton.disabled = !record.paymentAccountNumber;
        copyButton.dataset.value = record.paymentAccountNumber || '';
    }

    document.getElementById('copy-account').addEventListener('click', async (event) => {
        const value = event.currentTarget.dataset.value || '';
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            document.getElementById('copy-feedback').textContent = 'Đã sao chép đúng số tài khoản đang hiển thị.';
        } catch {
            document.getElementById('copy-feedback').textContent = 'Không thể sao chép tự động. Vui lòng sao chép thủ công.';
        }
    });

    document.getElementById('logout-button').addEventListener('click', async () => {
        try { await api('/api/logout', { method: 'POST' }); } catch { /* cookie will expire naturally */ }
        sessionStorage.removeItem('vivay_csrf');
        window.location.assign('/');
    });

    (async () => {
        try {
            const session = await api('/api/session', { headers: {} });
            if (session.role !== 'customer') throw new Error('Không có quyền xem hồ sơ này.');
            sessionStorage.setItem('vivay_csrf', session.csrfToken);
            const record = await api('/api/me/loan');
            render(record.data);
        } catch {
            sessionStorage.removeItem('vivay_csrf');
            window.location.replace('/');
        }
    })();
})();
