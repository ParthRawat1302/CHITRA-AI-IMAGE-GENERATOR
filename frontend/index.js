const storedImages = [];

async function generateAiImages(prompt, numImages) {
  if (!prompt || !numImages) {
    alert("Please enter a prompt.");
    return;
  }

  const requestId = crypto.randomUUID();
  const gallery = document.querySelector(".image-gallery");

  try {

    document.getElementById("generateButton").disabled = true;
    gallery.innerHTML = "";

    for (let i = 0; i < numImages; i++) {
      const imgCard = document.createElement("div");
      imgCard.classList.add("img-card", "loading");

      const spinner = document.createElement("div");
      spinner.classList.add("spinner");

      imgCard.appendChild(spinner);
      gallery.appendChild(imgCard);
    }

    const headers = { "Content-Type": "application/json" };
    if (isUserLoggedIn()) {
      const token = getCookie("jwt_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }


    const response = await fetch("http://localhost:5000/generate-image", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, num_images: numImages, requestId })
    });

    console.log("Response:", response);
    if (!response.ok) {
      // window.location.reload();
      throw new Error("Failed to start image generation.");
    }
    const eventSource = new EventSource(`http://localhost:5000/image-events/${requestId}`);
    console.log("EventSource:", eventSource);
    eventSource.onmessage = (event) => {
      console.log("Raw event data:", event.data);
      try {
        const data = JSON.parse(event.data);
        console.log("Received data:", data);
        gallery.innerHTML = ""; 
        displayImages(data.imageUrls);
        console.log("Image URLs:", data.imageUrls);
        document.getElementById("generateButton").disabled = false;
    
  
        eventSource.close();
      } catch (err) {
        console.error("Invalid message data", err);
        // window.location.reload();
      }
    };
    
    console.log("EventSource onmessage:", eventSource.onmessage);
    eventSource.onerror = (err) => {
      console.error("SSE connection error", err);
      eventSource.close();
      gallery.innerHTML = "";
      document.getElementById("generateButton").disabled = false;
      // window.location.reload();
      alert("Failed to receive image updates.");
    };

  } catch (error) {
    console.error("Error:", error);
    // window.location.reload();
    alert("Failed to generate images.");
    gallery.innerHTML = "";
    document.getElementById("generateButton").disabled = false;
  }
}

function normalizeUrl(url) {
  // Normalize URLs to avoid duplicates based on the path, ignoring the base URL (localhost)
  return url.replace(/^http:\/\/localhost:5000/, '').replace(/\/$/, '');
}

function displayImages(imageUrls) {

  if (!imageUrls || imageUrls.length === 0) return;

  // Ensure imageUrls is an array
  if (!Array.isArray(imageUrls)) {
      imageUrls = [imageUrls];
  }

  const imageGallery = document.querySelector(".image-gallery");

  // Normalize URLs and filter out duplicates
  const newImages = imageUrls.filter(url => !storedImages.includes(normalizeUrl(url)));

  if (newImages.length === 0) {
      console.log("No new images to display.");
  }

  // Append new images
  newImages.forEach(imageUrl => {
    const imgCard = document.createElement("div");
    imgCard.classList.add("img-card");

    const fullImageUrl = `http://localhost:5000${imageUrl}`;
    console.log("Full image URL:", fullImageUrl);

    const downloadLink = document.createElement("a");
    downloadLink.href = fullImageUrl;

    const imageElement = document.createElement("img");
    imageElement.src = fullImageUrl;
    imageElement.alt = "Generated Image";
    downloadLink.appendChild(imageElement);

    // Handle login-based download
    if (isUserLoggedIn()) {
        downloadLink.setAttribute("download", "chitra-image.jpg");
    } else {
        downloadLink.addEventListener("click", (e) => {
            e.preventDefault();
            alert("Please log in to download this image.");
        });
    }

    imgCard.appendChild(downloadLink);
    imageGallery.appendChild(imgCard);

    storedImages.push(normalizeUrl(imageUrl));
});
}


function isUserLoggedIn() {
  return !!getCookie("jwt_token");
}

// generateAiImages on click
document.addEventListener("DOMContentLoaded", () => {
  const promptInput = document.getElementById("promptInput");
  const imageCount = document.getElementById("imageCount");
  const generateButton = document.getElementById("generateButton");
  const generateForm = document.querySelector(".generate-form");
  const imageGallery = document.querySelector(".image-gallery");

  if (!promptInput || !imageCount || !generateButton || !generateForm) {
    console.error("Missing elements in HTML: Make sure 'promptInput', 'imageCount', and 'generateButton' exist.");
    return;
  }

  generateForm.addEventListener("submit", (e) => {
    e.preventDefault(); // Prevent form submission
    generateButton.disabled = true;
    const prompt = promptInput.value;
    const count = Number(imageCount.value); // Convert to a number

    if (!prompt.trim()) {
      alert("Please enter a prompt!");
      return;
    }
    generateAiImages(prompt, count);
  });
});

