// Gruzin Auto - Interactive Auth Modal Controller (Login / Register / Confirmation)
document.addEventListener('DOMContentLoaded', () => {
    initAuthModal();
});

function initAuthModal() {
    const backdrop = document.getElementById('authModalBackdrop');
    const card = document.getElementById('authModalCard');
    const closeBtn = document.getElementById('authModalCloseBtn');

    const tabBar = document.getElementById('authTabBar');
    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const panelLogin = document.getElementById('authPanelLogin');
    const panelRegister = document.getElementById('authPanelRegister');
    const panelConfirm = document.getElementById('authPanelConfirmation');

    const heading = document.getElementById('authModalHeading');
    const subheading = document.getElementById('authModalSubheading');
    const modalFooter = document.getElementById('authModalFooter');
    const footerPrompt = document.getElementById('footerPromptText');
    const footerSwitchBtn = document.getElementById('footerSwitchBtn');

    // Forms & Inputs
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginAlert = document.getElementById('loginAlertBox');
    const registerAlert = document.getElementById('registerAlertBox');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const registerSubmitBtn = document.getElementById('registerSubmitBtn');

    // Confirmation Elements
    const confirmEmailDisplay = document.getElementById('confirmEmailDisplay');
    const resendConfirmBtn = document.getElementById('resendConfirmBtn');
    const confirmToLoginBtn = document.getElementById('confirmToLoginBtn');

    let registeredEmail = '';

    if (!backdrop || !card) return;

    // Helper: get CSRF token
    function getCsrfToken() {
        const tokenInput = card.querySelector('[name=csrfmiddlewaretoken]');
        if (tokenInput) return tokenInput.value;
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        return cookieValue || '';
    }

    // 1. Tab Switching Logic
    function switchTab(tabName) {
        if (panelConfirm) panelConfirm.style.display = 'none';
        if (tabBar) tabBar.style.display = 'grid';
        if (modalFooter) modalFooter.style.display = 'block';

        if (tabName === 'register') {
            tabLogin?.classList.remove('active');
            tabLogin?.setAttribute('aria-selected', 'false');
            tabRegister?.classList.add('active');
            tabRegister?.setAttribute('aria-selected', 'true');

            panelLogin?.classList.remove('active');
            panelRegister?.classList.add('active');

            if (heading) heading.textContent = 'Join Gruzin Auto';
            if (subheading) subheading.textContent = 'Create your account to unlock luxury car rentals in Georgia';
            if (footerPrompt) footerPrompt.textContent = 'Already have an account?';
            if (footerSwitchBtn) footerSwitchBtn.textContent = 'Sign in';
        } else {
            tabRegister?.classList.remove('active');
            tabRegister?.setAttribute('aria-selected', 'false');
            tabLogin?.classList.add('active');
            tabLogin?.setAttribute('aria-selected', 'true');

            panelRegister?.classList.remove('active');
            panelLogin?.classList.add('active');

            if (heading) heading.textContent = 'Welcome to Gruzin Auto';
            if (subheading) subheading.textContent = 'Access your reservations, garage, and exclusive vehicles';
            if (footerPrompt) footerPrompt.textContent = "Don't have an account?";
            if (footerSwitchBtn) footerSwitchBtn.textContent = 'Sign up';
        }

        clearAlerts();
    }

    function showConfirmationScreen(email) {
        registeredEmail = email;
        if (panelLogin) panelLogin.classList.remove('active');
        if (panelRegister) panelRegister.classList.remove('active');
        if (tabBar) tabBar.style.display = 'none';
        if (modalFooter) modalFooter.style.display = 'none';

        if (panelConfirm) {
            panelConfirm.style.display = 'block';
            panelConfirm.classList.add('active');
        }
        if (confirmEmailDisplay) confirmEmailDisplay.textContent = email;
        if (heading) heading.textContent = 'Verify Your Email';
        if (subheading) subheading.textContent = 'We just sent an activation link to your inbox';
    }

    function clearAlerts() {
        if (loginAlert) {
            loginAlert.style.display = 'none';
            loginAlert.textContent = '';
        }
        if (registerAlert) {
            registerAlert.style.display = 'none';
            registerAlert.textContent = '';
        }
    }

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => switchTab('login'));
        tabRegister.addEventListener('click', () => switchTab('register'));
    }

    if (footerSwitchBtn) {
        footerSwitchBtn.addEventListener('click', () => {
            const isLoginActive = tabLogin && tabLogin.classList.contains('active');
            switchTab(isLoginActive ? 'register' : 'login');
        });
    }

    if (confirmToLoginBtn) {
        confirmToLoginBtn.addEventListener('click', () => {
            switchTab('login');
        });
    }

    // 2. Open / Close Modal
    function openModal(initialTab = 'login') {
        switchTab(initialTab);
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            const activePanel = initialTab === 'register' ? panelRegister : panelLogin;
            const firstInput = activePanel?.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 120);
    }

    function closeModal() {
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        clearAlerts();
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    backdrop.addEventListener('click', (e) => {
        if (!card.contains(e.target)) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop.classList.contains('is-open')) closeModal();
    });

    // 3. Global Trigger Binding
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-open-auth], .auth-login-btn, .auth-register-btn');
        if (trigger) {
            e.preventDefault();
            const tab = trigger.dataset.openAuth || (trigger.classList.contains('auth-register-btn') ? 'register' : 'login');
            openModal(tab);
        }
    });

    // 4. Show/Hide Password Eye Toggle
    const eyeButtons = card.querySelectorAll('.auth-eye-btn');
    eyeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.auth-input-wrapper').querySelector('input');
            const showSvg = btn.querySelector('.eye-show');
            const hideSvg = btn.querySelector('.eye-hide');

            if (input.type === 'password') {
                input.type = 'text';
                if (showSvg) showSvg.style.display = 'none';
                if (hideSvg) hideSvg.style.display = 'block';
            } else {
                input.type = 'password';
                if (showSvg) showSvg.style.display = 'block';
                if (hideSvg) hideSvg.style.display = 'none';
            }
        });
    });

    // 5. AJAX Registration Form Handler
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlerts();

            const firstName = document.getElementById('registerFirstName')?.value.trim();
            const lastName = document.getElementById('registerLastName')?.value.trim();
            const phone = document.getElementById('registerPhone')?.value.trim();
            const email = document.getElementById('registerEmail')?.value.trim();
            const password = document.getElementById('registerPassword')?.value;
            const confirmPassword = document.getElementById('registerConfirmPassword')?.value;

            // Client-side validations
            if (!firstName) {
                showRegisterError('Please enter your first name.');
                return;
            }
            if (!phone) {
                showRegisterError('Please enter your phone number.');
                return;
            }
            if (!email) {
                showRegisterError('Please enter your email address.');
                return;
            }
            if (!password || password.length < 8) {
                showRegisterError('Password must be at least 8 characters.');
                return;
            }
            if (password !== confirmPassword) {
                showRegisterError('Passwords do not match.');
                return;
            }

            // Disable submit button
            if (registerSubmitBtn) {
                registerSubmitBtn.disabled = true;
                registerSubmitBtn.innerHTML = '<span>Creating Account...</span>';
            }

            try {
                const response = await fetch('/accounts/register/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        phone_number: phone,
                        email: email,
                        password: password,
                        confirm_password: confirmPassword
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showConfirmationScreen(email);
                    registerForm.reset();
                } else {
                    showRegisterError(data.error || 'Failed to create account. Please try again.');
                }
            } catch (err) {
                showRegisterError('Network error. Please try again.');
            } finally {
                if (registerSubmitBtn) {
                    registerSubmitBtn.disabled = false;
                    registerSubmitBtn.innerHTML = '<span>Create Account</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
                }
            }
        });
    }

    function showRegisterError(msg) {
        if (registerAlert) {
            registerAlert.className = 'auth-alert-box error';
            registerAlert.textContent = msg;
            registerAlert.style.display = 'block';
        }
    }

    // 6. AJAX Login Form Handler (Phone Number & Password)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlerts();

            const phone = document.getElementById('loginPhone')?.value.trim();
            const password = document.getElementById('loginPassword')?.value;

            if (!phone || !password) {
                showLoginError('Please enter both phone number and password.');
                return;
            }

            if (loginSubmitBtn) {
                loginSubmitBtn.disabled = true;
                loginSubmitBtn.innerHTML = '<span>Signing In...</span>';
            }

            try {
                const response = await fetch('/accounts/login/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({
                        phone_number: phone,
                        password: password
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    window.location.href = data.redirect_url || '/vehicles/';
                } else {
                    if (data.needs_activation) {
                        showLoginError(data.error);
                        // Add quick resend link
                        const resendSpan = document.createElement('div');
                        resendSpan.style.marginTop = '8px';
                        resendSpan.innerHTML = `<button type="button" class="auth-switch-link" style="color: #60a5fa; text-decoration: underline;">Resend confirmation email to ${data.email}</button>`;
                        resendSpan.querySelector('button').addEventListener('click', () => {
                            sendResendRequest(data.email);
                        });
                        loginAlert.appendChild(resendSpan);
                    } else {
                        showLoginError(data.error || 'Invalid phone number or password.');
                    }
                }
            } catch (err) {
                showLoginError('Network connection error. Please try again.');
            } finally {
                if (loginSubmitBtn) {
                    loginSubmitBtn.disabled = false;
                    loginSubmitBtn.innerHTML = '<span>Sign In</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
                }
            }
        });
    }

    function showLoginError(msg) {
        if (loginAlert) {
            loginAlert.className = 'auth-alert-box error';
            loginAlert.textContent = msg;
            loginAlert.style.display = 'block';
        }
    }

    // 7. Resend Confirmation Handler
    async function sendResendRequest(email) {
        const targetEmail = email || registeredEmail;
        if (!targetEmail) return;

        if (resendConfirmBtn) {
            resendConfirmBtn.disabled = true;
            resendConfirmBtn.textContent = 'Sending...';
        }

        try {
            const response = await fetch('/accounts/resend-activation/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ email: targetEmail })
            });
            const data = await response.json();

            if (resendConfirmBtn) {
                resendConfirmBtn.textContent = 'Confirmation Sent!';
                setTimeout(() => {
                    resendConfirmBtn.disabled = false;
                    resendConfirmBtn.textContent = 'Resend Confirmation Email';
                }, 4000);
            }
        } catch (e) {
            if (resendConfirmBtn) {
                resendConfirmBtn.disabled = false;
                resendConfirmBtn.textContent = 'Resend Confirmation Email';
            }
        }
    }

    if (resendConfirmBtn) {
        resendConfirmBtn.addEventListener('click', () => {
            sendResendRequest(registeredEmail);
        });
    }

    // Expose globally for convenience
    window.openAuthModal = openModal;
    window.closeAuthModal = closeModal;
}
