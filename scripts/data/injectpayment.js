(() => {
    console.log("💳 Card Injection Script Loading...");
    
    const CONFIG = {
        DEBUG: true,
        TIMESTAMP: '2025-03-21 04:33:51',
        USER: 'Viraajgit69',
        SELECTORS: {
            CARD_NUMBER: '[data-elements-stable-field-name="cardNumber"]',
            CARD_EXPIRY: '[data-elements-stable-field-name="cardExpiry"]',
            CARD_CVC: '[data-elements-stable-field-name="cardCvc"]',
            SUBMIT_BUTTON: 'button[type="submit"], [data-testid="hosted-payment-submit-button"]',
            FRAMES: {
                NUMBER: 'iframe[name*="__privateStripeFrame"][name*="cardNumber"]',
                EXPIRY: 'iframe[name*="__privateStripeFrame"][name*="exp"]',
                CVC: 'iframe[name*="__privateStripeFrame"][name*="cvc"]'
            }
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

    // Add Submit Button Handler
    const SubmitHandler = {
        setupButton(button) {
            if (!button || button.hasAttribute('data-card-handler')) return;
            
            button.setAttribute('data-card-handler', 'true');
            button.addEventListener('click', (event) => {
                if (!State.processing) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log("injectpayment: Requesting new card");
                    this.requestNewCard();
                }
            });
        },

        requestNewCard() {
            if (State.processing) return;
            
            State.processing = true;
            chrome.runtime.sendMessage({ 
                type: 'REQUEST_CARD',
                timestamp: CONFIG.TIMESTAMP
            });
        },

        findAndSetupButton() {
            const button = document.querySelector(CONFIG.SELECTORS.SUBMIT_BUTTON);
            if (button) this.setupButton(button);
        }
    };

    // Keep your existing Frame Handler code
    const FrameHandler = {
        // ... your existing FrameHandler code ...
    };

    // Keep your existing Card Handler code
    const CardHandler = {
        // ... your existing CardHandler code ...
    };

    // Modify your Payment Handler
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

                // Inject card data
                await CardHandler.injectValue(frames.number, cardData.number);
                await CardHandler.delay(CONFIG.DELAYS.FIELD);

                const expiry = `${String(cardData.month).padStart(2, '0')}${String(cardData.year).slice(-2)}`;
                await CardHandler.injectValue(frames.expiry, expiry);
                await CardHandler.delay(CONFIG.DELAYS.FIELD);

                await CardHandler.injectValue(frames.cvc, cardData.cvv);

                State.log('Card details injected successfully');
                this.notifySuccess();

            } catch (error) {
                State.log('Injection failed:', error);
                this.notifyFailure(error);

            } finally {
                State.processing = false;
            }
        }
    };

    // Modify Message Handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'CARD_DATA' && message.card) {
            console.log('injectpayment: Received message:', message);
            console.log('injectpayment.ts: Received new card:', JSON.stringify(message.card));
            PaymentHandler.start(message.card);
        }

        if (message.type === 'PAUSE_RETRY') {
            console.log('injectpayment.ts: Received PAUSE_RETRY message, pausing retries');
            State.processing = false;
        }
    });

    // Initialize monitoring
    const observer = new MutationObserver((mutations) => {
        SubmitHandler.findAndSetupButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial setup
    SubmitHandler.findAndSetupButton();
    State.log('Injection script initialized');
})();
