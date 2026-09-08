// Gruzin Auto - Interactive Luxury Card Payment Controller & 3D Three.js Bridge

(function () {
    let currentVehicleId = null;
    let currentDays = 1;
    let currentDailyPrice = 90.0;
    let currentTotal = 90.0;
    let currentCity = 'Tbilisi';

    // Helper to get or dynamically load ThreeCardViewer
    async function getThreeCardViewer() {
        if (window.ThreeCardViewer) return window.ThreeCardViewer;
        try {
            const module = await import('/static/js/three_card_viewer.js?v=3dcard1');
            return module || window.ThreeCardViewer;
        } catch (e) {
            console.warn('ThreeCardViewer dynamic load error:', e);
            return window.ThreeCardViewer;
        }
    }

    window.openPaymentModal = async function (vehicleId, vehicleTitle, days, dailyPrice, city) {
        currentVehicleId = vehicleId;
        currentDays = parseInt(days, 10) || 1;
        currentDailyPrice = parseFloat(dailyPrice) || 90.0;
        currentTotal = (currentDays * currentDailyPrice).toFixed(2);
        currentCity = city || 'Tbilisi';

        const backdrop = document.getElementById('paymentModalBackdrop');
        const titleEl = document.getElementById('payVehicleTitle');
        const daysEl = document.getElementById('paySummaryDays');
        const totalEl = document.getElementById('paySummaryTotal');
        const btnLabel = document.getElementById('payBtnLabel');
        const errorBanner = document.getElementById('payErrorBanner');
        const form = document.getElementById('cardPaymentForm');
        const successState = document.getElementById('paySuccessState');

        if (titleEl) titleEl.textContent = vehicleTitle || 'Luxury Vehicle';
        if (daysEl) daysEl.textContent = `${currentDays} Day${currentDays > 1 ? 's' : ''}`;
        if (totalEl) totalEl.textContent = `₾${currentTotal}`;
        if (btnLabel) btnLabel.textContent = `Authorize & Pay ₾${currentTotal}`;
        if (errorBanner) {
            errorBanner.style.display = 'none';
            errorBanner.textContent = '';
        }
        if (form) form.style.display = 'block';
        if (successState) successState.style.display = 'none';

        if (backdrop) {
            backdrop.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            // Initialize Three.js 3D Card
            setTimeout(async () => {
                const viewer = await getThreeCardViewer();
                if (viewer && viewer.initThreeCard) {
                    viewer.initThreeCard();
                    const cardNum = document.getElementById('inputCardNumber')?.value;
                    const expiry = document.getElementById('inputCardExpiry')?.value;
                    const pin = document.getElementById('inputCardPin')?.value;
                    viewer.updateCardData(
                        cardNum || '•••• •••• •••• ••••',
                        window.LOGGED_IN_USER_NAME || 'VIP MEMBER',
                        expiry || 'MM/YY',
                        pin || '•••'
                    );
                    viewer.setCardFlipped(false);
                }
                document.getElementById('inputCardNumber')?.focus();
            }, 100);
        }
    };

    window.closePaymentModal = function () {
        const backdrop = document.getElementById('paymentModalBackdrop');
        if (backdrop) {
            backdrop.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (window.ThreeCardViewer && window.ThreeCardViewer.stopRendering) {
            window.ThreeCardViewer.stopRendering();
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const backdrop = document.getElementById('paymentModalBackdrop');
        const closeBtn = document.getElementById('closePaymentModalBtn');
        const cancelBtn = document.getElementById('cancelPayBtn');
        const form = document.getElementById('cardPaymentForm');
        const demoFillBtn = document.getElementById('btnFillDemoCard');
        const cardNumInput = document.getElementById('inputCardNumber');
        const cardExpiryInput = document.getElementById('inputCardExpiry');
        const cardPinInput = document.getElementById('inputCardPin');

        // Close handlers
        closeBtn?.addEventListener('click', window.closePaymentModal);
        cancelBtn?.addEventListener('click', window.closePaymentModal);
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) window.closePaymentModal();
        });

        // 1. Card Number Formatter & Real-Time 3D Card Update
        if (cardNumInput) {
            cardNumInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '').slice(0, 16);
                let formatted = val.replace(/(\d{4})/g, '$1 ').trim();
                e.target.value = formatted;

                let previewStr = '';
                if (val.length === 0) {
                    previewStr = '•••• •••• •••• ••••';
                } else {
                    for (let i = 0; i < 16; i++) {
                        if (i > 0 && i % 4 === 0) previewStr += ' ';
                        previewStr += (i < val.length) ? val[i] : '•';
                    }
                }

                if (window.ThreeCardViewer?.updateCardData) {
                    window.ThreeCardViewer.updateCardData(previewStr);
                }
            });

            cardNumInput.addEventListener('focus', () => {
                window.ThreeCardViewer?.setCardFlipped(false);
            });
        }

        // 2. Expiry Formatter & Real-Time 3D Card Update (MM/YY)
        if (cardExpiryInput) {
            cardExpiryInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                if (val.length >= 2) {
                    e.target.value = val.slice(0, 2) + '/' + val.slice(2);
                } else {
                    e.target.value = val;
                }
                const expVal = e.target.value || 'MM/YY';
                if (window.ThreeCardViewer?.updateCardData) {
                    window.ThreeCardViewer.updateCardData(undefined, undefined, expVal);
                }
            });

            cardExpiryInput.addEventListener('focus', () => {
                window.ThreeCardViewer?.setCardFlipped(false);
            });
        }

        // 3. PIN / CVV Real-Time 3D Card Update & 180° Auto-Flip!
        if (cardPinInput) {
            cardPinInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                e.target.value = val;
                const pinVal = val ? '•'.repeat(val.length) : '•••';

                if (window.ThreeCardViewer?.updateCardData) {
                    window.ThreeCardViewer.updateCardData(undefined, undefined, undefined, pinVal);
                }
            });

            // Smooth Auto-Flip to Card Back when focusing PIN
            cardPinInput.addEventListener('focus', () => {
                if (window.ThreeCardViewer?.setCardFlipped) {
                    window.ThreeCardViewer.setCardFlipped(true);
                }
            });

            // Smooth Auto-Flip to Card Front when blurring PIN
            cardPinInput.addEventListener('blur', () => {
                // If focus moved to another input, keep it flipped accordingly
                setTimeout(() => {
                    if (document.activeElement !== cardPinInput) {
                        window.ThreeCardViewer?.setCardFlipped(false);
                    }
                }, 100);
            });
        }

        // 4. Quick Test / Demo Card Auto-Fill
        demoFillBtn?.addEventListener('click', () => {
            if (cardNumInput) cardNumInput.value = '4532 8820 9104 3829';
            if (cardExpiryInput) cardExpiryInput.value = '12/28';
            if (cardPinInput) cardPinInput.value = '742';

            if (window.ThreeCardViewer?.updateCardData) {
                window.ThreeCardViewer.updateCardData(
                    '4532 8820 9104 3829',
                    window.LOGGED_IN_USER_NAME || 'VIP MEMBER',
                    '12/28',
                    '•••'
                );
            }
        });

        // 5. Payment Form Submission
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const cardNum = cardNumInput?.value.replace(/\s/g, '') || '';
                const expiry = cardExpiryInput?.value.trim() || '';
                const pin = cardPinInput?.value.trim() || '';
                const errorBanner = document.getElementById('payErrorBanner');
                const authBtn = document.getElementById('authorizePayBtn');

                if (cardNum.length < 15) {
                    showPayError('Please enter a valid 16-digit card number.');
                    cardNumInput?.focus();
                    return;
                }

                if (!expiry.includes('/') || expiry.length < 5) {
                    showPayError('Please enter a valid expiration date (MM/YY).');
                    cardExpiryInput?.focus();
                    return;
                }

                if (pin.length < 3) {
                    showPayError('Please enter a valid 3 or 4-digit PIN/CVV.');
                    cardPinInput?.focus();
                    return;
                }

                if (errorBanner) errorBanner.style.display = 'none';
                if (authBtn) {
                    authBtn.disabled = true;
                    authBtn.innerHTML = `
                        <div class="spinner-dot" style="display:inline-block; width:14px; height:14px; border:2px solid #000000; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:6px;"></div>
                        <span>Processing ₾${currentTotal}...</span>
                    `;
                }

                const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';

                try {
                    const res = await fetch(`/vehicles/${currentVehicleId}/rent/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken,
                        },
                        body: JSON.stringify({
                            city: currentCity,
                            rental_days: currentDays,
                            card_last4: cardNum.slice(-4),
                        })
                    });

                    const data = await res.json();

                    if (res.ok && data.success) {
                        form.style.display = 'none';
                        const successState = document.getElementById('paySuccessState');
                        const chatBtn = document.getElementById('successChatBtn');
                        if (chatBtn && data.chat_url) {
                            chatBtn.href = data.chat_url;
                        }
                        if (successState) successState.style.display = 'block';

                        // Update main page booking button state
                        const mainRentBtn = document.getElementById('rentNowBtn');
                        const bookingAlert = document.getElementById('bookingAlertBox');
                        if (mainRentBtn) mainRentBtn.style.display = 'none';
                        if (bookingAlert) {
                            bookingAlert.className = 'booking-alert success';
                            bookingAlert.innerHTML = `
                                <strong>🎉 Booking Confirmed & Paid (₾${data.total_price})</strong>
                                <p style="margin: 4px 0 0; font-size: 12px; color:#86efac;">Receipt #${data.booking_id} saved to your profile.</p>
                            `;
                            bookingAlert.style.display = 'block';
                        }
                    } else {
                        showPayError(data.error || 'Payment authorization failed. Please try again.');
                        if (authBtn) {
                            authBtn.disabled = false;
                            authBtn.innerHTML = `<span>Authorize & Pay ₾${currentTotal}</span>`;
                        }
                    }
                } catch (err) {
                    showPayError('Connection error during transaction. Please try again.');
                    if (authBtn) {
                        authBtn.disabled = false;
                        authBtn.innerHTML = `<span>Authorize & Pay ₾${currentTotal}</span>`;
                    }
                }
            });
        }

        function showPayError(msg) {
            const errorBanner = document.getElementById('payErrorBanner');
            if (errorBanner) {
                errorBanner.textContent = msg;
                errorBanner.style.display = 'block';
            }
        }
    });
})();
