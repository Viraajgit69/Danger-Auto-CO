console.log("✅ Background script loaded.");

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "send_otp" && message.telegramId) {
        sendOTPToTelegram(message.telegramId, sendResponse);
        return true; // Keep sendResponse alive for async request
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
});

// Function to send OTP request to Telegram
function sendOTPToTelegram(telegramId, sendResponse) {
    const botToken = "7890377108:AAFgiveInFKUPhn7S8t7zNRjZMQZn-1rKVk"; // Replace with your actual bot token
    const adminId = "7345260405"; // Replace with your Telegram admin ID
    const messageText = `🔹 OTP request received from: ${telegramId}`;

    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: adminId,
            text: messageText
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.ok) {
            console.log("✅ OTP request sent to Telegram successfully.");
            sendResponse({ success: true, message: "OTP sent successfully!" });
        } else {
            console.error("❌ Failed to send OTP:", data);
            sendResponse({ success: false, message: "Failed to send OTP." });
        }
    })
    .catch(error => {
        console.error("❌ Error sending OTP:", error);
        sendResponse({ success: false, message: "Error sending OTP." });
    });
}
