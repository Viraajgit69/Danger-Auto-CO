(function () {
    // Function to create and display the error box
    function showErrorMessage(errorText) {
        let existingBox = document.getElementById("payment-failure-box");
        if (!existingBox) {
            let errorBox = document.createElement("div");
            errorBox.id = "payment-failure-box";
            errorBox.style.position = "fixed";
            errorBox.style.top = "20px";
            errorBox.style.right = "20px";
            errorBox.style.backgroundColor = "#121826";
            errorBox.style.color = "#fff";
            errorBox.style.padding = "15px 20px";
            errorBox.style.borderRadius = "8px";
            errorBox.style.boxShadow = "0px 0px 10px rgba(0,0,0,0.3)";
            errorBox.style.display = "flex";
            errorBox.style.alignItems = "center";
            errorBox.style.fontSize = "16px";
            errorBox.style.zIndex = "9999";

            let icon = document.createElement("span");
            icon.innerHTML = "❌";
            icon.style.marginRight = "10px";
            icon.style.fontSize = "18px";

            let message = document.createElement("span");
            message.innerText = `Payment Declined\nCode: ${errorText}`;

            errorBox.appendChild(icon);
            errorBox.appendChild(message);
            document.body.appendChild(errorBox);

            // Remove the message after 5 seconds
            setTimeout(() => {
                errorBox.remove();
            }, 5000);
        } else {
            existingBox.innerText = `Payment Declined\nCode: ${errorText}`;
        }
    }

    // Function to observe checkout page for payment failures
    function observeFailureMessages() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.innerText) {
                            let text = node.innerText.toLowerCase();
                            let failureReasons = [
                                "generic decline",
                                "fraudulent",
                                "insufficient funds",
                                "transaction not allowed",
                                "do not honor",
                                "stolen card",
                                "lost card",
                            ];

                            failureReasons.forEach((reason) => {
                                if (text.includes(reason)) {
                                    showErrorMessage(reason);
                                }
                            });
                        }
                    });
                }
            });
        });

        // Wait until document.body is available before observing
        function waitForBody() {
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                });
            } else {
                setTimeout(waitForBody, 50); // Retry after 50ms
            }
        }

        // Start checking for body
        waitForBody();
    }

    // Run the observer when the script loads
    observeFailureMessages();
})();
