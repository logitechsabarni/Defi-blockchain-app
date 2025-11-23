import React, { useState, useEffect } from 'react';
import { Shield, Upload, CheckCircle, XCircle, Key, Building2, Users, FileCheck, Lock, Unlock, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const CONTRACT_ADDRESS = '0x...'; // Replace with deployed contract

// Mock ethers.js functions (replace with actual ethers.js in production)
const mockEthers = {
  connect: async () => {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  },
  contract: {
    registerKYC: async (hash) => {
      console.log('Registering KYC with hash:', hash);
      return { hash: '0x123...', wait: async () => ({}) };
    },
    grantAccess: async (bankAddress) => {
      console.log('Granting access to:', bankAddress);
      return { hash: '0x456...', wait: async () => ({}) };
    },
    revokeAccess: async (bankAddress) => {
      console.log('Revoking access from:', bankAddress);
      return { hash: '0x789...', wait: async () => ({}) };
    },
    getUserKYC: async (userAddress) => {
      return {
        kycHash: '0xabc...',
        status: 1,
        timestamp: Date.now()
      };
    },
    verifyKYC: async (userAddress, approve) => {
      console.log('Verifying KYC for:', userAddress, approve);
      return { hash: '0xdef...', wait: async () => ({}) };
    }
  }
};

const TrustLedgerApp = () => {
  const [activeTab, setActiveTab] = useState('connect');
  const [wallet, setWallet] = useState(null);
  const [userRole, setUserRole] = useState('user'); // user, bank, admin
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // KYC Upload State
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('aadhaar');
  const [uploadResult, setUploadResult] = useState(null);

  // Bank Verification State
  const [verifyAddress, setVerifyAddress] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  // Access Management State
  const [accessRequests, setAccessRequests] = useState([
    { bank: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', name: 'HDFC Bank', status: 'pending' },
    { bank: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', name: 'ICICI Bank', status: 'approved' }
  ]);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setWallet(accounts[0]);
          setActiveTab('dashboard');
        }
      } catch (error) {
        console.error('Error checking wallet:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      showNotification('Please install MetaMask!', 'error');
      return;
    }

    try {
      setLoading(true);
      const address = await mockEthers.connect();
      setWallet(address);
      setActiveTab('dashboard');
      showNotification('Wallet connected successfully!', 'success');
    } catch (error) {
      showNotification('Failed to connect wallet', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFileUpload = async () => {
    if (!file) {
      showNotification('Please select a file', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Upload to backend
      const formData = new FormData();
      formData.append('document', file);
      formData.append('userAddress', wallet);
      formData.append('documentType', documentType);

      const response = await fetch(`${API_BASE}/kyc/upload`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Register on blockchain
        const tx = await mockEthers.contract.registerKYC(result.data.hash);
        await tx.wait();

        setUploadResult(result.data);
        showNotification('KYC uploaded and registered on blockchain!', 'success');
        setActiveTab('status');
      } else {
        showNotification(result.error || 'Upload failed', 'error');
      }
    } catch (error) {
      showNotification('Upload failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async () => {
    if (!verifyAddress) {
      showNotification('Please enter a user address', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Get KYC from blockchain
      const kycData = await mockEthers.contract.getUserKYC(verifyAddress);
      
      // Verify with backend
      const response = await fetch(`${API_BASE}/kyc/status/${verifyAddress}`);
      const result = await response.json();

      if (result.success) {
        setVerifyResult({
          ...result.data,
          status: ['Pending', 'Verified', 'Rejected'][kycData.status],
          onChainHash: kycData.kycHash
        });
      } else {
        showNotification('User not found', 'error');
      }
    } catch (error) {
      showNotification('Verification failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const approveKYC = async (userAddress) => {
    try {
      setLoading(true);
      const tx = await mockEthers.contract.verifyKYC(userAddress, true);
      await tx.wait();
      showNotification('KYC approved successfully!', 'success');
      handleVerifyUser();
    } catch (error) {
      showNotification('Approval failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAccessControl = async (bank, action) => {
    try {
      setLoading(true);
      if (action === 'grant') {
        const tx = await mockEthers.contract.grantAccess(bank);
        await tx.wait();
        showNotification('Access granted!', 'success');
      } else {
        const tx = await mockEthers.contract.revokeAccess(bank);
        await tx.wait();
        showNotification('Access revoked!', 'success');
      }
      
      // Update local state
      setAccessRequests(prev => 
        prev.map(req => 
          req.bank === bank 
            ? { ...req, status: action === 'grant' ? 'approved' : 'revoked' }
            : req
        )
      );
    } catch (error) {
      showNotification('Action failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Connect Wallet Screen
  const ConnectWalletScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <Shield className="w-20 h-20 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TrustLedger</h1>
          <p className="text-gray-600">Decentralized KYC & Identity Verification</p>
        </div>
        
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-700">Secure blockchain storage</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-700">Document privacy guaranteed</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-gray-700">Instant verification</span>
          </div>
        </div>

        <button
          onClick={connectWallet}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
          Connect MetaMask
        </button>
      </div>
    </div>
  );

  // Dashboard
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-4">
            <Upload className="w-10 h-10 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">1</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Upload KYC</h3>
          <p className="text-sm text-gray-600 mb-4">Submit your identity documents securely</p>
          <button
            onClick={() => setActiveTab('upload')}
            className="text-blue-600 text-sm font-medium hover:underline"
          >
            Get Started →
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-4">
            <Lock className="w-10 h-10 text-green-600" />
            <span className="text-2xl font-bold text-green-600">0</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Access Control</h3>
          <p className="text-sm text-gray-600 mb-4">Manage bank access permissions</p>
          <button
            onClick={() => setActiveTab('permissions')}
            className="text-green-600 text-sm font-medium hover:underline"
          >
            Manage Access →
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-4">
            <FileCheck className="w-10 h-10 text-purple-600" />
            <span className="text-2xl font-bold text-purple-600">-</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Status</h3>
          <p className="text-sm text-gray-600 mb-4">View your verification status</p>
          <button
            onClick={() => setActiveTab('status')}
            className="text-purple-600 text-sm font-medium hover:underline"
          >
            Check Status →
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl">
        <h3 className="text-xl font-bold mb-2">Your Identity, Your Control</h3>
        <p className="text-indigo-100 mb-4">
          TrustLedger ensures your documents never leave your control. Only cryptographic hashes are stored on-chain.
        </p>
        <div className="flex gap-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded">🔒 Encrypted</span>
          <span className="bg-white/20 px-3 py-1 rounded">⛓️ Blockchain-backed</span>
          <span className="bg-white/20 px-3 py-1 rounded">🚀 Instant</span>
        </div>
      </div>
    </div>
  );

  // Upload KYC Screen
  const UploadKYCScreen = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload KYC Document</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
              <option value="passport">Passport</option>
              <option value="drivers_license">Driver's License</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Document (PDF, JPG, PNG)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Choose file
              </label>
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name}
                </p>
              )}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Privacy Notice</p>
                <p>Your document will be encrypted and stored on IPFS. Only the SHA-256 hash will be recorded on the blockchain.</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleFileUpload}
            disabled={loading || !file}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload & Register
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Status Screen
  const StatusScreen = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">KYC Status</h2>
        
        {uploadResult ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">KYC Registered Successfully</p>
                <p className="text-sm text-green-700">Your identity is now on the blockchain</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Document Hash</p>
                <p className="font-mono text-sm break-all">{uploadResult.hash}</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">IPFS CID</p>
                <p className="font-mono text-sm break-all">{uploadResult.ipfsCID}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Upload Time</p>
                <p className="font-medium">{uploadResult.uploadTime}</p>
              </div>
            </div>

            <button className="w-full bg-indigo-100 text-indigo-700 py-2 rounded-lg font-medium hover:bg-indigo-200 transition flex items-center justify-center gap-2">
              <ExternalLink className="w-4 h-4" />
              View on Explorer
            </button>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No KYC data found</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="mt-4 text-indigo-600 font-medium hover:underline"
            >
              Upload KYC Document
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Bank Verification Screen
  const BankVerificationScreen = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Verify User KYC</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User Wallet Address
            </label>
            <input
              type="text"
              value={verifyAddress}
              onChange={(e) => setVerifyAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleVerifyUser}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <FileCheck className="w-5 h-5" />
                Verify User
              </>
            )}
          </button>

          {verifyResult && (
            <div className="mt-6 p-6 bg-gray-50 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  verifyResult.status === 'Verified' 
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {verifyResult.status}
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Document Type</p>
                <p className="font-medium capitalize">{verifyResult.documentType}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">On-Chain Hash</p>
                <p className="font-mono text-xs break-all">{verifyResult.onChainHash}</p>
              </div>

              {verifyResult.status === 'Pending' && (
                <button
                  onClick={() => approveKYC(verifyAddress)}
                  className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition"
                >
                  Approve KYC
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Permissions Screen
  const PermissionsScreen = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Access Permissions</h2>
        
        <div className="space-y-4">
          {accessRequests.map((request, idx) => (
            <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-indigo-600" />
                  <div>
                    <p className="font-semibold text-gray-900">{request.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{request.bank.slice(0, 12)}...</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  request.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : request.status === 'revoked'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {request.status}
                </span>
              </div>

              <div className="flex gap-2">
                {request.status !== 'approved' && (
                  <button
                    onClick={() => handleAccessControl(request.bank, 'grant')}
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-4 h-4" />
                    Grant Access
                  </button>
                )}
                {request.status === 'approved' && (
                  <button
                    onClick={() => handleAccessControl(request.bank, 'revoke')}
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Revoke Access
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!wallet) {
    return <ConnectWalletScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">TrustLedger</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-mono">{wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
            </div>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="user">User</option>
              <option value="bank">Bank</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {['dashboard', 'upload', 'status', userRole === 'bank' ? 'verify' : 'permissions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-medium capitalize transition ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'verify' ? 'Verify KYC' : tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'upload' && <UploadKYCScreen />}
        {activeTab === 'status' && <StatusScreen />}
        {activeTab === 'verify' && userRole === 'bank' && <BankVerificationScreen />}
        {activeTab === 'permissions' && <PermissionsScreen />}
      </main>

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 flex items-center gap-3 max-w-md animate-slide-up">
          {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
          {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
          {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600" />}
          <p className="text-sm text-gray-900">{notification.message}</p>
        </div>
      )}
    </div>
  );
};

export default TrustLedgerApp;