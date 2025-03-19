console.log("✅ Stripe Autofill Script Loaded");

// Default configuration
const DEFAULT_CONFIG = {
    primaryBIN: "424242",
    expiryYearOffset: 3,
    debugMode: true
};

// Improved storage access with better error handling
function getStorageData(key) {
    return new Promise((resolve) => {
        try {
            // Check if we're in a content script context
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
            return frame.name?.startsWith('__privateStripeFrame') || 
                   frame.src?.includes('js.stripe.com');
        });
}

// Improved card data generation
async function generatePaymentData() {
    const bin = await getStorageData('primaryBIN') || DEFAULT_CONFIG.primaryBIN;
    const cardNumber = await generateCardNumber(bin);
    
    return {
        cardNumber,
        expiry: generateExpiryDate(),
        cvc: generateCVV()
    };
}

// Modified card number generation
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

// Improved Stripe frame communication
function injectIntoStripeFrame(frame, data) {
    try {
        // Create a script to handle autofill
        const script = `
            (function() {
                const fillData = ${JSON.stringify(data)};
                
                function simulateInput(element, value) {
                    if (!element) return;
                    
                    // Focus the element
                    element.focus();
                    
                    // Set the value
                    element.value = value;
                    
                    // Trigger events
                    ['input', 'change', 'blur'].forEach(eventType => {
                        element.dispatchEvent(new Event(eventType, { bubbles: true }));
                    });
                }
                
                // Wait for elements and fill them
                const observer = new MutationObserver(() => {
                    const cardNumber = document.querySelector('[name="cardnumber"], [data-elements-stable-field-name="cardNumber"]');
                    const expiry = document.querySelector('[name="exp-date"], [data-elements-stable-field-name="cardExpiry"]');
                    const cvc = document.querySelector('[name="cvc"], [data-elements-stable-field-name="cardCvc"]');
                    
                    if (cardNumber) simulateInput(cardNumber, fillData.cardNumber);
                    if (expiry) simulateInput(expiry, fillData.expiry);
                    if (cvc) simulateInput(cvc, fillData.cvc);
                });
                
                observer.observe(document.body, { 
                    childList: true, 
                    subtree: true 
                });
            })();
        `;

        // Inject the script into the frame
        frame.contentWindow.postMessage({
            type: 'stripe-autofill',
            script: script
        }, '*');

        console.log("📤 Injected autofill script into Stripe frame");
    } catch (error) {
        console.error("❌ Failed to inject into frame:", error);
    }
}

// Main autofill function
async function fillPaymentDetails() {
    try {
        console.log("🔍 Searching for Stripe payment fields...");
        
        let attempts = 0;
        const maxAttempts = 20;
        const checkInterval = 500;
        
        const attemptFill = async () => {
            const stripeFrames = findStripeFrames();
            
            if (stripeFrames.length > 0) {
                console.log(`✅ Found ${stripeFrames.length} Stripe frame(s)`);
                
                const paymentData = await generatePaymentData();
                
                for (const frame of stripeFrames) {
                    frame.addEventListener('load', () => {
                        injectIntoStripeFrame(frame, paymentData);
                    });
                    
                    // Also try immediate injection if frame is already loaded
                    if (frame.contentWindow) {
                        injectIntoStripeFrame(frame, paymentData);
                    }
                }
                
                return true;
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

// Utility functions (unchanged)
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
