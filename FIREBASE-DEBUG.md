# Firebase Functions Deployment Debug Guide

## Current Issue
Your admin panel is getting a 404 error when trying to access the generate-batch endpoint on the live Firebase Functions.

Error: `POST https://api-vcdrn5osga-uc.a.run.app/admin/generate-batch 404 (Not Found)`

## Root Cause
The endpoint URL in the error shows `/admin/generate-batch` but the code is calling `/api/admin/generate-batch`. This suggests either:
1. The Firebase Functions deployment is missing the route
2. The URL rewriting is not working correctly
3. The Firebase Functions are not properly deployed

## Solution Steps

### 1. Verify Firebase Functions Deployment
Run these commands to redeploy your Firebase Functions with the latest code:

```bash
# Navigate to your project directory
cd c:\Users\mariousso\Documents\memorychain

# Install dependencies
cd functions
npm install

# Deploy Firebase Functions
firebase deploy --only functions

# Check deployment status
firebase functions:log --limit 10
```

### 2. Test the API Endpoint Directly
After deployment, test the endpoint directly:

```bash
# Test if the endpoint exists
curl -X GET https://api-vcdrn5osga-uc.a.run.app/health

# Test the generate-batch endpoint
curl -X POST https://api-vcdrn5osga-uc.a.run.app/api/admin/generate-batch \
  -H "Content-Type: application/json" \
  -d '{"quantity":1,"photoLimit":5,"prefix":"","premium":false}'
```

### 3. Check Firebase Functions Configuration
Make sure your Firebase Functions are properly configured:

1. Check `firebase.json` for proper function configuration
2. Verify environment variables are set in Firebase Console
3. Confirm the function URL matches what's in admin-script.js

### 4. Alternative: Update API URL
If the Firebase Functions URL has changed, update the API_BASE_URL in admin-script.js:

```javascript
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://YOUR_ACTUAL_FIREBASE_FUNCTIONS_URL';
```

## Debugging Commands

1. **Check Firebase project**: `firebase projects:list`
2. **Check current project**: `firebase use`
3. **Check functions logs**: `firebase functions:log --limit 20`
4. **Check deployment status**: `firebase functions:list`

## Expected Function URL Format
Firebase Functions typically follow this pattern:
- `https://[REGION]-[PROJECT-ID].cloudfunctions.net/api`
- Or: `https://[PROJECT-ID]-[RANDOM].a.run.app`

Make sure your API_BASE_URL matches the actual deployed function URL.
