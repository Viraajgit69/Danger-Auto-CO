console.log("✅ Background script loaded.");

const CONFIG = {
    BOT_TOKEN: "7890377108:AAFgiveInFKUPhn7S8t7zNRjZMQZn-1rKVk",
    ADMIN_ID: "7345260405"
};

// State management
const state = {
    processing: false,
    verifiedTelegram: false
};

// Card Generation System
const CardGenerator = {
    async generateCard() {
        return new Promise(async (resolve) => {
            const result = await chrome.storage.local.get(['primaryBIN', 'secondaryBIN', 'extensionEnabled', 'telegramVerified']);
            
            if (!result.extensionEnabled) {
                sendNotificationToContent("Extension is disabled", "error");
                resolve(null);
                return;
            }

            if (!result.telegramVerified) {
                sendNotificationToContent("Please verify your Telegram account first", "error");
                resolve(null);
                return;
            }

            if (!result.primaryBIN && !result.secondaryBIN) {
                sendNotificationToContent("No BIN configured. Please set up a BIN in settings.", "error");
                resolve(null);
                return;
            }

            const bin = result.primaryBIN || result.secondaryBIN;
            const card = this.generateFromBin(bin);
            
            if (card) {
                sendNotificationToContent("Card generated successfully", "success");
                console.log('Generated new card:', {
                    number: card.number,
                    month: card.month,
                    year: card.year,
                    cvv: '***'
                });
            }
            
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

// Notification System
function sendNotificationToContent(message, messageType = 'info') {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (message, messageType) => {
                    // Add Font Awesome if not present
                    if (!document.querySelector('link[href*="font-awesome"]')) {
                        const fontAwesomeLink = document.createElement('link');
                        fontAwesomeLink.rel = 'stylesheet';
                        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
                        document.head.appendChild(fontAwesomeLink);
                    }

                    const toast = document.createElement('div');
                    Object.assign(toast.style, {
                        position: 'fixed',
                        top: '70px',
                        right: '20px',
                        background: 'rgba(10, 10, 15, 0.95)',
                        color: '#fff',
                        padding: '10px 15px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        zIndex: '1000000',
                        boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(5px)',
                        fontFamily: 'Arial, sans-serif',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                    });

                    let iconClass = '';
                    let iconColor = '';
                    if (messageType === 'success') {
                        iconClass = 'fas fa-check-circle';
                        iconColor = '#4caf50';
                    } else if (messageType === 'error') {
                        iconClass = 'fas fa-times-circle';
                        iconColor = '#ff4d4d';
                    } else {
                        iconClass = 'fas fa-info-circle';
                        iconColor = '#2196f3';
                    }

                    const icon = document.createElement('i');
                    icon.className = iconClass;
                    icon.style.color = iconColor;
                    icon.style.opacity = '0.8';

                    toast.appendChild(icon);
                    toast.appendChild(document.createTextNode(message));
                    document.body.appendChild(toast);

                    setTimeout(() => toast.remove(), 2500);
                },
                args: [message, messageType]
            }).catch(error => {
                console.error('Notification error:', error);
            });
        }
    });
}

// Message Handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "send_otp" && message.telegramId) {
        sendOTPToTelegram(message.telegramId, sendResponse);
        return true;
    }

    if (message.type === "REQUEST_CARD") {
        console.log("Received card request from tab:", sender.tab.id);
        if (state.processing) {
            sendNotificationToContent("Card generation already in progress", "info");
            return true;
        }
        
        state.processing = true;
        CardGenerator.generateCard().then(card => {
            state.processing = false;
            if (!card) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'CARD_ERROR',
                    error: 'Failed to generate card. Please check your settings.'
                });
                return;
            }

            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'CARD_DATA',
                card: card
            });

            // Log success to Telegram if enabled
            chrome.storage.local.get(['telegramSettings'], function(result) {
                if (result.telegramSettings?.autoNotify) {
                    handlePaymentSuccess(card, "Card Generated");
                }
            });
        });
        return true;
    }

    if (message.type === "VERIFY_TELEGRAM") {
        verifyTelegramUser(message.telegramId, message.otp, sendResponse);
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

// Function to verify Telegram user
function verifyTelegramUser(telegramId, otp, sendResponse) {
    chrome.storage.local.get(['otp'], function(result) {
        const isValid = result.otp === otp;
        if (isValid) {
            chrome.storage.local.set({ 
                telegramVerified: true,
                telegramId: telegramId
            }, function() {
                state.verifiedTelegram = true;
                sendNotificationToContent("Telegram verification successful!", "success");
                sendResponse({ success: true });
            });
        } else {
            sendNotificationToContent("Invalid OTP. Please try again.", "error");
            sendResponse({ success: false, error: "Invalid OTP" });
        }
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

// Extension initialization
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
});

// Storage change listener
chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        if (key === 'extensionEnabled') {
            if (newValue) {
                sendNotificationToContent("Extension enabled", "success");
            } else {
                sendNotificationToContent("Extension disabled", "error");
            }
        }
    }
});
