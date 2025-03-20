(() => {
    console.log("💳 Card Injection Script Loading...");
    
    const CONFIG = {
        DEBUG: true,
        SELECTORS: {
            CARD_NUMBER: '[data-elements-stable-field-name="cardNumber"]',
            CARD_EXPIRY: '[data-elements-stable-field-name="cardExpiry"]',
            CARD_CVC: '[data-elements-stable-field-name="cardCvc"]',
            FRAMES: {
                NUMBER: 'iframe[name*="__privateStripeFrame"][name*="cardNumber"]',
                EXPIRY: 'iframe[name*="__privateStripeFrame"][name*="exp"]',
                CVC: 'iframe[name*="__privateStripeFrame"][name*="cvc"]'
            }
        },
        ENDPOINTS: {
            STRIPE_API: 'api.stripe.com',
            ANALYTICS: 'r.stripe.com/b',
            MERCHANT_UI: 'merchant-ui-api.stripe.com'
        },
        DELAYS: {
            TYPING: 50,
            FIELD: 200,
            RETRY: 1000,
            MAX_RETRIES: 5
        }
    };

    // State Management
    const State = {
        processing: false,
        retryCount: 0,
        cardData: null,
        sessionId: null,
        log(message, data = '') {
            if (CONFIG.DEBUG) {
                console.log(`[STRIPE INTERCEPTOR] ${message}`, data);
            }
        }
    };

    // Frame Handler
    const FrameHandler = {
        getFrame(selector) {
            return document.querySelector(selector);
        },

        getFrameDocument(frame) {
            try {
                return frame.contentDocument || frame.contentWindow?.document;
            } catch (e) {
                State.log('Failed to access frame document:', e);
                return null;
            }
        },

        getInput(frame) {
            const doc = this.getFrameDocument(frame);
            return doc?.querySelector('input') || null;
        },

        async waitForFrames() {
            return new Promise((resolve) => {
                const check = () => {
                    const frames = {
                        number: this.getFrame(CONFIG.SELECTORS.FRAMES.NUMBER),
                        expiry: this.getFrame(CONFIG.SELECTORS.FRAMES.EXPIRY),
                        cvc: this.getFrame(CONFIG.SELECTORS.FRAMES.CVC)
                    };

                    if (frames.number && frames.expiry && frames.cvc) {
                        State.log('All frames found');
                        resolve(frames);
                    } else if (State.retryCount++ < CONFIG.DELAYS.MAX_RETRIES) {
                        setTimeout(check, CONFIG.DELAYS.RETRY);
                    } else {
                        State.log('Failed to find all frames');
                        resolve(null);
                    }
                };

                check();
            });
        }
    };

    // Card Handler
    const CardHandler = {
        async injectValue(frame, value) {
            const input = FrameHandler.getInput(frame);
            if (!input) {
                State.log('No input found in frame');
                return false;
            }

            try {
                // Clear field
                input.focus();
                input.value = '';
                this.dispatchEvent(input, 'change');

                // Type value
                for (const char of value.toString()) {
                    input.value += char;
                    this.simulateTyping(input, char);
                    await this.delay(CONFIG.DELAYS.TYPING);
                }

                this.dispatchEvent(input, 'change');
                this.dispatchEvent(input, 'blur');
                return true;

            } catch (e) {
                State.log('Injection error:', e);
                return false;
            }
        },

        simulateTyping(input, char) {
            const events = ['keydown', 'keypress', 'input', 'keyup'];
            events.forEach(type => {
                const event = new KeyboardEvent(type, {
                    key: char,
                    code: `Digit${char}`,
                    bubbles: true,
                    cancelable: true
                });
                input.dispatchEvent(event);
            });
        },

        dispatchEvent(element, type) {
            element.dispatchEvent(new Event(type, { bubbles: true }));
        },

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };

    // Payment Handler
    const PaymentHandler = {
        async start(cardData) {
            if (State.processing) return;
            State.processing = true;
            State.cardData = cardData;

            try {
                State.log('Starting payment injection...');
                const frames = await FrameHandler.waitForFrames();
                
                if (!frames) {
                    throw new Error('Required frames not found');
                }

                // Inject card number
                await CardHandler.injectValue(frames.number, cardData.number);
                await CardHandler.delay(CONFIG.DELAYS.FIELD);

                // Inject expiry
                const expiry = `${String(cardData.month).padStart(2, '0')}${String(cardData.year).slice(-2)}`;
                await CardHandler.injectValue(frames.expiry, expiry);
                await CardHandler.delay(CONFIG.DELAYS.FIELD);

                // Inject CVC
                await CardHandler.injectValue(frames.cvc, cardData.cvv);

                State.log('Card details injected successfully');
                this.notifySuccess();

            } catch (error) {
                State.log('Injection failed:', error);
                this.notifyFailure(error);

            } finally {
                State.processing = false;
            }
        },

        notifySuccess() {
            window.postMessage({ type: 'INJECTION_SUCCESS' }, '*');
            if (chrome?.runtime?.id) {
                chrome.runtime.sendMessage({ type: 'INJECTION_SUCCESS' });
            }
        },

        notifyFailure(error) {
            window.postMessage({ type: 'INJECTION_FAILED', error: error.message }, '*');
            if (chrome?.runtime?.id) {
                chrome.runtime.sendMessage({ type: 'INJECTION_FAILED', error: error.message });
            }
        }
    };

    // Message Handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'INJECT_CARD' && message.card) {
            PaymentHandler.start(message.card);
        }
    });

    // Initialize monitoring
    const observer = new MutationObserver((mutations) => {
        if (!State.processing && document.querySelector(CONFIG.SELECTORS.FRAMES.NUMBER)) {
            chrome.runtime.sendMessage({ type: 'FORM_READY' });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    State.log('Injection script initialized');
})();
