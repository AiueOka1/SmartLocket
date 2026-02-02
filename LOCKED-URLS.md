# 🔒 LOCKED URL CONFIGURATION

## ⚠️ CRITICAL - DO NOT MODIFY THESE PATHS!

These URLs are **LOCKED** and hardcoded across multiple files. **DO NOT CHANGE** without updating ALL references.

### 🌐 PRODUCTION URLS (LOCKED)

```
R2 Public URL:    https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev
R2 S3 Endpoint:   https://cfb74f6c6f03ae746b61558cfd98e44d.r2.cloudflarestorage.com
API Production:   https://api-vcdrn5osga-uc.a.run.app
Frontend Domain:  https://aiueoka1.github.io
```

### 🏠 LOCAL URLS (LOCKED)

```
API Local:        http://localhost:3000
Frontend Local:   http://localhost:3000
```

### 📁 FILES THAT REFERENCE THESE URLS

If you change ANY URL above, you MUST update ALL of these files:

#### Frontend Files:
- ✅ `src/config.js` - LOCKED configuration
- ✅ `src/script.js` - Uses LOCKED config
- ✅ `public/src/config.js` - Deployed version
- ✅ `public/src/script.js` - Deployed version

#### Backend Files:
- ✅ `backend/.env` - LOCKED environment
- ✅ `backend/server.js` - Uses .env
- ✅ `backend/server-new.js` - Uses .env

#### Shared Files:
- ✅ `shared/routes.js` - LOCKED R2 URLs
- ✅ `functions/shared/routes.js` - Firebase version

#### Environment Files:
- ✅ `.env.example` - Template with LOCKED URLs
- ✅ `functions/.env` - Firebase Functions environment

### 🚨 WARNING: BEFORE CHANGING ANY URL

1. **Search entire project** for the old URL
2. **Update ALL references** in the files above
3. **Test both local and production** environments
4. **Commit all changes together**

### 🔧 How It Works

1. **Frontend Auto-Detection**: `src/config.js` detects hostname and uses appropriate URL
2. **Backend Environment**: Uses `.env` file with LOCKED URLs
3. **Image Handling**: `getImageUrl()` function handles all URL transformations
4. **Fallbacks**: Every URL has a fallback to LOCKED defaults

### ✅ Current Status

All paths are now LOCKED and consistent:
- ✅ Production: Uses `pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev` directly
- ✅ Development: Proxies through `localhost:3000`
- ✅ Auto-detection: Works on all browsers and mobile
- ✅ No more CORS errors
- ✅ No more 404 errors

**DO NOT TOUCH THESE PATHS!** 🔒
