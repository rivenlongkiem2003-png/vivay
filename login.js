(() => {
    const status = document.getElementById('form-status');
    const customerTab = document.getElementById('customer-tab');
    const adminTab = document.getElementById('admin-tab');
    const customerPanel = document.getElementById('customer-panel');
    const adminPanel = document.getElementById('admin-panel');

    function setStatus(message, success = false) {
        status.textContent = message;
        status.classList.toggle('is-success', success);
    }

    function switchTab(role) {
        const customer = role === 'customer';
        customerTab.classList.toggle('is-active', customer);
        customerTab.setAttribute('aria-selected', String(customer));
        adminTab.classList.toggle('is-active', !customer);
        adminTab.setAttribute('aria-selected', String(!customer));
        customerPanel.hidden = !customer;
        adminPanel.hidden = customer;
        setStatus('');
        (customer ? document.getElementById('loan-code') : document.getElementById('admin-username')).focus();
    }

    async function submitLogin(endpoint, form, redirect) {
        const button = form.querySelector('button[type="submit"]');
        const data = Object.fromEntries(new FormData(form));
        if (Object.values(data).some((value) => !String(value).trim())) {
            setStatus('Vui lòng nhập đầy đủ thông tin.');
            return;
        }
        button.disabled = true;
        setStatus('Đang xác thực…', true);
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Không thể đăng nhập.');
            sessionStorage.setItem('vivay_csrf', result.csrfToken);
            window.location.assign(redirect);
        } catch (error) {
            setStatus(error.message || 'Không thể kết nối hệ thống.');
        } finally {
            button.disabled = false;
        }
    }

    customerTab.addEventListener('click', () => switchTab('customer'));
    adminTab.addEventListener('click', () => switchTab('admin'));
    document.getElementById('customer-login-form').addEventListener('submit', (event) => { event.preventDefault(); submitLogin('/api/auth/customer', event.currentTarget, '/detail.html'); });
    document.getElementById('admin-login-form').addEventListener('submit', (event) => { event.preventDefault(); submitLogin('/api/auth/admin', event.currentTarget, '/admin.html'); });
})();
