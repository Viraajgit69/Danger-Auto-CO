(() => {
    console.log("💳 Payment Content Script Loaded");

    // Configuration
    const CONFIG = {
        STRIPE: {
            SESSION_KEY: 'stripe_session_data',
            CONFIRMATION_ATTEMPTS: 3,
            RETRY_DELAY: 2000
        }
    };

    // Payment Handler
    const PaymentHandler = {
        async init() {
            this.setupMessageListeners();
            this.monitorPaymentFlow();
        },

        setupMessageListeners() {
            window.addEventListener('message', (event) => {
                if (event.data?.type === 'PAYMENT_INFO_DETECTED') {
                    console.log("Payment info received:", event.data.paymentInfo);
                    this.handlePaymentInfo(event.data.paymentInfo);
                }
            });

            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                switch (message.type) {
                    case 'PAYMENT_SUCCESS':
                        this.handlePaymentSuccess(message.data);
                        break;
                    case 'PAYMENT_ERROR':
                        this.handlePaymentError(message.error);
                        break;
                    case 'PAYMENT_ACTION_REQUIRED':
                        this.handlePaymentAction(message.action);
                        break;
                }
            });
        },

        handlePaymentInfo(paymentInfo) {
            // Store payment session data
            sessionStorage.setItem(CONFIG.STRIPE.SESSION_KEY, JSON.stringify({
                ...paymentInfo,
                timestamp: new Date().toISOString()
            }));

            // Notify extension about payment details
            chrome.runtime.sendMessage({
                type: 'PAYMENT_SESSION_READY',
                data: paymentInfo
            });
        },

        handlePaymentSuccess(data) {
            console.log("Payment successful:", data);
            // Handle successful payment completion
        },

        handlePaymentError(error) {
            console.error("Payment error:", error);
            // Handle payment errors
        },

        handlePaymentAction(action) {
            console.log("Payment action required:", action);
            // Handle additional payment actions if needed
        },

        monitorPaymentFlow() {
            // Monitor for specific Stripe elements and payment flow changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        // Check for payment form changes
                        this.checkPaymentForm();
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        },

        checkPaymentForm() {
            // Check for Stripe form elements
            const stripeForm = document.querySelector('form[data-stripe-form]');
            if (stripeForm) {
                console.log("Stripe form detected");
                this.setupFormMonitoring(stripeForm);
            }
        },

        setupFormMonitoring(form) {
            // Monitor form submission
            form.addEventListener('submit', (event) => {
                const sessionData = sessionStorage.getItem(CONFIG.STRIPE.SESSION_KEY);
                if (sessionData) {
                    console.log("Form submission with session:", JSON.parse(sessionData));
                }
            });
        }
    };

    // Initialize
    PaymentHandler.init();
})();
