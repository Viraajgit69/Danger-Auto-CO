console.log("💳 Card Injection Script Loaded");

// Configuration
const CONFIG = {
    STRIPE: {
        FRAME_SELECTORS: {
            NUMBER: [
                'iframe[name*="__privateStripeFrame"][name*="cardNumber"]',
                'iframe[name*="__privateStripeElement"][name*="cardNumber"]',
                'iframe[title*="Card number"]',
                'input[data-elements-stable-field-name="cardNumber"]'
            ],
            EXPIRY: [
                'iframe[name*="__privateStripeFrame"][name*="exp"]',
                'iframe[name*="__privateStripeElement"][name*="expiry"]',
                'iframe[title*="expiration date"]',
                'input[data-elements-stable-field-name="cardExpiry"]'
            ],
            CVC: [
                'iframe[name*="__privateStripeFrame"][name*="cvc"]',
                'iframe[name*="__privateStripeElement"][name*="cvc"]',
                'iframe[title*="security code"]',
                'input[data-elements-stable-field-name="cardCvc"]'
            ]
        },
        FORM_CHECK_INTERVAL: 500,
        MAX_RETRIES: 5
    }
};

// State Management
let state = {
    isProcessing: false,
    lastGeneratedCard: null,
    retryAttempts: 0
};

// Card Detail Handler
const CardHandler = {
    async injectIntoFrame(frame, value) {
        try {
            const doc = frame.contentDocument || frame.contentWindow?.document;
            if (!doc) return false;

            const input = doc.querySelector('input[class*="InputElement"]');
            if (!input) return false;

            // Clear field
            input.focus();
            input.value = '';
            input.dispatchEvent(new Event('change', { bubbles: true }));
            await this.delay(50);

            // Type character by character
            for (const char of value.toString()) {
                input.value += char;
                
                // Simulate typing events
                ['keydown', 'keypress', 'keyup', 'input', 'change'].forEach(event => {
                    input.dispatchEvent(new KeyboardEvent(event, {
                        key: char,
                        code: `Digit${char}`,
                        keyCode: char.charCodeAt(0),
                        which: char.charCodeAt(0),
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    }));
                });
                
                await this.delay(10);
            }

            // Trigger final events
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            input.dispatchEvent(new CustomEvent('stripeElementUpdate', {
                bubbles: true,
                detail: { complete: true, value }
            }));

            return true;

        } catch (error) {
            console.warn('Frame injection error:', error);
            return false;
        }
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Form Manager
const FormManager = {
    async waitForForm() {
        return new Promise((resolve) => {
            const checkForm = () => {
                const frames = {
                    number: document.querySelector(CONFIG.STRIPE.FRAME_SELECTORS.NUMBER.join(',')),
                    expiry: document.querySelector(CONFIG.STRIPE.FRAME_SELECTORS.EXPIRY.join(',')),
                    cvc: document.querySelector(CONFIG.STRIPE.FRAME_SELECTORS.CVC.join(','))
                };

                if (frames.number && frames.expiry && frames.cvc) {
                    resolve(frames);
                    return;
                }

                if (state.retryAttempts < CONFIG.STRIPE.MAX_RETRIES) {
                    state.retryAttempts++;
                    setTimeout(checkForm, CONFIG.STRIPE.FORM_CHECK_INTERVAL);
                } else {
                    resolve(null);
                }
            };
            checkForm();
        });
    },

    async injectCardDetails(frames, card) {
        try {
            // Inject card number
            await CardHandler.injectIntoFrame(frames.number, card.number);
            await CardHandler.delay(100);

            // Inject expiry
            const expiry = `${String(card.month).padStart(2, '0')}${String(card.year).slice(-2)}`;
            await CardHandler.injectIntoFrame(frames.expiry, expiry);
            await CardHandler.delay(100);

            // Inject CVC
            await CardHandler.injectIntoFrame(frames.cvc, card.cvv);

            return true;
        } catch (error) {
            console.error('Failed to inject card details:', error);
            return false;
        }
    }
};

// Auto Payment Handler
const AutoPayment = {
    async start() {
        if (state.isProcessing) return;
        state.isProcessing = true;

        try {
            // Wait for form frames
            const frames = await FormManager.waitForForm();
            if (!frames) {
                throw new Error('Stripe form frames not found');
            }

            // Request card details from background script
            chrome.runtime.sendMessage({ type: 'GET_CARD_DETAILS' }, async (response) => {
                if (!response || !response.card) {
                    console.error('Failed to get card details from background script');
                    return;
                }

                // Store card details
                state.lastGeneratedCard = response.card;
                console.log('💳 Using card:', {
                    number: response.card.number.replace(/(\d{6})\d{6}(\d{4})/, '$1******$2'),
                    expiry: `${response.card.month}/${response.card.year}`,
                    cvv: '***'
                });

                // Inject card details
                const success = await FormManager.injectCardDetails(frames, response.card);
                if (success) {
                    console.log('✅ Card details injected successfully');
                    chrome.runtime.sendMessage({ type: 'CARD_INJECTION_SUCCESS' });
                } else {
                    throw new Error('Failed to inject card details');
                }
            });

        } catch (error) {
            console.error('❌ Payment process failed:', error);
            chrome.runtime.sendMessage({ 
                type: 'CARD_INJECTION_ERROR',
                error: error.message
            });
        } finally {
            state.isProcessing = false;
        }
    }
};

// Form Observer
const FormObserver = {
    init() {
        setTimeout(() => {
            this.initialize();
        }, 800);
    },

    initialize() {
        const observer = new MutationObserver((mutations) => {
            if (!state.isProcessing && this.shouldProcessMutations(mutations)) {
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

        // Initial check
        AutoPayment.start();
    },

    shouldProcessMutations(mutations) {
        return mutations.some(mutation => {
            if (mutation.addedNodes.length) {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== 1) return false;
                    
                    const isStripeFrame = node.tagName === 'IFRAME' && 
                        (node.src?.includes('js.stripe.com') || 
                         node.name?.includes('__privateStripeFrame'));
                         
                    if (isStripeFrame) return true;
                    
                    return !!node.querySelector(CONFIG.STRIPE.FRAME_SELECTORS.NUMBER.join(','));
                });
            }

            return mutation.type === 'attributes' && 
                   mutation.target.tagName === 'IFRAME' &&
                   (mutation.target.src?.includes('js.stripe.com') ||
                    mutation.target.name?.includes('__privateStripeFrame'));
        });
    }
};

// Message Handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'RETRY_INJECTION' && state.lastGeneratedCard) {
        AutoPayment.start();
    }
});

// Initialize
FormObserver.init();
console.log("✅ Auto payment script ready");
