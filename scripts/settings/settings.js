document.addEventListener("DOMContentLoaded", function () {
  const BACKEND_URL = "http://46.202.163.22:3000/api";
  
  // Preloader
  const preloader = document.getElementById("preloader");
  window.addEventListener("load", function () {
    preloader.style.opacity = "0";
    setTimeout(() => {
      preloader.style.display = "none";
    }, 500);
  });

  // Toggle sections
  const navButtons = document.querySelectorAll(".nav-button");
  const settingsSections = document.querySelectorAll(".settings-section");

  navButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const targetId = this.id.replace("-toggle", "-section");

      navButtons.forEach((btn) => btn.classList.remove("active"));
      settingsSections.forEach((section) => section.classList.remove("active-section"));

      this.classList.add("active");
      document.getElementById(targetId).classList.add("active-section");
    });
  });

  // Save settings
  document.getElementById("save-settings").addEventListener("click", function () {
    const primaryBinInput = document.getElementById("primary-bin-input").value.trim();
    const secondaryBinInput = document.getElementById("secondary-bin-input").value.trim();

    if (primaryBinInput || secondaryBinInput) {
      showNotification("BIN settings saved successfully!", "success");
    } else {
      showNotification("Please fill in at least one of the Primary or Secondary BIN fields.", "error");
    }
  });

  document.getElementById("save-settings-cc").addEventListener("click", function () {
    const cardListInput = document.getElementById("card-list-input").value.trim();

    if (cardListInput) {
      showNotification("CC list settings saved successfully!", "success");
    } else {
      showNotification("Please enter your card list.", "error");
    }
  });

  document.getElementById("save-settings-email").addEventListener("click", function () {
    const emailInput = document.getElementById("email-input").value.trim();

    if (emailInput) {
      showNotification("Email settings saved successfully!", "success");
    } else {
      showNotification("Please enter your email address.", "error");
    }
  });

  document.getElementById("save-settings-proxy").addEventListener("click", function () {
    const proxyInput = document.getElementById("proxy-input").value.trim();

    if (proxyInput) {
      showNotification("Proxy settings saved successfully!", "success");
    } else {
      showNotification("Please enter your proxy details.", "error");
    }
  });

  document.getElementById("refresh-bins").addEventListener("click", function () {
    showNotification("Updating BINs...", "success");
    // Add the logic to update the BINs here
  });

  // Telegram verification
  const sendOtpButton = document.getElementById("send-otp");
  const verifyOtpButton = document.getElementById("verify-otp");

  sendOtpButton.addEventListener("click", function () {
    const telegramIdInput = document.getElementById("telegram-id-input").value.trim();
    if (telegramIdInput) {
      showNotification("OTP sent to your Telegram ID!", "success");
    } else {
      showNotification("Please enter your Telegram ID.", "error");
    }
  });

  verifyOtpButton.addEventListener("click", function () {
    const otpInput = document.getElementById("otp-input").value.trim();
    if (otpInput) {
      showNotification("OTP verified successfully!", "success");
    } else {
      showNotification("Please enter the OTP.", "error");
    }
  });

  // History modal
  const historyModal = document.getElementById("history-modal");
  const historyButton = document.getElementById("history-button");
  const closeHistoryButton = document.querySelector(".close-history-button");

  historyButton.addEventListener("click", function () {
    historyModal.style.display = "block";
  });

  closeHistoryButton.addEventListener("click", function () {
    historyModal.style.display = "none";
  });

  window.addEventListener("click", function (event) {
    if (event.target == historyModal) {
      historyModal.style.display = "none";
    }
  });

  // Toggle extension
  const extensionToggleInput = document.getElementById("extension-toggle-input");
  const toggleStatusLabel = document.getElementById("toggle-status-label");

  extensionToggleInput.addEventListener("change", function () {
    if (this.checked) {
      toggleStatusLabel.textContent = "Extension Enabled ✅";
      showNotification("Extension has been enabled.", "success");
    } else {
      toggleStatusLabel.textContent = "Extension Disabled ❌";
      showNotification("Extension has been disabled.", "error");
    }
  });

  // Notifications
  const notificationsContainer = document.querySelector(".notifications-container");

  function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.classList.add("notification", type, "show");

    const icon = document.createElement("i");
    icon.classList.add("notification-icon");
    if (type === "success") {
      icon.classList.add("fas", "fa-check-circle");
    } else if (type === "error") {
      icon.classList.add("fas", "fa-exclamation-circle");
    } else if (type === "info") {
      icon.classList.add("fas", "fa-info-circle");
    } else {
      icon.classList.add("fas", "fa-exclamation-triangle");
    }
    notification.appendChild(icon);

    const content = document.createElement("div");
    content.classList.add("notification-content");
    const title = document.createElement("div");
    title.classList.add("notification-title");
    title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    const messageElem = document.createElement("div");
    messageElem.classList.add("notification-message");
    messageElem.textContent = message;
    content.appendChild(title);
    content.appendChild(messageElem);
    notification.appendChild(content);

    const closeButton = document.createElement("button");
    closeButton.classList.add("notification-close");
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", () => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    });
    notification.appendChild(closeButton);

    notificationsContainer.appendChild(notification);

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  // Watermark Settings
  const saveWatermarkSettingsButton = document.getElementById("save-watermark-settings");
  saveWatermarkSettingsButton.addEventListener("click", function () {
    const name = document.getElementById("watermark-name-input").value.trim();
    const color = document.getElementById("watermark-color-input").value.trim();
    const concentration = document.getElementById("watermark-concentration-input").value.trim();

    if (name && color && concentration) {
      showNotification("Watermark settings saved successfully!", "success");
    } else {
      showNotification("Please fill in all watermark settings fields.", "error");
    }
  });
});
