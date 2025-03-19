console.log("✅ Autofill script loaded.");

// Configuration object for selectors and default values
const config = {
    fields: {
        // Billing/Shipping Information
        billingName: 'input[name="billingName"], input[name="name"], input[autocomplete*="name"], input[id*="name"]',
        cardholderName: 'input[placeholder*="card holder"], input[placeholder*="cardholder"], input[name*="holdername"], input[autocomplete="cc-name"], input[aria-label*="name on card"], input[aria-label*="cardholder"]',
        addressLine1: 'input[name="billingAddressLine1"], input[name="addressLine1"], input[name="address"], input[autocomplete*="address-line1"], input[id*="address"]',
        addressLine2: 'input[name="billingAddressLine2"], input[name="addressLine2"], input[autocomplete*="address-line2"]',
        city: 'input[name="billingLocality"], input[name="city"], input[autocomplete*="city"], input[id*="city"]',
        country: 'select[name="billingCountry"], select[name="country"], select[autocomplete*="country"]',
        state: 'input[name="billingAdministrativeArea"], select[name="state"], input[id*="state"], select[autocomplete*="state"]',
        postalCode: 'input[name="billingPostalCode"], input[name="postalCode"], input[name="zip"], input[autocomplete*="postal-code"], input[id*="zip"]',
        phone: 'input[name="phone"], input[id*="phone"], input[autocomplete*="tel"]',
        
        // Card Details (for initial fill)
        cardNumber: 'input[name="cardNumber"], input[name*="card-number"], input[data-elements-stable-field-name*="cardNumber"], input[aria-label*="card number"], input[placeholder*="card number"], iframe[name*="card"]',
        cardExpiry: 'input[name="cardExpiry"], input[name*="expir"], input[data-elements-stable-field-name*="cardExpiry"], input[aria-label*="expir"], input[placeholder*="MM"], iframe[name*="expir"]',
        cardCvc: 'input[name="cardCvc"], input[name*="cvc"], input[name*="cvv"], input[data-elements-stable-field-name*="cardCvc"], input[aria-label*="CVC"], input[placeholder*="CVC"], iframe[name*="cvc"]'
    },

    // Predefined card details
    cardDefaults: {
        cardNumber: '4242424242424242',
        cardExpiry: '12/32',
        cardCvc: '000'
    }
};

// Random data generators
const randomData = {
    firstNames: ['John', 'Michael', 'David', 'James', 'Robert', 'William', 'Joseph', 'Thomas', 'Christopher', 'Daniel'],
    lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']
};

// Generate random name
function generateRandomName() {
    const firstName = randomData.firstNames[Math.floor(Math.random() * randomData.firstNames.length)];
    const lastName = randomData.lastNames[Math.floor(Math.random() * randomData.lastNames.length)];
    return `${firstName} ${lastName}`;
}

// Wait for the page to fully load
window.onload = function() {
    console.log("🚀 Page loaded. Starting autofill process.");
    setTimeout(autofillCheckoutForm, 2000);
};

// Function to autofill checkout form fields
function autofillCheckoutForm() {
    try {
        console.log("🔍 Starting comprehensive form fill...");
        
        // Generate random name for this session
        const randomName = generateRandomName();
        
        // Prepare form data
        const formData = {
            name: randomName,
            cardholderName: randomName, // Use same random name for cardholder
            addressLine1: '123 Main Street',
            addressLine2: 'OK',
            city: 'Macao',
            state: 'Macau',
            country: 'MO',
            postalCode: '999078',
            phone: '+1 234-567-8900',
            ...config.cardDefaults // Include predefined card details
        };

        // Fill regular fields first
        Object.entries(config.fields).forEach(([key, selector]) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    fillField(element, formData[key] || '');
                    console.log(`✅ Filled ${key} field with: ${formData[key]}`);
                }
            });
        });

        // Handle iframes
        handleIframeFields(formData);

        console.log("✨ Form filling complete with random name and predefined data");
    } catch (error) {
        console.error("❌ Autofill error:", error);
    }
}

// Handle iframe fields
function handleIframeFields(formData) {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (!doc) return;

            // Handle cardholder name in iframes
            const cardholderNameInput = doc.querySelector('input[placeholder*="card holder"], input[placeholder*="cardholder"]');
            if (cardholderNameInput) {
                fillField(cardholderNameInput, formData.cardholderName);
                console.log('✅ Filled cardholder name in iframe');
            }

            // Fill card fields in iframes
            if (iframe.name.includes('card')) {
                const input = doc.querySelector('input');
                if (input && !input.placeholder?.toLowerCase().includes('name')) {
                    fillField(input, formData.cardNumber);
                }
            }
            if (iframe.name.includes('expir')) {
                const input = doc.querySelector('input');
                if (input) fillField(input, formData.cardExpiry);
            }
            if (iframe.name.includes('cvc')) {
                const input = doc.querySelector('input');
                if (input) fillField(input, formData.cardCvc);
            }
        } catch (e) {
            // Silent fail for cross-origin iframes
        }
    });
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

// Add MutationObserver to handle dynamically loaded elements
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            const hasNewFormFields = Array.from(mutation.addedNodes).some(node => 
                node.nodeType === 1 && // Element node
                Object.values(config.fields).some(selector => 
                    node.matches?.(selector) || node.querySelector?.(selector)
                )
            );
            
            if (hasNewFormFields) {
                console.log("🔄 New form fields detected, filling...");
                autofillCheckoutForm();
            }
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("✅ Autofill script ready.");
