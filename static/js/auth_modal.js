// Auto Ultimate - Interactive Auth Modal Controller (Login / Register Popup)
document.addEventListener('DOMContentLoaded', () => {
    initAuthModal();
});

function initAuthModal() {
    const backdrop = document.getElementById('authModalBackdrop');
    const card = document.getElementById('authModalCard');
    const closeBtn = document.getElementById('authModalCloseBtn');

    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const panelLogin = document.getElementById('authPanelLogin');
    const panelRegister = document.getElementById('authPanelRegister');

    const heading = document.getElementById('authModalHeading');
    const subheading = document.getElementById('authModalSubheading');
    const footerPrompt = document.getElementById('footerPromptText');
    const footerSwitchBtn = document.getElementById('footerSwitchBtn');

    if (!backdrop || !card) return;

    // 1. Tab Switching Logic
    function switchTab(tabName) {
        if (tabName === 'register') {
            tabLogin.classList.remove('active');
            tabLogin.setAttribute('aria-selected', 'false');
            tabRegister.classList.add('active');
            tabRegister.setAttribute('aria-selected', 'true');

            panelLogin.classList.remove('active');
            panelRegister.classList.add('active');

            heading.textContent = 'Join Auto Ultimate';
            subheading.textContent = 'Create your account to unlock luxury car rentals in Georgia';
            footerPrompt.textContent = 'Already have an account?';
            footerSwitchBtn.textContent = 'Sign in';
        } else {
            tabRegister.classList.remove('active');
            tabRegister.setAttribute('aria-selected', 'false');
            tabLogin.classList.add('active');
            tabLogin.setAttribute('aria-selected', 'true');

            panelRegister.classList.remove('active');
            panelLogin.classList.add('active');

            heading.textContent = 'Welcome to Auto Ultimate';
            subheading.textContent = 'Access your reservations, garage, and exclusive vehicles';
            footerPrompt.textContent = "Don't have an account?";
            footerSwitchBtn.textContent = 'Sign up';
        }
    }

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => switchTab('login'));
        tabRegister.addEventListener('click', () => switchTab('register'));
    }

    if (footerSwitchBtn) {
        footerSwitchBtn.addEventListener('click', () => {
            const isLoginActive = tabLogin.classList.contains('active');
            switchTab(isLoginActive ? 'register' : 'login');
        });
    }

    // 2. Open / Close Modal
    function openModal(initialTab = 'login') {
        switchTab(initialTab);
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Lock background scroll

        // Autofocus first input after animation
        setTimeout(() => {
            const activePanel = initialTab === 'register' ? panelRegister : panelLogin;
            const firstInput = activePanel.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 120);
    }

    function closeModal() {
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Close when clicking outside modal card
    backdrop.addEventListener('click', (e) => {
        if (!card.contains(e.target)) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop.classList.contains('is-open')) {
            closeModal();
        }
    });

    // 3. Global Trigger Binding: Any button or link with data-open-auth or auth buttons
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
                showSvg.style.display = 'none';
                hideSvg.style.display = 'block';
            } else {
                input.type = 'password';
                showSvg.style.display = 'block';
                hideSvg.style.display = 'none';
            }
        });
    });

    // Expose globally for convenience
    window.openAuthModal = openModal;
    window.closeAuthModal = closeModal;
}
