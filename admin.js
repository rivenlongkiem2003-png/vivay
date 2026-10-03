(() => {
    const dialog = document.getElementById('record-dialog');
    const form = document.getElementById('record-form');
    const recordsBody = document.getElementById('records-body');
    const dialogStatus = document.getElementById('dialog-status');
    const accessPanel = document.getElementById('access-code-panel');
    const accessValue = document.getElementById('access-code-value');
    const csrf = () => sessionStorage.getItem('vivay_csrf') || '';
    const money = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + ' đ';
    const maskPhone = (value) => value && value.length > 5 ? `${value.slice(0, 3)}***${value.slice(-3)}` : value || '—';

    async function api(url, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrf();
        const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không thể xử lý yêu cầu.');
        return result;
    }

    function cell(row, value, className = '') {
        const element = document.createElement('td');
        if (className) element.className = className;
        element.textContent = value;
        row.appendChild(element);
        return element;
    }

    function renderRecords(records) {
        recordsBody.replaceChildren();
        if (!records.length) {
            const row = document.createElement('tr');
            const empty = cell(row, 'Chưa có hồ sơ nào.');
            empty.colSpan = 6;
            empty.className = 'empty-cell';
            recordsBody.appendChild(row);
        }
        records.forEach((record) => {
            const row = document.createElement('tr');
            cell(row, record.loanCode || 'Đang khởi tạo', 'loan-code');
            const customer = cell(row, '', 'customer-name');
            const name = document.createElement('span');
            name.textContent = record.customerName;
            const phone = document.createElement('span');
            phone.className = 'customer-phone';
            phone.textContent = maskPhone(record.customerPhone);
            customer.append(name, phone);
            const status = cell(row, '');
            const badge = document.createElement('span');
            badge.className = 'status-badge';
            badge.textContent = record.loanStatus;
            status.appendChild(badge);
            cell(row, money(record.loanAmount));
            cell(row, record.dueDate || 'Chưa xác định');
            const action = cell(row, '');
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'button button-secondary';
            edit.textContent = 'Chỉnh sửa';
            edit.addEventListener('click', () => openEdit(record.id));
            action.appendChild(edit);
            recordsBody.appendChild(row);
        });
        document.getElementById('record-count').textContent = String(records.length);
        document.getElementById('total-disbursed').textContent = money(records.reduce((total, record) => total + (Number(record.disbursedAmount) || 0), 0));
        document.getElementById('total-payment').textContent = money(records.reduce((total, record) => total + (Number(record.loanAmount) || 0), 0));
    }

    async function loadRecords() {
        document.getElementById('load-status').textContent = 'Đang tải…';
        try {
            const result = await api('/api/admin/customers');
            renderRecords(result.data);
            document.getElementById('load-status').textContent = `${result.data.length} hồ sơ`;
        } catch (error) {
            document.getElementById('load-status').textContent = error.message;
        }
    }

    function field(name) { return form.elements.namedItem(name); }
    function setAccessCode(code) {
        accessValue.textContent = code;
        accessPanel.hidden = false;
        requestAnimationFrame(() => accessPanel.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
    function hideAccessCode() { accessPanel.hidden = true; accessValue.textContent = ''; }
    function openCreate() {
        form.reset();
        field('id').value = '';
        field('loanCode').value = 'Sẽ tự sinh sau khi lưu';
        field('loanStatus').value = 'Đang xử lý';
        document.getElementById('dialog-title').textContent = 'Tạo hồ sơ';
        document.getElementById('rotate-access-button').hidden = true;
        dialogStatus.textContent = '';
        hideAccessCode();
        dialog.showModal();
        field('customerName').focus();
    }
    function fillRecord(record) {
        field('id').value = record.id;
        field('loanCode').value = record.loanCode || 'Đang khởi tạo';
        field('customerName').value = record.customerName || '';
        field('customerPhone').value = record.customerPhone || '';
        field('loanStatus').value = record.loanStatus || '';
        field('loanAmount').value = record.loanAmount ?? 0;
        field('disbursedAmount').value = record.disbursedAmount ?? 0;
        field('disbursementDate').value = record.disbursementDate || '';
        field('dueDate').value = record.dueDate || '';
        field('feeOrInterestDisplay').value = record.feeOrInterestDisplay || '';
        field('paymentAccountName').value = record.paymentAccountName || '';
        field('paymentBank').value = record.paymentBank || '';
        field('paymentAccountNumber').value = record.paymentAccountNumber || '';
    }
    async function openEdit(id) {
        try {
            const result = await api(`/api/admin/customers/${id}`);
            fillRecord(result.data);
            document.getElementById('dialog-title').textContent = 'Chỉnh sửa hồ sơ';
            document.getElementById('rotate-access-button').hidden = false;
            dialogStatus.textContent = '';
            hideAccessCode();
            dialog.showModal();
        } catch (error) { document.getElementById('load-status').textContent = error.message; }
    }
    async function saveRecord() {
        const id = field('id').value;
        const payload = Object.fromEntries(new FormData(form));
        delete payload.id;
        delete payload.loanCode;
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        dialogStatus.textContent = 'Đang lưu…';
        try {
            const result = await api(id ? `/api/admin/customers/${id}` : '/api/admin/customers', { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            dialogStatus.textContent = result.message || 'Đã lưu hồ sơ.';
            if (result.data) {
                fillRecord(result.data);
                if (!id) {
                    document.getElementById('dialog-title').textContent = 'Hồ sơ đã tạo';
                    document.getElementById('rotate-access-button').hidden = false;
                }
            }
            if (result.customerAccessCode) setAccessCode(result.customerAccessCode);
            await loadRecords();
        } catch (error) { dialogStatus.textContent = error.message; } finally { submit.disabled = false; }
    }
    async function rotateAccessCode() {
        const id = field('id').value;
        if (!id || !window.confirm('Tạo mã truy cập mới sẽ vô hiệu mã cũ. Tiếp tục?')) return;
        const button = document.getElementById('rotate-access-button');
        button.disabled = true;
        dialogStatus.textContent = 'Đang tạo mã…';
        try {
            const result = await api(`/api/admin/customers/${id}/access-code`, { method: 'POST' });
            setAccessCode(result.customerAccessCode);
            dialogStatus.textContent = result.message;
        } catch (error) { dialogStatus.textContent = error.message; } finally { button.disabled = false; }
    }
    async function copyAccessCode() {
        const value = accessValue.textContent;
        if (!value) return;
        try { await navigator.clipboard.writeText(value); dialogStatus.textContent = 'Đã sao chép mã truy cập.'; } catch { dialogStatus.textContent = 'Không thể sao chép tự động.'; }
    }
    async function logout() {
        try { await api('/api/logout', { method: 'POST' }); } catch { /* expire locally */ }
        sessionStorage.removeItem('vivay_csrf');
        window.location.assign('/');
    }
    async function initialize() {
        try {
            const session = await api('/api/session');
            if (session.role !== 'admin') throw new Error('Không có quyền quản trị.');
            sessionStorage.setItem('vivay_csrf', session.csrfToken);
            await loadRecords();
        } catch { sessionStorage.removeItem('vivay_csrf'); window.location.replace('/'); }
    }

    document.getElementById('new-record-button').addEventListener('click', openCreate);
    document.getElementById('close-dialog-button').addEventListener('click', () => dialog.close());
    document.getElementById('cancel-dialog-button').addEventListener('click', () => dialog.close());
    document.getElementById('rotate-access-button').addEventListener('click', rotateAccessCode);
    document.getElementById('copy-access-button').addEventListener('click', copyAccessCode);
    document.getElementById('logout-button').addEventListener('click', logout);
    form.addEventListener('submit', (event) => { event.preventDefault(); saveRecord(); });
    initialize();
})();
