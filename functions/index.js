/* eslint-disable require-jsdoc */

const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const {S3Client, PutObjectCommand} = require("@aws-sdk/client-s3");

// --------------------
// Firebase init
// --------------------
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// --------------------
// Cloudflare R2
// --------------------
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// --------------------
// Mailer
// --------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// --------------------
// Express app
// --------------------
const app = express();

const allowedOrigins = [
  "https://aiueoka1.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json());

// --------------------
// Utils
// --------------------
function formatTimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  return null;
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --------------------
// Routes
// --------------------
app.get("/health", (req, res) => {
  res.json({status: "ok"});
});

// Get memory
app.get(["/api/memory/:memoryId", "/memory/:memoryId"], async (req, res) => {
  const {memoryId} = req.params;

  try {
    const docRef = db.collection("nfcChains").doc(memoryId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({message: "NFCchain not found"});
    }

    const data = doc.data();

    return res.json({
      memoryId,
      status: data.status,
      premium: data.premium,
      photoLimit: data.photoLimit,
      photoCount: data.photoCount,
      galleryTitle: data.galleryTitle,
      galleryData: data.galleryData,
      images: data.images || [],
      letterContent: data.letterContent,
      spotifyUrl: data.spotifyUrl,
      spotifyTrack: data.spotifyTrack || null,
      themeSettings: data.themeSettings || null,
      createdAt: formatTimestamp(data.createdAt),
      activatedAt: formatTimestamp(data.activatedAt),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({message: "Failed to fetch memory"});
  }
});

// Update memory (THIS FIXES YOUR 404 PUT)
app.put(["/api/memory/:memoryId", "/memory/:memoryId"], async (req, res) => {
  const {memoryId} = req.params;
  const updates = req.body;

  if (!updates || !Object.keys(updates).length) {
    return res.status(400).json({message: "No update data"});
  }

  try {
    const ref = db.collection("nfcChains").doc(memoryId);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({message: "NFCchain not found"});
    }

    await ref.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({success: true});
  } catch (err) {
    console.error(err);
    return res.status(500).json({success: false});
  }
});

// Verify passcode
app.post(["/api/verify-passcode", "/verify-passcode"], async (req, res) => {
  const {memoryId, passcode} = req.body;

  if (!memoryId || !passcode) {
    return res.status(400).json({valid: false});
  }

  try {
    const ref = db.collection("nfcChains").doc(memoryId);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({valid: false});
    }

    const data = doc.data();

    if (!data.passcodeHash) {
      return res.json({valid: true});
    }

    const valid = await bcrypt.compare(passcode, data.passcodeHash);
    return res.json({valid});
  } catch (err) {
    console.error(err);
    return res.status(500).json({valid: false});
  }
});

// Upload image to R2
app.post(["/api/upload-image", "/upload-image"], async (req, res) => {
  const {memoryId, imageData, fileName} = req.body;

  if (!memoryId || !imageData) {
    return res.status(400).json({message: "Missing image data"});
  }

  try {
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const ext = fileName ? fileName.split(".").pop() : "jpg";
    const key = `${memoryId}/${Date.now()}.${ext}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000",
    }));

    const url = `${process.env.R2_PUBLIC_URL}/${key}`;

    return res.json({
      success: true,
      url,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({message: "Upload failed"});
  }
});

// Request reset
app.post(
  ["/api/memory/request-reset", "/memory/request-reset"],
  async (req, res) => {
    const {memoryId, email} = req.body;

    if (!memoryId || !email) {
      return res.status(400).json({success: false});
    }

    try {
      const ref = db.collection("nfcChains").doc(memoryId);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({success: false});
      }

      const data = doc.data();
      if (data.email !== email) {
        return res.status(400).json({success: false});
      }

      const code = generateVerificationCode();

      await ref.update({
        resetCode: code,
        resetCodeExpiry: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 10 * 60 * 1000),
        ),
      });

      await transporter.sendMail({
        from: "SmartLocket <no-reply@memorychain>",
        to: email,
        subject: "Your reset code",
        text: `Your reset code is ${code}`,
      });

      return res.json({success: true});
    } catch (err) {
      console.error(err);
      return res.status(500).json({success: false});
    }
  },
);

// Reset passcode
app.post(
  ["/api/memory/reset-passcode", "/memory/reset-passcode"],
  async (req, res) => {
    const {memoryId, code, newPasscode} = req.body;

    if (!memoryId || !code || !newPasscode) {
      return res.status(400).json({success: false});
    }

    try {
      const ref = db.collection("nfcChains").doc(memoryId);
      const doc = await ref.get();

      if (!doc.exists()) {
        return res.status(404).json({success: false});
      }

      const data = doc.data();

      if (data.resetCode !== code) {
        return res.status(400).json({success: false});
      }

      const hash = await bcrypt.hash(newPasscode, 10);

      await ref.update({
        passcodeHash: hash,
        resetCode: admin.firestore.FieldValue.delete(),
        resetCodeExpiry: admin.firestore.FieldValue.delete(),
      });

      return res.json({success: true});
    } catch (err) {
      console.error(err);
      return res.status(500).json({success: false});
    }
  },
);

// --------------------
// Export
// --------------------
exports.api = functions.https.onRequest(app);
