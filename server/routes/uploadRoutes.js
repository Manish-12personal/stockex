import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, SVG, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Auth middleware for upload routes
const protectUpload = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select('-password');
    
    if (!req.admin) return res.status(401).json({ message: 'Admin not found' });
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Upload logo endpoint
router.post('/logo', protectUpload, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Construct the URL for the uploaded file
    const baseUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5001}`;
    const logoUrl = `${baseUrl}/uploads/logos/${req.file.filename}`;

    // Update admin's branding with the new logo URL
    const admin = await Admin.findById(req.admin._id);
    if (!admin.branding) {
      admin.branding = {};
    }
    
    // Delete old logo file if exists
    if (admin.branding.logoUrl && admin.branding.logoUrl.includes('/uploads/logos/')) {
      const oldFilename = admin.branding.logoUrl.split('/uploads/logos/')[1];
      const oldFilePath = path.join(uploadsDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    admin.branding.logoUrl = logoUrl;
    await admin.save();

    res.json({
      message: 'Logo uploaded successfully',
      logoUrl,
      branding: admin.branding
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete logo endpoint
router.delete('/logo', protectUpload, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    
    if (admin.branding?.logoUrl && admin.branding.logoUrl.includes('/uploads/logos/')) {
      const filename = admin.branding.logoUrl.split('/uploads/logos/')[1];
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    admin.branding.logoUrl = '';
    await admin.save();

    res.json({ message: 'Logo deleted successfully', branding: admin.branding });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
