// ✅ Get Cookie Value
function getCookieValue(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

const token = getCookieValue("jwt_token");


// ✅ Decode JWT (optional)
function parseJwt(token) {
    try {
        const base64 = token.split(".")[1];
        const jsonPayload = decodeURIComponent(atob(base64).split("").map(function(c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(""));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}


// ✅ Show Login UI if not logged in
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


// ✅ Load User Info
async function fetchUserInfo() {
    try {
        const response = await fetch("/api/user");
        const user = await response.json();

        document.getElementById("user-name").textContent = user.name;
        document.getElementById("user-email").textContent = user.email;
        document.getElementById("profile-pic1").src = user.profilePic || "default-avatar.png";
    } catch (error) {
        console.error("Error fetching user info:", error);
    }
}

async function fetchCounts() {
    try {
        const [messageRes, imageRes] = await Promise.all([
            fetch("/api/messages/count", { credentials: "include" }),
            fetch("/api/generated-images/count", { credentials: "include" })
        ]);

        const messagesData = await messageRes.json();
        const imagesData = await imageRes.json();

        document.getElementById("message-count").textContent = messagesData.count || 0;
        document.getElementById("image-count").textContent = imagesData.count || 0;

    } catch (err) {
        console.error("Error fetching counts:", err);
    }
}


// Dark Mode Toggle
const darkModeToggle = document.getElementById("dark-mode-toggle");

if (darkModeToggle) {
    darkModeToggle.checked = getDarkModePreference() === "true";
    applyDarkMode(darkModeToggle.checked);

    darkModeToggle.addEventListener("change", () => {
        const isDarkMode = darkModeToggle.checked;
        localStorage.setItem("dark_mode", isDarkMode);
        applyDarkMode(isDarkMode);
    });
}


darkModeToggle.checked = getDarkModePreference() === "true";
applyDarkMode(darkModeToggle.checked);

darkModeToggle.addEventListener("change", () => {
    const isDarkMode = darkModeToggle.checked;
    localStorage.setItem("dark_mode", isDarkMode);
    applyDarkMode(isDarkMode);
});

// Apply dark mode styling
function applyDarkMode(enable) {
    if (enable) {
        document.body.classList.add("dark-mode");
    } else {
        document.body.classList.remove("dark-mode");
    }
}

// Get from localStorage
function getDarkModePreference() {
    return localStorage.getItem("dark_mode");
}

// ✅ Load Navbar First, Then Proceed with JWT Checks
document.addEventListener("DOMContentLoaded", () => {
    const observer = new MutationObserver(() => {
        const profilePic = document.getElementById("profile-pic1");

        if (profilePic) {
            observer.disconnect();
            setupEventListeners(); 
            updateUI();      

            console.log("✅ Navbar loaded, proceeding to check JWT...");


            const jwtToken = getCookieValue("jwt_token");
            if (!jwtToken) {
                showLoginUI();
            } else {
                fetchUserInfo();
                fetchCounts();
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
});