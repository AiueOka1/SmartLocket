/**
 * NFCchain Backend API - Local Development Server
 * Uses shared routes module for consistency with Firebase Functions
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Add bcrypt import
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

// Import shared routes
const {setupRoutes} = require('../shared/routes');

// Firebase Admin SDK
const admin = require('firebase-admin');
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./firebase-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'nfcchain.firebasestorage.app'
});

const db = admin.firestore();

// Cloudflare R2 Configuration
const { S3Client } = require('@aws-sdk/client-s3');

const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

console.log('🌐 Cloudflare R2 initialized:', process.env.R2_BUCKET_NAME);
console.log('📦 Public URL:', process.env.R2_PUBLIC_URL);

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const app = express();

// CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'https://aiueoka1.github.io',
    "https://127.0.0.1:5500",
    "http://localhost:5500",
    process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Increase payload size limit to 50MB for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));
app.use('/src', express.static(path.join(__dirname, '../src')));

// --------------------
// Setup all routes using shared module
// --------------------
setupRoutes(app, db, admin, r2Client, transporter, bcrypt);

// Health check specifically for local development
app.get('/', (req, res) => {
    res.json({
        message: 'SmartLocket Local Development Server is running!',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint to add passcode to existing SmartLocket (development only)
app.post('/api/dev/add-passcode/:memoryId', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Not available in production' });
    }
    
    const { memoryId } = req.params;
    const { passcode } = req.body;
    
    if (!passcode || passcode.length < 6) {
        return res.status(400).json({ error: 'Passcode must be at least 6 characters' });
    }
    
    try {
        const passcodeHash = await bcrypt.hash(passcode, 10);
        
        const docRef = db.collection('nfcChains').doc(memoryId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'SmartLocket not found' });
        }
        
        await docRef.update({
            passcodeHash: passcodeHash
        });
        
        console.log(`🔒 Added passcode to ${memoryId}`);
        res.json({ 
            success: true, 
            message: `Passcode added to ${memoryId}`,
            passcodeHash: passcodeHash
        });
    } catch (error) {
        console.error('Error adding passcode:', error);
        res.status(500).json({ error: 'Failed to add passcode' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 SmartLocket Server running on http://localhost:${PORT}`);
    console.log(`📧 Email service: ${process.env.EMAIL_USER}`);
    console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Server is shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Server terminated gracefully');
    process.exit(0);
});
