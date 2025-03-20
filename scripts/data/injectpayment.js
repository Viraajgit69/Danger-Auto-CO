console.log("💳 Card Injection Script Loaded");

// Configuration
const INJECTION_CONFIG = {
    STORAGE: {
        KEYS: {
            PRIMARY_BIN: 'primaryBIN',
            SECONDARY_BIN: 'secondaryBIN',
            CURRENT_BIN: 'currentBIN',
            EXTENSION_ENABLED: 'extensionEnabled'
        }
    },
    STRIPE: {
        FRAME_SELECTORS: {
            NUMBER: [
                'iframe[name*="__privateStripeFrame"][name*="cardNumber"]',
                'iframe[name*="__privateStripeElement"][name*="cardNumber"]',
                'iframe[title*="Card number"]',
                'iframe[id*="card-number"]'
            ],
            EXPIRY: [
                'iframe[name*="__privateStripeFrame"][name*="exp"]',
                'iframe[name*="__privateStripeElement"][name*="expiry"]',
                'iframe[title*="expiration date"]'
            ],
            CVC: [
                'iframe[name*="__privateStripeFrame"][name*="cvc"]',
                'iframe[name*="__privateStripeElement"][name*="cvc"]',
                'iframe[title*="security code"]'
            ]
        },
        INPUT_SELECTORS: {
            NUMBER: 'input[data-elements-stable-field-name="cardNumber"]',
            EXPIRY: 'input[data-elements-stable-field-name="cardExpiry"]',
            CVC: 'input[data-elements-stable-field-name="cardCvc"]'
        },
        TIMING: {
            INITIAL_DELAY: 800,
            FRAME_CHECK_INTERVAL: 300,
            INJECTION_DELAY: 50,
            MAX_RETRIES: 5,
            FRAME_READY_TIMEOUT: 2000
        }
    }
};

// Storage Manager
const StorageManager = {
    async getBINs() {
        try {
            const result = await new Promise((resolve) => {
                chrome.storage.local.get([
                    INJECTION_CONFIG.STORAGE.KEYS.PRIMARY_BIN,
                    INJECTION_CONFIG.STORAGE.KEYS.SECONDARY_BIN,
                    INJECTION_CONFIG.STORAGE.KEYS.EXTENSION_ENABLED,
                    INJECTION_CONFIG.STORAGE.KEYS.CURRENT_BIN
                ], resolve);
            });

            if (!result[INJECTION_CONFIG.STORAGE.KEYS.EXTENSION_ENABLED]) {
                throw new Error('Extension is disabled');
            }

            if (!result[INJECTION_CONFIG.STORAGE.KEYS.PRIMARY_BIN] && !result[INJECTION_CONFIG.STORAGE.KEYS.SECONDARY_BIN]) {
                throw new Error('No BINs provided');
            }

            return {
                primaryBin: result[INJECTION_CONFIG.STORAGE.KEYS.PRIMARY_BIN],
                secondaryBin: result[INJECTION_CONFIG.STORAGE.KEYS.SECONDARY_BIN],
                currentBin: result[INJECTION_CONFIG.STORAGE.KEYS.CURRENT_BIN] || 'primary'
            };
        } catch (error) {
            console.error('Failed to get BINs:', error.message);
            throw error;
        }
    },

    async getNextBIN() {
        const bins = await this.getBINs();
        const nextBin = bins.currentBin === 'primary' ? 
            (bins.secondaryBin || bins.primaryBin) : 
            bins.primaryBin;

        await this.saveCurrentBin(nextBin === bins.primaryBin ? 'primary' : 'secondary');
        return nextBin;
    },

    async saveCurrentBin(type) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ 
                [INJECTION_CONFIG.STORAGE.KEYS.CURRENT_BIN]: type 
            }, resolve);
        });
    }
};

// Card Generator
const CardGenerator = {
    generateLuhn(partial) {
        let sum = 0;
        let isEven = false;
        
        for (let i = partial.length - 1; i >= 0; i--) {
            let digit = parseInt(partial[i]);
            
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        const checkDigit = (Math.ceil(sum / 10) * 10 - sum) % 10;
        return partial + checkDigit;
    },

    async generateCard() {
        try {
            const bin = await StorageManager.getNextBIN();
            if (!bin) throw new Error('No valid BIN available');

            const remainingLength = 16 - bin.length;
            const randomDigits = Array.from(
                { length: remainingLength - 1 },
                () => Math.floor(Math.random() * 10)
            ).join('');

            const now = new Date();
            const month = Math.floor(Math.random() * 12) + 1;
            const year = now.getFullYear() + Math.floor(Math.random() * 5) + 1;

            return {
                number: this.generateLuhn(bin + randomDigits),
                month: month,
                year: year,
                cvv: Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('')
            };
        } catch (error) {
            console.error('Card generation failed:', error.message);
            throw error;
        }
    }
};

// Enhanced Stripe Handler
const StripeHandler = {
    async waitForFrame(selectors) {
        return new Promise((resolve) => {
            const checkFrame = () => {
                for (const selector of selectors) {
                    const frame = document.querySelector(selector);
                    if (frame) {
                        resolve(frame);
                        return;
                    }
                }
                setTimeout(checkFrame, INJECTION_CONFIG.STRIPE.TIMING.FRAME_CHECK_INTERVAL);
            };
            checkFrame();
        });
    },

    async waitForFrameLoad(frame) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Frame load timeout'));
            }, INJECTION_CONFIG.STRIPE.TIMING.FRAME_READY_TIMEOUT);

            const checkFrame = () => {
                try {
                    const doc = frame.contentDocument || frame.contentWindow?.document;
                    if (doc) {
                        clearTimeout(timeout);
                        resolve(doc);
                    } else {
                        setTimeout(checkFrame, 100);
                    }
                } catch (e) {
                    clearTimeout(timeout);
                    reject(new Error('Cross-origin frame access denied'));
                }
            };
            checkFrame();
        });
    },

    async injectIntoFrame(frame, value, fieldType) {
        let attempts = 0;
        const maxAttempts = INJECTION_CONFIG.STRIPE.TIMING.MAX_RETRIES;

        while (attempts < maxAttempts) {
            try {
                const doc = await this.waitForFrameLoad(frame);
                const input = doc.querySelector('input[class*="InputElement"]');
                if (!input) throw new Error('Input element not found');

                // Clear and focus
                input.focus();
                input.value = '';
                input.dispatchEvent(new Event('change', { bubbles: true }));
                await new Promise(r => setTimeout(r, 50));

                // Type value
                for (const char of value.toString()) {
                    input.value += char;
                    
                    const events = ['keydown', 'keypress', 'keyup', 'input', 'change'];
                    for (const event of events) {
                        input.dispatchEvent(new KeyboardEvent(event, {
                            key: char,
                            code: `Digit${char}`,
                            keyCode: char.charCodeAt(0),
                            which: char.charCodeAt(0),
                            bubbles: true,
                            cancelable: true,
                            composed: true
                        }));
                        await new Promise(r => setTimeout(r, 5));
                    }
                }

                // Verify injection
                if (input.value !== value.toString()) {
                    throw new Error('Value verification failed');
                }

                // Final events
                input.dispatchEvent(new Event('blur', { bubbles: true }));
                input.dispatchEvent(new CustomEvent('stripeElementUpdate', {
                    bubbles: true,
                    detail: { complete: true, value }
                }));

                return true;

            } catch (error) {
                console.warn(`Injection attempt ${attempts + 1} failed for ${fieldType}:`, error.message);
                attempts++;
                if (attempts < maxAttempts) {
                    await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempts)));
                }
            }
        }
        throw new Error(`Frame injection failed for ${fieldType} after ${maxAttempts} attempts`);
    }
};

// Auto Payment Handler
const AutoPayment = {
    isProcessing: false,

    async start() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const frames = await this.detectStripeForm();
            if (!frames) {
                throw new Error('Stripe form not found');
            }

            const card = await CardGenerator.generateCard();
            console.log('💳 Generated card:', {
                number: card.number.replace(/(\d{6})\d{6}(\d{4})/, '$1******$2'),
                expiry: `${card.month}/${card.year}`,
                cvv: '***'
            });

            await this.injectCardDetails(frames, card);
            console.log('✅ Card details injected successfully');

        } catch (error) {
            console.error('❌ Payment process failed:', error.message);
        } finally {
            this.isProcessing = false;
        }
    },

    async detectStripeForm() {
        try {
            const numberFrame = await StripeHandler.waitForFrame(INJECTION_CONFIG.STRIPE.FRAME_SELECTORS.NUMBER);
            const expiryFrame = await StripeHandler.waitForFrame(INJECTION_CONFIG.STRIPE.FRAME_SELECTORS.EXPIRY);
            const cvcFrame = await StripeHandler.waitForFrame(INJECTION_CONFIG.STRIPE.FRAME_SELECTORS.CVC);

            return {
                number: numberFrame,
                expiry: expiryFrame,
                cvc: cvcFrame
            };
        } catch (error) {
            console.error('Failed to detect Stripe form:', error);
            return null;
        }
    },

    async injectCardDetails(frames, card) {
        const tasks = [];

        // Card Number
        if (frames.number) {
            tasks.push(
                StripeHandler.injectIntoFrame(frames.number, card.number, 'card number')
                    .then(() => true)
                    .catch(() => false)
            );
        }

        // Expiry
        if (frames.expiry) {
            const expiry = `${card.month.toString().padStart(2, '0')}${card.year.toString().slice(-2)}`;
            tasks.push(
                StripeHandler.injectIntoFrame(frames.expiry, expiry, 'expiry')
                    .then(() => true)
                    .catch(() => false)
            );
        }

        // CVC
        if (frames.cvc) {
            tasks.push(
                StripeHandler.injectIntoFrame(frames.cvc, card.cvv, 'cvc')
                    .then(() => true)
                    .catch(() => false)
            );
        }

        const results = await Promise.all(tasks);
        if (!results.every(Boolean)) {
            throw new Error('Failed to inject all card details');
        }
    }
};

// Form Observer
const FormObserver = {
    init() {
        setTimeout(() => {
            this.initialize();
        }, INJECTION_CONFIG.STRIPE.TIMING.INITIAL_DELAY);
    },

    initialize() {
        const observer = new MutationObserver((mutations) => {
            if (!AutoPayment.isProcessing && this.shouldProcessMutations(mutations)) {
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
            // Check for added nodes
            if (mutation.addedNodes.length) {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== 1) return false;
                    
                    // Check if it's a Stripe iframe or contains one
                    const isStripeFrame = node.tagName === 'IFRAME' && 
                        (node.src?.includes('js.stripe.com') || 
                         node.name?.includes('__privateStripeFrame'));
                         
                    if (isStripeFrame) return true;
                    
                    // Check for nested frames
                    return !!node.querySelector(
                        INJECTION_CONFIG.STRIPE.FRAME_SELECTORS.NUMBER.join(',')
                    );
                });
            }

            // Check attribute changes on iframes
            return mutation.type === 'attributes' && 
                   mutation.target.tagName === 'IFRAME' &&
                   (mutation.target.src?.includes('js.stripe.com') ||
                    mutation.target.name?.includes('__privateStripeFrame'));
        });
    }
};

// Initialize
FormObserver.init();
console.log("✅ Auto payment script ready");
