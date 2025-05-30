let currentImageIndex = 0;
let allImages = [];


// ✅ Get Cookie Value
function getCookieValue(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

// ✅ Decode JWT Token (to extract user info)
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = decodeURIComponent(
        atob(base64Url).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
    );
    return JSON.parse(base64);
}

async function loadHistory() {
    const jwtToken = getCookieValue('jwt_token');
    if (!jwtToken) {
        console.error("No JWT token found. User must be logged in.");
        return;
    }

    updateUI();

    try {
        const userInfo = parseJwt(jwtToken);
        const userId = userInfo.userId || userInfo.sub;

        const response = await fetch(`/get-history/${userId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${jwtToken}`
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load history.");
        }

        const images = await response.json();
        const container = document.getElementById("history-container");
        if (!container) return;

        if (!images || images.length === 0) {
            container.innerHTML = "<p>No images found.</p>";
            return;
        }

        allImages = images
  .filter(image => typeof image.imageUrl === "string" && image.imageUrl.trim() !== "")
  .map(image => ({
    id: image._id,
    url: image.imageUrl,      // now matches
    createdAt: image.timestamp
  }))
  .reverse();


        allImages.forEach((imageObj, index) => {
            const wrapper = document.createElement("div");
            wrapper.classList.add("history-item");

            const imgElement = document.createElement("img");
            const imagePath = imageObj.url;

            if (typeof imagePath !== "string") {
                console.warn("Invalid image path:", imagePath, imageObj);
                return;
            }

            imgElement.src = imagePath.startsWith("http")
                ? imagePath
                : `http://localhost:5000${imagePath}`;
            imgElement.classList.add("history-image");

            imgElement.addEventListener("click", () => openLightbox(index));

            const timestamp = document.createElement("p");
            timestamp.classList.add("timestamp");
            const date = new Date(imageObj.createdAt || Date.now());
            timestamp.textContent = date.toLocaleString();

            const downloadBtn = document.createElement("a");
            downloadBtn.href = imgElement.src;
            downloadBtn.download = "image.png";
            downloadBtn.classList.add("download-btn");
            downloadBtn.innerHTML = `<i class="fas fa-download"></i>`;

            wrapper.appendChild(imgElement);
            wrapper.appendChild(downloadBtn);
            wrapper.appendChild(timestamp);
            container.appendChild(wrapper);
        });

        console.log("Welcome,", userInfo.name || userInfo.email);

    } catch (error) {
        console.error("Error loading history:", error);
        const container = document.getElementById("history-container");
        if (container) {
            container.innerHTML = "<p>Unable to load history.</p>";
        }
    }
}

// ✅ Open Lightbox with Navigation, Download, Share, and Delete
    
function openLightbox(index) {
    if (document.getElementById("lightbox")) return;

    currentImageIndex = index;
    console.log("Current Image Index:", currentImageIndex); // Add this debug line
    const imageObj = allImages[index];
    const imagePath = imageObj.url;

    const isDarkMode = document.body.classList.contains("dark-mode");
    if (!imagePath) return;

    const lightbox = document.createElement("div");
    lightbox.id = "lightbox";
    lightbox.style.position = "fixed";
    lightbox.style.top = 0;
    lightbox.style.left = 0;
    lightbox.style.width = "100vw";
    lightbox.style.height = "100vh";
    lightbox.style.backgroundColor = isDarkMode ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.95)";
    lightbox.style.display = "flex";
    lightbox.style.justifyContent = "center";
    lightbox.style.alignItems = "center";
    lightbox.style.zIndex = "9999";
    lightbox.style.flexDirection = "column";

    // Add early to DOM so styling + events apply
    document.body.appendChild(lightbox);

    const loading = document.createElement("div");
    loading.innerText = "Loading...";
    loading.style.color = isDarkMode ? "black" : "white";
    loading.style.fontSize = "24px";
    loading.style.marginBottom = "20px";
    lightbox.appendChild(loading);

    const img = document.createElement("img");
    img.style.maxWidth = "90%";
    img.style.maxHeight = "90%";
    img.style.borderRadius = "10px";
    img.style.opacity = 0;
    img.style.transition = "opacity 0.3s";
    img.style.boxShadow = isDarkMode
        ? "0 0 15px rgba(0,0,0,0.2)"
        : "0 0 15px rgba(255,255,255,0.2)";

    img.onload = () => {
        loading.remove();
        img.style.opacity = 1;
    };

    img.onerror = () => {
        loading.innerText = "Failed to load image.";
    };

    img.src = imagePath.startsWith("http")
        ? imagePath
        : `http://localhost:5000${imagePath}`;
    lightbox.appendChild(img);

    const textColor = isDarkMode ? "black" : "white";
    const bgOverlay = isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";

    const closeBtn = document.createElement("div");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "30px";
    closeBtn.style.fontSize = "40px";
    closeBtn.style.color = textColor;
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", removeLightbox);
    lightbox.appendChild(closeBtn);

    const prevBtn = document.createElement("div");
    prevBtn.innerHTML = "&#10094;";
    prevBtn.style.position = "absolute";
    prevBtn.style.left = "20px";
    prevBtn.style.top = "50%";
    prevBtn.style.transform = "translateY(-50%)";
    prevBtn.style.fontSize = "60px";
    prevBtn.style.color = textColor;
    prevBtn.style.cursor = "pointer";
    prevBtn.addEventListener("click", () => {
        removeLightbox();
        openLightbox((currentImageIndex - 1 + allImages.length) % allImages.length);
    });
    lightbox.appendChild(prevBtn);

    const nextBtn = document.createElement("div");
    nextBtn.innerHTML = "&#10095;";
    nextBtn.style.position = "absolute";
    nextBtn.style.right = "20px";
    nextBtn.style.top = "50%";
    nextBtn.style.transform = "translateY(-50%)";
    nextBtn.style.fontSize = "60px";
    nextBtn.style.color = textColor;
    nextBtn.style.cursor = "pointer";
    nextBtn.addEventListener("click", () => {
        removeLightbox();
        openLightbox((currentImageIndex + 1) % allImages.length);
    });
    lightbox.appendChild(nextBtn);

    const downloadBtn = document.createElement("a");
    downloadBtn.href = img.src;
    downloadBtn.download = "image.png";
    downloadBtn.innerHTML = `<i class="fas fa-download"></i>`;
    Object.assign(downloadBtn.style, {
        position: "absolute",
        bottom: "30px",
        right: "30px",
        fontSize: "30px",
        color: textColor,
        background: bgOverlay,
        padding: "10px 15px",
        borderRadius: "8px",
        textDecoration: "none",
        cursor: "pointer",
    });
    lightbox.appendChild(downloadBtn);

    const shareBtn = document.createElement("button");
    shareBtn.innerHTML = `<i class="fas fa-share"></i>`;
    shareBtn.title = "Copy Link";
    Object.assign(shareBtn.style, {
        position: "absolute",
        bottom: "30px",
        left: "30px",
        fontSize: "30px",
        color: textColor,
        background: bgOverlay,
        padding: "10px 15px",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
    });
    shareBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(img.src);
        alert("Image link copied to clipboard!");
    });
    lightbox.appendChild(shareBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
    deleteBtn.title = "Delete Image";
    Object.assign(deleteBtn.style, {
        position: "absolute",
        bottom: "30px",
        left: "100px",
        fontSize: "30px",
        color: "red",
        background: bgOverlay,
        padding: "10px 15px",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
    });
    deleteBtn.addEventListener("click", async () => {
        if (confirm("Delete this image?")) {
            // currentImageIndex = allImages.findIndex(img => img.id === imageObj.id);
            console.log("Current Image Index in delete:", currentImageIndex); 
            console.log("here i am: ",allImages[currentImageIndex]);
            const imageId = allImages[currentImageIndex].id;
            const jwtToken = getCookieValue('jwt_token');
            console.log("Deleting image with ID:", imageId); // Add this debug line

            const res = await fetch(`/api/delete-image/${imageId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${jwtToken}`
                }
            });

            const result = await res.json();
            if (result.success) {
                alert("Image deleted successfully!");
                removeLightbox();
                allImages.splice(currentImageIndex, 1);
                document.getElementById("history-container").innerHTML = "";
                loadHistory(); // Refresh only visible content
            } else {
                alert("Failed to delete image.");
            }
        }
    });
    
    lightbox.appendChild(deleteBtn);

    // Allow click outside image to close lightbox
    lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox) {
            removeLightbox();
        }
    });

    // Keyboard navigation
    function handleKey(e) {
        if (e.key === "ArrowLeft") {
            removeLightbox();
            openLightbox((currentImageIndex - 1 + allImages.length) % allImages.length);
        } else if (e.key === "ArrowRight") {
            removeLightbox();
            openLightbox((currentImageIndex + 1) % allImages.length);
        } else if (e.key === "Escape") {
            removeLightbox();
        }
    }

    function removeLightbox() {
        const el = document.getElementById("lightbox");
        if (el) document.body.removeChild(el);
        document.removeEventListener("keydown", handleKey);
    }

    document.addEventListener("keydown", handleKey);
}

// ✅ Handle Not Logged-In User
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


// ✅ Load Navbar First, Then Run Login Logic
document.addEventListener("DOMContentLoaded", () => {
            const jwtToken = getCookieValue("jwt_token");
            if (jwtToken) {
                loadHistory();
            } else {
                showLoginUI();
            }
});







