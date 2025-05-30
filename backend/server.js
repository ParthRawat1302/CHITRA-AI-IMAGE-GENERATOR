const nodemailer = require("nodemailer");

require("dotenv").config();
const connections = {}; // request_id -> SSE response

const mongoose = require("mongoose");
const PORT = 5000;
const jwt = require('jsonwebtoken');

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const requestsCallbacks = {}; // Store pending image requests

const FLASK_SERVER_URL = "http://localhost:5001"; // Python backend

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const JWT_SECRET = process.env.JWT_SECRET;

const ImageSchema = new mongoose.Schema({
    userId: String,
    imageUrl: String,
    prompt: String,
    timestamp: { type: Date, default: Date.now },
});

const requestResults = {}; 
const Image = mongoose.model("Image", ImageSchema);


const app = express();
const cookieParser = require("cookie-parser");

// Define Contact Schema & Model
const contactSchema = new mongoose.Schema({
    name: String,
    email: String,
    message: String,
    userId: String,
    adminReply: String,
    timestamp: { type: Date, default: Date.now }
});

const Contact = mongoose.model("Contact", contactSchema);

const bcrypt = require("bcryptjs"); // For hashing passwords
// Define User Schema & Model
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    profilePic: String,
    isAdmin: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);
const { google } = require('googleapis');

const CLIENT_ID = "435838539988-1jodai6050m5ffdichd949a5b3sj0ha0.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:5000/auth/callback";

const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
    );


const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5000',
    credentials: true, // Allow credentials (cookies) to be sent
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));


app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));


function authenticateUser(req, res, next) {
    const token = req.cookies.jwt_token; // ✅ Get token from cookie

    if (!token) {
        console.warn("🚫 No token found in cookies");
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // contains userId, isAdmin, etc.
        next(); // ✅ pass to next middleware/route
    } catch (err) {
        console.warn("🚫 Invalid token:", err.message);
        return res.status(403).json({ error: "Invalid token" });
    }
}


// Ensure user folder exists
function ensureUserFolder(userId = "guest") {
    const userFolder = path.join(__dirname, "generated_images", userId || "guest");
    if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
    }
    return userFolder;
}


app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    const redirectTo = req.query.state;

    if (!code) {
        return res.status(400).send("No code found in the URL.");
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // 👤 Get user info
        const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
        const { data: userInfo } = await oauth2.userinfo.get();

        // 🧠 Check if user exists in DB
        let userInDb = await User.findOne({ email: userInfo.email });
        // 🆕 If not, create them
        if (!userInDb) {
            userInDb = new User({
                username: userInfo.name,
                email: userInfo.email,
                profilePic: userInfo.picture
            });
            await userInDb.save();
        } else {
        }

        // ✅ Issue your own JWT
        const customJwt = jwt.sign(
            {
                userId: userInDb._id,
                name: userInfo.name,
                email: userInfo.email,
                profilePic: userInfo.picture,
                isAdmin: userInDb.isAdmin
            },
            JWT_SECRET,
            { expiresIn: "1d" }
        );
        // 🍪 Send as HTTP-only cookie
        res.cookie("jwt_token", customJwt, {
            httpOnly: false, // true in production
            sameSite: "Lax",
            path: "/", // Ensure the cookie is sent with requests to the same origin
            secure: false // true in production with HTTPS
        });

        // ✅ Redirect back to same page
        res.redirect(redirectTo);
    } catch (err) {
        console.error("OAuth Callback Error:", err);
        res.status(500).send("Authentication failed.");
    }
});



// Serve static files from frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Serve images from user-specific folders
app.use("/generated_images", express.static(path.join(__dirname, "generated_images")));

// Protect Download Route (ONLY for logged-in users)
app.get("/api/download/:imageId", authenticateUser, (req, res) => {
    const imageId = req.params.imageId;
    const userId = req.user.userId;

    const imagePath = path.join(__dirname, "generated_images", userId, imageId);

    if (fs.existsSync(imagePath)) {
        return res.download(imagePath);
    } else {
        return res.status(404).json({ error: "Image not found" });
    }
});

// 🔹 Image Generation Route
app.post("/generate-image", async (req, res) => {
    try {
        const { prompt, num_images, requestId } = req.body;

      if (!prompt || !num_images || !requestId) {
        return res.status(400).json({ error: "Prompt and num_images are required" });
      }
  
      let userId = "guest";
      if (req.headers.authorization) {
        try {
          const token = req.headers.authorization.split(" ")[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId;
        } catch (err) {
          console.warn("⚠️ Invalid token, proceeding as guest");
        }
      }
      console.log("Image requested from User ID:", userId);
      console.log("RequestId", requestId);
      console.log("📤 Sending request to Flask...");
      const response = await axios.post(`${FLASK_SERVER_URL}/generate-image`, {
        prompt,
        num_images,
        user_id: userId,
        request_id: requestId
      });
  
      const request_id = response.data.request_id;
      console.log("📥 Received request_id from Flask:", request_id);
  
       // Track request status in the in-memory store
      requestResults[request_id] = "pending";

      // Save callback to use when Flask calls back
      requestsCallbacks[request_id] = async (images) => {
        const imagePaths = [];
        for (const filename of images) {
          const imageUrl = `/generated_images/${filename}`;
          imagePaths.push(imageUrl);
  
          if (userId !== "guest") {
            await new Image({ userId, imageUrl, prompt }).save();
          }
        }

        requestResults[request_id] = imagePaths; // Store the image URLs in memory
        console.log("✅ Images saved to MongoDB:", imagePaths); 
        // If there’s an open SSE connection, send data
        const sseConnection = connections[request_id];
        if (sseConnection) {
          sseConnection.write(`data: ${JSON.stringify({ imageUrls: imagePaths })}\n\n`);
          sseConnection.end();
          delete connections[request_id];
        }
        // Clean up callback too
        delete requestsCallbacks[request_id];
      };
  
      // Acknowledge that generation has started
      res.json({ status: "queued", request_id: request_id });
  
    } catch (error) {
      console.error("❌ Error in image generation:", error.message);
      return res.status(500).json({ error: "Failed to generate images" });
    }
  });
  
  app.get('/check-images/:requestId', (req, res) => {
    const { requestId } = req.params;
    console.log("Checking requestId:", requestId);
  
    const imageUrls = requestResults[requestId];
    
    if (imageUrls) {
      // Send them back
      res.json({ imageUrls });
  
      // Clear from memory — one-time use
      delete requestResults[requestId];
    } else {
      res.json({ imageUrls: [] }); // Still processing
    }
  });
  
app.post("/image-generated-callback", async (req, res) => {
    const { request_id, images } = req.body;

    if (!request_id || !images) {
        return res.status(400).json({ error: "Missing request_id or images" });
    }

    console.log("📥 Callback received from Flask:", request_id);

    const callback = requestsCallbacks[request_id];
    if (callback) {
        // Pass images to the waiting frontend callback
        callback(images);

        // Remove from pending callbacks
        delete requestsCallbacks[request_id];
    }

    res.json({ message: "Callback processed successfully" });
});

app.get("/image-events/:request_id", (req, res) => {
    const { request_id } = req.params;
  
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    res.flushHeaders();
  
    // Store this open connection to send updates later
    connections[request_id] = res;
  
    // Clean up if client disconnects early
    req.on("close", () => {
      delete connections[request_id];
    });
  });
  

// Get history for a specific user
app.get("/get-history/:user_id", authenticateUser, async (req, res) => {
    const userId = req.params.user_id;

    if (req.user.userId !== userId) {
        return res.status(403).json({ message: "Access denied." });
    }

    const history = await Image.find({ userId }).sort({ timestamp: -1 });

    // Clean up the response
    const formattedHistory = history.map(item => ({
        _id: item._id, 
        imageUrl: item.imageUrl,
        prompt: item.prompt,
        timestamp: item.timestamp
    }));

    res.json(formattedHistory);
});


app.get("/get-messages", authenticateUser, async (req, res) => {
    try {
        if (req.user.isAdmin) {
            // Admin sees all messages
            const messages = await Contact.find().sort({ timestamp: -1 });
            return res.json(messages);
        } else {
            // Regular users see only their messages
            const messages = await Contact.find({ userId: req.user.userId }).sort({ timestamp: -1 });
            return res.json(messages);
        }
    } catch (error) {
        console.error("❌ Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// Admin reply to a contact message
app.post("/reply-to-message/:messageId", async (req, res) => {
    const { messageId } = req.params;
    const { reply } = req.body;

    if (!reply) {
        return res.status(400).json({ error: "Reply content is required" });
    }

    try {
        const updated = await Contact.findByIdAndUpdate(
            messageId,
            { adminReply: reply },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Message not found" });
        }

        // inside the try block, after updating the message:
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: updated.email, // send to the original message sender
            subject: "Reply to your message from CHITRA",
            text: `Hi ${updated.name},\n\nThanks for contacting us! Here's our reply:\n\n"${reply}"\n\nBest regards,\nCHITRA Support Team`
        });
        console.log("✅ Admin reply email sent to:", updated.email);

        res.status(200).json({ message: "Reply added successfully", updated });
    } catch (err) {
        console.error("Error replying to message:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.post("/contact", authenticateUser, async (req, res) => {
    const { name, email, message, recaptchaToken } = req.body;
    const userId = req.user ? req.user.userId : null; // Get user ID from JWT if logged in

    if (!name || !email || !message || !recaptchaToken) {
        return res.status(400).json({ error: "All fields are required" });
    }

    // Verify Google reCAPTCHA
    const secretKey = process.env.RECAPTCHA_SECRET;
    const recaptchaVerifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;

    try {
        const recaptchaResponse = await axios.post(recaptchaVerifyUrl);
        if (!recaptchaResponse.data.success) {
            return res.status(400).json({ error: "reCAPTCHA verification failed" });
        }

        // Save message in MongoDB (Attach to user if logged in)
        const newMessage = new Contact({ userId, name, email, message, timestamp: new Date() });
        await newMessage.save();

        // Send email notification
        const mailOptions = {
            from: process.env.EMAIL_USER,       // your Gmail that’s sending the email
            to: process.env.EMAIL_RECEIVER,     // where you want to receive it
            replyTo: email,                     // user who filled out the form
            subject: "New Contact Message",
            text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
        };


        await transporter.sendMail(mailOptions);
        console.log("✅ Email sent to:", process.env.EMAIL_RECEIVER);

        // Auto-reply to the sender
        const autoReplyOptions = {
            from: process.env.EMAIL_USER, // your Gmail
            to: email,                    // the user's email from the contact form
            subject: "Thanks for contacting us!",
            text: `Hi ${name},\n\nThank you for reaching out! We’ve received your message and will get back to you shortly.\n\nBest regards,\nTeam CHITRA`,
        };

        await transporter.sendMail(autoReplyOptions);
        console.log("✅ Auto-reply sent to:", email);

        res.status(200).json({ message: "Message sent successfully" });

    } catch (error) {
        console.error("Error processing contact form:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Endpoint to get user info
const ContactModel = require('./models/Contact');
const ImageModel = require('./models/Image');

app.get("/api/user", async (req, res) => {
    const token = req.cookies.jwt_token;
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
            });
        });

        const user = await User.findById(decoded.userId).lean();

        if (user) {
            res.json({
                name: user.username,
                email: user.email,
                profilePic: user.profilePic || "default-avatar.png",
                isAdmin: user.isAdmin
            });

        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        res.status(403).json({ message: "Invalid token" });
    }
});

// Endpoint to get messages
app.get("/api/messages/count", authenticateUser, async (req, res) => {
    try {
        const count = await ContactModel.countDocuments({ userId: req.user.userId });
        res.json({ count });
    } catch (err) {
        console.error("❌ Error fetching message count:", err);
        res.status(500).json({ error: "Failed to fetch message count" });
    }
});

app.get("/api/generated-images/count", authenticateUser, async (req, res) => {
    try {
        const count = await ImageModel.countDocuments({ userId: req.user.userId });
        res.json({ count });
    } catch (err) {
        console.error("❌ Error fetching image count:", err);
        res.status(500).json({ error: "Failed to fetch image count" });
    }
});

app.delete("/api/delete-image/:id", async (req, res) => {
    try {
      console.log("Deleting image with ID:", req.params.id);
      const image = await Image.findById(req.params.id);
  
      if (!image) return res.status(404).json({ success: false, message: "Image not found" });
  
      // Debug log the found document
      console.log("Found image:", image);
  
      // Delete from folder if path exists
      if (image.path) {
        const filePath = path.join(__dirname, "public", "generated", path.basename(image.path));
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("Failed to delete file from filesystem:", err);
          } else {
            console.log("File deleted from filesystem:", filePath);
          }
        });
      } else {
        console.warn("No 'path' field found on image document, skipping file deletion.");
      }
  
      // Delete from MongoDB
      await Image.findByIdAndDelete(req.params.id);
  
      res.json({ success: true });
    } catch (err) {
      console.error("Error during image deletion:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

app.use("/api", authenticateUser);


const server = app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
  

