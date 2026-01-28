/**
 * Firebase Functions entry point for Express API
 * Note: The Express app is implemented in `backend/server.js`.
 * Any changes to that file require a functions redeploy, which
 * Firebase detects when this file (or other files in the `functions`
 * source directory) changes.
 */
const functions = require("firebase-functions");
const app = require("../backend/server");

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
