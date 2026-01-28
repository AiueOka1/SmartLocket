/**
 * Firebase Functions entry point for Express API
 */
const functions = require("firebase-functions");
const app = require("../backend/server");

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
