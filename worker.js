// Cloudflare Worker - Image Relay for Mobile Carrier Bypass
// Deploy this to: assets.smartlocket.app or assets.yourdomain.com

export default {
  async fetch(request, env) {
    // Parse the request URL
    const url = new URL(request.url);
    
    // Only handle GET requests for images
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // Extract the image path from the URL
    // Example: assets.smartlocket.app/449G9U/image.jpg -> 449G9U/image.jpg
    const imagePath = url.pathname.slice(1); // Remove leading slash
    
    // If no path provided, return a simple status
    if (!imagePath) {
      return new Response('SmartLocket Assets Relay - OK', { 
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    // Construct the R2 URL
    const r2Url = `https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev/${imagePath}`;
    
    try {
      // Fetch from R2
      const response = await fetch(r2Url, {
        headers: {
          // Forward any relevant headers from the original request
          'User-Agent': request.headers.get('User-Agent') || 'SmartLocket-Relay/1.0'
        }
      });
      
      // If R2 returns an error, return a simple error response
      if (!response.ok) {
        console.log(`R2 fetch failed: ${response.status} for ${r2Url}`);
        return new Response('Image not found', { 
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=300' // Short cache for errors
          }
        });
      }
      
      // Create response with proper headers for caching and CORS
      const headers = new Headers();
      
      // Copy important headers from R2 response
      headers.set('Content-Type', response.headers.get('Content-Type') || 'image/jpeg');
      headers.set('Content-Length', response.headers.get('Content-Length') || '');
      headers.set('Last-Modified', response.headers.get('Last-Modified') || '');
      headers.set('ETag', response.headers.get('ETag') || '');
      
      // Set caching headers - cache for 1 day on edge
      headers.set('Cache-Control', 'public, max-age=86400, s-maxage=31536000');
      
      // Set CORS headers to allow cross-origin requests
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      
      // Add custom header to identify the relay
      headers.set('X-Relay', 'SmartLocket-Assets');
      
      return new Response(response.body, {
        status: response.status,
        headers: headers
      });
      
    } catch (error) {
      console.error(`Worker error for ${imagePath}:`, error);
      return new Response('Service temporarily unavailable', { 
        status: 503,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache',
          'Retry-After': '60'
        }
      });
    }
  }
};
