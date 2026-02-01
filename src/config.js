// SmartLocket Frontend Configuration
// This file sets the API base URL for local development vs production

const API_CONFIG = {
    // Change this based on your environment
    BASE_URL: (() => {
        const hostname = window.location.hostname;
        
        // Local development
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        
        // Production on GitHub Pages (your repository)
        if (hostname === 'aiueoka1.github.io') {
            // Your deployed Firebase Functions backend
            return 'https://api-vcdrn5osga-uc.a.run.app';
        }
        
        // Production on Firebase Hosting (if you use both)
        if (hostname === 'nfcchain.web.app' || hostname === 'nfcchain.firebaseapp.com') {
            // Use your Firebase Functions backend
            return 'https://api-vcdrn5osga-uc.a.run.app';
        }
        
        // Default fallback
        return 'https://api-vcdrn5osga-uc.a.run.app';
    })(),
    
    // Helper function to get full API URL
    getUrl: function(endpoint) {
        return this.BASE_URL + endpoint;
    }
};

// Global API_BASE_URL for backwards compatibility
const API_BASE_URL = API_CONFIG.BASE_URL;

// Example usage:
// fetch(API_CONFIG.getUrl('/api/admin/stats'))
