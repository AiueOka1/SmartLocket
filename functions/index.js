/* eslint-disable require-jsdoc */

const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs"); // Add bcrypt import
const nodemailer = require("nodemailer");

// Import shared routes
const {setupRoutes} = require("./shared/routes");

// Load environment variables for local development
require("dotenv").config();

// For environment variables in Firebase Functions, use runtime environment
// These can be set using Firebase Console or firebase functions:config:set

// --------------------
// Firebase init
// --------------------
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// --------------------
// Cloudflare R2 Configuration
// --------------------
const {S3Client} = require("@aws-sdk/client-s3");

const r2Client = new S3Client({
  region: "auto", 
  endpoint: process.env.R2_ENDPOINT || "https://cfb74f6c6f03ae746b61558cfd98e44d.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "81856ac44c6c8a46b7207b5cd68b4740",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "20792b08b4598bdc215658f5962a2e06f5b73c60f925834a0d7beabe64ff7bae",
  },
});

// --------------------
// Mailer
// --------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "nfcchain@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "nfyf rija wbhb mqor",
  },
});

// --------------------
// Express app
// --------------------
const app = express();

const allowedOrigins = [
  "https://smartlocket.win",
  "http://smartlocket.win",
  "https://www.smartlocket.win",
  "http://www.smartlocket.win",
  "https://assets.smartlocket.win",
  "https://nfcchain.web.app",
  "https://nfcchain.firebaseapp.com",
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
// Setup all routes using shared module
// --------------------
setupRoutes(app, db, admin, r2Client, transporter, bcrypt);

// --------------------
// Export
// --------------------
exports.api = functions.https.onRequest({
  timeoutSeconds: 540,
  memory: "1GiB",
  maxInstances: 10,
}, app);
