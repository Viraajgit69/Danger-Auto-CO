(() => {
    console.log("[STRIPE INTERCEPTOR] Initializing...");

    // Enhanced Configuration
    const CONFIG = {
        STRIPE_ENDPOINTS: {
            API_BASE: 'api.stripe.com',
            PAYMENT_PAGES: '/v1/payment_pages',
            PAYMENT_CONFIRM: '/confirm',
            ANALYTICS: 'r.stripe.com/b',
        },
        INJECTION_FLAGS: {
            shouldInjectCard: false,
            isProcessing: false
        }
    };

    // State Management
    let currentPaymentSession = {
        sessionId: null,
        paymentInfo: null,
        timestamp: null
    };

    // Enhanced Response Interceptor
    const ResponseInterceptor = {
        init() {
            this.interceptFetch();
            this.interceptXHR();
            this.setupMessageHandlers();
            console.log("[STRIPE INTERCEPTOR] Interceptor initialized");
        },

        interceptFetch() {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const url = args[0]?.url || args[0];
                
                if (typeof url === 'string') {
                    console.log("[STRIPE INTERCEPTOR] Fetch intercepted:", url);
                    
                    if (this.isStripeEndpoint(url)) {
                        try {
                            const response = await originalFetch.apply(window, args);
                            const clonedResponse = response.clone();
                            
                            // Process response asynchronously
                            this.processResponse(url, clonedResponse);
                            
                            return response;
                        } catch (error) {
                            console.error("[STRIPE INTERCEPTOR] Fetch error:", error);
                            throw error;
                        }
                    }
                }
                
                return originalFetch.apply(window, args);
            };
        },

        interceptXHR() {
            const XHR = XMLHttpRequest.prototype;
            const originalOpen = XHR.open;
            const originalSend = XHR.send;

            XHR.open = function(...args) {
                this._url = args[1];
                return originalOpen.apply(this, args);
            };

            XHR.send = function(...args) {
                if (this._url && ResponseInterceptor.isStripeEndpoint(this._url)) {
                    console.log("[STRIPE INTERCEPTOR] XHR intercepted:", this._url);
                    
                    this.addEventListener('load', function() {
                        ResponseInterceptor.processXHRResponse(this);
                    });
                }
                return originalSend.apply(this, args);
            };
        },

        async processResponse(url, response) {
            try {
                const data = await response.json();
                console.log("[STRIPE INTERCEPTOR] Processing response from:", url);

                if (url.includes(CONFIG.STRIPE_ENDPOINTS.PAYMENT_PAGES)) {
                    if (url.includes(CONFIG.STRIPE_ENDPOINTS.PAYMENT_CONFIRM)) {
                        this.handlePaymentConfirmation(data);
                    } else {
                        this.handlePaymentSession(data);
                    }
                }

                // Process analytics endpoint
                if (url.includes(CONFIG.STRIPE_ENDPOINTS.ANALYTICS)) {
                    console.log("[STRIPE INTERCEPTOR] Processing JSON response data");
                }

            } catch (error) {
                console.warn("[STRIPE INTERCEPTOR] Failed to process response:", error);
            }
        },

        processXHRResponse(xhr) {
            try {
                const data = JSON.parse(xhr.responseText);
                console.log("[STRIPE INTERCEPTOR] Processing response from:", xhr._url);
                
                if (xhr._url.includes(CONFIG.STRIPE_ENDPOINTS.PAYMENT_PAGES)) {
                    this.handlePaymentSession(data);
                }
            } catch (error) {
                console.warn("[STRIPE INTERCEPTOR] Failed to process XHR response:", error);
            }
        },

        handlePaymentSession(data) {
            if (!data) return;

            const paymentInfo = {
                amountDue: data.amount || null,
                currency: data.currency?.toLowerCase() || 'usd',
                customerEmail: data.customer_email || null,
                successUrl: data.success_url || window.location.origin,
                businessUrl: window.location.origin,
                timestamp: new Date().toISOString()
            };

            console.log("[STRIPE INTERCEPTOR] Payment info extracted:", JSON.stringify(paymentInfo));

            // Store session data
            currentPaymentSession = {
                sessionId: data.id,
                paymentInfo,
                timestamp: new Date().toISOString()
            };

            // Notify content script
            window.postMessage({
                type: 'PAYMENT_INFO_DETECTED',
                paymentInfo
            }, '*');

            // Notify extension
            chrome.runtime.sendMessage({
                type: 'PAYMENT_INFO_DETECTED',
                paymentInfo
            });

            // Modify checkout page appearance if needed
            this.modifyCheckoutAppearance();
        },

        handlePaymentConfirmation(data) {
            console.log("[STRIPE INTERCEPTOR] Payment confirmation intercepted");
            
            if (data.error) {
                console.log("[STRIPE INTERCEPTOR] Payment error:", data.error.message);
                chrome.runtime.sendMessage({
                    type: 'PAYMENT_ERROR',
                    error: data.error
                });
            } else if (data.next_action) {
                console.log("[STRIPE INTERCEPTOR] Payment requires additional action");
                chrome.runtime.sendMessage({
                    type: 'PAYMENT_ACTION_REQUIRED',
                    action: data.next_action
                });
            } else if (data.status === 'succeeded') {
                console.log("[STRIPE INTERCEPTOR] Payment successful");
                chrome.runtime.sendMessage({
                    type: 'PAYMENT_SUCCESS',
                    data: data
                });
            }
        },

        modifyCheckoutAppearance() {
            console.log("[STRIPE INTERCEPTOR] Modifying branding colors");
            // Add any custom styling if needed
        },

        isStripeEndpoint(url) {
            return url.includes(CONFIG.STRIPE_ENDPOINTS.API_BASE) || 
                   url.includes(CONFIG.STRIPE_ENDPOINTS.ANALYTICS);
        },

        setupMessageHandlers() {
            window.addEventListener('message', (event) => {
                if (event.data?.type === 'PAYMENT_INFO_DETECTED') {
                    console.log("Payment info received:", event.data.paymentInfo);
                }
            });
        }
    };

    // Initialize the interceptor
    ResponseInterceptor.init();
})();
