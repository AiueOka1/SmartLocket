# 🔥 Cloudflare Worker Deployment Guide - Mobile Carrier Bypass
## GitHub Pages + Firebase + Cloudflare R2 Setup

## Overview
This Cloudflare Worker acts as a "dumb relay" that makes your R2 images appear to come from your own domain, bypassing mobile carrier blocking. Perfect for GitHub Pages + Firebase hosting!

## Benefits
- ✅ **Carrier-Proof**: Mobile carriers see your domain, not blocked Cloudflare R2
- ✅ **Lightning Fast**: Cloudflare's global edge network
- ✅ **Auto-Caching**: Images cached at edge for 24 hours
- ✅ **Zero Server Load**: No impact on Firebase Functions
- ✅ **GitHub Pages Compatible**: Works with static hosting

## Step 1: Create Cloudflare Worker

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click "Workers & Pages"
3. Click "Create Application"
4. Click "Create Worker"
5. Name it: `memorychain-assets` (or `smartlocket-assets`)
6. Copy the code from `worker.js` into the editor
7. Click "Save and Deploy"

## Step 2: Setup Custom Domain Options

### Option A: Using Your Main Domain
If your site is at `yourdomain.com`:
1. In Cloudflare Dashboard, go to your domain
2. Go to "Workers Routes"
3. Add route: `assets.yourdomain.com/*` → `memorychain-assets`

### Option B: Using GitHub Pages Domain
If using `username.github.io/memorychain`:
1. Use a subdomain like `cdn.yourdomain.com`
2. Point it to the worker: `cdn.yourdomain.com/*` → `memorychain-assets`

### Option C: Using Firebase Custom Domain
If using Firebase Hosting with custom domain:
1. Create subdomain: `images.yourdomain.com`
2. Route to worker: `images.yourdomain.com/*` → `memorychain-assets`

## Step 3: Update Your Code

Choose your domain and update the JavaScript:

### For Custom Domain:
```javascript
const ASSETS_RELAY_URL = 'https://assets.yourdomain.com';
```

### For GitHub Pages + Subdomain:
```javascript
const ASSETS_RELAY_URL = 'https://cdn.yourdomain.com';
```

### For Firebase Hosting:
```javascript
const ASSETS_RELAY_URL = 'https://images.yourdomain.com';
```

All image URLs will now be:
- **Before**: `https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev/449G9U/image.jpg`
- **After**: `https://your-chosen-domain.com/449G9U/image.jpg`

## Architecture Overview

```
GitHub Pages (Frontend)
    ↓
Your Custom Domain (assets.yourdomain.com)
    ↓
Cloudflare Worker (edge relay)
    ↓
Cloudflare R2 Storage
    ↓
Firebase (API/Auth) [separate service]
```

## How It Works

```
Mobile User → smartlocket-asset.somarious2.workers.dev/image.jpg
    ↓
Cloudflare Worker (edge)
    ↓
pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev/image.jpg
    ↓
Back to user (cached at edge)
```

## Testing

1. ✅ Worker deployed at: `https://smartlocket-asset.somarious2.workers.dev/`
2. Test URL: `https://smartlocket-asset.somarious2.workers.dev/449G9U/test.jpg`
3. Should proxy any R2 image seamlessly

## Monitoring

- Check Cloudflare Analytics for worker requests
- Monitor cache hit ratio (should be >90% after initial requests)
- Check for any 5xx errors in worker logs

## Costs

- Cloudflare Workers: First 100,000 requests/day = FREE
- Bandwidth: Typically free on Pro plan
- Your images will be cached globally = faster loading

## Alternative Domains for GitHub Pages

If you don't have a custom domain, use these free options:

### Option 1: Cloudflare Workers Domain
```javascript
const ASSETS_RELAY_URL = 'https://memorychain-assets.your-subdomain.workers.dev';
```

### Option 2: Use Your Firebase Domain
```javascript
const ASSETS_RELAY_URL = 'https://your-project.web.app/assets';
```
(Route `/assets/*` to the worker)

### Option 3: GitHub Pages + CNAME
1. Create `CNAME` record: `cdn.yourdomain.com` → `username.github.io`
2. Use worker on the subdomain

Just update `ASSETS_RELAY_URL` in your JavaScript code accordingly.

## Deployment with GitHub Pages

1. **Worker**: Deploy to Cloudflare (handles images)
2. **Frontend**: Push to GitHub Pages (static files)
3. **Backend**: Firebase Functions (API/auth)
4. **Storage**: Cloudflare R2 (via worker relay)

Perfect separation of concerns! 🔥

---

**Result**: Mobile carriers will never see Cloudflare R2 domain, only YOUR domain! 🚀
