(() => {
    const CONFIG = {
        VERSION: '1.4.1',
        TIMESTAMP: '2025-03-21 04:16:36',
        USER: 'Viraajgit69'
    };

    // State for tracking intercepted data
    const state = {
        lastResponse: null,
        paymentInfo: null,
        retryPaused: false
    };

    // Stripe API interceptor
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        if (url.includes('stripe.com')) {
            console.log('[STRIPE INTERCEPTOR] Fetch intercepted:', url);
            
            try {
                const response = await originalFetch.apply(this, arguments);
                const clonedResponse = response.clone();

                // Process response based on URL
                if (url.includes('/payment_methods') || 
                    url.includes('/payment_pages') || 
                    url.includes('/confirm')) {
                    
                    console.log('[STRIPE INTERCEPTOR] Processing response from:', url);
                    
                    try {
                        const jsonData = await clonedResponse.json();
                        console.log('[STRIPE INTERCEPTOR] Processing JSON response data');

                        // Handle decline codes
                        if (jsonData.error) {
                            const declineCode = jsonData.error.decline_code || jsonData.error.code;
                            if (declineCode) {
                                console.log('[STRIPE INTERCEPTOR] Decline code found:', declineCode);
                                handleDeclinedPayment(declineCode, jsonData.error);
                            }
                        }

                        // Extract payment information
                        if (url.includes('/payment_pages')) {
                            const paymentInfo = {
                                amountDue: jsonData.amount || 0,
                                currency: jsonData.currency || 'usd',
                                customerEmail: jsonData.customer_email || '',
                                successUrl: jsonData.success_url || '',
                                businessUrl: new URL(jsonData.success_url || '').origin,
                                timestamp: CONFIG.TIMESTAMP
                            };

                            console.log('[STRIPE INTERCEPTOR] Payment info extracted:', JSON.stringify(paymentInfo));
                            state.paymentInfo = paymentInfo;

                            // Send payment info to other components
                            chrome.runtime.sendMessage({
                                type: 'PAYMENT_INFO',
                                data: paymentInfo
                            });
                        }

                        // Handle payment confirmation
                        if (url.includes('/confirm')) {
                            handlePaymentConfirmation(jsonData);
                        }

                    } catch (error) {
                        console.error('Error processing response:', error);
                    }
                }

                return response;
            } catch (error) {
                console.error('Fetch error:', error);
                return originalFetch.apply(this, arguments);
            }
        }
        return originalFetch.apply(this, arguments);
    };

    function handleDeclinedPayment(declineCode, error) {
        chrome.runtime.sendMessage({
            type: 'CARD_DECLINED',
            data: {
                code: declineCode,
                message: error.message,
                timestamp: CONFIG.TIMESTAMP
            }
        });

        if (!state.retryPaused) {
            console.log('injectpayment.ts: Received PAUSE_RETRY message, pausing retries');
            state.retryPaused = true;
            
            // Request new card after delay
            setTimeout(() => {
                chrome.runtime.sendMessage({ type: 'REQUEST_CARD' });
                state.retryPaused = false;
            }, 2000);
        }
    }

    function handlePaymentConfirmation(jsonData) {
        if (jsonData.status === 'succeeded') {
            chrome.runtime.sendMessage({
                type: 'PAYMENT_SUCCESS',
                data: {
                    ...state.paymentInfo,
                    timestamp: CONFIG.TIMESTAMP
                }
            });
        } else if (jsonData.error) {
            handleDeclinedPayment(
                jsonData.error.decline_code || jsonData.error.code,
                jsonData.error
            );
        }
    }

    // Branding modification
    function modifyBranding() {
        console.log('[STRIPE INTERCEPTOR] Modifying branding colors');
        // Add your branding modification code here
    }

    // Initialize
    function initialize() {
        // Set up observers and initial state
        const observer = new MutationObserver(() => {
            if (state.paymentInfo) {
                modifyBranding();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('Response interceptor initialized:', {
            version: CONFIG.VERSION,
            timestamp: CONFIG.TIMESTAMP,
            user: CONFIG.USER
        });
    }

    // Start when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
