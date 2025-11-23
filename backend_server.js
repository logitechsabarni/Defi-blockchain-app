// server.js
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.'));
        }
    }
});

// In-memory database (replace with MongoDB in production)
const database = {
    users: new Map(),
    accessLogs: [],
    kycMetadata: new Map()
};

// Helper Functions
function generateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return `0x${hash}`;
}

async function uploadToIPFS(filePath) {
    try {
        const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
        const data = new FormData();
        data.append('file', fs.createReadStream(filePath));

        const metadata = JSON.stringify({
            name: 'KYC Document',
            keyvalues: {
                type: 'kyc',
                timestamp: Date.now()
            }
        });
        data.append('pinataMetadata', metadata);

        const response = await axios.post(url, data, {
            maxBodyLength: 'Infinity',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                'pinata_api_key': process.env.PINATA_API_KEY,
                'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
            }
        });

        return response.data.IpfsHash;
    } catch (error) {
        console.error('IPFS upload error:', error.response?.data || error.message);
        throw new Error('Failed to upload to IPFS');
    }
}

async function getFromIPFS(cid) {
    try {
        const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return response.data;
    } catch (error) {
        throw new Error('Failed to retrieve from IPFS');
    }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'TrustLedger API is running' });
});

// Upload KYC Document
app.post('/api/kyc/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { userAddress, documentType } = req.body;

        if (!userAddress) {
            fs.unlinkSync(req.file.path); // Clean up
            return res.status(400).json({ error: 'User address is required' });
        }

        // Generate hash
        const hash = generateHash(req.file.path);

        // Upload to IPFS
        const ipfsCID = await uploadToIPFS(req.file.path);

        // Store metadata
        const metadata = {
            userAddress,
            documentType: documentType || 'identity',
            hash,
            ipfsCID,
            filename: req.file.originalname,
            uploadTime: new Date().toISOString(),
            size: req.file.size
        };

        database.kycMetadata.set(userAddress, metadata);

        // Clean up local file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            data: {
                hash,
                ipfsCID,
                uploadTime: metadata.uploadTime
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

// Verify Hash
app.post('/api/kyc/verify-hash', (req, res) => {
    try {
        const { userAddress, hash } = req.body;

        if (!userAddress || !hash) {
            return res.status(400).json({ error: 'User address and hash are required' });
        }

        const metadata = database.kycMetadata.get(userAddress);

        if (!metadata) {
            return res.json({
                success: false,
                verified: false,
                message: 'No KYC data found for this address'
            });
        }

        const verified = metadata.hash === hash;

        res.json({
            success: true,
            verified,
            data: verified ? {
                documentType: metadata.documentType,
                uploadTime: metadata.uploadTime
            } : null
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User KYC Status
app.get('/api/kyc/status/:userAddress', (req, res) => {
    try {
        const { userAddress } = req.params;
        const metadata = database.kycMetadata.get(userAddress);

        if (!metadata) {
            return res.status(404).json({ 
                error: 'No KYC data found',
                exists: false
            });
        }

        res.json({
            success: true,
            exists: true,
            data: {
                hash: metadata.hash,
                documentType: metadata.documentType,
                uploadTime: metadata.uploadTime,
                ipfsCID: metadata.ipfsCID
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bank Access Request (Log)
app.post('/api/access/request', (req, res) => {
    try {
        const { bankAddress, userAddress, requestId } = req.body;

        if (!bankAddress || !userAddress || !requestId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const accessLog = {
            requestId,
            bankAddress,
            userAddress,
            requestTime: new Date().toISOString(),
            status: 'pending'
        };

        database.accessLogs.push(accessLog);

        res.json({
            success: true,
            data: accessLog
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Access Logs
app.get('/api/access/logs/:userAddress', (req, res) => {
    try {
        const { userAddress } = req.params;
        const logs = database.accessLogs.filter(log => log.userAddress === userAddress);

        res.json({
            success: true,
            data: logs
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retrieve Document from IPFS
app.get('/api/ipfs/:cid', async (req, res) => {
    try {
        const { cid } = req.params;
        const data = await getFromIPFS(cid);
        
        res.set('Content-Type', 'application/pdf');
        res.send(data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users (admin only)
app.get('/api/users', (req, res) => {
    try {
        const users = Array.from(database.kycMetadata.values()).map(metadata => ({
            userAddress: metadata.userAddress,
            documentType: metadata.documentType,
            uploadTime: metadata.uploadTime,
            hasKYC: true
        }));

        res.json({
            success: true,
            count: users.length,
            data: users
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TrustLedger API running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});