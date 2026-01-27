/**
 * Test Firebase Storage Connection
 * Run this to verify Storage is properly configured
 */

require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

console.log('🔍 Testing Firebase Storage...\n');

// Initialize Firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'nfcchain.appspot.com'
});

const bucket = admin.storage().bucket();

async function testStorage() {
    try {
        console.log('1️⃣ Checking bucket name...');
        console.log(`   Bucket: ${bucket.name}`);
        
        console.log('\n2️⃣ Testing bucket access...');
        const [exists] = await bucket.exists();
        
        if (!exists) {
            console.log('   ❌ BUCKET DOES NOT EXIST!');
            console.log('\n🔧 FIX: You need to enable Firebase Storage:');
            console.log('   1. Go to: https://console.firebase.google.com/');
            console.log('   2. Select project: nfcchain');
            console.log('   3. Click: Build → Storage → Get Started');
            console.log('   4. Accept defaults → Done');
            process.exit(1);
        }
        
        console.log('   ✅ Bucket exists!');
        
        console.log('\n3️⃣ Testing upload...');
        const testFileName = `test/test_${Date.now()}.txt`;
        const testFile = bucket.file(testFileName);
        await testFile.save('Hello from SmartLocket!', {
            metadata: { contentType: 'text/plain' }
        });
        console.log(`   ✅ Upload successful: ${testFileName}`);
        
        console.log('\n4️⃣ Testing public access...');
        await testFile.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${testFileName}`;
        console.log(`   ✅ Public URL: ${publicUrl}`);
        
        console.log('\n5️⃣ Cleaning up...');
        await testFile.delete();
        console.log('   ✅ Test file deleted');
        
        console.log('\n🎉 SUCCESS! Firebase Storage is working!');
        console.log('✅ Your server can now upload images!\n');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\n📋 Full error:', error);
        
        if (error.code === 'storage/unauthorized') {
            console.log('\n🔧 FIX: Firebase Storage is not enabled!');
            console.log('   1. Go to: https://console.firebase.google.com/');
            console.log('   2. Select project: smartlocket');
            console.log('   3. Click: Build → Storage → Get Started');
            console.log('   4. Accept defaults → Done');
        } else if (error.code === 'storage/bucket-not-found') {
            console.log('\n🔧 FIX: Storage bucket not found!');
            console.log('   Check your .env file has:');
            console.log('   FIREBASE_STORAGE_BUCKET=smartlocket.appspot.com');
        }
        
        process.exit(1);
    }
}

testStorage();
