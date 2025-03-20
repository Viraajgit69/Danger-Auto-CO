(() => {
    console.log("[STRIPE INTERCEPTOR] Initializing...");

    const CONFIG = {
        ENDPOINTS: {
            STRIPE_API: 'api.stripe.com',
            PAYMENT_PAGES: '/v1/payment_pages',
            ANALYTICS: 'r.stripe.com/b',
            DEPLOY_STATUS: '.deploy_status_henson.json',
            MERCHANT_UI: 'merchant-ui-api.stripe.com',
            COOKIES: 'checkout-cookies.stripe.com'
        },
        DEBUG: true
    };

    const ResponseInterceptor = {
        init() {
            this.interceptFetch();
            this.interceptXHR();
            console.log("[STRIPE INTERCEPTOR] Interceptor initialized");
        },

        shouldProcessResponse(url) {
            // Only process specific endpoints
            return url.includes(CONFIG.ENDPOINTS.STRIPE_API) && 
                   !url.includes(CONFIG.ENDPOINTS.ANALYTICS) &&
                   !url.includes(CONFIG.ENDPOINTS.DEPLOY_STATUS);
        },

        async interceptFetch() {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const url = args[0]?.url || args[0];
                
                if (typeof url === 'string') {
                    CONFIG.DEBUG && console.log("[STRIPE INTERCEPTOR] Fetch intercepted:", url);
                    
                    const response = await originalFetch.apply(window, args);

                    if (this.shouldProcessResponse(url)) {
                        try {
                            const clonedResponse = response.clone();
                            const contentType = response.headers.get('content-type');
                            
                            if (contentType && contentType.includes('application/json')) {
                                const jsonData = await clonedResponse.json();
                                this.processStripeResponse(url, jsonData);
                            }
                        } catch (error) {
                            // Only log actual processing errors, not expected non-JSON responses
                            if (this.shouldProcessResponse(url)) {
                                console.warn("[STRIPE INTERCEPTOR] Process error:", error.message);
                            }
                        }
                    }
                    
                    return response;
                }
                
                return originalFetch.apply(window, args);
            };
        },

        interceptXHR() {
            const XHR = XMLHttpRequest.prototype;
            const originalOpen = XHR.open;
            const originalSend = XHR.send;
            const self = this;

            XHR.open = function(...args) {
                this._url = args[1];
                return originalOpen.apply(this, args);
            };

            XHR.send = function(...args) {
                if (this._url && self.shouldProcessResponse(this._url)) {
                    CONFIG.DEBUG && console.log("[STRIPE INTERCEPTOR] XHR intercepted:", this._url);
                    
                    this.addEventListener('load', function() {
                        try {
                            const contentType = this.getResponseHeader('content-type');
                            if (contentType && contentType.includes('application/json')) {
                                const data = JSON.parse(this.responseText);
                                self.processStripeResponse(this._url, data);
                            }
                        } catch (error) {
                            console.warn("[STRIPE INTERCEPTOR] XHR process error:", error.message);
                        }
                    });
                }
                return originalSend.apply(this, args);
            };
        },

        processStripeResponse(url, data) {
            if (!data) return;

            CONFIG.DEBUG && console.log("[STRIPE INTERCEPTOR] Processing response from:", url);

            // Handle different response types
            if (url.includes('/init')) {
                this.handleInitResponse(data);
            } else if (url.includes('/confirm')) {
                this.handleConfirmResponse(data);
            } else if (url.includes(CONFIG.ENDPOINTS.PAYMENT_PAGES)) {
                this.handlePaymentPageResponse(data);
            }
        },

        handleInitResponse(data) {
            const paymentInfo = {
                amountDue: data.amount || null,
                currency: data.currency?.toLowerCase() || 'usd',
                customerEmail: data.customer_email || null,
                successUrl: data.success_url || window.location.origin,
                businessUrl: window.location.hostname,
                timestamp: new Date().toISOString()
            };

            CONFIG.DEBUG && console.log("[STRIPE INTERCEPTOR] Payment info extracted:", 
                JSON.stringify(paymentInfo));

            // Send message to page
            window.postMessage({
                type: 'STRIPE_PAYMENT_INFO',
                paymentInfo
            }, '*');

            // Try to send message to extension if in extension context
            try {
                if (chrome?.runtime?.id) {
                    chrome.runtime.sendMessage({
                        type: 'STRIPE_PAYMENT_INFO',
                        paymentInfo
                    });
                }
            } catch (e) {
                // Ignore chrome.runtime errors in non-extension context
            }
        },

        handleConfirmResponse(data) {
            if (data.error) {
                this.handleError(data.error);
            } else if (data.next_action) {
                this.handleNextAction(data.next_action);
            } else if (data.status === 'succeeded') {
                this.handleSuccess(data);
            }
        },

        handlePaymentPageResponse(data) {
            if (data.id && data.payment_intent_client_secret) {
                const sessionInfo = {
                    id: data.id,
                    clientSecret: data.payment_intent_client_secret,
                    livemode: data.livemode
                };

                window.postMessage({
                    type: 'STRIPE_SESSION_INFO',
                    sessionInfo
                }, '*');
            }
        },

        handleError(error) {
            console.warn("[STRIPE INTERCEPTOR] Payment error:", error.message);
            window.postMessage({
                type: 'STRIPE_ERROR',
                error
            }, '*');
        },

        handleNextAction(nextAction) {
            console.log("[STRIPE INTERCEPTOR] Next action required:", nextAction.type);
            window.postMessage({
                type: 'STRIPE_NEXT_ACTION',
                action: nextAction
            }, '*');
        },

        handleSuccess(data) {
            console.log("[STRIPE INTERCEPTOR] Payment succeeded");
            window.postMessage({
                type: 'STRIPE_SUCCESS',
                data
            }, '*');
        }
    };

    // Initialize
    ResponseInterceptor.init();

    // Listen for page messages
    window.addEventListener('message', (event) => {
        if (event.data?.type?.startsWith('STRIPE_')) {
            try {
                if (chrome?.runtime?.id) {
                    chrome.runtime.sendMessage(event.data);
                }
            } catch (e) {
                // Ignore chrome.runtime errors in non-extension context
            }
        }
    });
})();
