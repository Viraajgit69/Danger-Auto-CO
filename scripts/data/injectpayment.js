console.log("💳 Card Injection Script Loaded");

// Configuration for injection settings and selectors
const CONFIG = {
    selectors: {
        stripe: {
            number: [
                'input[data-elements-stable-field-name*="cardNumber"]',
                'input[name*="cardnumber"]',
                'input[name*="card-number"]',
                'input[placeholder*="card number"]',
                'input[id*="card"]',
                'input[aria-label*="card number"]'
            ],
            expiry: [
                'input[data-elements-stable-field-name*="cardExpiry"]',
                'input[name*="exp-date"]',
                'input[name*="expiry"]',
                'input[placeholder*="MM/YY"]',
                'input[id*="exp"]',
                'input[aria-label*="expiration"]'
            ],
            cvc: [
                'input[data-elements-stable-field-name*="cardCvc"]',
                'input[name*="cvc"]',
                'input[name*="cvv"]',
                'input[placeholder*="CVC"]',
                'input[id*="cvc"]',
                'input[aria-label*="security code"]'
            ],
            name: [
                'input[placeholder*="card holder"]',
                'input[name*="holdername"]',
                'input[name="name"]',
                'input[id*="name"]',
                'input[aria-label*="name on card"]'
            ]
        }
    },
    defaults: {
        bin: "48478345",
        expiryMinMonths: 12,
        expiryMaxMonths: 36,
        retryAttempts: 3,
        retryDelay: 100,
        initialDelay: 2000
    },
    debug: false
};

// Storage Management System
const StorageManager = {
    async get(keys) {
        return new Promise((resolve) => {
            try {
                if (chrome?.storage?.local) {
                    chrome.storage.local.get(keys, resolve);
                } else if (chrome?.storage?.sync) {
                    chrome.storage.sync.get(keys, resolve);
                } else {
                    console.warn("⚠️ No storage available, using defaults");
                    resolve({});
                }
            } catch (error) {
                console.warn("⚠️ Storage access failed:", error);
                resolve({});
            }
        });
    },

    async set(data) {
        return new Promise((resolve) => {
            try {
                if (chrome?.storage?.local) {
                    chrome.storage.local.set(data, resolve);
                } else if (chrome?.storage?.sync) {
                    chrome.storage.sync.set(data, resolve);
                } else {
                    console.warn("⚠️ No storage available");
                    resolve();
                }
            } catch (error) {
                console.warn("⚠️ Storage write failed:", error);
                resolve();
            }
        });
    }
};

// BIN Management System
const BINManager = {
    async getCurrentBIN() {
        try {
            const result = await StorageManager.get(["primaryBIN", "secondaryBIN", "currentBIN"]);
            const currentBINType = result.currentBIN || "primary";
            const bin = currentBINType === "primary" ? result.primaryBIN : result.secondaryBIN;
            
            if (!bin) {
                return CONFIG.defaults.bin;
            }
            
            return bin;
        } catch (error) {
            console.warn("⚠️ BIN retrieval failed:", error);
            return CONFIG.defaults.bin;
        }
    },

    async toggleBIN() {
        try {
            const result = await StorageManager.get(["primaryBIN", "secondaryBIN", "currentBIN"]);
            const currentType = result.currentBIN || "primary";
            const newType = currentType === "primary" ? "secondary" : "primary";
            
            if (!result[`${newType}BIN`]) {
                console.warn(`⚠️ No ${newType} BIN configured`);
                return false;
            }
            
            await StorageManager.set({ currentBIN: newType });
            return true;
        } catch (error) {
            console.error("❌ BIN switch failed:", error);
            return false;
        }
    }
};

// Card Generator System
const CardGenerator = {
    generateLuhn(partial) {
        let sum = 0;
        let alternate = false;
        
        // Process in reverse to handle length-16 numbers
        for (let i = partial.length - 1; i >= 0; i--) {
            let digit = parseInt(partial[i], 10);
            
            if (alternate) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            
            sum += digit;
            alternate = !alternate;
        }
        
        return ((Math.floor(sum / 10) + 1) * 10 - sum) % 10;
    },

    validateCardNumber(number) {
        if (!/^\d{16}$/.test(number)) {
            return false;
        }
        
        let sum = 0;
        let alternate = false;
        
        for (let i = number.length - 1; i >= 0; i--) {
            let digit = parseInt(number[i], 10);
            
            if (alternate) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            
            sum += digit;
            alternate = !alternate;
        }
        
        return (sum % 10) === 0;
    },

    async generateCard() {
        try {
            // Get current BIN
            const bin = await BINManager.getCurrentBIN();
            let cardNumber = bin;
            const remainingLength = 16 - bin.length;
            
            // Generate remaining digits
            for (let i = 0; i < remainingLength - 1; i++) {
                cardNumber += Math.floor(Math.random() * 10);
            }
            
            // Add Luhn check digit
            cardNumber += this.generateLuhn(cardNumber);
            
            // Validate the generated number
            if (!this.validateCardNumber(cardNumber)) {
                throw new Error("Generated card number failed validation");
            }
            
            return {
                number: cardNumber,
                expiry: this.generateExpiry(),
                cvc: this.generateCVC()
            };
        } catch (error) {
            console.error("❌ Card generation failed:", error);
            return null;
        }
    },

    generateExpiry() {
        const now = new Date();
        const minMonths = CONFIG.defaults.expiryMinMonths;
        const maxMonths = CONFIG.defaults.expiryMaxMonths;
        
        // Generate a future date between min and max months
        const monthsToAdd = Math.floor(Math.random() * (maxMonths - minMonths + 1)) + minMonths;
        const futureDate = new Date(now.getFullYear(), now.getMonth() + monthsToAdd, 1);
        
        const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
        const year = (futureDate.getFullYear() % 100).toString().padStart(2, '0');
        
        return `${month}/${year}`;
    },

    generateCVC() {
        return Math.floor(100 + Math.random() * 900).toString().padStart(3, '0');
    }
};

// Field Injection System
const FieldInjector = {
    async injectValue(element, value, maxRetries = CONFIG.defaults.retryAttempts) {
        if (!element || !value) return false;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                element.focus();
                element.value = value;
                
                // Dispatch events in sequence
                ['input', 'change', 'blur'].forEach(eventType => {
                    element.dispatchEvent(new Event(eventType, { bubbles: true }));
                });
                
                // Verify injection
                if (element.value === value) {
                    return true;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, CONFIG.defaults.retryDelay));
            } catch (error) {
                if (CONFIG.debug) {
                    console.warn(`⚠️ Injection attempt ${attempt + 1} failed:`, error);
                }
            }
        }
        
        return false;
    },

    findField(selectors, document) {
        for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    },

    async injectCardDetails() {
        try {
            console.log("🎯 Starting card detail injection");
            
            // Generate card details
            const card = await CardGenerator.generateCard();
            if (!card) {
                throw new Error("Failed to generate valid card");
            }
            
            // Get all possible injection contexts
            const contexts = [
                document,
                ...Array.from(document.querySelectorAll('iframe'))
                    .map(iframe => {
                        try {
                            return iframe.contentDocument || iframe.contentWindow.document;
                        } catch (e) {
                            return null;
                        }
                    })
                    .filter(Boolean)
            ];

            let injectedFields = 0;
            
            // Attempt injection in each context
            for (let doc of contexts) {
                for (let [fieldType, value] of Object.entries({
                    number: card.number,
                    expiry: card.expiry,
                    cvc: card.cvc
                })) {
                    const field = this.findField(CONFIG.selectors.stripe[fieldType], doc);
                    if (field && await this.injectValue(field, value)) {
                        console.log(`✅ Injected ${fieldType}: ${value}`);
                        injectedFields++;
                    }
                }
            }

            if (injectedFields === 0) {
                throw new Error("No fields were injected successfully");
            }

            return true;
        } catch (error) {
            console.error("❌ Card injection failed:", error);
            return false;
        }
    }
};

// Initialize event listeners
document.addEventListener('keydown', async function(e) {
    // Alt+B to switch BIN
    if (e.altKey && e.key === 'b') {
        if (await BINManager.toggleBIN()) {
            await FieldInjector.injectCardDetails();
        }
    }
    // Alt+I to inject card details
    else if (e.altKey && e.key === 'i') {
        await FieldInjector.injectCardDetails();
    }
});

// Initial injection attempt with delay
setTimeout(async () => {
    try {
        await FieldInjector.injectCardDetails();
    } catch (error) {
        console.error("❌ Initial injection failed:", error);
    }
}, CONFIG.defaults.initialDelay);

console.log("✅ Card injection script ready (Alt+I to inject, Alt+B to switch BIN)");
