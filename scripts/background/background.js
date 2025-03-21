console.log("✅ Background script loaded.");

const CONFIG = {
    BOT_TOKEN: "7890377108:AAFgiveInFKUPhn7S8t7zNRjZMQZn-1rKVk",
    ADMIN_ID: "7345260405"
};

// State management
const state = {
    processing: false
};

// Card Generation System
const CardGenerator = {
    async generateCard() {
        return new Promise(async (resolve) => {
            const result = await chrome.storage.local.get(['primaryBIN', 'secondaryBIN', 'extensionEnabled']);
            
            if (!result.extensionEnabled) {
                console.log('Extension is disabled');
                resolve(null);
                return;
            }

            if (!result.primaryBIN && !result.secondaryBIN) {
                console.log('No BIN configured');
                resolve(null);
                return;
            }

            const bin = result.primaryBIN || result.secondaryBIN;
            const card = this.generateFromBin(bin);
            
            console.log('Generated new card:', {
                number: card.number,
                month: card.month,
                year: card.year,
                cvv: '***'
            });
            
            resolve(card);
        });
    },

    generateFromBin(bin) {
        let cardNumber = bin;
        while (cardNumber.length < 15) {
            cardNumber += Math.floor(Math.random() * 10);
        }

        // Add Luhn check digit
        let sum = 0;
        let isEven = true;
        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let digit = parseInt(cardNumber[i]);
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            isEven = !isEven;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        cardNumber += checkDigit;

        // Generate expiry and CVV
        const currentYear = new Date().getFullYear();
        const year = currentYear + Math.floor(Math.random() * 4) + 3;
        const month = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');
        const cvv = (Math.floor(Math.random() * 900) + 100).toString();

        return {
            number: cardNumber,
            month: month,
            year: year.toString(),
            cvv: cvv
        };
    }
};

// Message Handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "send_otp" && message.telegramId) {
        sendOTPToTelegram(message.telegramId, sendResponse);
        return true;
    }

    if (message.type === "REQUEST_CARD") {
        console.log("Received card request from tab:", sender.tab.id);
        if (state.processing) {
            console.log("Card generation already in progress");
            return true;
        }
        
        state.processing = true;
        CardGenerator.generateCard().then(card => {
            state.processing = false;
            if (!card) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'CARD_ERROR',
                    error: 'Failed to generate card. Please check your BIN configuration.'
                });
                return;
            }

            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'CARD_DATA',
                card: card
            });
        });
        return true;
    }
});

// Function to send OTP request to Telegram
function sendOTPToTelegram(telegramId, sendResponse) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    chrome.storage.local.set({ otp: otp }, function() {
        console.log('Generated OTP:', otp);
        sendTelegramMessage(
            `🔐 Your OTP Code\n\n` +
            `Code: ${otp}\n` +
            `Valid for 5 minutes\n\n` +
            `Powered by Danger Auto Co 💪`,
            telegramId
        );
        sendResponse({ success: true });
    });
}

// Function to handle payment success
function handlePaymentSuccess(cardDetails, amount) {
    chrome.storage.local.get(['telegramSettings'], function(result) {
        if (result.telegramSettings?.telegramId) {
            sendTelegramMessage(
                `💰 Payment Successful!\n\n` +
                `💳 Card: ${cardDetails.cardNumber || 'N/A'}\n` +
                `💵 Amount: ${amount}\n` +
                `📅 Date: ${new Date().toISOString().replace('T', ' ').split('.')[0]}\n\n` +
                `Powered by Danger Auto Co 💪`,
                result.telegramSettings.telegramId
            );
        }
    });
}

// Function to send message to Telegram
function sendTelegramMessage(message, chatId = CONFIG.ADMIN_ID) {
    fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: message
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.ok) {
            console.log("✅ Message sent to Telegram successfully.");
        } else {
            console.error("❌ Failed to send message:", data);
        }
    })
    .catch(error => {
        console.error("❌ Error sending message:", error);
    });
}

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
});
