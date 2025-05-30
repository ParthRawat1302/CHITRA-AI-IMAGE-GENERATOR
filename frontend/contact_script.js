// Function to check if the user is logged in
function isLoggedIn() {
    return document.cookie.includes('jwt_token'); // Adjust 'jwt_token' to your cookie name
}

function showLoginUI() {
    document.body.innerHTML = `
    <div style="text-align: center; padding: 50px;">
        <h2>You need to sign in to view history</h2>
        <p>Click below to sign in with Google</p>
        <div style="display: flex; justify-content: center; margin-top: 20px;">
            <button id="googleLogin" style="
                display: flex; align-items: center; padding: 10px 20px;
                border: none; background: white; font-size: 16px; cursor: pointer;
                border-radius: 5px; box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2);
            ">
                <img src="images/google.webp"
                    alt="Google Logo" style="width: 60px; height: 30px; margin-right: 10px;">
                Sign in with Google
            </button>
        </div>
    </div>
    `;

    document.getElementById("googleLogin").addEventListener("click", function () {
        const currentPage = window.location.href;

        window.location.href = `https://accounts.google.com/o/oauth2/auth?` +
            `client_id=435838539988-1jodai6050m5ffdichd949a5b3sj0ha0.apps.googleusercontent.com` +
            `&redirect_uri=http://localhost:5000/auth/callback` +
            `&response_type=code` +
            `&scope=email%20profile%20openid` +
            `&access_type=offline` +
            `&prompt=consent` +
            `&state=${encodeURIComponent(currentPage)}`;
        
    });
}


document.addEventListener("DOMContentLoaded", function () {

    // If the user is not logged in, stop the script execution
    if (!isLoggedIn()) {
        showLoginUI();
        return;  // Stop executing the rest of the script
    }

     // 👇 Restore scroll position
     const savedScroll = localStorage.getItem("scrollPosition");
     if (savedScroll) window.scrollTo(0, parseInt(savedScroll));
 
     // 👇 Restore form data
     const savedForm = localStorage.getItem("contactFormData");
     if (savedForm) {
         const { name, email, message } = JSON.parse(savedForm);
         if (document.getElementById("name")) document.getElementById("name").value = name;
         if (document.getElementById("email")) document.getElementById("email").value = email;
         if (document.getElementById("message")) document.getElementById("message").value = message;
     }
     
    const contactForm = document.getElementById("contactForm");
    const sendButton = document.getElementById("sendButton");

    if (contactForm) {
        contactForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const recaptchaToken = grecaptcha.getResponse();
            if (!recaptchaToken) {
                document.getElementById("responseMessage").textContent = "Please complete the reCAPTCHA.";
                return;
            }

            const formData = {
                name: document.getElementById("name").value,
                email: document.getElementById("email").value,
                message: document.getElementById("message").value,
                recaptchaToken,
            };

            try {
                const response = await fetch("http://localhost:5000/contact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });

                if (response.ok) {
                    document.getElementById("responseMessage").textContent = "Thank you! Your message has been sent.";
                    sendButton.disabled = true; // Disable button
                    
                    setTimeout(() => {
                        document.getElementById("responseMessage").textContent = "";
                    }, 3000);

                    contactForm.reset();
                    grecaptcha.reset(); // Reset reCAPTCHA after submission
                    sendButton.disabled = false; // Re-enable button after a delay
                    localStorage.removeItem("scrollPosition");
                    localStorage.removeItem("contactFormData");

                } else {
                    document.getElementById("responseMessage").textContent = "Error sending message. Please try again.";
                    sendButton.disabled = false;
                }
            } catch (error) {
                console.error("Error:", error);
                document.getElementById("responseMessage").textContent = "Error sending message. Please try again.";
                sendButton.disabled = false;
            }
            finally {
                grecaptcha.reset(); // ✅ Always reset reCAPTCHA after submission
            }
        });
    }
});

window.addEventListener("beforeunload", () => {
    localStorage.setItem("scrollPosition", window.scrollY);

    // Optional: save form data
    const name = document.getElementById("name")?.value || "";
    const email = document.getElementById("email")?.value || "";
    const message = document.getElementById("message")?.value || "";

    localStorage.setItem("contactFormData", JSON.stringify({ name, email, message }));
});

