// ipfs-service.js
// Complete IPFS integration with Pinata for TrustLedger

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

// Pinata API Configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_JWT = process.env.PINATA_JWT; // Alternative auth method

// Pinata Endpoints
const PINATA_PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PINATA_UNPIN_URL = 'https://api.pinata.cloud/pinning/unpin';
const PINATA_LIST_URL = 'https://api.pinata.cloud/data/pinList';
const PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs';

class IPFSService {
    constructor() {
        this.apiKey = PINATA_API_KEY;
        this.secretKey = PINATA_SECRET_KEY;
        this.jwt = PINATA_JWT;
    }

    /**
     * Generate SHA-256 hash from file
     * @param {string} filePath - Path to the file
     * @returns {string} - Hexadecimal hash with 0x prefix
     */
    generateHash(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            return `0x${hash}`;
        } catch (error) {
            throw new Error(`Hash generation failed: ${error.message}`);
        }
    }

    /**
     * Generate SHA-256 hash from buffer
     * @param {Buffer} buffer - File buffer
     * @returns {string} - Hexadecimal hash with 0x prefix
     */
    generateHashFromBuffer(buffer) {
        try {
            const hash = crypto.createHash('sha256').update(buffer).digest('hex');
            return `0x${hash}`;
        } catch (error) {
            throw new Error(`Hash generation failed: ${error.message}`);
        }
    }

    /**
     * Encrypt file before uploading (optional security layer)
     * @param {Buffer} fileBuffer - File content
     * @param {string} password - Encryption password
     * @returns {Object} - {encryptedData, iv, authTag}
     */
    encryptFile(fileBuffer, password) {
        try {
            const algorithm = 'aes-256-gcm';
            const key = crypto.scryptSync(password, 'salt', 32);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(algorithm, key, iv);

            let encrypted = cipher.update(fileBuffer);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            const authTag = cipher.getAuthTag();

            return {
                encryptedData: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt file after downloading
     * @param {Buffer} encryptedData - Encrypted content
     * @param {string} password - Decryption password
     * @param {string} iv - Initialization vector
     * @param {string} authTag - Authentication tag
     * @returns {Buffer} - Decrypted data
     */
    decryptFile(encryptedData, password, iv, authTag) {
        try {
            const algorithm = 'aes-256-gcm';
            const key = crypto.scryptSync(password, 'salt', 32);
            const decipher = crypto.createDecipheriv(
                algorithm,
                key,
                Buffer.from(iv, 'hex')
            );
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));

            let decrypted = decipher.update(encryptedData);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Upload file to IPFS via Pinata
     * @param {string} filePath - Path to file
     * @param {Object} metadata - Optional metadata
     * @returns {Promise<Object>} - {ipfsHash, pinSize, timestamp, hash}
     */
    async uploadFile(filePath, metadata = {}) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('File not found');
            }

            // Generate hash before upload
            const fileHash = this.generateHash(filePath);

            const url = PINATA_PIN_FILE_URL;
            const data = new FormData();
            
            data.append('file', fs.createReadStream(filePath));

            // Add metadata
            const pinataMetadata = {
                name: metadata.name || path.basename(filePath),
                keyvalues: {
                    type: metadata.type || 'kyc_document',
                    userAddress: metadata.userAddress || '',
                    timestamp: Date.now(),
                    hash: fileHash,
                    ...metadata.additionalInfo
                }
            };

            data.append('pinataMetadata', JSON.stringify(pinataMetadata));

            // Pin options
            const pinataOptions = {
                cidVersion: 1,
                wrapWithDirectory: false
            };
            data.append('pinataOptions', JSON.stringify(pinataOptions));

            const response = await axios.post(url, data, {
                maxBodyLength: 'Infinity',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                    'pinata_api_key': this.apiKey,
                    'pinata_secret_api_key': this.secretKey
                }
            });

            return {
                success: true,
                ipfsHash: response.data.IpfsHash,
                ipfsCID: response.data.IpfsHash,
                pinSize: response.data.PinSize,
                timestamp: response.data.Timestamp,
                hash: fileHash,
                url: `${PINATA_GATEWAY_URL}/${response.data.IpfsHash}`
            };

        } catch (error) {
            console.error('IPFS Upload Error:', error.response?.data || error.message);
            throw new Error(`IPFS upload failed: ${error.message}`);
        }
    }

    /**
     * Upload JSON data to IPFS
     * @param {Object} jsonData - JSON object to upload
     * @param {Object} metadata - Optional metadata
     * @returns {Promise<Object>} - {ipfsHash, pinSize, timestamp}
     */
    async uploadJSON(jsonData, metadata = {}) {
        try {
            const url = PINATA_PIN_JSON_URL;

            const data = {
                pinataContent: jsonData,
                pinataMetadata: {
                    name: metadata.name || 'json_data',
                    keyvalues: {
                        type: metadata.type || 'json',
                        timestamp: Date.now(),
                        ...metadata.additionalInfo
                    }
                },
                pinataOptions: {
                    cidVersion: 1
                }
            };

            const response = await axios.post(url, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'pinata_api_key': this.apiKey,
                    'pinata_secret_api_key': this.secretKey
                }
            });

            return {
                success: true,
                ipfsHash: response.data.IpfsHash,
                ipfsCID: response.data.IpfsHash,
                pinSize: response.data.PinSize,
                timestamp: response.data.Timestamp,
                url: `${PINATA_GATEWAY_URL}/${response.data.IpfsHash}`
            };

        } catch (error) {
            console.error('JSON Upload Error:', error.response?.data || error.message);
            throw new Error(`JSON upload failed: ${error.message}`);
        }
    }

    /**
     * Retrieve file from IPFS
     * @param {string} cid - IPFS CID
     * @returns {Promise<Buffer>} - File content as buffer
     */
    async getFile(cid) {
        try {
            const url = `${PINATA_GATEWAY_URL}/${cid}`;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000 // 30 seconds timeout
            });

            return response.data;
        } catch (error) {
            console.error('IPFS Retrieval Error:', error.message);
            throw new Error(`Failed to retrieve file: ${error.message}`);
        }
    }

    /**
     * Retrieve JSON from IPFS
     * @param {string} cid - IPFS CID
     * @returns {Promise<Object>} - JSON object
     */
    async getJSON(cid) {
        try {
            const url = `${PINATA_GATEWAY_URL}/${cid}`;
            const response = await axios.get(url, {
                timeout: 30000
            });

            return response.data;
        } catch (error) {
            console.error('JSON Retrieval Error:', error.message);
            throw new Error(`Failed to retrieve JSON: ${error.message}`);
        }
    }

    /**
     * Unpin file from IPFS (delete)
     * @param {string} cid - IPFS CID to unpin
     * @returns {Promise<boolean>}
     */
    async unpinFile(cid) {
        try {
            const url = `${PINATA_UNPIN_URL}/${cid}`;
            await axios.delete(url, {
                headers: {
                    'pinata_api_key': this.apiKey,
                    'pinata_secret_api_key': this.secretKey
                }
            });

            return true;
        } catch (error) {
            console.error('Unpin Error:', error.response?.data || error.message);
            throw new Error(`Failed to unpin: ${error.message}`);
        }
    }

    /**
     * List all pinned files
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>}
     */
    async listPinnedFiles(filters = {}) {
        try {
            const url = PINATA_LIST_URL;
            const params = {
                status: 'pinned',
                pageLimit: filters.pageLimit || 10,
                pageOffset: filters.pageOffset || 0,
                ...filters
            };

            const response = await axios.get(url, {
                params,
                headers: {
                    'pinata_api_key': this.apiKey,
                    'pinata_secret_api_key': this.secretKey
                }
            });

            return response.data.rows;
        } catch (error) {
            console.error('List Error:', error.response?.data || error.message);
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    /**
     * Verify hash matches IPFS content
     * @param {string} cid - IPFS CID
     * @param {string} expectedHash - Expected hash (with 0x prefix)
     * @returns {Promise<boolean>}
     */
    async verifyHash(cid, expectedHash) {
        try {
            const fileData = await this.getFile(cid);
            const actualHash = this.generateHashFromBuffer(Buffer.from(fileData));
            return actualHash === expectedHash;
        } catch (error) {
            console.error('Hash Verification Error:', error.message);
            return false;
        }
    }

    /**
     * Get gateway URL for a CID
     * @param {string} cid - IPFS CID
     * @returns {string} - Gateway URL
     */
    getGatewayURL(cid) {
        return `${PINATA_GATEWAY_URL}/${cid}`;
    }

    /**
     * Test connection to Pinata
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const response = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
                headers: {
                    'pinata_api_key': this.apiKey,
                    'pinata_secret_api_key': this.secretKey
                }
            });
            console.log('✅ Pinata connection successful:', response.data);
            return true;
        } catch (error) {
            console.error('❌ Pinata connection failed:', error.message);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new IPFSService();

// Example usage:
/*
const ipfsService = require('./ipfs-service');

// Upload file
const result = await ipfsService.uploadFile('./document.pdf', {
    name: 'Aadhaar Card',
    type: 'kyc_document',
    userAddress: '0x742d...'
});

console.log('IPFS CID:', result.ipfsCID);
console.log('Document Hash:', result.hash);

// Retrieve file
const fileData = await ipfsService.getFile(result.ipfsCID);

// Verify hash
const isValid = await ipfsService.verifyHash(result.ipfsCID, result.hash);
console.log('Hash valid:', isValid);
*/