console.log("✅ Stripe Autofill Script Loaded");

// Default configuration
const DEFAULT_CONFIG = {
    primaryBIN: "424242",
    expiryYearOffset: 3,
    debugMode: true
};

// Track injected frames to prevent duplicate injections
const injectedFrames = new Set();

// Improved storage access
function getStorageData(key) {
    return new Promise((resolve) => {
        try {
            if (window.chrome && chrome.runtime && chrome.runtime.id) {
                chrome.storage.local.get([key], function(result) {
                    if (chrome.runtime.lastError) {
                        console.warn("⚠ Storage access error:", chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        resolve(result[key]);
                    }
                });
            } else {
                resolve(null);
            }
        } catch (error) {
            console.warn("⚠ Storage access failed:", error);
            resolve(null);
        }
    });
}

// Enhanced frame detection
function findStripeFrames() {
    return Array.from(document.querySelectorAll('iframe'))
        .filter(frame => {
            return (frame.name?.startsWith('__privateStripeFrame') || 
                   frame.src?.includes('js.stripe.com')) &&
                   !injectedFrames.has(frame); // Only return frames we haven't injected into yet
        });
}

// Generate payment data
async function generatePaymentData() {
    const bin = await getStorageData('primaryBIN') || DEFAULT_CONFIG.primaryBIN;
    const cardNumber = await generateCardNumber(bin);
    
    return {
        cardNumber,
        expiry: generateExpiryDate(),
        cvc: generateCVV()
    };
}

// Card number generation
async function generateCardNumber(bin) {
    try {
        let cardNumber = bin;
        const remainingLength = 16 - bin.length;

        for (let i = 0; i < remainingLength - 1; i++) {
            cardNumber += Math.floor(Math.random() * 10);
        }

        return cardNumber + calculateLuhnCheckDigit(cardNumber);
    } catch (error) {
        console.error("❌ Error generating card number:", error);
        return DEFAULT_CONFIG.primaryBIN + "4242424242";
    }
}

// Improved Stripe frame injection with deduplication
function injectIntoStripeFrame(frame, data) {
    // Check if we've already injected into this frame
    if (injectedFrames.has(frame)) {
        console.log("⚠ Frame already injected, skipping...");
        return;
    }

    try {
        const script = `
            (function() {
                // Prevent multiple injections
                if (window.__stripeAutofillInjected) return;
                window.__stripeAutofillInjected = true;

                const fillData = ${JSON.stringify(data)};
                
                function simulateInput(element, value) {
                    if (!element) return;
                    
                    const events = ['focus', 'input', 'change', 'blur'];
                    element.focus();
                    element.value = value;
                    
                    events.forEach(eventType => {
                        element.dispatchEvent(new Event(eventType, { bubbles: true }));
                    });
                }
                
                function fillFields() {
                    const selectors = {
                        cardNumber: '[name="cardnumber"], [data-elements-stable-field-name="cardNumber"]',
                        expiry: '[name="exp-date"], [data-elements-stable-field-name="cardExpiry"]',
                        cvc: '[name="cvc"], [data-elements-stable-field-name="cardCvc"]'
                    };

                    const fields = {
                        cardNumber: document.querySelector(selectors.cardNumber),
                        expiry: document.querySelector(selectors.expiry),
                        cvc: document.querySelector(selectors.cvc)
                    };

                    if (fields.cardNumber) simulateInput(fields.cardNumber, fillData.cardNumber);
                    if (fields.expiry) simulateInput(fields.expiry, fillData.expiry);
                    if (fields.cvc) simulateInput(fields.cvc, fillData.cvc);
                }

                // Initial fill attempt
                fillFields();

                // Watch for dynamic field additions
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.addedNodes.length) {
                            fillFields();
                        }
                    }
                });

                observer.observe(document.body, { 
                    childList: true, 
                    subtree: true 
                });
            })();
        `;

        frame.contentWindow.postMessage({
            type: 'stripe-autofill',
            script: script
        }, '*');

        // Mark this frame as injected
        injectedFrames.add(frame);
        console.log("📤 Successfully injected autofill script into Stripe frame");
    } catch (error) {
        console.error("❌ Failed to inject into frame:", error);
    }
}

// Main autofill function
async function fillPaymentDetails() {
    try {
        console.log("🔍 Searching for Stripe payment fields...");
        
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = 500;
        
        const attemptFill = async () => {
            const stripeFrames = findStripeFrames();
            
            if (stripeFrames.length > 0) {
                console.log(`✅ Found ${stripeFrames.length} new Stripe frame(s)`);
                
                const paymentData = await generatePaymentData();
                
                for (const frame of stripeFrames) {
                    if (frame.contentWindow) {
                        injectIntoStripeFrame(frame, paymentData);
                    } else {
                        frame.addEventListener('load', () => {
                            injectIntoStripeFrame(frame, paymentData);
                        }, { once: true }); // Ensure the listener only fires once
                    }
                }
                
                return stripeFrames.length > 0;
            }
            
            return false;
        };
        
        // Initial attempt
        if (await attemptFill()) return;
        
        // Set up retry mechanism
        const interval = setInterval(async () => {
            attempts++;
            
            if (await attemptFill() || attempts >= maxAttempts) {
                clearInterval(interval);
                if (attempts >= maxAttempts) {
                    console.log("⚠ Max attempts reached for finding Stripe frames");
                }
            }
        }, checkInterval);
        
    } catch (error) {
        console.error("❌ Payment autofill error:", error);
    }
}

// Utility functions remain unchanged
function calculateLuhnCheckDigit(number) {
    let sum = 0;
    let alternate = false;
    for (let i = number.length - 1; i >= 0; i--) {
        let n = parseInt(number[i], 10);
        if (alternate) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
        alternate = !alternate;
    }
    return (sum * 9) % 10;
}

function generateExpiryDate() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear() + Math.floor(Math.random() * 3) + 2;
    return `${month}/${String(year).slice(-2)}`;
}

function generateCVV() {
    return String(Math.floor(Math.random() * 900) + 100);
}

// Initialize
function initialize() {
    console.log("🚀 Initializing Stripe autofill...");
    fillPaymentDetails();
}

// Start when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
