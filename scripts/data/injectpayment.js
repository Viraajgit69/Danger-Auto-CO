console.log("💳 Card Injection Script Loaded");

// Enhanced Configuration with better Stripe integration
const CONFIG = {
    STRIPE: {
        FRAME_SELECTORS: {
            NUMBER: [
                'iframe[name*="__privateStripeFrame"][name*="cardNumber"]',
                'iframe[name*="__privateStripeElement"][name*="cardNumber"]',
                'iframe[title*="Card number"]',
                'input[data-elements-stable-field-name="cardNumber"]',
                // Add modern Stripe iframe selectors
                'iframe[src*="js.stripe.com/v3/elements-inner-card"]',
                'iframe[src*="js.stripe.com/v3/elements-inner-payment"]'
            ],
            EXPIRY: [
                'iframe[name*="__privateStripeFrame"][name*="exp"]',
                'iframe[name*="__privateStripeElement"][name*="expiry"]',
                'iframe[title*="expiration date"]',
                'input[data-elements-stable-field-name="cardExpiry"]',
                'iframe[src*="js.stripe.com/v3/elements-inner-card-expiry"]'
            ],
            CVC: [
                'iframe[name*="__privateStripeFrame"][name*="cvc"]',
                'iframe[name*="__privateStripeElement"][name*="cvc"]',
                'iframe[title*="security code"]',
                'input[data-elements-stable-field-name="cardCvc"]',
                'iframe[src*="js.stripe.com/v3/elements-inner-card-cvc"]'
            ]
        },
        ENDPOINTS: {
            PAYMENT_PAGES: 'https://api.stripe.com/v1/payment_pages',
            COOKIES: 'https://checkout-cookies.stripe.com/api/get-cookie',
            MERCHANT_UI: 'https://merchant-ui-api.stripe.com/link/get-cookie'
        },
        INJECTION_DELAYS: {
            BETWEEN_CHARS: 50,
            BETWEEN_FIELDS: 200,
            INITIAL_DELAY: 1000,
            FRAME_READY: 800,
            RETRY_INTERVAL: 500,
            MAX_RETRIES: 10
        }
    }
};

// Enhanced State Management
const StateManager = {
    state: {
        isProcessing: false,
        lastGeneratedCard: null,
        retryAttempts: 0,
        injectionSuccess: false,
        lastError: null,
        frameStates: {
            number: false,
            expiry: false,
            cvc: false
        },
        stripeSession: null
    },

    reset() {
        this.state = {
            isProcessing: false,
            lastGeneratedCard: null,
            retryAttempts: 0,
            injectionSuccess: false,
            lastError: null,
            frameStates: {
                number: false,
                expiry: false,
                cvc: false
            },
            stripeSession: null
        };
    },

    setStripeSession(session) {
        this.state.stripeSession = session;
    },

    getStripeSession() {
        return this.state.stripeSession;
    }
};

// Enhanced Frame Manager
const FrameManager = {
    waitForFrame(frame, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            
            const check = () => {
                if (Date.now() - start > timeout) {
                    reject(new Error('Frame timeout'));
                    return;
                }

                const doc = frame.contentDocument || frame.contentWindow?.document;
                if (doc && doc.readyState === 'complete') {
                    resolve(frame);
                } else {
                    setTimeout(check, 100);
                }
            };

            check();
        });
    },

    findInputElement(frame) {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (!doc) return null;

        const selectors = [
            'input[data-elements-stable-field-name]',
            'input[class*="InputElement"]',
            'input[class*="input"]',
            'input[dir="ltr"]'
        ];

        for (const selector of selectors) {
            const input = doc.querySelector(selector);
            if (input) return input;
        }

        return null;
    }
};

// Enhanced Card Handler with Response Interceptor
const CardHandler = {
    async injectIntoFrame(frame, value, fieldType) {
        try {
            // Wait for frame to be ready
            await FrameManager.waitForFrame(frame);
            
            // Find input element
            const input = FrameManager.findInputElement(frame);
            if (!input) {
                console.warn(`[STRIPE INTERCEPTOR] No input found for ${fieldType}`);
                return false;
            }

            // Clear existing value
            await this.clearField(input);

            // Type value with proper events
            await this.typeValue(input, value);

            // Mark frame as ready
            StateManager.state.frameStates[fieldType] = true;

            console.log(`[STRIPE INTERCEPTOR] Successfully injected ${fieldType}`);
            return true;

        } catch (error) {
            console.warn(`[STRIPE INTERCEPTOR] Frame injection error (${fieldType}):`, error);
            return false;
        }
    },

    async clearField(input) {
        input.focus();
        input.value = '';
        
        const events = ['keydown', 'keyup', 'input', 'change', 'blur'];
        events.forEach(eventType => {
            input.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        await this.delay(50);
    },

    async typeValue(input, value) {
        for (const char of value.toString()) {
            input.value += char;
            
            // Simulate real typing
            const events = [
                new KeyboardEvent('keydown', {
                    key: char,
                    code: `Digit${char}`,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }),
                new KeyboardEvent('keypress', {
                    key: char,
                    code: `Digit${char}`,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }),
                new Event('input', { bubbles: true }),
                new KeyboardEvent('keyup', {
                    key: char,
                    code: `Digit${char}`,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true,
                    composed: true
                })
            ];

            events.forEach(event => input.dispatchEvent(event));
            await this.delay(CONFIG.STRIPE.INJECTION_DELAYS.BETWEEN_CHARS);
        }

        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        
        // Stripe-specific events
        input.dispatchEvent(new CustomEvent('stripeElementUpdate', {
            bubbles: true,
            detail: { complete: true, value: input.value }
        }));
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Enhanced Response Interceptor
const ResponseInterceptor = {
    init() {
        console.log('[STRIPE INTERCEPTOR] Initializing response interceptor...');
        this.interceptFetchRequests();
        this.interceptXHRRequests();
        console.log('[STRIPE INTERCEPTOR] Response interceptor initialized successfully');
    },

    interceptFetchRequests() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await originalFetch.apply(window, args);
            
            try {
                if (response.url.includes(CONFIG.STRIPE.ENDPOINTS.PAYMENT_PAGES)) {
                    const clonedResponse = response.clone();
                    const data = await clonedResponse.json();
                    this.handleStripeResponse(data);
                }
            } catch (error) {
                console.warn('[STRIPE INTERCEPTOR] Error processing response:', error);
            }

            return response;
        };
    },

    interceptXHRRequests() {
        const XHR = XMLHttpRequest.prototype;
        const send = XHR.send;
        const open = XHR.open;

        XHR.open = function(...args) {
            this._url = args[1];
            return open.apply(this, args);
        };

        XHR.send = function(...args) {
            this.addEventListener('load', function() {
                try {
                    if (this._url.includes(CONFIG.STRIPE.ENDPOINTS.PAYMENT_PAGES)) {
                        const data = JSON.parse(this.responseText);
                        ResponseInterceptor.handleStripeResponse(data);
                    }
                } catch (error) {
                    console.warn('[STRIPE INTERCEPTOR] Error processing XHR response:', error);
                }
            });

            return send.apply(this, args);
        };
    },

    handleStripeResponse(data) {
        if (data?.payment_page?.id) {
            console.log('[STRIPE INTERCEPTOR] Stripe checkout detected for:', window.location.hostname);
            StateManager.setStripeSession(data);

            if (data.payment_intent_client_secret) {
                console.log('[STRIPE INTERCEPTOR] Payment intent detected');
                this.extractPaymentInfo(data);
            }
        }
    },

    extractPaymentInfo(data) {
        const paymentInfo = {
            amountDue: data.amount,
            currency: data.currency,
            customerEmail: data.customer_email,
            successUrl: data.success_url,
            businessUrl: window.location.origin
        };

        console.log('[STRIPE INTERCEPTOR] Payment info extracted:', {
            ...paymentInfo,
            amountDue: `${paymentInfo.currency} ${(paymentInfo.amountDue / 100).toFixed(2)}`
        });

        // Notify extension of extracted payment info
        chrome.runtime.sendMessage({
            type: 'PAYMENT_INFO_EXTRACTED',
            paymentInfo
        });
    }
};

// Enhanced Form Manager
const FormManager = {
    async waitForForm() {
        return new Promise((resolve) => {
            const findFrames = () => {
                const frames = {};
                
                Object.entries(CONFIG.STRIPE.FRAME_SELECTORS).forEach(([key, selectors]) => {
                    const selector = selectors.join(',');
                    frames[key.toLowerCase()] = document.querySelector(selector);
                });

                return frames;
            };

            const checkForm = () => {
                const frames = findFrames();
                
                if (this.areFramesComplete(frames)) {
                    console.log('[STRIPE INTERCEPTOR] All frames found');
                    resolve(frames);
                    return;
                }

                if (StateManager.state.retryAttempts++ < CONFIG.STRIPE.INJECTION_DELAYS.MAX_RETRIES) {
                    setTimeout(checkForm, CONFIG.STRIPE.INJECTION_DELAYS.RETRY_INTERVAL);
                } else {
                    console.warn('[STRIPE INTERCEPTOR] Could not find all frames');
                    resolve(null);
                }
            };

            // Start checking after initial delay
            setTimeout(checkForm, CONFIG.STRIPE.INJECTION_DELAYS.FRAME_READY);
        });
    },

    areFramesComplete(frames) {
        return frames && frames.number && frames.expiry && frames.cvc;
    },

    async injectCardDetails(frames, card) {
        try {
            console.log('[STRIPE INTERCEPTOR] Starting card injection...');

            // Inject card number
            const numberSuccess = await CardHandler.injectIntoFrame(
                frames.number,
                card.number,
                'number'
            );
            if (!numberSuccess) return false;
            await CardHandler.delay(CONFIG.STRIPE.INJECTION_DELAYS.BETWEEN_FIELDS);

            // Inject expiry
            const expiry = `${String(card.month).padStart(2, '0')}${String(card.year).slice(-2)}`;
            const expirySuccess = await CardHandler.injectIntoFrame(
                frames.expiry,
                expiry,
                'expiry'
            );
            if (!expirySuccess) return false;
            await CardHandler.delay(CONFIG.STRIPE.INJECTION_DELAYS.BETWEEN_FIELDS);

            // Inject CVC
            const cvcSuccess = await CardHandler.injectIntoFrame(
                frames.cvc,
                card.cvv,
                'cvc'
            );
            if (!cvcSuccess) return false;

            return true;
        } catch (error) {
            console.error('[STRIPE INTERCEPTOR] Failed to inject card details:', error);
            return false;
        }
    }
};

// Main Injection Controller
const AutoPayment = {
    async start() {
        if (StateManager.state.isProcessing) return;
        StateManager.state.isProcessing = true;

        try {
            console.log('[STRIPE INTERCEPTOR] Starting auto payment process...');

            // Reset state for new attempt
            StateManager.reset();

            // Wait for form frames
            const frames = await FormManager.waitForForm();
            if (!frames) {
                throw new Error('Stripe form frames not found');
            }

            // Request card details
            chrome.runtime.sendMessage({ type: 'GET_CARD_DETAILS' }, async response => {
                if (!response?.card) {
                    throw new Error('Failed to get card details from background script');
                }

                // Store and log card details
                StateManager.state.lastGeneratedCard = response.card;
                this.logCardDetails(response.card);

                // Inject card details
                const success = await FormManager.injectCardDetails(frames, response.card);
                
                if (success) {
                    console.log('[STRIPE INTERCEPTOR] Card details injected successfully');
                    chrome.runtime.sendMessage({
                        type: 'CARD_INJECTION_SUCCESS',
                        frameStates: StateManager.state.frameStates
                    });
                } else {
                    throw new Error('Failed to inject card details');
                }
            });

        } catch (error) {
            console.error('[STRIPE INTERCEPTOR] Payment process failed:', error);
            chrome.runtime.sendMessage({
                type: 'CARD_INJECTION_ERROR',
                error: error.message,
                frameStates: StateManager.state.frameStates
            });
        } finally {
            StateManager.state.isProcessing = false;
        }
    },

    logCardDetails(card) {
        console.log('[STRIPE INTERCEPTOR] Using card:', {
            number: card.number.replace(/(\d{6})\d{6}(\d{4})/, '$1******$2'),
            expiry: `${card.month}/${card.year}`,
            cvv: '***'
        });
    }
};

// Observer to watch for Stripe form initialization
const FormObserver = {
    init() {
        console.log('[STRIPE INTERCEPTOR] Initializing form observer...');
        
        // Initialize response interceptor
        ResponseInterceptor.init();

        setTimeout(() => {
            this.observe();
            AutoPayment.start(); // Initial attempt
        }, CONFIG.STRIPE.INJECTION_DELAYS.INITIAL_DELAY);
    },

    observe() {
        const observer = new MutationObserver((mutations)
