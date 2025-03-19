console.log("✅ Stripe Autofill Script Loaded");

// Utility function to wait for elements
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            if (Date.now() - startTime >= timeout) {
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                return;
            }
            
            requestAnimationFrame(checkElement);
        };
        
        checkElement();
    });
}

// Retrieve the BIN from Chrome Storage
function getUserBIN(callback) {
    chrome.storage.sync.get(["primaryBIN"], function(result) {
        if (result.primaryBIN) {
            callback(result.primaryBIN);
        } else {
            console.warn("⚠ No BIN found in settings. Using default test BIN.");
            callback("424242"); // Fallback BIN if none is provided
        }
    });
}

// Function to generate a card number using the provided BIN
function generateCardNumber(callback) {
    getUserBIN(function(bin) {
        let cardNumber = bin; // Start with the user-provided BIN
        let remainingLength = 16 - bin.length; // Ensure card number is 16 digits

        // Generate random remaining digits
        for (let i = 0; i < remainingLength - 1; i++) {
            cardNumber += Math.floor(Math.random() * 10);
        }

        // Calculate Luhn check digit
        cardNumber += calculateLuhnCheckDigit(cardNumber);
        callback(cardNumber);
    });
}

// Function to calculate Luhn check digit
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

// Generate random expiry date (current month + 2-5 years)
function generateExpiryDate() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear() + Math.floor(Math.random() * 3) + 2;
    return `${month}/${String(year).slice(-2)}`;
}

// Generate random CVV
function generateCVV() {
    return String(Math.floor(Math.random() * 900) + 100);
}

// Function to handle postMessage communication with Stripe iframes
function setupStripeFrameListener() {
    window.addEventListener('message', function(event) {
        // Verify the message origin is from Stripe
        if (event.origin === 'https://js.stripe.com') {
            if (event.data.type === 'stripe-frame-ready') {
                console.log("🔄 Stripe frame signaled ready - initiating autofill");
                fillPaymentDetails();
            }
        }
    });
}

// Modified fillPaymentDetails function with improved iframe handling
function fillPaymentDetails() {
    try {
        console.log("🔍 Searching for Stripe payment fields...");
        
        // Find all Stripe iframes
        const stripeFrameCheck = setInterval(() => {
            const stripeFrames = Array.from(document.querySelectorAll('iframe[name^="__privateStripeFrame"]'));
            
            if (stripeFrames.length > 0) {
                clearInterval(stripeFrameCheck);
                console.log("✅ Stripe frames detected:", stripeFrames.length);
                
                stripeFrames.forEach(frame => {
                    frame.addEventListener('load', () => {
                        generateCardNumber(function(cardNumber) {
                            // Prepare autofill data
                            const autofillData = {
                                type: 'stripe-autofill',
                                data: {
                                    cardNumber: cardNumber,
                                    expiry: generateExpiryDate(),
                                    cvc: generateCVV()
                                }
                            };

                            // Attempt to communicate with the frame
                            try {
                                frame.contentWindow.postMessage(autofillData, 'https://js.stripe.com');
                                console.log("📤 Sent autofill data to Stripe frame");
                            } catch (postError) {
                                console.error("❌ Failed to send data to frame:", postError);
                            }
                        });
                    });
                });
            }
        }, 500);
        
        // Set timeout after 10 seconds to stop checking
        setTimeout(() => clearInterval(stripeFrameCheck), 10000);
        
    } catch (error) {
        console.error("❌ Payment autofill error:", error);
    }
}

// Set up MutationObserver to watch for dynamically added Stripe frames
const stripeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            const stripeFrame = Array.from(mutation.addedNodes)
                .find(node => node.tagName === 'IFRAME' && node.name?.startsWith('__privateStripeFrame'));
            
            if (stripeFrame) {
                console.log("🔄 Stripe frame dynamically added - initiating autofill");
                fillPaymentDetails();
            }
        }
    });
});

// Initialize the script
function initialize() {
    console.log("🚀 Initializing Stripe autofill...");
    
    // Start observing DOM changes
    stripeObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Set up message listener for Stripe frames
    setupStripeFrameListener();
    
    // Attempt initial autofill
    setTimeout(fillPaymentDetails, 1000);
}

// Start the initialization when the document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
