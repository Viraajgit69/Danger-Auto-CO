console.log("✅ Autofill script loaded.");

// Wait for the page to fully load before attempting to autofill
window.onload = function () {
    console.log("🚀 Page loaded. Starting autofill process.");
    setTimeout(autofillCheckoutForm, 2000); // Small delay to ensure elements are loaded
};

// Function to autofill checkout form fields
function autofillCheckoutForm() {
    try {
        console.log("🔍 Searching for checkout fields...");
        
        // Autofill Name
        let nameField = document.querySelector('input[name="name"], input[id*="name"]');
        if (nameField) {
            fillField(nameField, generateRandomName());
            console.log("📝 Name autofilled.");
        }

        // Autofill Address
        let addressField = document.querySelector('input[name="address"], input[id*="address"]');
        if (addressField) {
            fillField(addressField, generateRandomAddress());
            console.log("📍 Address autofilled.");
        }

        // Autofill ZIP Code
        let zipField = document.querySelector('input[name="zip"], input[name="postal"], input[id*="zip"]');
        if (zipField) {
            fillField(zipField, generateRandomZIP());
            console.log("📮 ZIP Code autofilled.");
        }

        // Autofill Phone Number
        let phoneField = document.querySelector('input[name="phone"], input[id*="phone"]');
        if (phoneField) {
            fillField(phoneField, generateRandomPhoneNumber());
            console.log("📞 Phone number autofilled.");
        }

        // Autofill City
        let cityField = document.querySelector('input[name="city"], input[id*="city"]');
        if (cityField) {
            fillField(cityField, generateRandomCity());
            console.log("🏙️ City autofilled.");
        }

        // Autofill State
        let stateField = document.querySelector('input[name="state"], input[id*="state"], select[name="state"]');
        if (stateField) {
            fillField(stateField, generateRandomState());
            console.log("🌎 State autofilled.");
        }

        // Autofill Country
        let countryField = document.querySelector('input[name="country"], select[name="country"]');
        if (countryField) {
            fillField(countryField, "United States"); // Default to US
            console.log("🌍 Country autofilled.");
        }

        // Email field is intentionally **not filled** as per your request.
        console.log("⚠️ Email field left empty for manual input.");

    } catch (error) {
        console.error("❌ Autofill error:", error);
    }
}

// Helper function to fill a field with a value
function fillField(element, value) {
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
}

// Function to generate a random name
function generateRandomName() {
    const firstNames = ["John", "Jane", "Alex", "Chris", "Taylor", "Sam"];
    const lastNames = ["Smith", "Doe", "Johnson", "Brown", "Davis", "Miller"];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

// Function to generate a random address
function generateRandomAddress() {
    const streets = ["Main St", "Broadway", "Sunset Blvd", "Park Ave", "Maple St"];
    return `${Math.floor(Math.random() * 9999)} ${streets[Math.floor(Math.random() * streets.length)]}`;
}

// Function to generate a random ZIP code
function generateRandomZIP() {
    return `${Math.floor(10000 + Math.random() * 90000)}`;
}

// Function to generate a random phone number
function generateRandomPhoneNumber() {
    return `+1 ${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Function to generate a random city
function generateRandomCity() {
    const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "San Francisco"];
    return cities[Math.floor(Math.random() * cities.length)];
}

// Function to generate a random state
function generateRandomState() {
    const states = ["CA", "NY", "TX", "FL", "WA", "IL"];
    return states[Math.floor(Math.random() * states.length)];
}

console.log("✅ Autofill script execution completed.");
