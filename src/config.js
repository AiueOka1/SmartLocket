// SmartLocket Frontend Configuration
// This file sets the API base URL for local development vs production

const API_CONFIG = {
    // Change this based on your environment
    BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000'  // Local development
        : 'https://api.smartlocket.com',  // Production (change when you deploy)
    
    // Helper function to get full API URL
    getUrl: function(endpoint) {
        return this.BASE_URL + endpoint;
    }
};

// Example usage:
// fetch(API_CONFIG.getUrl('/api/admin/stats'))
