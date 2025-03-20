console.log("💳 Card Injection Script Loaded");

// Enhanced Configuration with more reliable selectors
const CONFIG = {
    STRIPE: {
        FRAME_SELECTORS: {
            NUMBER: [
                'iframe[name*="__privateStripeFrame"][name*="cardNumber"]',
                'iframe[name*="__privateStripeElement"][name*="cardNumber"]',
                'iframe[title*="Card number"]',
                'input[data-elements-stable-field-name="cardNumber"]',
                // Add modern Stripe iframe selectors
                'iframe[src*="js.stripe.com/v3/elements-inner-card-"]',
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
        FORM_CHECK_INTERVAL: 300,
        MAX_RETRIES: 10,
        INJECTION_DELAYS: {
            BETWEEN_CHARS: 50,
            BETWEEN_FIELDS: 200,
            INITIAL_DELAY: 1000,
            FRAME_READY: 800
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
        }
    },

    reset() {
        Object.assign(this.state, {
            isProcessing: false,
            retryAttempts: 0,
            injectionSuccess: false,
            lastError: null,
            frameStates: {
                number: false,
                expiry: false,
                cvc: false
            }
        });
    },

    setProcessing(value) {
        this.state.isProcessing = value;
    },

    setCardDetails(card) {
        this.state.lastGeneratedCard = card;
    },

    getFrameState(type) {
        return this.state.frameStates[type];
    },

    setFrameState(type, value) {
        this.state.frameStates[type] = value;
    },

    areAllFramesReady() {
        return Object.values(this.state.frameStates).every(state => state);
    }
};

// Enhanced Card Handler
const CardHandler = {
    async injectIntoFrame(frame, value, fieldType) {
        try {
            // Wait for frame to be ready
            await this.waitForFrame(frame);
            
            const doc = frame.contentDocument || frame.contentWindow?.document;
            if (!doc) return false;

            // Enhanced input element detection
            const input = doc.querySelector('input[class*="InputElement"]') || 
                         doc.querySelector('input[data-elements-stable-field-name]') ||
                         doc.querySelector('input[class*="input"]');
            
            if (!input) return false;

            // Wait for input to be interactive
            await this.waitForInput(input);

            // Clear existing value
            await this.clearField(input);

            // Type value with proper events
            await this.typeValue(input, value);

            // Mark frame as ready
            StateManager.setFrameState(fieldType, true);

            return true;
        } catch (error) {
            console.warn(`Frame injection error (${fieldType}):`, error);
            return false;
        }
    },

    async waitForFrame(frame) {
        return new Promise((resolve, reject) => {
            const maxAttempts = 10;
            let attempts = 0;

            const checkFrame = () => {
                attempts++;
                const doc = frame.contentDocument || frame.contentWindow?.document;
                
                if (doc) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    setTimeout(checkFrame, 200);
                } else {
                    reject(new Error('Frame not ready'));
                }
            };

            checkFrame();
        });
    },

    async waitForInput(input) {
        return new Promise(resolve => {
            if (input.matches(':enabled')) {
                resolve();
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                if (input.matches(':enabled')) {
                    obs.disconnect();
                    resolve();
                }
            });

            observer.observe(input, {
                attributes: true,
                attributeFilter: ['disabled']
            });
        });
    },

    async clearField(input) {
        input.focus();
        input.value = '';
        
        // Dispatch proper events
        ['keydown', 'keyup', 'input', 'change', 'blur'].forEach(eventType => {
            input.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        await this.delay(50);
    },

    async typeValue(input, value) {
        for (const char of value.toString()) {
            input.value += char;
            
            // Simulate real typing
            this.simulateTyping(input, char);
            
            await this.delay(CONFIG.STRIPE.INJECTION_DELAYS.BETWEEN_CHARS);
        }

        // Final events
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        
        // Stripe-specific event
        input.dispatchEvent(new CustomEvent('stripeElementUpdate', {
            bubbles: true,
            detail: { complete: true, value: input.value }
        }));
    },

    simulateTyping(input, char) {
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
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Enhanced Form Manager
const FormManager = {
    async waitForForm() {
        return new Promise((resolve) => {
            const checkForm = () => {
                const frames = this.findFrames();
                
                if (this.areFramesComplete(frames)) {
                    resolve(frames);
                    return;
                }

                if (StateManager.state.retryAttempts++ < CONFIG.STRIPE.MAX_RETRIES) {
                    setTimeout(checkForm, CONFIG.STRIPE.FORM_CHECK_INTERVAL);
                } else {
                    resolve(null);
                }
            };

            // Initial delay to let Stripe initialize
            setTimeout(checkForm, CONFIG.STRIPE.INJECTION_DELAYS.FRAME_READY);
        });
    },

    findFrames() {
        const frames = {};
        
        Object.entries(CONFIG.STRIPE.FRAME_SELECTORS).forEach(([key, selectors]) => {
            const selector = selectors.join(',');
            frames[key.toLowerCase()] = document.querySelector(selector);
        });

        return frames;
    },

    areFramesComplete(frames) {
        return frames && frames.number && frames.expiry && frames.cvc;
    },

    async injectCardDetails(frames, card) {
        try {
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
            console.error('Failed to inject card details:', error);
            return false;
        }
    }
};

// Enhanced Form Observer
const FormObserver = {
    init() {
        setTimeout(() => {
            this.initialize();
            this.observeFrameCreation();
        }, CONFIG.STRIPE.INJECTION_DELAYS.INITIAL_DELAY);
    },

    initialize() {
        // Initial check
        AutoPayment.start();
    },

    observeFrameCreation() {
        const observer = new MutationObserver((mutations) => {
            if (!StateManager.state.isProcessing && this.hasStripeFrames(mutations)) {
                AutoPayment.start();
            }
        });

        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'name', 'title']
            });
        }
    },

    hasStripeFrames(mutations) {
        return mutations.some(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== 1) return false;
                    
                    return node.tagName === 'IFRAME' && (
                        node.src?.includes('js.stripe.com') ||
                        node.name?.includes('__privateStripeFrame') ||
                        node.title?.includes('Secure payment input frame')
                    );
                });
            }
            return false;
        });
    }
};

// Auto Payment Handler
const AutoPayment = {
    async start() {
        if (StateManager.state.isProcessing) return;
        StateManager.setProcessing(true);

        try {
            // Reset state
            StateManager.reset();

            // Wait for form frames
            const frames = await FormManager.waitForForm();
            if (!frames) {
                throw new Error('Stripe form frames not found');
            }

            // Request card details
            chrome.runtime.sendMessage({ type: 'GET_CARD_DETAILS' }, async response => {
                if (!response?.card) {
                    throw new Error('Failed to get card details');
                }

                // Store card details
                StateManager.setCardDetails(response.card);
                this.logCardDetails(response.card);

                // Inject card details
                const success = await FormManager.injectCardDetails(frames, response.card);
                
                if (success) {
                    console.log('✅ Card details injected successfully');
                    chrome.runtime.sendMessage({ 
                        type: 'CARD_INJECTION_SUCCESS',
                        frameStates: StateManager.state.frameStates
                    });
                } else {
                    throw new Error('Failed to inject card details');
                }
            });

        } catch (error) {
            console.error('❌ Payment process failed:', error);
            chrome.runtime.sendMessage({ 
                type: 'CARD_INJECTION_ERROR',
                error: error.message,
                frameStates: StateManager.state.frameStates
            });
        } finally {
            StateManager.setProcessing(false);
        }
    },

    logCardDetails(card) {
        console.log('💳 Using card:', {
            number: card.number.replace(/(\d{6})\d{6}(\d{4})/, '$1******$2'),
            expiry: `${card.month}/${card.year}`,
            cvv: '***'
        });
    }
};

// Message Handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'RETRY_INJECTION' && StateManager.state.lastGeneratedCard) {
        StateManager.reset();
        AutoPayment.start();
    }
});

// Initialize
FormObserver.init();
console.log("✅ Auto payment script ready");
