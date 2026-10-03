(() => {
    const status = document.getElementById('form-status');

    function setStatus(message, success = false) {
        status.textContent = message;
        status.className = 'form-status' + (success ? ' is-success' : '');
    }

    async function submitPhone(form) {
        const button = form.querySelector('button[type="submit"]');
        const data = Object.fromEntries(new FormData(form));
        const phone = String(data.phone || '').trim();

        if (!phone) {
            setStatus('Vui lòng nhập số điện thoại.');
            return;
        }

        button.disabled = true;
        setStatus('Đang kiểm tra…', true);

        try {
            const response = await fetch('/api/auth/phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ phone })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Không thể xác thực.');
            sessionStorage.setItem('vivay_csrf', result.csrfToken);
            window.location.assign(result.role === 'admin' ? '/admin.html' : '/detail.html');
        } catch (error) {
            setStatus(error.message || 'Không thể kết nối hệ thống.');
        } finally {
            button.disabled = false;
        }
    }

    document.getElementById('phone-login-form').addEventListener('submit', (event) => {
        event.preventDefault();
        submitPhone(event.currentTarget);
    });
})();