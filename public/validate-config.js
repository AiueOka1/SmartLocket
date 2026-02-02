// 🔒 LOCKED URL VALIDATION SCRIPT
// Run this to verify all URLs are consistent

console.log('🔒 VALIDATING LOCKED CONFIGURATION...\n');

// Test if config.js is loaded
if (typeof window !== 'undefined' && window.LOCKED_CONFIG) {
    console.log('✅ LOCKED_CONFIG loaded successfully');
    console.log('📍 R2 Public URL:', window.LOCKED_CONFIG.R2_PUBLIC_URL);
    console.log('📍 API Production:', window.LOCKED_CONFIG.API_PRODUCTION);
    console.log('📍 API Local:', window.LOCKED_CONFIG.API_LOCAL);
    console.log('📍 Production Domain:', window.LOCKED_CONFIG.PRODUCTION_DOMAIN);
} else {
    console.log('❌ LOCKED_CONFIG not found - config.js not loaded');
}

// Test API_BASE_URL
if (typeof window !== 'undefined' && window.API_BASE_URL) {
    console.log('✅ API_BASE_URL set:', window.API_BASE_URL);
} else {
    console.log('❌ API_BASE_URL not set');
}

// Test R2_PUBLIC_URL
if (typeof window !== 'undefined' && window.R2_PUBLIC_URL) {
    console.log('✅ R2_PUBLIC_URL set:', window.R2_PUBLIC_URL);
} else {
    console.log('❌ R2_PUBLIC_URL not set');
}

// Test environment detection
if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    console.log('🌍 Current hostname:', hostname);
    
    if (window.LOCKED_CONFIG && window.LOCKED_CONFIG.isProduction) {
        const isProduction = window.LOCKED_CONFIG.isProduction();
        console.log('🔍 Is production?', isProduction);
    }
}

// Test getImageUrl function if available
if (typeof getImageUrl === 'function') {
    console.log('\n🖼️ TESTING getImageUrl FUNCTION:');
    
    const testUrls = [
        'XNJNQV/1770039622910.jpeg',
        '/api/image/XNJNQV/test.jpg',
        '/api/image/nfcchain/XNJNQV/test.jpg',
        'https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev/XNJNQV/test.jpg'
    ];
    
    testUrls.forEach(url => {
        const result = getImageUrl(url);
        console.log(`Input:  ${url}`);
        console.log(`Output: ${result}\n`);
    });
} else {
    console.log('❌ getImageUrl function not available');
}

console.log('🔒 VALIDATION COMPLETE');

// Expected results:
// ✅ All URLs should use https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev in production
// ✅ All URLs should use http://localhost:3000 in development
// ✅ No hardcoded URLs should remain
