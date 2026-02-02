// ===================================================================
// 🔒 LOCKED CONFIGURATION - DO NOT TOUCH THESE PATHS!
// ===================================================================
// These URLs are LOCKED and should NEVER be changed without updating ALL references

const LOCKED_CONFIG = {
    // 🌐 PRODUCTION URLS - LOCKED
    R2_PUBLIC_URL: 'https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev',
    R2_BUCKET: 'nfcchain',
    
    // 🚀 API ENDPOINTS - LOCKED
    API_PRODUCTION: 'https://api-vcdrn5osga-uc.a.run.app',
    API_LOCAL: 'http://localhost:3000',
    
    // 🌍 FRONTEND DOMAINS - LOCKED
    PRODUCTION_DOMAIN: 'aiueoka1.github.io',
    FIREBASE_DOMAINS: ['nfcchain.web.app', 'nfcchain.firebaseapp.com'],
    LOCAL_DOMAINS: ['localhost', '127.0.0.1']
};

const API_CONFIG = {
    // ⚠️ DO NOT MODIFY - Auto-detect environment and use LOCKED URLs
    BASE_URL: (() => {
        const hostname = window.location.hostname;
        
        // Local development - LOCKED URL
        if (LOCKED_CONFIG.LOCAL_DOMAINS.includes(hostname)) {
            return LOCKED_CONFIG.API_LOCAL;
        }
        
        // Production on GitHub Pages - LOCKED URL
        if (hostname === LOCKED_CONFIG.PRODUCTION_DOMAIN) {
            return LOCKED_CONFIG.API_PRODUCTION;
        }
        
        // Production on Firebase Hosting - LOCKED URL
        if (LOCKED_CONFIG.FIREBASE_DOMAINS.includes(hostname)) {
            return LOCKED_CONFIG.API_PRODUCTION;
        }
        
        // Default fallback - LOCKED URL
        return LOCKED_CONFIG.API_PRODUCTION;
    })(),
    
    // 🔒 LOCKED R2 Configuration
    R2_PUBLIC_URL: LOCKED_CONFIG.R2_PUBLIC_URL,
    R2_BUCKET: LOCKED_CONFIG.R2_BUCKET,
    
    // Helper function to get full API URL
    getUrl: function(endpoint) {
        return this.BASE_URL + endpoint;
    },
    
    // 🔒 LOCKED Helper Functions - DO NOT MODIFY
    getImageUrl: function(imagePath) {
        // Remove any existing bucket prefix to avoid duplication
        const cleanPath = imagePath.replace(/^nfcchain\//, '');
        return `${this.R2_PUBLIC_URL}/${cleanPath}`;
    },
    
    // Check if running in production
    isProduction: function() {
        const hostname = window.location.hostname;
        return hostname === LOCKED_CONFIG.PRODUCTION_DOMAIN || 
               LOCKED_CONFIG.FIREBASE_DOMAINS.includes(hostname);
    }
};

// 🔒 LOCKED Global Variables - DO NOT MODIFY THESE NAMES
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = API_CONFIG.BASE_URL;
}
if (typeof window.R2_PUBLIC_URL === 'undefined') {
    window.R2_PUBLIC_URL = API_CONFIG.R2_PUBLIC_URL;
}
if (typeof window.LOCKED_CONFIG === 'undefined') {
    window.LOCKED_CONFIG = LOCKED_CONFIG;
}
// ===================================================================
// ⚠️  CRITICAL WARNING - READ BEFORE MAKING ANY CHANGES
// ===================================================================
// These URLs are used across multiple files and environments:
// 1. Frontend: src/script.js, public/src/script.js
// 2. Backend: backend/.env, backend/server.js, backend/server-new.js
// 3. Functions: functions/.env, functions/index.js
// 4. Shared: shared/routes.js, functions/shared/routes.js
// 
// IF YOU CHANGE ANY URL HERE, YOU MUST UPDATE ALL REFERENCES!
// ===================================================================
