function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}


/** ✅ Setup Event Listeners for Navbar After It’s Loaded */
function setupEventListeners() {

    const logoutButton = document.getElementById("logoutButton");
    const profilePic = document.getElementById("profilePic");
    const userDropdown = document.getElementById("profileMenu");

    if (!profilePic || !userDropdown) {
        console.error("Error: Required navbar elements not found.");
        return;
    }
    if (logoutButton) {
        logoutButton.addEventListener("click", handleLogout);
    }

    const profileButton = document.getElementById("profileButton");
    if (profileButton) {
        profileButton.addEventListener("click", () => {
            window.location.href = "/profile.html"; // ✅ or whatever your profile page is
        });
}

}

/** ✅ Update UI Based on Login Status */
async function updateUI() {
    const profileButton = document.getElementById("profileButton");
    const loginButton = document.getElementById("loginButton");
    const logoutButton = document.getElementById("logoutButton");
    const profileSection = document.getElementById("profileMenu");
    const profilePic = document.getElementById("profilePic");
    const loginPopup = document.getElementById("loginPopup");

    if (!profilePic || !loginPopup || !profileSection) {
        console.error("Skipping updateUI(): Critical elements missing.");
        return;
    }

    const token = getCookie("jwt_token");
    if (!token) {
        requestAnimationFrame(() => {
            loginButton.style.display = "block";
            logoutButton.style.display = "none";
            profilePic.src = "images/default-avatar.png";
        });
        return;
    }

    try {
        const token = getCookie("jwt_token");
        const res = await fetch("http://localhost:5000/api/user", {
            headers: {
                "Authorization": `Bearer ${token}`
              },
            credentials: "include"
        });
        // console.log("Response from user data fetch:", res);
        const user = await res.json();

        if (user.error) {
            console.error("Error fetching user data:", user.error);
            return;
        }

        localStorage.removeItem("Generated");
        localStorage.removeItem("generatedImages");
        localStorage.removeItem("isGenerating");
        localStorage.removeItem("currentRequestId");
        requestAnimationFrame(() => {
            loginButton.style.display = "none";
            logoutButton.style.display = "block";
            profileButton.style.display = "block";
            profilePic.src = user.profilePic || "images/default-avatar.png";
            // Show popup
            if (loginPopup && popupMessage && !sessionStorage.getItem("welcomeShown")) {
                popupMessage.textContent = `Welcome, ${user.name || "User"}!`;
                loginPopup.style.display = "block";
                setTimeout(() => {
                    loginPopup.style.display = "none";
                }, 3000);

                // ✅ Mark as shown for this session
                sessionStorage.setItem("welcomeShown", "true");
            }

        });

    } catch (err) {
        console.error("Failed to fetch user data:", err);
    }
    updateProfileMenu();
}

/** ✅ Update Profile Dropdown Menu */
function updateProfileMenu() {
    const loginBtn = document.getElementById("loginButton");
    const profileBtn = document.getElementById("profileButton");
    const logoutBtn = document.getElementById("logoutButton");

    if (!loginBtn || !profileBtn || !logoutBtn) {
        console.error("❌ One or more profile buttons are missing.");
        return;
    }

    if (isUserLoggedIn()) {
        loginBtn.classList.add("hidden");
        profileBtn.classList.remove("hidden");
        logoutBtn.classList.remove("hidden");
    } else {
        loginBtn.classList.remove("hidden");
        profileBtn.classList.add("hidden");
        logoutBtn.classList.add("hidden");

        // Handle login via OAuth flow
        loginBtn.addEventListener("click", () => {
            const currentPage = window.location.pathname;

            const oauthURL = `https://accounts.google.com/o/oauth2/auth?` +
                `client_id=435838539988-1jodai6050m5ffdichd949a5b3sj0ha0.apps.googleusercontent.com` +
                `&redirect_uri=http://localhost:5000/auth/callback` +
                `&response_type=code` +
                `&scope=email%20profile%20openid` +
                `&access_type=offline` +
                `&prompt=consent` +
                `&state=${encodeURIComponent(currentPage)}`;

            window.location.href = oauthURL;
        });
    }
}

/** ✅ Handle Logout */
function handleLogout(event) {
    localStorage.removeItem("Generated");
    localStorage.removeItem("generatedImages");
    localStorage.removeItem("isGenerating");
    localStorage.removeItem("currentRequestId");
    event.preventDefault();
    deleteCookie("jwt_token");
    sessionStorage.removeItem("welcomeShown");
    updateUI();
    reloadPage();
}

function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = name + "=; Max-Age=0; path=/;"; // ✅ Force instant removal
    updateUI();
}

// Function for Reloading the current page 
function reloadPage() {
    window.location.reload();
}

// Function to check if user is logged in
function isUserLoggedIn() {
    return getCookie("jwt_token") !== null;  // ✅ Check JWT instead of Google credential
}

function showPopupMessage(message) {
    const popup = document.getElementById("loginPopup");
    const popupMessage = document.getElementById("popupMessage");

    if (!popup || !popupMessage) {
        console.error("❌ Popup elements not found!");
        return;
    }

    popupMessage.textContent = message;
    popup.style.display = "block";

    setTimeout(() => {
        popup.style.display = "none";
    }, 3000);
}

document.addEventListener("DOMContentLoaded", function () {
    fetch("navbar.html")
        .then(response => response.text())
        .then(html => {
            document.body.insertAdjacentHTML("afterbegin", html);

            setTimeout(() => {
                const profilePic = document.getElementById("profilePic");
                const profileMenu = document.getElementById("profileMenu");
                const loginButton = document.getElementById("loginButton");

                if (profilePic && profileMenu) {
                    // Toggle dropdown on click
                    profilePic.addEventListener("click", function (event) {
                        event.stopPropagation();
                        profileMenu.classList.toggle("show");

                        if (profileMenu.classList.contains("show")) {
                            loginButton?.classList.add("active");
                        } else {
                            loginButton?.classList.remove("active");
                        }
                    });

                    // ✅ Hide dropdown on outside click (INSIDE where elements are available)
                    document.addEventListener("click", function (event) {
                        if (!profilePic.contains(event.target) && !profileMenu.contains(event.target)) {
                            profileMenu.classList.remove("show");
                            loginButton?.classList.remove("active");
                        }
                    });
                    const interval = setInterval(() => {
                        const loginButton = document.getElementById("loginButton");

                        if (profilePic && loginButton) {
                            clearInterval(interval); // ✅ Stop checking
                            setupEventListeners();
                            updateUI();              // ✅ Ensure this always runs
                        }
                    }, 100); // check every 100ms
                } else {
                    console.error("⚠️ Profile picture or menu not found.");
                }
            }, 500);
        })
        .catch(error => console.error("❌ Error loading navbar:", error));
});


document.addEventListener("click", function (event) {
    const loginButton = document.getElementById("loginButton");
    if (loginButton && event.target === loginButton) {
        const currentPage = window.location.href;

        // Construct OAuth URL with redirect query
        const oauthURL = `https://accounts.google.com/o/oauth2/auth?` +
            `client_id=435838539988-1jodai6050m5ffdichd949a5b3sj0ha0.apps.googleusercontent.com` +
            `&redirect_uri=http://localhost:5000/auth/callback` +
            `&response_type=code` +
            `&scope=email%20profile%20openid` +
            `&access_type=offline` +
            `&prompt=consent` +
            `&state=${encodeURIComponent(currentPage)}`;

        window.location.href = oauthURL;

    }
});


window.addEventListener("DOMContentLoaded", () => {
    const isDarkMode = localStorage.getItem("dark_mode") === "true";
    if (isDarkMode) {
        document.body.classList.add("dark-mode");
    }
});

