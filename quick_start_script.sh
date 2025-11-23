#!/bin/bash

# TrustLedger Quick Start Setup Script
# This script sets up the entire project structure

echo "======================================"
echo "  TrustLedger - Quick Setup Script"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create project directory
PROJECT_NAME="trustledger"
echo -e "${BLUE}Creating project directory: $PROJECT_NAME${NC}"
mkdir -p $PROJECT_NAME
cd $PROJECT_NAME

# Initialize root package.json
echo -e "${BLUE}Initializing root package.json...${NC}"
npm init -y

# Install Hardhat
echo -e "${BLUE}Installing Hardhat and dependencies...${NC}"
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv

# Initialize Hardhat
echo -e "${BLUE}Initializing Hardhat...${NC}"
npx hardhat init --yes

# Create directory structure
echo -e "${BLUE}Creating directory structure...${NC}"
mkdir -p contracts scripts backend frontend/src/components frontend/src/utils uploads

# Create contracts directory
echo -e "${BLUE}Setting up smart contract...${NC}"
cat > contracts/TrustLedger.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TrustLedger {
    // Your smart contract code here
    // (Copy from the artifact provided earlier)
}
EOF

# Create deploy script
echo -e "${BLUE}Creating deployment script...${NC}"
cat > scripts/deploy.js << 'EOF'
const hre = require("hardhat");

async function main() {
  console.log("Deploying TrustLedger...");
  const TrustLedger = await hre.ethers.getContractFactory("TrustLedger");
  const trustLedger = await TrustLedger.deploy();
  await trustLedger.deployed();
  console.log("TrustLedger deployed to:", trustLedger.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
EOF

# Create hardhat.config.js
echo -e "${BLUE}Creating Hardhat configuration...${NC}"
cat > hardhat.config.js << 'EOF'
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.19",
  networks: {
    polygonMumbai: {
      url: process.env.POLYGON_MUMBAI_RPC || "https://rpc-mumbai.maticvigil.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80001
    }
  }
};
EOF

# Setup Backend
echo -e "${BLUE}Setting up backend...${NC}"
cd backend

# Create backend package.json
cat > package.json << 'EOF'
{
  "name": "trustledger-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "axios": "^1.6.2",
    "form-data": "^4.0.0",
    "dotenv": "^16.3.1",
    "ethers": "^5.7.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

# Install backend dependencies
echo -e "${BLUE}Installing backend dependencies...${NC}"
npm install

# Create backend .env template
cat > .env.example << 'EOF'
PORT=5000
PINATA_API_KEY=your_api_key_here
PINATA_SECRET_KEY=your_secret_key_here
CONTRACT_ADDRESS=0xYourContractAddress
RPC_URL=https://rpc-mumbai.maticvigil.com
CHAIN_ID=80001
EOF

echo -e "${YELLOW}⚠️  Copy .env.example to .env and fill in your credentials${NC}"

cd ..

# Setup Frontend
echo -e "${BLUE}Setting up frontend...${NC}"
cd frontend

# Create Vite React app
npm create vite@latest . -- --template react
npm install

# Install frontend dependencies
echo -e "${BLUE}Installing frontend dependencies...${NC}"
npm install ethers@5.7.2 lucide-react axios
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init -p

# Create Tailwind config
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# Update index.css
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# Create frontend .env template
cat > .env.example << 'EOF'
VITE_API_URL=http://localhost:5000/api
VITE_CONTRACT_ADDRESS=0xYourContractAddress
VITE_CHAIN_ID=80001
VITE_RPC_URL=https://rpc-mumbai.maticvigil.com
EOF

cd ..

# Create root .env template
echo -e "${BLUE}Creating root environment template...${NC}"
cat > .env.example << 'EOF'
PRIVATE_KEY=your_wallet_private_key
POLYGON_MUMBAI_RPC=https://rpc-mumbai.maticvigil.com
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_key
POLYGONSCAN_API_KEY=your_polygonscan_key
EOF

# Create .gitignore
echo -e "${BLUE}Creating .gitignore...${NC}"
cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
dist/
build/
cache/
artifacts/
uploads/*
!uploads/.gitkeep
*.log
.DS_Store
.vscode/
coverage/
EOF

# Create uploads .gitkeep
touch uploads/.gitkeep

# Create README
echo -e "${BLUE}Creating README...${NC}"
cat > README.md << 'EOF'
# TrustLedger - Decentralized KYC System

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Configure environment variables:
   - Copy `.env.example` to `.env` in root, backend, and frontend
   - Fill in your credentials

3. Deploy smart contract:
   ```bash
   npx hardhat run scripts/deploy.js --network polygonMumbai
   ```

4. Start backend:
   ```bash
   cd backend
   npm start
   ```

5. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Documentation

See deployment guide for detailed instructions.
EOF

echo ""
echo -e "${GREEN}======================================"
echo -e "  Setup Complete! 🎉"
echo -e "======================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Copy .env.example files to .env and configure"
echo "2. Get Pinata API keys from https://pinata.cloud"
echo "3. Get test MATIC from https://faucet.polygon.technology"
echo "4. Deploy contract: npx hardhat run scripts/deploy.js --network polygonMumbai"
echo "5. Start backend: cd backend && npm start"
echo "6. Start frontend: cd frontend && npm run dev"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"