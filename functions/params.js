// Firebase Functions params API setup
// Do NOT use reserved prefixes like FIREBASE_, X_GOOGLE_, or EXT_
const {defineString} = require("firebase-functions/params");

exports.SERVICE_ACCOUNT_JSON = defineString("SERVICE_ACCOUNT_JSON");
exports.DB_URL = defineString("DB_URL");
exports.STORAGE_BUCKET = defineString("STORAGE_BUCKET");
exports.EMAIL_USER = defineString("EMAIL_USER");
exports.EMAIL_PASSWORD = defineString("EMAIL_PASSWORD");
exports.R2_ENDPOINT = defineString("R2_ENDPOINT");
exports.R2_ACCESS_KEY_ID = defineString("R2_ACCESS_KEY_ID");
exports.R2_SECRET_ACCESS_KEY = defineString("R2_SECRET_ACCESS_KEY");
exports.R2_BUCKET_NAME = defineString("R2_BUCKET_NAME");
exports.R2_PUBLIC_URL = defineString("R2_PUBLIC_URL");
