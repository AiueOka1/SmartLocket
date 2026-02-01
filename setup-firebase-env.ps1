# Firebase Functions Environment Variables Setup (PowerShell)
# Run this script to set environment variables for your Firebase Functions

Write-Host "Setting up environment variables for Firebase Functions..." -ForegroundColor Green

# Email Configuration
firebase functions:config:set email.user="nfcchain@gmail.com"
firebase functions:config:set email.password="nfyf rija wbhb mqor"

# Cloudflare R2 Configuration
firebase functions:config:set r2.account_id="cfb74f6c6f03ae746b61558cfd98e44d"
firebase functions:config:set r2.access_key_id="81856ac44c6c8a46b7207b5cd68b4740"
firebase functions:config:set r2.secret_access_key="20792b08b4598bdc215658f5962a2e06f5b73c60f925834a0d7beabe64ff7bae"
firebase functions:config:set r2.bucket_name="nfcchain"
firebase functions:config:set r2.endpoint="https://cfb74f6c6f03ae746b61558cfd98e44d.r2.cloudflarestorage.com"
firebase functions:config:set r2.public_url="https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev"

Write-Host "Environment variables set successfully!" -ForegroundColor Green
Write-Host "Run 'firebase deploy --only functions' to deploy your updated functions" -ForegroundColor Yellow
