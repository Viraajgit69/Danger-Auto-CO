console.log("💳 Card Injection Script Loaded");

// Configuration for field selectors specific to card injection
const cardFieldSelectors = {
    number: [
        'input[data-elements-stable-field-name*="cardNumber"]',
        'input[name*="card-number"]',
        'input[placeholder*="card number"]',
        'input[aria-label*="card number"]'
    ],
    expiry: [
        'input[data-elements-stable-field-name*="cardExpiry"]',
        'input[name*="expir"]',
        'input[placeholder*="MM/YY"]',
        'input[aria-label*="expiration"]'
    ],
    cvc: [
        'input[data-elements-stable-field-name*="cardCvc"]',
        'input[name*="cvc"]',
        'input[name*="cvv"]',
        'input[placeholder*="CVC"]',
        'input[aria-label*="security code"]'
    ]
};

// BIN Management System
const BINManager = {
    async getCurrentBIN() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(["primaryBIN", "secondaryBIN", "currentBIN"], function(result) {
                const currentBINType = result.currentBIN || "primary";
                const bin = currentBINType === "primary" ? result.primaryBIN : result.secondaryBIN;
                
                if (!bin) {
                    console.warn("⚠️ No BIN found, using fallback");
                    resolve("48478345"); // Fallback BIN
                    return;
                }
                
                console.log(`✅ Using ${currentBINType} BIN`);
                resolve(bin);
            });
        });
    },

    async switchBIN() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(["currentBIN"], function(result) {
                const newBINType = result.currentBIN === "primary" ? "secondary" : "primary";
                chrome.storage.sync.set({ currentBIN: newBINType }, function() {
                    console.log(`🔄 Switched to ${newBINType} BIN`);
                    resolve(newBINType);
                });
            });
        });
    }
};

// Card Generation System
const CardGenerator = {
    generateLuhn(partial) {
        let sum = 0;
        let alternate = false;
        for (let i = partial.length - 1; i >= 0; i--) {
            let n = parseInt(partial[i], 10);
            if (alternate) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            alternate = !alternate;
        }
        return (sum * 9) % 10;
    },

    async generateCard() {
        const bin = await BINManager.getCurrentBIN();
        let cardNumber = bin;
        const remainingLength = 16 - bin.length;
        
        for (let i = 0; i < remainingLength - 1; i++) {
            cardNumber += Math.floor(Math.random() * 10);
        }
        
        cardNumber += this.generateLuhn(cardNumber);
        return {
            number: cardNumber,
            expiry: this.generateExpiry(),
            cvc: this.generateCVC()
        };
    },

    generateExpiry() {
        const currentDate = new Date();
        const month = Math.floor(Math.random() * 12) + 1;
        const year = currentDate.getFullYear() + Math.floor(Math.random() * 2) + 1;
        return `${month.toString().padStart(2, '0')}${(year % 100).toString().padStart(2, '0')}`;
    },

    generateCVC() {
        return Math.floor(100 + Math.random() * 900).toString();
    }
};

// Field Injection System
const FieldInjector = {
    injectValue(element, value) {
        if (!element) return false;
        
        try {
            element.focus();
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        } catch (error) {
            console.error("❌ Injection failed:", error);
            return false;
        }
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
            const card = await CardGenerator.generateCard();
            
            // Handle both main document and iframes
            const contexts = [document, ...Array.from(document.querySelectorAll('iframe'))
                .map(iframe => {
                    try {
                        return iframe.contentDocument || iframe.contentWindow.document;
                    } catch (e) {
                        return null;
                    }
                }).filter(doc => doc)];

            for (let doc of contexts) {
                // Inject card number
                const numberField = this.findField(cardFieldSelectors.number, doc);
                if (numberField && this.injectValue(numberField, card.number)) {
                    console.log("💳 Card number injected:", card.number);
                }

                // Inject expiry
                const expiryField = this.findField(cardFieldSelectors.expiry, doc);
                if (expiryField && this.injectValue(expiryField, card.expiry)) {
                    console.log("📅 Expiry date injected:", card.expiry);
                }

                // Inject CVC
                const cvcField = this.findField(cardFieldSelectors.cvc, doc);
                if (cvcField && this.injectValue(cvcField, card.cvc)) {
                    console.log("🔒 CVC injected:", card.cvc);
                }
            }
        } catch (error) {
            console.error("❌ Card injection failed:", error);
        }
    }
};

// Keyboard Shortcuts
document.addEventListener('keydown', async function(e) {
    // Alt+B to switch BIN
    if (e.altKey && e.key === 'b') {
        await BINManager.switchBIN();
        await FieldInjector.injectCardDetails();
    }
    // Alt+I to inject card details
    else if (e.altKey && e.key === 'i') {
        await FieldInjector.injectCardDetails();
    }
});

// Initial injection attempt
setTimeout(() => FieldInjector.injectCardDetails(), 2000);

console.log("✅ Card injection script ready (Alt+I to inject, Alt+B to switch BIN)");
