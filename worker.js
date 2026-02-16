// Cloudflare Worker - Asset Relay for Mobile Carrier Bypass
// Deploy this to: smartlocket-asset.somarious2.workers.dev
// Handles: Images (JPG, PNG, GIF, WEBP, etc.) and Videos (MP4)

export default {
  async fetch(request, env) {
    // Parse the request URL
    const url = new URL(request.url);
    
    // Only handle GET requests for assets
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // Extract the asset path from the URL
    // Example: smartlocket-asset.somarious2.workers.dev/449G9U/image.jpg -> 449G9U/image.jpg
    // Example: smartlocket-asset.somarious2.workers.dev/449G9U/videos/video.mp4 -> 449G9U/videos/video.mp4
    const assetPath = url.pathname.slice(1); // Remove leading slash
    
    // If no path provided, return a simple status
    if (!assetPath) {
      return new Response('SmartLocket Assets Relay - OK (Images & Videos)', { 
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    // Construct the R2 URL
    const r2Url = `https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev/${assetPath}`;
    
    try {
      // Fetch from R2
      const response = await fetch(r2Url, {
        headers: {
          // Forward any relevant headers from the original request
          'User-Agent': request.headers.get('User-Agent') || 'SmartLocket-Relay/1.0',
          'Range': request.headers.get('Range') || '' // Support video range requests
        }
      });
      
      // If R2 returns an error, return a simple error response
      if (!response.ok) {
        console.log(`R2 fetch failed: ${response.status} for ${r2Url}`);
        return new Response('Asset not found', { 
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
      headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
      headers.set('Content-Length', response.headers.get('Content-Length') || '');
      headers.set('Last-Modified', response.headers.get('Last-Modified') || '');
      headers.set('ETag', response.headers.get('ETag') || '');
      
      // Support video streaming with range requests
      const acceptRanges = response.headers.get('Accept-Ranges');
      const contentRange = response.headers.get('Content-Range');
      if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);
      if (contentRange) headers.set('Content-Range', contentRange);
      
      // Set caching headers - cache for 1 day on edge, 1 year in CDN
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
      console.error(`Worker error for ${assetPath}:`, error);
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
