// demo-simulation.js
// Complete end-to-end simulation of TrustLedger workflow

const chalk = require('chalk'); // For colored console output
const fs = require('fs');
const crypto = require('crypto');

// Simulated services
class SimulationService {
    constructor() {
        this.blockchain = {
            users: new Map(),
            banks: new Map(),
            accessPermissions: new Map(),
            transactionHistory: []
        };
        this.ipfs = {
            storage: new Map()
        };
        this.database = {
            kycMetadata: new Map(),
            accessLogs: []
        };
    }

    // Helper function to simulate delay
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate transaction hash
    generateTxHash() {
        return '0x' + crypto.randomBytes(32).toString('hex');
    }

    // Generate SHA-256 hash
    generateHash(data) {
        return '0x' + crypto.createHash('sha256').update(data).digest('hex');
    }

    // Log with timestamp
    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}]`;
        
        switch(type) {
            case 'success':
                console.log(chalk.green(`${prefix} ✓ ${message}`));
                break;
            case 'error':
                console.log(chalk.red(`${prefix} ✗ ${message}`));
                break;
            case 'warning':
                console.log(chalk.yellow(`${prefix} ⚠ ${message}`));
                break;
            case 'info':
                console.log(chalk.blue(`${prefix} ℹ ${message}`));
                break;
            case 'step':
                console.log(chalk.cyan(`\n${prefix} ▶ ${message}`));
                break;
            default:
                console.log(`${prefix} ${message}`);
        }
    }

    // Simulate file upload to IPFS
    async uploadToIPFS(fileName, fileContent) {
        this.log(`Uploading ${fileName} to IPFS...`, 'step');
        await this.delay(1000);

        const cid = 'Qm' + crypto.randomBytes(22).toString('base64').replace(/[+/=]/g, '');
        this.ipfs.storage.set(cid, {
            fileName,
            content: fileContent,
            uploadedAt: new Date().toISOString(),
            size: fileContent.length
        });

        this.log(`File uploaded successfully!`, 'success');
        this.log(`IPFS CID: ${cid}`, 'info');
        return cid;
    }

    // Generate document hash
    async generateDocumentHash(fileContent) {
        this.log('Generating SHA-256 hash...', 'step');
        await this.delay(500);

        const hash = this.generateHash(fileContent);
        this.log(`Hash generated: ${hash}`, 'success');
        return hash;
    }

    // Register KYC on blockchain
    async registerKYC(userAddress, kycHash) {
        this.log('Registering KYC on blockchain...', 'step');
        await this.delay(1500);

        const txHash = this.generateTxHash();
        const blockNumber = Math.floor(Math.random() * 1000000) + 12000000;

        this.blockchain.users.set(userAddress, {
            kycHash,
            status: 'pending',
            registeredAt: new Date().toISOString(),
            blockNumber,
            txHash
        });

        this.blockchain.transactionHistory.push({
            event: 'UserRegistered',
            userAddress,
            kycHash,
            txHash,
            blockNumber,
            timestamp: new Date().toISOString()
        });

        this.log(`KYC registered on blockchain!`, 'success');
        this.log(`Transaction Hash: ${txHash}`, 'info');
        this.log(`Block Number: ${blockNumber}`, 'info');
        return { txHash, blockNumber };
    }

    // Store metadata in database
    async storeMetadata(userAddress, metadata) {
        this.log('Storing metadata in database...', 'step');
        await this.delay(500);

        this.database.kycMetadata.set(userAddress, {
            ...metadata,
            storedAt: new Date().toISOString()
        });

        this.log('Metadata stored successfully!', 'success');
    }

    // Bank requests access
    async requestAccess(bankAddress, userAddress) {
        this.log('Bank requesting access to user KYC...', 'step');
        await this.delay(1000);

        const requestId = this.generateTxHash();
        const key = `${userAddress}-${bankAddress}`;

        this.blockchain.accessPermissions.set(key, {
            requestId,
            status: 'pending',
            requestedAt: new Date().toISOString()
        });

        this.database.accessLogs.push({
            requestId,
            bankAddress,
            userAddress,
            action: 'access_requested',
            timestamp: new Date().toISOString()
        });

        this.log('Access request created!', 'success');
        this.log(`Request ID: ${requestId}`, 'info');
        return requestId;
    }

    // User grants access
    async grantAccess(userAddress, bankAddress) {
        this.log('User granting access to bank...', 'step');
        await this.delay(1000);

        const key = `${userAddress}-${bankAddress}`;
        const txHash = this.generateTxHash();

        const permission = this.blockchain.accessPermissions.get(key);
        if (permission) {
            permission.status = 'approved';
            permission.approvedAt = new Date().toISOString();
            permission.txHash = txHash;
        }

        this.blockchain.transactionHistory.push({
            event: 'AccessGranted',
            userAddress,
            bankAddress,
            txHash,
            timestamp: new Date().toISOString()
        });

        this.database.accessLogs.push({
            bankAddress,
            userAddress,
            action: 'access_granted',
            txHash,
            timestamp: new Date().toISOString()
        });

        this.log('Access granted successfully!', 'success');
        this.log(`Transaction Hash: ${txHash}`, 'info');
        return txHash;
    }

    // Bank verifies KYC
    async verifyKYC(bankAddress, userAddress, expectedHash) {
        this.log('Bank verifying KYC hash...', 'step');
        await this.delay(1500);

        // Check access permission
        const key = `${userAddress}-${bankAddress}`;
        const permission = this.blockchain.accessPermissions.get(key);

        if (!permission || permission.status !== 'approved') {
            this.log('Access denied! Bank does not have permission.', 'error');
            return { verified: false, reason: 'No access permission' };
        }

        // Get user KYC from blockchain
        const userKYC = this.blockchain.users.get(userAddress);
        if (!userKYC) {
            this.log('User KYC not found!', 'error');
            return { verified: false, reason: 'User not registered' };
        }

        // Verify hash
        const hashMatches = userKYC.kycHash === expectedHash;

        if (hashMatches) {
            this.log('✓ Hash verification SUCCESSFUL!', 'success');
            this.log(`On-chain hash: ${userKYC.kycHash}`, 'info');
            this.log(`Provided hash: ${expectedHash}`, 'info');

            // Update verification status
            userKYC.status = 'verified';
            userKYC.verifiedBy = bankAddress;
            userKYC.verifiedAt = new Date().toISOString();

            const txHash = this.generateTxHash();
            this.blockchain.transactionHistory.push({
                event: 'KYCVerified',
                userAddress,
                bankAddress,
                txHash,
                timestamp: new Date().toISOString()
            });

            this.database.accessLogs.push({
                bankAddress,
                userAddress,
                action: 'kyc_verified',
                txHash,
                timestamp: new Date().toISOString()
            });

            return {
                verified: true,
                status: 'verified',
                txHash,
                verifiedAt: userKYC.verifiedAt
            };
        } else {
            this.log('✗ Hash verification FAILED!', 'error');
            return { verified: false, reason: 'Hash mismatch' };
        }
    }

    // User revokes access
    async revokeAccess(userAddress, bankAddress) {
        this.log('User revoking access from bank...', 'step');
        await this.delay(1000);

        const key = `${userAddress}-${bankAddress}`;
        const txHash = this.generateTxHash();

        const permission = this.blockchain.accessPermissions.get(key);
        if (permission) {
            permission.status = 'revoked';
            permission.revokedAt = new Date().toISOString();
            permission.revokeTxHash = txHash;
        }

        this.blockchain.transactionHistory.push({
            event: 'AccessRevoked',
            userAddress,
            bankAddress,
            txHash,
            timestamp: new Date().toISOString()
        });

        this.database.accessLogs.push({
            bankAddress,
            userAddress,
            action: 'access_revoked',
            txHash,
            timestamp: new Date().toISOString()
        });

        this.log('Access revoked successfully!', 'success');
        this.log(`Transaction Hash: ${txHash}`, 'info');
        return txHash;
    }

    // Print summary
    printSummary() {
        console.log('\n' + '='.repeat(80));
        console.log(chalk.bold.cyan('                    SIMULATION SUMMARY'));
        console.log('='.repeat(80) + '\n');

        console.log(chalk.bold('📊 Blockchain State:'));
        console.log(`   Total Users: ${this.blockchain.users.size}`);
        console.log(`   Total Transactions: ${this.blockchain.transactionHistory.length}`);
        console.log(`   Access Permissions: ${this.blockchain.accessPermissions.size}\n`);

        console.log(chalk.bold('💾 IPFS Storage:'));
        console.log(`   Files Stored: ${this.ipfs.storage.size}\n`);

        console.log(chalk.bold('📁 Database:'));
        console.log(`   KYC Records: ${this.database.kycMetadata.size}`);
        console.log(`   Access Logs: ${this.database.accessLogs.length}\n`);

        console.log(chalk.bold('📜 Transaction History:'));
        this.blockchain.transactionHistory.forEach((tx, idx) => {
            console.log(`   ${idx + 1}. ${tx.event} - ${tx.txHash.slice(0, 20)}...`);
        });

        console.log('\n' + '='.repeat(80) + '\n');
    }
}

// Main simulation
async function runSimulation() {
    const sim = new SimulationService();

    console.log(chalk.bold.green('\n' + '█'.repeat(80)));
    console.log(chalk.bold.green('█') + ' '.repeat(78) + chalk.bold.green('█'));
    console.log(chalk.bold.green('█') + chalk.bold.white('          TrustLedger - Complete KYC Workflow Simulation') + ' '.repeat(20) + chalk.bold.green('█'));
    console.log(chalk.bold.green('█') + ' '.repeat(78) + chalk.bold.green('█'));
    console.log(chalk.bold.green('█'.repeat(80)) + '\n');

    // Test data
    const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const bankAddress = '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199';
    const aadhaarContent = 'AADHAAR_CARD_DOCUMENT_CONTENT_' + Date.now();

    try {
        // STEP 1: User uploads Aadhaar document
        console.log(chalk.bold.yellow('\n══════════════════════════════════════════════════════════'));
        console.log(chalk.bold.yellow('  STEP 1: User Uploads Aadhaar Document'));
        console.log(chalk.bold.yellow('══════════════════════════════════════════════════════════\n'));
        
        sim.log(`User: ${userAddress}`, 'info');
        const ipfsCID = await sim.uploadToIPFS('aadhaar_card.pdf', aadhaarContent);

        // STEP 2: Generate hash
        console.log(chalk.bold.yellow('\n══════════════════════════════════════════════════════════'));
        console.log(chalk.bold.yellow('  STEP 2: Generate Document Hash'));
        console.log(chalk.bold.yellow('══════════════════════════════════════════════════════════\n'));
        
        const documentHash = await sim.generateDocumentHash(aadhaarContent);

        // STEP 3: Register on blockchain
        console.log(chalk.bold.yellow('\n══════════════════════════════════════════════════════════'));
        console.log(chalk.bold.yellow('  STEP 3: Register KYC on Blockchain'));
        console.log(chalk.bold.yellow('══════════════════════════════════════════════════════════\n'));
        
        const { txHash, blockNumber } = await sim.registerKYC(userAddress, documentHash);

        // STEP 4: Store metadata
        console.log(chalk.bold.yellow('\n══════════════════════════════════════════════════════════'));
        console.log(chalk.bold.yellow('  STEP 4: Store Metadata in Database'));
        console.log(chalk.bold.yellow('══════════════════════════════════════════════════════════\n'));
        
        await sim.storeMetadata(userAddress, {
            documentType: 'aadhaar',
            ipfsCID,
            documentHash,
            txHash,
            blockNumber
        });

        // STEP 5: Bank requests access
        console.log(chalk.bold.yellow('\n══════════════════════════════════════════════════════════'));
        console.log(chalk.bold.yellow('  STEP 5: Bank Requests Access'));
        console.log(chalk.bold.yellow('══════════════════════════════════════════════════════════\n'));
        
        sim.log(`Bank: ${bankAddress}`, 'info');
        const requestId = await sim.requestAccess(bankAddress, userAddress);

        // STEP 6: User grants access
        console.log(chalk.bold.yellow('\n══════════════════════════════════════════════════════════'));
        console.log(chalk.bold.yellow('  STEP 6: User Grants Access'));
        console.log(chalk.bold.yellow('══════════════════════════════════════════════════════════\n'));
        
        const grantTxHash = await sim.grantAccess(userAddress, bankAddress);

        // STEP 7: Bank verifies KYC
        console.log(chalk.bold.yellow('\n══════════════════════════════════════════════════════════'));
        console.log(chalk.bold.yellow('  STEP 7: Bank Verifies KYC Hash'));
        console.log(chalk.bold.yellow('══════════════════════════════════════════════════════════\n'));
        
        const verificationResult = await sim.verifyKYC(bankAddress, userAddress, documentHash);

        if (verificationResult.verified) {
            sim.log(`KYC Status: ${verificationResult.status.toUpperCase()}`, 'success');
            sim.log(`Verified at: ${verificationResult.verifiedAt}`, 'info');
        }

        // STEP 8: User revokes access
        console.log(chalk.bold.yellow('\n══════════════════════════════════════════════════════════'));
        console.log(chalk.bold.yellow('  STEP 8: User Revokes Access'));
        console.log(chalk.bold.yellow('══════════════════════════════════════════════════════════\n'));
        
        const revokeTxHash = await sim.revokeAccess(userAddress, bankAddress);

        // Print summary
        sim.printSummary();

        console.log(chalk.bold.green('✓ Simulation completed successfully!\n'));

    } catch (error) {
        sim.log(`Simulation failed: ${error.message}`, 'error');
        console.error(error);
    }
}

// Run the simulation
if (require.main === module) {
    runSimulation().catch(console.error);
}

module.exports = { SimulationService, runSimulation };