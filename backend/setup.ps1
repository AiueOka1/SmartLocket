# MemoryChain Backend Setup Script
# Run this in PowerShell from the backend folder

Write-Host "🔥 MemoryChain Backend Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the backend folder
if (!(Test-Path "server.js")) {
    Write-Host "❌ Error: Please run this script from the backend folder" -ForegroundColor Red
    Write-Host "   cd backend" -ForegroundColor Yellow
    exit 1
}

# Step 1: Check Node.js
Write-Host "📦 Step 1: Checking Node.js installation..." -ForegroundColor Green
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js $nodeVersion installed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js not found. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Step 2: Install dependencies
Write-Host ""
Write-Host "📦 Step 2: Installing dependencies..." -ForegroundColor Green
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 3: Check for .env file
Write-Host ""
Write-Host "🔧 Step 3: Checking environment configuration..." -ForegroundColor Green
if (!(Test-Path ".env")) {
    Write-Host "   ⚠️  .env file not found" -ForegroundColor Yellow
    Write-Host "   Creating .env from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "   ✅ .env file created" -ForegroundColor Green
    Write-Host "   ⚠️  Please edit .env with your Firebase and Gmail credentials" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
}

# Step 4: Check for Firebase service account
Write-Host ""
Write-Host "🔥 Step 4: Checking Firebase service account..." -ForegroundColor Green
if (!(Test-Path "firebase-service-account.json")) {
    Write-Host "   ❌ firebase-service-account.json not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "   To get this file:" -ForegroundColor Yellow
    Write-Host "   1. Go to https://console.firebase.google.com" -ForegroundColor Yellow
    Write-Host "   2. Select your project" -ForegroundColor Yellow
    Write-Host "   3. Click the gear icon → Project settings" -ForegroundColor Yellow
    Write-Host "   4. Go to Service accounts tab" -ForegroundColor Yellow
    Write-Host "   5. Click 'Generate new private key'" -ForegroundColor Yellow
    Write-Host "   6. Save as: firebase-service-account.json in backend folder" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Firebase service account found" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "📋 Setup Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

if (Test-Path ".env") {
    Write-Host "✅ .env file created" -ForegroundColor Green
} else {
    Write-Host "❌ .env file missing" -ForegroundColor Red
    $allGood = $false
}

if (Test-Path "firebase-service-account.json") {
    Write-Host "✅ Firebase service account configured" -ForegroundColor Green
} else {
    Write-Host "❌ Firebase service account missing" -ForegroundColor Red
    $allGood = $false
}

if (Test-Path "node_modules") {
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "❌ Dependencies not installed" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

if ($allGood) {
    Write-Host "🎉 Setup complete! Ready to start server" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the server, run:" -ForegroundColor Cyan
    Write-Host "   npm start" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Setup incomplete. Please complete the steps above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Edit .env with your Firebase URL and Gmail credentials" -ForegroundColor Yellow
    Write-Host "2. Download firebase-service-account.json from Firebase Console" -ForegroundColor Yellow
    Write-Host "3. Run this script again to verify" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📖 For detailed instructions, see: FIREBASE-SETUP-GUIDE.md" -ForegroundColor Cyan
