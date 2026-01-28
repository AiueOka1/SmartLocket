/**
 * Firebase Functions entry point for Express API
 * Note: The Express app code has been migrated here from `backend/server.js`.
 * Any changes to this file require a functions redeploy, which
 * Firebase detects when this file (or other files in the `functions`
 * source directory) changes.
 */
const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

// Initialize Express app
const app = express();

// Enable CORS for all requests
app.use(cors({origin: true}));

// Parse JSON request bodies
app.use(express.json());

// Health check route
app.get("/health", (req, res) => {
  res.json({status: "ok"});
});

// ...additional routes and logic migrated from backend/server.js...

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
