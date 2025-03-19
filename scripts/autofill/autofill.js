console.log("✅ Autofill script loaded.");

// Configuration object for selectors and default values
const config = {
    fields: {
        // Comprehensive field selectors from your working script
        billingName: 'input[name="billingName"], input[name="name"], input[autocomplete*="name"], input[id*="name"]',
        addressLine1: 'input[name="billingAddressLine1"], input[name="addressLine1"], input[name="address"], input[autocomplete*="address-line1"], input[id*="address"]',
        addressLine2: 'input[name="billingAddressLine2"], input[name="addressLine2"], input[autocomplete*="address-line2"]',
        city: 'input[name="billingLocality"], input[name="city"], input[autocomplete*="city"], input[id*="city"]',
        country: 'select[name="billingCountry"], select[name="country"], select[autocomplete*="country"]',
        state: 'input[name="billingAdministrativeArea"], select[name="state"], input[id*="state"], select[autocomplete*="state"]',
        postalCode: 'input[name="billingPostalCode"], input[name="postalCode"], input[name="zip"], input[autocomplete*="postal-code"], input[id*="zip"]',
        phone: 'input[name="phone"], input[id*="phone"], input[autocomplete*="tel"]',
        cardNumber: 'input[name="cardNumber"], input[name*="card"], input[data-elements-stable-field-name*="cardNumber"], input[aria-label*="card"], input[placeholder*="card"], iframe[name*="card"]',
        cardExpiry: 'input[name="cardExpiry"], input[name*="expir"], input[data-elements-stable-field-name*="cardExpiry"], input[aria-label*="expir"], input[placeholder*="MM"], iframe[name*="expir"]',
        cardCvc: 'input[name="cardCvc"], input[name*="cvc"], input[name*="cvv"], input[data-elements-stable-field-name*="cardCvc"], input[aria-label*="CVC"], input[placeholder*="CVC"], iframe[name*="cvc"]',
        email: 'input[type="email"], input[name="email"], input[autocomplete*="email"]'
    },
    defaultAddress: {
        name: "𝘿𝘼𝙉𝙂𝙀𝙍 𝘿𝘼𝘿𝘿𝙔",
        addressLine1: "123 Main Street",
        addressLine2: "Apt 4B",
        city: "New York",
        country: "US",
        state: "NY",
        postalCode: "10001",
        phone: "+1 234-567-8900"
    }
};

// Wait for the page to fully load before attempting to autofill
window.onload = function() {
    console.log("🚀 Page loaded. Starting autofill process.");
    setTimeout(autofillCheckoutForm, 2000); // Small delay to ensure elements are loaded
};

// Function to handle iframe fields
function handleIframeFields() {
    console.log("🔍 Searching for iframe fields...");
    const iframes = document.querySelectorAll('iframe[name*="card"], iframe[name*="expir"], iframe[name*="cvc"]');
    
    iframes.forEach(iframe => {
        try {
            const input = iframe.contentDocument.querySelector('input');
            if (input) {
                if (iframe.name.includes('card')) {
                    fillField(input, generateCardNumber());
                    console.log("💳 Card number filled in iframe");
                }
                if (iframe.name.includes('expir')) {
                    fillField(input, generateExpiryDate());
                    console.log("📅 Expiry date filled in iframe");
                }
                if (iframe.name.includes('cvc')) {
                    fillField(input, generateCVC());
                    console.log("🔒 CVC filled in iframe");
                }
            }
        } catch (e) {
            console.log("⚠️ Cross-origin iframe access restricted", e);
        }
    });
}

// Function to unlock readonly and disabled fields
function unlockFields() {
    const fields = document.querySelectorAll('input[disabled], select[disabled], input[readonly], select[readonly]');
    fields.forEach(field => {
        field.removeAttribute('disabled');
        field.removeAttribute('readonly');
        console.log("🔓 Unlocked field:", field);
    });
}

// Function to autofill checkout form fields
function autofillCheckoutForm() {
    try {
        console.log("🔍 Starting comprehensive form fill...");
        
        // First unlock any locked fields
        unlockFields();

        // Handle iframe fields first
        handleIframeFields();

        // Fill regular fields
        Object.entries(config.fields).forEach(([key, selector]) => {
            const field = document.querySelector(selector);
            if (field && key !== 'email') { // Skip email as per requirement
                let value = config.defaultAddress[key] || generateRandomValue(key);
                fillField(field, value);
                console.log(`✅ Filled ${key} field`);
            }
        });

        console.log("✨ Form filling complete");

    } catch (error) {
        console.error("❌ Autofill error:", error);
    }
}

// Helper function to fill a field with a value
function fillField(element, value) {
    try {
        element.focus();
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
    } catch (error) {
        console.error("❌ Error filling field:", error);
        return false;
    }
}

// Function to generate random values based on field type
function generateRandomValue(fieldType) {
    switch (fieldType) {
        case 'cardNumber':
            return generateCardNumber();
        case 'cardExpiry':
            return generateExpiryDate();
        case 'cardCvc':
            return generateCVC();
        case 'phone':
            return generateRandomPhoneNumber();
        case 'postalCode':
            return generateRandomZIP();
        case 'state':
            return generateRandomState();
        case 'city':
            return generateRandomCity();
        default:
            return config.defaultAddress[fieldType] || '';
    }
}

// Existing helper functions with improvements
function generateRandomName() {
    return "𝘿𝘼𝙉𝙂𝙀𝙍 𝘿𝘼𝘿𝘿𝙔";
}

function generateCardNumber() {
    // This should be replaced with your actual card number generation logic
    return "4242424242424242";
}

function generateExpiryDate() {
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const year = String(new Date().getFullYear() + 1).slice(-2);
    return `${month}${year}`;
}

function generateCVC() {
    return String(Math.floor(Math.random() * 900) + 100);
}

function generateRandomPhoneNumber() {
    return `+1 ${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateRandomZIP() {
    return `${Math.floor(10000 + Math.random() * 90000)}`;
}

function generateRandomCity() {
    const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "San Francisco"];
    return cities[Math.floor(Math.random() * cities.length)];
}

function generateRandomState() {
    const states = ["CA", "NY", "TX", "FL", "WA", "IL"];
    return states[Math.floor(Math.random() * states.length)];
}

// Add MutationObserver to handle dynamically loaded elements
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            console.log("🔄 New elements detected, checking for form fields...");
            autofillCheckoutForm();
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("✅ Autofill script execution completed.");
