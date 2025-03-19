console.log("Checking script execution...");
// Retrieve the BIN from Chrome Storage
function getUserBIN(callback) {
    chrome.storage.sync.get(["primaryBIN", "secondaryBIN"], function(result) {
        if (result.primaryBIN) {
            console.log("Using primary BIN");
            callback(result.primaryBIN);
        } else if (result.secondaryBIN) {
            console.log("Primary BIN not found, using secondary BIN");
            callback(result.secondaryBIN);
        } else {
            console.warn("⚠ No BIN found in settings. Using default test BIN.");
            callback("48478345"); // Fallback BIN if none is provided
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

// Generate random expiry date (1-2 years in the future)
function generateExpiryDate() {
    const currentDate = new Date();
    const month = Math.floor(Math.random() * 12) + 1;
    const year = currentDate.getFullYear() + Math.floor(Math.random() * 2) + 1;
    return `${month.toString().padStart(2, '0')}${(year % 100).toString().padStart(2, '0')}`;
}

// Generate random CVV
function generateCVV() {
    return Math.floor(100 + Math.random() * 900).toString();
}

// Generate random name
function generateRandomName() {
    const firstNames = ["John", "Jane", "Alex", "Sarah", "Michael", "Emma"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia"];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

// Helper function to fill field
function fillField(element, value) {
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
}

// Modify `fillPaymentDetails` to use dynamically generated card numbers
function fillPaymentDetails() {
    try {
        console.log("🔍 Searching for payment fields...");

        let iframes = document.querySelectorAll("iframe");

        if (iframes.length === 0) {
            console.warn("⚠ No iframes found. Autofill might not work.");
            return;
        }

        for (let iframe of iframes) {
            try {
                let doc = iframe.contentDocument || iframe.contentWindow.document;
                if (!doc) {
                    console.error("❌ Unable to access iframe document.");
                    continue;
                }

                // Autofill Card Number
                let cardNumberField = doc.querySelector('input[name="cardnumber"], input[id*="card"]');
                if (cardNumberField) {
                    generateCardNumber(function (generatedCardNumber) {
                        fillField(cardNumberField, generatedCardNumber);
                        console.log("💳 Card number autofilled:", generatedCardNumber);
                    });
                }

                // Autofill Expiry Date
                let expiryField = doc.querySelector('input[name="exp-date"], input[id*="exp"]');
                if (expiryField) {
                    fillField(expiryField, generateExpiryDate());
                    console.log("📆 Expiry date autofilled.");
                }

                // Autofill CVC
                let cvcField = doc.querySelector('input[name="cvc"], input[id*="cvc"]');
                if (cvcField) {
                    fillField(cvcField, generateCVV());
                    console.log("🔒 CVC autofilled.");
                }

                // Autofill Name on Card
                let nameField = doc.querySelector('input[name="name"], input[id*="name"]');
                if (nameField) {
                    fillField(nameField, generateRandomName());
                    console.log("📝 Cardholder name autofilled.");
                }

            } catch (iframeError) {
                console.error("❌ Error processing iframe:", iframeError);
            }
        }
    } catch (error) {
        console.error("❌ Payment autofill error:", error);
    }
}

// Add keyboard shortcut to switch BINs (Alt+B)
document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key === 'b') {
        chrome.storage.sync.get(["primaryBIN", "secondaryBIN", "currentBIN"], function(result) {
            const currentBIN = result.currentBIN || "primary";
            const newBIN = currentBIN === "primary" ? "secondary" : "primary";
            chrome.storage.sync.set({ currentBIN: newBIN }, function() {
                console.log(`🔄 Switched to ${newBIN} BIN`);
                fillPaymentDetails(); // Refill with new BIN
            });
        });
    }
});
