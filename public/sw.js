// SmartLocket Service Worker for Enhanced Mobile Performance
const CACHE_NAME = 'smartlocket-v1.3';
const CACHE_URLS = [
    '/gallery.html',
    '/activate.html',
    '/activate-style.css',
    '/src/style.css',
    '/src/script.js',
    '/config.js',
    '/src/activate-script.js',
    '/resources/chain.png',
    '/resources/phone.png'
];

// Network-first strategy for API calls, Cache-first for static assets
const NETWORK_FIRST_PATTERNS = [
    /\/api\//,
    /api-vcdrn5osga-uc\.a\.run\.app/
];

const CACHE_FIRST_PATTERNS = [
    /\.css$/,
    /\.js$/,
    /\.png$/,
    /\.jpg$/,
    /\.gif$/,
    /\.webp$/
];

// Install event - cache static resources
self.addEventListener('install', event => {
    console.log('🔧 Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Service Worker: Caching static resources');
                return cache.addAll(CACHE_URLS.map(url => 
                    new Request(url, { mode: 'no-cors' })
                ));
            })
            .then(() => {
                console.log('✅ Service Worker: Installation complete');
                self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Service Worker: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('🗑️ Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extension requests
    if (request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    // Determine caching strategy
    const isNetworkFirst = NETWORK_FIRST_PATTERNS.some(pattern => 
        pattern.test(request.url)
    );
    
    const isCacheFirst = CACHE_FIRST_PATTERNS.some(pattern => 
        pattern.test(request.url)
    );
    
    if (isNetworkFirst) {
        // Network-first strategy for API calls
        event.respondWith(networkFirst(request));
    } else if (isCacheFirst) {
        // Cache-first strategy for static assets
        event.respondWith(cacheFirst(request));
    } else {
        // Default: try cache first, fallback to network
        event.respondWith(cacheFirst(request));
    }
});

// Network-first strategy implementation
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        
        // Cache successful responses
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('🌐 Service Worker: Network failed, trying cache for', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return a generic offline response for API calls
        return new Response(
            JSON.stringify({ error: 'Offline - cached data not available' }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Cache-first strategy implementation
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // Update cache in background for next time
        fetch(request).then(response => {
            if (response.ok) {
                const cache = caches.open(CACHE_NAME);
                cache.then(c => c.put(request, response.clone()));
            }
        }).catch(() => {
            // Ignore network errors in background update
        });
        
        return cachedResponse;
    }
    
    try {
        const response = await fetch(request);
        
        // Cache the response
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.error('🌐 Service Worker: Failed to fetch', request.url);
        
        // Return a generic offline response
        return new Response(
            'Offline - content not available',
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
            }
        );
    }
}

// Handle background sync for failed uploads
self.addEventListener('sync', event => {
    if (event.tag === 'upload-retry') {
        console.log('🔄 Service Worker: Retrying failed uploads');
        event.waitUntil(retryFailedUploads());
    }
});

// Retry failed uploads when connection is restored
async function retryFailedUploads() {
    // This would integrate with IndexedDB to store failed uploads
    // For now, just log that the feature is available
    console.log('📤 Service Worker: Upload retry functionality ready');
}

// Handle push notifications (for future use)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        console.log('📬 Service Worker: Push notification received', data);
        
        const options = {
            body: data.body || 'New update available',
            icon: '/resources/chain.png',
            badge: '/resources/chain.png',
            tag: 'smartlocket-update',
            requireInteraction: false
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'SmartLocket', options)
        );
    }
});

console.log('🔧 Service Worker: Loaded and ready');
