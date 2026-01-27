# SmartLocket Deployment Guide

Complete guide for deploying SmartLocket frontend to Cloudflare Pages and backend to Render.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Frontend Deployment - Cloudflare Pages](#frontend-deployment---cloudflare-pages)
3. [Backend Deployment - Render](#backend-deployment---render)
4. [Environment Variables Setup](#environment-variables-setup)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ GitHub account
- ✅ Cloudflare account (free tier works)
- ✅ Render account (free tier works)
- ✅ Firebase project with Firestore enabled
- ✅ Cloudflare R2 bucket for image storage
- ✅ Domain name (optional but recommended)

---

## Frontend Deployment - Cloudflare Pages

### Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/memorychain.git
   git push -u origin main
   ```

### Step 2: Create Cloudflare Pages Project

1. **Log in to Cloudflare Dashboard**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Navigate to **Pages** in the sidebar

2. **Create a new project**
   - Click **"Create a project"**
   - Select **"Connect to Git"**
   - Authorize Cloudflare to access your GitHub account
   - Select your repository: `memorychain`

3. **Configure Build Settings**
   - **Project name**: `smartlocket` (or your preferred name)
   - **Production branch**: `main`
   - **Build command**: Leave empty (static site, no build needed)
   - **Build output directory**: `public`
   - **Root directory**: `/` (root of repository)

4. **Environment Variables** (Add these in the build settings):
   - `NODE_VERSION`: `18` (optional, for any Node.js tools)

5. **Click "Save and Deploy"**

### Step 3: Configure Custom Domain (Optional)

1. **Add Custom Domain**
   - In your Pages project, go to **Custom domains**
   - Click **"Set up a custom domain"**
   - Enter your domain: `smartlocket.com` (or your domain)
   - Follow DNS setup instructions

2. **Update DNS Records**
   - Add a **CNAME** record:
     - **Name**: `@` (or `www`)
     - **Target**: `your-project.pages.dev`
     - **Proxy status**: Proxied (orange cloud)

### Step 4: Update Frontend Configuration

After deployment, update `src/config.js`:

```javascript
const API_BASE_URL = 'https://your-backend.onrender.com';
```

Or use environment variables if you set up build-time injection.

---

## Backend Deployment - Render

### Step 1: Prepare Backend for Deployment

1. **Ensure your backend is ready**:
   - All dependencies are in `package.json`
   - Environment variables are used (not hardcoded)
   - `server.js` is the entry point

2. **Create a `.render.yaml` file** (optional but recommended) in the backend folder:

```yaml
services:
  - type: web
    name: smartlocket-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

### Step 2: Deploy to Render

1. **Log in to Render**
   - Go to [render.com](https://render.com)
   - Sign up/login with GitHub

2. **Create New Web Service**
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Select your repository: `memorychain`

3. **Configure Service Settings**:
   - **Name**: `smartlocket-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Add Environment Variables** (see section below)

5. **Click "Create Web Service"**

### Step 3: Configure Environment Variables

In Render dashboard, go to **Environment** tab and add:

```
NODE_ENV=production
PORT=10000

# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT=<paste entire JSON here>
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_STORAGE_BUCKET=nfcchain.firebasestorage.app

# Cloudflare R2 Configuration
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=nfcchain

# Email Configuration (Nodemailer)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
# Note: For Gmail, use App Password (not regular password)
# Generate at: https://myaccount.google.com/apppasswords

# CORS Configuration
CORS_ORIGIN=https://smartlocket.pages.dev,https://smartlocket.com
```

### Step 4: Get Firebase Service Account JSON

1. **Firebase Console**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Go to **Project Settings** → **Service Accounts**
   - Click **"Generate New Private Key"**
   - Download the JSON file

2. **Add to Render**:
   - Copy the entire JSON content
   - In Render, add environment variable:
     - **Key**: `FIREBASE_SERVICE_ACCOUNT`
     - **Value**: Paste the entire JSON (Render will handle it)

### Step 5: Update CORS Settings

In your `backend/server.js`, ensure CORS allows your Cloudflare Pages domain:

```javascript
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
        'https://smartlocket.pages.dev',
        'https://smartlocket.com',
        'http://localhost:5500', // For local development
        'http://localhost:3000'
    ],
    credentials: true
}));
```

---

## Environment Variables Setup

### Frontend (`src/config.js`)

Update the API base URL to your Render backend:

```javascript
const API_BASE_URL = process.env.API_BASE_URL || 'https://your-backend.onrender.com';
```

### Backend (`.env` file for local, Environment Variables in Render)

Create a `.env` file in the `backend/` folder for local development:

```env
NODE_ENV=development
PORT=3000

# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_STORAGE_BUCKET=nfcchain.firebasestorage.app

# Cloudflare R2
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=nfcchain

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
# Note: For Gmail, use App Password (not regular password)

# CORS
CORS_ORIGIN=http://localhost:5500,http://localhost:3000
```

**Important**: Add `.env` to `.gitignore` to keep secrets safe!

---

## Post-Deployment Configuration

### 1. Update Frontend API URL

After backend is deployed, get your Render URL (e.g., `https://smartlocket-backend.onrender.com`) and update:

- `src/config.js`: Change `API_BASE_URL` to your Render backend URL
- Commit and push to trigger Cloudflare Pages rebuild

### 2. Update Email Domain

In `backend/server.js`, update email sender:

```javascript
from: 'SmartLocket <noreply@smartlocket.com>'
```

**Note**: If using Gmail, the display name "SmartLocket" may not always show. Gmail sometimes displays the email address instead. To ensure the name shows correctly:
- Use a custom domain email (not Gmail)
- Configure SPF/DKIM records for your domain
- Or use a professional email service (SendGrid, Mailgun, etc.)

Make sure your domain has SPF/DKIM records configured for email delivery.

### 3. Test Deployment

1. **Test Frontend**:
   - Visit your Cloudflare Pages URL
   - Try activating a memory chain
   - Check browser console for errors

2. **Test Backend**:
   - Visit `https://your-backend.onrender.com/api/health` (if you add this endpoint)
   - Test API endpoints from frontend
   - Check Render logs for errors

### 4. Enable Auto-Deploy

Both Cloudflare Pages and Render automatically deploy on git push:
- **Cloudflare Pages**: Auto-deploys from `main` branch
- **Render**: Auto-deploys from configured branch

---

## Troubleshooting

### Frontend Issues

**Problem**: API calls failing with CORS errors
- **Solution**: Check CORS_ORIGIN in backend includes your Cloudflare Pages domain

**Problem**: Assets not loading (404 errors)
- **Solution**: Ensure `public` folder is set as build output directory in Cloudflare Pages

**Problem**: Page shows blank screen
- **Solution**: Check browser console for errors, verify API_BASE_URL is correct

### Backend Issues

**Problem**: Backend crashes on startup
- **Solution**: Check Render logs, verify all environment variables are set correctly

**Problem**: Firebase connection errors
- **Solution**: Verify FIREBASE_SERVICE_ACCOUNT JSON is correctly formatted (no line breaks in Render env var)

**Problem**: Email not sending
- **Solution**: 
  - For Gmail: Use App Password (not regular password)
  - Enable "Less secure app access" or use OAuth2
  - Check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS

**Problem**: Images not uploading to R2
- **Solution**: Verify R2 credentials and bucket name are correct

### Render-Specific Issues

**Problem**: Service goes to sleep (free tier)
- **Solution**: 
  - First request after sleep takes ~30 seconds
  - Consider upgrading to paid tier for always-on service
  - Or use a cron job to ping your service every 5 minutes

**Problem**: Build fails
- **Solution**: Check build logs, ensure all dependencies are in `package.json`

### Cloudflare-Specific Issues

**Problem**: Custom domain not working
- **Solution**: Verify DNS records are correct, wait for DNS propagation (up to 24 hours)

**Problem**: Pages not updating
- **Solution**: Check deployment status, manually trigger rebuild if needed

---

## Quick Reference

### Frontend URLs
- **Cloudflare Pages**: `https://smartlocket.pages.dev`
- **Custom Domain**: `https://smartlocket.com`

### Backend URLs
- **Render**: `https://smartlocket-backend.onrender.com`
- **Health Check**: `https://smartlocket-backend.onrender.com/api/health`

### Important Files
- Frontend config: `src/config.js`
- Backend server: `backend/server.js`
- Environment variables: Render Dashboard → Environment tab
- Build settings: Cloudflare Pages → Settings → Builds & deployments

---

## Next Steps

1. ✅ Deploy frontend to Cloudflare Pages
2. ✅ Deploy backend to Render
3. ✅ Configure environment variables
4. ✅ Update frontend API URL
5. ✅ Test all functionality
6. ✅ Set up custom domain
7. ✅ Configure email domain (SPF/DKIM)
8. ✅ Monitor logs for errors
9. ✅ Set up error tracking (optional: Sentry, LogRocket)

---

## Support

If you encounter issues:
1. Check Render logs: Dashboard → Your Service → Logs
2. Check Cloudflare Pages logs: Dashboard → Your Project → Deployments → View Logs
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly

Good luck with your deployment! 🚀
