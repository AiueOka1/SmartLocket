/**
 * Shared Routes Module for SmartLocket API
 * Used by both local server.js and Firebase Functions index.js
 */

// Note: Dependencies are passed in rather than required here
// This allows the module to work in different environments

// Utility functions
async function hashPasscode(passcode, bcrypt) {
  return await bcrypt.hash(passcode, 10);
}

async function verifyPasscode(passcode, hash, bcrypt) {
  return await bcrypt.compare(passcode, hash);
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  return null;
}

function generateMemoryId(prefix = "") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = prefix;
  const length = prefix ? 4 : 6;

  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Setup all routes for the Express app
 * @param {express.Application} app - Express app instance
 * @param {admin.firestore.Firestore} db - Firestore database instance
 * @param {admin.app.App} admin - Firebase admin instance
 * @param {S3Client} r2Client - Cloudflare R2 client (optional)
 * @param {nodemailer.Transporter} transporter - Email transporter
 * @param {Object} bcrypt - bcrypt/bcryptjs module
 */
function setupRoutes(app, db, admin, r2Client, transporter, bcrypt) {
  // Import AWS SDK components for Cloudflare R2
  let PutObjectCommand, DeleteObjectCommand;
  if (r2Client) {
    try {
      const { PutObjectCommand: Put, DeleteObjectCommand: Delete } = require('@aws-sdk/client-s3');
      PutObjectCommand = Put;
      DeleteObjectCommand = Delete;
    } catch (error) {
      console.error('Failed to import AWS SDK:', error.message);
    }
  }
  
  // Health check
  app.get("/health", (req, res) => {
    res.json({status: "ok"});
  });

  // Image proxy route - serves R2 images with proper CORS headers
  app.get(["/api/image/*", "/image/*"], async (req, res) => {
    try {
      // Get the image path from the URL
      const imagePath = req.params[0]; // Get everything after /api/image/
      
      // 🔒 LOCKED - Construct R2 URL using LOCKED configuration
      const r2BaseUrl = process.env.R2_PUBLIC_URL || 'https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev';
      const imageUrl = `${r2BaseUrl}/${imagePath}`;
      
      console.log(`📸 Proxying image: ${imageUrl}`);
      
      // Fetch image from R2
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        console.log(`❌ R2 fetch failed: ${response.status} ${response.statusText}`);
        return res.status(response.status).json({ 
          error: 'Image not found',
          status: response.status,
          statusText: response.statusText,
          url: imageUrl
        });
      }
      
      // Get image buffer
      const imageBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Set CORS headers and content type
      res.set({
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Content-Length': imageBuffer.byteLength
      });
      
      // Send image data
      res.send(Buffer.from(imageBuffer));
      
    } catch (error) {
      console.error('❌ Image proxy error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch image',
        message: error.message
      });
    }
  });

  // Serve uploaded files locally
  app.use('/uploads', (req, res, next) => {
    const fs = require('fs');
    const path = require('path');
    const filename = req.url.replace('/', '');
    const filePath = path.join(__dirname, '../backend/uploads', filename);
    
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.sendFile(path.resolve(filePath));
    } else {
      res.status(404).json({error: 'Image not found'});
    }
  });

  // Admin stats
  app.get(["/api/admin/stats", "/admin/stats"], async (req, res) => {
    try {
      const snapshot = await db.collection("nfcChains").get();

      let total = 0;
      let unused = 0;
      let written = 0;
      let activated = 0;
      let premium = 0;

      snapshot.forEach((doc) => {
        total += 1;
        const data = doc.data();

        if (data.status === "unused") unused += 1;
        if (data.status === "written") written += 1;
        if (data.status === "activated") activated += 1;
        if (data.premium === true) premium += 1;
      });

      return res.json({
        total,
        unused,
        written,
        activated,
        premium,
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      return res.status(500).json({
        message: "Failed to load admin stats",
      });
    }
  });

  // Admin inventory (paginated + filtered)
  app.get(["/api/admin/inventory", "/admin/inventory"], async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const status = req.query.status;
      const premium = req.query.premium;

      let query = db.collection("nfcChains");

      if (status && status !== "all") {
        query = query.where("status", "==", status);
      }

      if (premium && premium !== "all") {
        query = query.where(
          "premium",
          "==",
          premium === "true" || premium === "premium",
        );
      }

      const snapshot = await query.get();
      const allDocs = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        allDocs.push({
          memoryId: data.memoryId || doc.id,
          status: data.status || "unused",
          premium: data.premium || false,
          photoLimit: data.photoLimit || 0,
          orderId: data.orderId || null,
          email: data.email || null,
          viewUrl: data.viewUrl || `https://smartlocket.win/public/gallery?id=${data.memoryId || doc.id}`,
          createdAt: data.createdAt ? formatTimestamp(data.createdAt) : null,
          activatedAt: data.activatedAt ? formatTimestamp(data.activatedAt) : null,
        });
      });

      const total = allDocs.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginated = allDocs.slice(start, end);

      return res.json({
        data: paginated,
        page,
        limit,
        total,
      });
    } catch (error) {
      console.error("Admin inventory error:", error);
      return res.status(500).json({
        message: "Failed to load inventory",
      });
    }
  });

  // Generate batch
  app.post("/api/admin/generate-batch", async (req, res) => {
    const {quantity, photoLimit, prefix, premium} = req.body;

    try {
      const batch = [];
      const usedIds = new Set();

      // Get existing IDs to avoid duplicates
      const existingSnapshot = await db.collection("nfcChains")
        .select("memoryId")
        .get();

      existingSnapshot.forEach((doc) => {
        usedIds.add(doc.data().memoryId);
      });

      // Generate batch
      for (let i = 0; i < quantity; i++) {
        let memoryId;
        do {
          memoryId = generateMemoryId(prefix);
        } while (usedIds.has(memoryId));

        usedIds.add(memoryId);

        const nfcChain = {
          memoryId,
          passcodeHash: null,
          email: null,
          emailVerified: false,
          status: "unused",
          premium: premium || false,
          photoLimit: parseInt(photoLimit) || 5,
          photoCount: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          assignedAt: null,
          activatedAt: null,
          orderId: null,
          customerName: null,
          viewUrl: `https://smartlocket.win/public/gallery?id=${memoryId}`,

          // Gallery defaults
          galleryTitle: "SmartLocket Gallery",
          galleryData: {},
          images: [],
          letterContent: {
            title: "Welcome to SmartLocket",
            paragraphs: [
              "As you scroll through this magical journey...",
              "This gallery is a celebration of precious moments...",
              "Continue scrolling to reveal the gallery...",
            ],
          },
          spotifyUrl: null,

          // Reset fields
          resetToken: null,
          resetTokenExpiry: null,
        };

        batch.push(nfcChain);
      }

      // Batch write to Firestore (max 500 per batch)
      const batchSize = 500;
      for (let i = 0; i < batch.length; i += batchSize) {
        const writeBatch = db.batch();
        const chunk = batch.slice(i, i + batchSize);

        chunk.forEach((item) => {
          const docRef = db.collection("nfcChains").doc(item.memoryId);
          writeBatch.set(docRef, item);
        });

        await writeBatch.commit();
      }

      res.json({
        success: true,
        count: batch.length,
        batch: batch.map((item) => ({
          memoryId: item.memoryId,
          viewUrl: item.viewUrl,
          premium: item.premium,
          photoLimit: item.photoLimit,
        })),
      });
    } catch (error) {
      console.error("Batch generation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate batch",
      });
    }
  });

  // Mark as written
  app.post(["/api/admin/mark-written/:memoryId"], async (req, res) => {
    const {memoryId} = req.params;

    try {
      const docRef = db.collection("nfcChains").doc(memoryId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          message: "SmartLocket not found",
        });
      }

      await docRef.update({
        status: "written",
        writtenAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({
        success: true,
        message: "SmartLocket marked as written",
        memoryId,
      });
    } catch (error) {
      console.error("Mark written error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to mark as written",
      });
    }
  });

  // Send activation code
  app.post(["/api/activation/send-code", "/activation/send-code"], async (req, res) => {
    const {memoryId, email} = req.body;

    if (!memoryId || !email) {
      return res.status(400).json({
        message: "Memory ID and email are required",
      });
    }

    try {
      const docRef = db.collection("nfcChains").doc(memoryId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({
          message: "SmartLocket not found",
        });
      }

      const data = doc.data();

      if (data.status === "activated") {
        return res.status(400).json({
          message: "SmartLocket already activated",
        });
      }

      if (data.status !== "written" && data.status !== "unused") {
        return res.status(400).json({
          message: "SmartLocket not available for activation",
        });
      }

      const verificationCode = generateVerificationCode();
      const token = generateMemoryId("TOKEN_");
      const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

      await db.collection("verificationTokens").doc(token).set({
        memoryId,
        email,
        code: verificationCode,
        expiry,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // In development mode, if email service is not configured, just log the code
      try {
        await transporter.sendMail({
          from: `SmartLocket <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Activate Your SmartLocket",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000000;">
              <div style="background: #000000; padding: 30px; text-align: center; color: #ffffff;">
                <h1>Activate Your SmartLocket</h1>
              </div>
              <div style="padding: 30px; background: #ffffff; border: 1px solid #000000;">
                <h2 style="color: #000000;">Almost Ready</h2>
                <p style="color: #000000;">Your SmartLocket <strong>${memoryId}</strong> is ready to be activated.</p>
                
                <p style="color: #000000;">Your verification code is:</p>
                <div style="text-align: center; margin: 20px 0;">
                  <span style="background: #000000; color: #ffffff; padding: 15px 30px; font-size: 24px; font-weight: bold; border: 1px solid #000000; display: inline-block; letter-spacing: 5px;">
                    ${verificationCode}
                  </span>
                </div>
                
                <p style="color: #000000;">Enter this code along with your desired 6-digit passcode to complete activation.</p>
                <p style="color: #666666; font-size: 14px;">This code will expire in 10 minutes.</p>
              </div>
            </div>
          `,
        });
        console.log(`Email sent to ${email}`);
      } catch (emailError) {
        console.log(`⚠️ Email service not configured, verification code: ${verificationCode}`);
        // Don't fail in development if email service isn't configured
      }

      // In development, always log the verification code to console
      if (process.env.NODE_ENV !== 'production') {
        console.log(`DEV MODE: Verification code for ${memoryId} (${email}): ${verificationCode}`);
      }

      return res.json({
        success: true,
        message: "Verification code sent to your email",
        token,
      });
    } catch (error) {
      console.error("Send activation code error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send activation code",
      });
    }
  });

  // Resend verification code
  app.post(["/api/activation/resend-code", "/activation/resend-code"], async (req, res) => {
    const {memoryId, email} = req.body;

    if (!memoryId || !email) {
      return res.status(400).json({
        message: "Memory ID and email are required",
      });
    }

    try {
      // Find existing token for this memoryId and email
      const tokensSnapshot = await db.collection("verificationTokens")
        .where("memoryId", "==", memoryId)
        .where("email", "==", email)
        .get();

      // Delete any existing tokens
      const batch = db.batch();
      tokensSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Generate new verification code and token
      const verificationCode = generateVerificationCode();
      const token = generateMemoryId("TOKEN_");
      const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

      await db.collection("verificationTokens").doc(token).set({
        memoryId,
        email,
        code: verificationCode,
        expiry,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // In development mode, if email service is not configured, just log the code
      try {
        await transporter.sendMail({
          from: `SmartLocket <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "SmartLocket - New Verification Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000000;">
              <div style="background: #000000; padding: 30px; text-align: center; color: #ffffff;">
                <h1>New Verification Code</h1>
              </div>
              <div style="padding: 30px; background: #ffffff; border: 1px solid #000000;">
                <h2 style="color: #000000;">New Code Requested</h2>
                <p style="color: #000000;">A new verification code has been requested for SmartLocket <strong>${memoryId}</strong>.</p>
                
                <p style="color: #000000;">Your new verification code is:</p>
                <div style="text-align: center; margin: 20px 0;">
                  <span style="background: #000000; color: #ffffff; padding: 15px 30px; font-size: 24px; font-weight: bold; border: 1px solid #000000; display: inline-block; letter-spacing: 5px;">
                    ${verificationCode}
                  </span>
                </div>
                
                <p style="color: #000000;">Enter this code along with your desired 6-digit passcode to complete activation.</p>
                <p style="color: #666666; font-size: 14px;">This code will expire in 10 minutes.</p>
              </div>
            </div>
          `,
        });
        console.log(`📧 New code sent to ${email}`);
      } catch (emailError) {
        console.log(`⚠️ Email service not configured, verification code: ${verificationCode}`);
        // Don't fail in development if email service isn't configured
      }

      // In development, always log the verification code to console
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔑 DEV MODE: New verification code for ${memoryId} (${email}): ${verificationCode}`);
      }

      return res.json({
        success: true,
        message: "New verification code sent to your email",
      });
    } catch (error) {
      console.error("Resend activation code error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send new verification code",
      });
    }
  });

  // Complete activation
  app.post(["/api/activation/complete", "/activation/complete"], async (req, res) => {
    const {memoryId, email, passcode, verificationCode} = req.body;
    const token = req.headers.authorization && req.headers.authorization.replace("Bearer ", "");

    if (!memoryId || !email || !passcode || !token || !verificationCode) {
      return res.status(400).json({message: "All fields required"});
    }

    try {
      const tokenRef = db.collection("verificationTokens").doc(token);
      const tokenDoc = await tokenRef.get();

      if (!tokenDoc.exists) {
        return res.status(401).json({message: "Invalid or expired token"});
      }

      const tokenData = tokenDoc.data();

      if (Date.now() > tokenData.expiry) {
        await tokenRef.delete();
        return res.status(401).json({message: "Token expired"});
      }

      if (tokenData.memoryId !== memoryId || tokenData.email !== email) {
        return res.status(401).json({message: "Token mismatch"});
      }

      // Verify the provided verification code matches the stored code
      if (tokenData.code !== verificationCode) {
        return res.status(401).json({message: "Invalid verification code"});
      }

      const passcodeHash = await hashPasscode(passcode, bcrypt);

      const docRef = db.collection("nfcChains").doc(memoryId);
      await docRef.update({
        email,
        emailVerified: true,
        passcodeHash,
        status: "activated",
        activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await tokenRef.delete();

      await transporter.sendMail({
        from: `SmartLocket <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Welcome to SmartLocket",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000000;">
            <div style="background: #000000; padding: 30px; text-align: center; color: #ffffff;">
              <h1>Welcome to SmartLocket</h1>
            </div>
            <div style="padding: 30px; background: #ffffff; border: 1px solid #000000;">
              <h2 style="color: #000000;">Your SmartLocket is Ready</h2>
              <p style="color: #000000;">Your personal memory gallery has been successfully activated.</p>
              <div style="background: #ffffff; border: 1px solid #000000; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; color: #000000;"><strong>SmartLocket ID:</strong> ${memoryId}</p>
                <p style="margin: 10px 0 0 0; color: #000000;"><strong>Access URL:</strong> <a href="https://smartlocket.win/public/gallery?id=${memoryId}" style="color: #000000;">smartlocket.win/public/gallery?id=${memoryId}</a></p>
              </div>
              <p style="color: #000000;"><strong>Important:</strong> Save your passcode securely. You will need it to edit your gallery.</p>
            </div>
          </div>
        `,
      });

      return res.json({
        success: true,
        message: "Activation complete! Welcome email sent.",
        memoryId,
      });
    } catch (err) {
      console.error("Activation error:", err);
      return res.status(500).json({success: false});
    }
  });

  // Get memory
  app.get(["/api/memory/:memoryId", "/memory/:memoryId"], async (req, res) => {
    const {memoryId} = req.params;

    try {
      const docRef = db.collection("nfcChains").doc(memoryId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({message: "NFCchain not found"});
      }

      const data = doc.data();

      return res.json({
        memoryId,
        status: data.status,
        premium: data.premium,
        photoLimit: data.photoLimit,
        photoCount: data.photoCount,
        galleryTitle: data.galleryTitle,
        galleryData: data.galleryData,
        images: data.images || [],
        letterContent: data.letterContent,
        spotifyUrl: data.spotifyUrl,
        spotifyTrack: data.spotifyTrack || null,
        themeSettings: data.themeSettings || null,
        passcodeHash: data.passcodeHash || null, // Add passcode hash for frontend verification
        createdAt: formatTimestamp(data.createdAt),
        activatedAt: formatTimestamp(data.activatedAt),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({message: "Failed to fetch memory"});
    }
  });

  // Update memory
  app.put(["/api/memory/:memoryId", "/memory/:memoryId"], async (req, res) => {
    const {memoryId} = req.params;
    const updates = req.body;

    if (!updates || !Object.keys(updates).length) {
      return res.status(400).json({message: "No update data"});
    }

    try {
      const ref = db.collection("nfcChains").doc(memoryId);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({message: "NFCchain not found"});
      }

      await ref.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({success: true});
    } catch (err) {
      console.error(err);
      return res.status(500).json({success: false});
    }
  });

  // Verify passcode
  app.post(["/api/verify-passcode", "/verify-passcode"], async (req, res) => {
    const {memoryId, passcode} = req.body;

    if (!memoryId || !passcode) {
      return res.status(400).json({valid: false});
    }

    try {
      const ref = db.collection("nfcChains").doc(memoryId);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({valid: false});
      }

      const data = doc.data();

      if (!data.passcodeHash) {
        return res.json({valid: true});
      }

      const valid = await verifyPasscode(passcode, data.passcodeHash, bcrypt);
      return res.json({valid});
    } catch (err) {
      console.error(err);
      return res.status(500).json({valid: false});
    }
  });

  // Upload image
  app.post(["/api/upload-image", "/upload-image"], async (req, res) => {
    const {memoryId, imageData, fileName} = req.body;

    if (!memoryId || !imageData) {
      return res.status(400).json({message: "Missing image data"});
    }

    // 🚫 STRICT FILE TYPE VALIDATION - Server-side validation
    if (fileName) {
      const ext = fileName.split(".").pop().toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
      const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v'];
      const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'wma', 'flac'];
      
      // Reject video and audio files explicitly
      if (videoExtensions.includes(ext) || audioExtensions.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: `Video and audio files are not supported. File: ${fileName}`
        });
      }
      
      // Only allow image extensions
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: `Only image files are supported (JPG, PNG, GIF, WEBP, BMP, SVG). File: ${fileName}`
        });
      }
    }

    // Validate image data format
    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: "Invalid image data format"
      });
    }

    try {
      const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      
      // Check file size (limit to 10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 10MB."
        });
      }
      
      const ext = fileName ? fileName.split(".").pop() : "jpg";
      const key = `${memoryId}/${Date.now()}.${ext}`;

      if (r2Client && PutObjectCommand) {
        try {
          await r2Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME || "nfcchain",
            Key: key,
            Body: buffer,
            ContentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            CacheControl: "public, max-age=31536000",
          }));

          // 🔒 LOCKED - Use LOCKED R2 public URL
          const publicUrl = process.env.R2_PUBLIC_URL || "https://pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev";
          const url = `${publicUrl}/${key}`;
          
          console.log(`✅ R2 upload successful:`, {
            key: key,
            url: url,
            bucket: process.env.R2_BUCKET_NAME || "nfcchain"
          });
          
          return res.json({ 
            success: true, 
            url: url,
            fileName: key  // Return the R2 key for deletion
          });
        } catch (r2Error) {
          console.error("R2 upload failed:", r2Error);
          // For production environments (Firebase Functions), don't fall back to local storage
          if (process.env.FUNCTIONS_EMULATOR !== 'true' && !process.env.NODE_ENV?.includes('development')) {
            return res.status(500).json({
              success: false, 
              message: "Image upload failed - cloud storage unavailable"
            });
          }
          console.log("R2 upload failed, using local storage fallback");
        }
      }
      
      // Local storage fallback (only for development)
      const fs = require('fs');
      const path = require('path');
      
      const uploadsDir = path.join(__dirname, '../backend/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const localFileName = `${memoryId}_${Date.now()}.${ext}`;
      const localFilePath = path.join(uploadsDir, localFileName);
      
      fs.writeFileSync(localFilePath, buffer);
      
      const localUrl = `http://localhost:3000/uploads/${localFileName}`;
      return res.json({ 
        success: true, 
        url: localUrl,
        fileName: localFileName  // Return local filename for deletion
      });
      
    } catch (err) {
      console.error(err);
      return res.status(500).json({message: "Upload failed"});
    }
  });

  // Delete image
  app.delete(["/api/delete-image", "/delete-image"], async (req, res) => {
    const { fileName, memoryId, imageUrl } = req.body;
    
    console.log(`🗑️ Delete request received:`, { fileName, memoryId, imageUrl });
    
    if (!fileName && !imageUrl) {
      return res.status(400).json({
        success: false,
        message: "fileName or imageUrl is required"
      });
    }
    
    try {
      let keyToDelete = fileName;
      
      // If no fileName provided, try to extract from imageUrl
      if (!keyToDelete && imageUrl) {
        console.log(`📝 Extracting key from imageUrl: ${imageUrl}`);
        
        // Clean the URL and extract the key
        let cleanUrl = imageUrl.split('?')[0]; // Remove query parameters
        
        // Extract the key from R2 URL or local URL
        if (cleanUrl.includes('pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev/')) {
          keyToDelete = cleanUrl.split('pub-5d6eb9dacf9146a2bd3bff425e11c1b2.r2.dev/')[1];
          console.log(`📝 Extracted R2 key from URL: ${keyToDelete}`);
        } else if (cleanUrl.includes('/uploads/')) {
          // Handle local storage files
          keyToDelete = cleanUrl.split('/uploads/')[1];
          console.log(`📝 Extracted local key: ${keyToDelete}`);
        } else if (cleanUrl.includes('smartlocket-asset.somarious2.workers.dev/')) {
          // Handle Cloudflare Worker relay URLs
          keyToDelete = cleanUrl.split('smartlocket-asset.somarious2.workers.dev/')[1];
          console.log(`📝 Extracted key from worker URL: ${keyToDelete}`);
        } else {
          console.log('⚠️ Unable to extract file key from URL, trying fallback methods');
          // Try to extract from various URL patterns
          const urlParts = cleanUrl.split('/');
          const lastPart = urlParts[urlParts.length - 1];
          if (lastPart && lastPart.includes('.') && memoryId) {
            keyToDelete = `${memoryId}/${lastPart}`;
            console.log(`📝 Constructed fallback key: ${keyToDelete}`);
          }
        }
      }
      
      console.log(`🎯 Key to delete: "${keyToDelete}"`);
      
      // Validate that we have a proper key
      if (!keyToDelete || keyToDelete.trim() === '') {
        console.error('❌ No valid key found for deletion');
        return res.status(400).json({
          success: false,
          message: "Unable to determine file key for deletion",
          debug: { fileName, imageUrl, memoryId }
        });
      }
      
      let deletedFromR2 = false;
      let deletionError = null;
      
      // Try to delete from Cloudflare R2
      if (r2Client && DeleteObjectCommand) {
        try {
          console.log(`🗑️ Deleting from R2 bucket: ${process.env.R2_BUCKET_NAME || "nfcchain"}`);
          console.log(`🗑️ R2 key: "${keyToDelete}"`);
          
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME || "nfcchain",
            Key: keyToDelete,
          });
          
          const deleteResult = await r2Client.send(deleteCommand);
          deletedFromR2 = true;
          console.log(`✅ Successfully deleted from R2: ${keyToDelete}`, deleteResult);
          
        } catch (r2Error) {
          deletionError = r2Error;
          console.error(`❌ R2 deletion failed for "${keyToDelete}":`, {
            error: r2Error.message,
            code: r2Error.code || 'UNKNOWN',
            name: r2Error.name || 'UNKNOWN',
            key: keyToDelete,
            bucket: process.env.R2_BUCKET_NAME || "nfcchain"
          });
          
          // If it's a "NoSuchKey" error, the file doesn't exist (might have been deleted already)
          if (r2Error.name === 'NoSuchKey' || r2Error.code === 'NoSuchKey') {
            console.log(`📝 File "${keyToDelete}" does not exist in R2 - may have been deleted already`);
            deletedFromR2 = true; // Consider this a success since the file is gone
          }
        }
      } else {
        console.warn('⚠️ R2 client not available for deletion');
        deletionError = 'R2 client not configured';
      }
      
      // Try to delete from local storage as fallback
      let deletedFromLocal = false;
      if (keyToDelete && keyToDelete.includes('_')) {
        try {
          const fs = require('fs');
          const path = require('path');
          
          // For local files, the key might be like "memoryId_timestamp.ext"
          const localFileName = keyToDelete.includes('/') ? 
            keyToDelete.split('/').pop() : keyToDelete;
          
          const uploadsDir = path.join(__dirname, '../backend/uploads');
          const localFilePath = path.join(uploadsDir, localFileName);
          
          if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
            deletedFromLocal = true;
            console.log(`✅ Successfully deleted from local storage: ${localFileName}`);
          } else {
            console.log(`📝 Local file does not exist: ${localFileName}`);
          }
        } catch (localError) {
          console.error('❌ Local deletion failed:', localError);
        }
      }
      
      // Update Firestore to remove the image from the memory document
      let updatedFirestore = false;
      if (memoryId) {
        try {
          const docRef = db.collection("nfcChains").doc(memoryId);
          const doc = await docRef.get();
          
          if (doc.exists) {
            const data = doc.data();
            const images = data.images || [];
            
            // Find and remove the image by fileName or URL  
            const originalCount = images.length;
            const updatedImages = images.filter(img => {
              // Check multiple ways the image might be stored
              const matches = [
                img.fileName === keyToDelete,
                img.fileName === fileName, 
                img.fullImage === imageUrl,
                img.thumbnail === imageUrl
              ];
              return !matches.some(match => match);
            });
            
            if (updatedImages.length < originalCount) {
              await docRef.update({
                images: updatedImages,
                photoCount: updatedImages.length,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              updatedFirestore = true;
              console.log(`✅ Updated Firestore: removed image from ${memoryId} (${originalCount} -> ${updatedImages.length})`);
            } else {
              console.log(`📝 No matching image found in Firestore for deletion`);
            }
          } else {
            console.log(`⚠️ Memory document ${memoryId} not found in Firestore`);
          }
        } catch (firestoreError) {
          console.error('❌ Firestore update failed:', firestoreError);
        }
      }
      
      // Return success if we deleted from R2 or if the file didn't exist
      const success = deletedFromR2 || deletedFromLocal || updatedFirestore;
      
      return res.json({
        success: success,
        message: success ? "Image deletion processed successfully" : "Image deletion failed",
        details: {
          deletedFromR2,
          deletedFromLocal,
          updatedFirestore,
          fileName: keyToDelete,
          originalFileName: fileName,
          originalImageUrl: imageUrl,
          error: deletionError?.message
        }
      });
      
    } catch (err) {
      console.error('❌ Delete image error:', err);
      return res.status(500).json({
        success: false,
        message: "Delete failed",
        error: err.message
      });
    }
  });

  // Request reset
  app.post(["/api/memory/request-reset", "/memory/request-reset"], async (req, res) => {
    const {memoryId, email} = req.body;

    if (!memoryId || !email) {
      return res.status(400).json({success: false});
    }

    try {
      const ref = db.collection("nfcChains").doc(memoryId);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({success: false});
      }

      const data = doc.data();
      if (data.email !== email) {
        return res.status(400).json({success: false});
      }

      const code = generateVerificationCode();

      await ref.update({
        resetCode: code,
        resetCodeExpiry: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 10 * 60 * 1000),
        ),
      });

      await transporter.sendMail({
        from: `SmartLocket <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Reset Your SmartLocket Passcode",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000000;">
            <div style="background: #000000; padding: 30px; text-align: center; color: #ffffff;">
              <h1>Reset Your Passcode</h1>
            </div>
            <div style="padding: 30px; background: #ffffff; border: 1px solid #000000;">
              <h2 style="color: #000000;">Password Reset Request</h2>
              <p style="color: #000000;">We received a request to reset the passcode for your SmartLocket:</p>
              <div style="background: #ffffff; border: 1px solid #000000; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; color: #000000;"><strong>SmartLocket ID:</strong> ${memoryId}</p>
              </div>
              <p style="color: #000000;">Your verification code is:</p>
              <div style="text-align: center; margin: 20px 0;">
                <span style="background: #000000; color: #ffffff; padding: 15px 30px; font-size: 24px; font-weight: bold; border: 1px solid #000000; display: inline-block; letter-spacing: 5px;">
                  ${code}
                </span>
              </div>
              <p style="color: #000000;">This code will expire in 10 minutes.</p>
              <p style="color: #666666; font-size: 14px;">If you did not request this, please ignore this email.</p>
            </div>
          </div>
        `,
      });

      return res.json({success: true});
    } catch (err) {
      console.error(err);
      return res.status(500).json({success: false});
    }
  });

  // Reset passcode
  app.post(["/api/memory/reset-passcode", "/memory/reset-passcode"], async (req, res) => {
    const {memoryId, code, newPasscode} = req.body;

    if (!memoryId || !code || !newPasscode) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!/^\d{6}$/.test(newPasscode)) {
      return res.status(400).json({
        success: false,
        message: "Passcode must be 6 digits",
      });
    }

    try {
      const ref = db.collection("nfcChains").doc(memoryId);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          message: "Memory ID not found",
        });
      }

      const data = doc.data();

      if (data.resetCode !== code) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification code",
        });
      }

      if (data.resetCodeExpiry && data.resetCodeExpiry.toDate() < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Verification code has expired. Please request a new one.",
        });
      }

      const hash = await hashPasscode(newPasscode, bcrypt);

      await ref.update({
        passcodeHash: hash,
        resetCode: admin.firestore.FieldValue.delete(),
        resetCodeExpiry: admin.firestore.FieldValue.delete(),
      });

      return res.json({
        success: true,
        message: "Passcode reset successfully",
      });
    } catch (err) {
      console.error("Reset passcode error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to reset passcode. Please try again.",
      });
    }
  });
}

module.exports = {
  setupRoutes,
  hashPasscode,
  verifyPasscode,
  formatTimestamp,
  generateMemoryId,
  generateVerificationCode,
};
