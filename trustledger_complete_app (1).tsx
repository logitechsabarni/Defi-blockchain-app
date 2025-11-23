import React, { useState, useEffect } from 'react';
import { Shield, Upload, CheckCircle, XCircle, Key, Building2, Users, FileCheck, Lock, Unlock, AlertCircle, Loader2, ExternalLink, Hash, Database, Eye, EyeOff, Download, Copy, QrCode, Calendar, Clock, MapPin, CheckSquare } from 'lucide-react';

const TrustLedgerApp = () => {
  const [activeTab, setActiveTab] = useState('connect');
  const [activeSubTab, setActiveSubTab] = useState('upload');
  const [wallet, setWallet] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('aadhaar');
  const [uploadResult, setUploadResult] = useState(null);
  const [verifyAddress, setVerifyAddress] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [accessRequests, setAccessRequests] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVerifications: 0,
    pendingRequests: 0,
    activePermissions: 0
  });

  const [mockBlockchain] = useState({
    users: new Map(),
    banks: new Map(),
    accessPermissions: new Map(),
    transactions: []
  });

  const [mockIPFS] = useState(new Map());
  const [mockDatabase] = useState(new Map());

  useEffect(() => {
    if (mockBlockchain.banks.size === 0) {
      registerBank('0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', 'HDFC Bank');
      registerBank('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 'ICICI Bank');
      registerBank('0x9A3f8b2c7d1e4f6a8b5c9d2e1f3a6b8c7d4e5f9a', 'State Bank of India');
    }
    checkWalletConnection();
    loadStats();
  }, []);

  useEffect(() => {
    if (wallet && userRole === 'user') {
      loadAccessRequests();
    }
  }, [wallet, userRole]);

  const loadStats = () => {
    setStats({
      totalUsers: mockBlockchain.users.size,
      totalVerifications: Array.from(mockBlockchain.users.values()).filter(u => u.status === 'verified').length,
      pendingRequests: Array.from(mockBlockchain.accessPermissions.values()).filter(p => p.status === 'pending').length,
      activePermissions: Array.from(mockBlockchain.accessPermissions.values()).filter(p => p.status === 'approved').length
    });
  };

  const loadAccessRequests = () => {
    const requests = [];
    mockBlockchain.accessPermissions.forEach((permission, key) => {
      if (key.startsWith(wallet)) {
        const bankAddr = key.split('-')[1];
        const bank = mockBlockchain.banks.get(bankAddr);
        requests.push({
          bank: bankAddr,
          name: bank?.name || 'Unknown Bank',
          status: permission.status,
          requestedAt: permission.requestedAt,
          ...permission
        });
      }
    });
    setAccessRequests(requests);
  };

  const checkWalletConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
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
    if (typeof window === 'undefined' || !window.ethereum) {
      const demoWallet = '0x' + Math.random().toString(16).substr(2, 40);
      setWallet(demoWallet);
      setActiveTab('dashboard');
      showNotification('Demo wallet connected! (Install MetaMask for real blockchain)', 'success');
      return;
    }

    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWallet(accounts[0]);
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

  const generateHash = (data) => {
    return '0x' + Array.from(data).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').slice(0, 64);
  };

  const registerBank = (bankAddr, bankName) => {
    mockBlockchain.banks.set(bankAddr, {
      name: bankName,
      address: bankAddr,
      registeredAt: new Date().toISOString(),
      verified: true
    });
  };

  const handleFileUpload = async () => {
    if (!file) {
      showNotification('Please select a file', 'error');
      return;
    }

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const fileContent = `${file.name}-${file.size}-${Date.now()}`;
      const documentHash = generateHash(fileContent);
      const ipfsCID = 'Qm' + Math.random().toString(36).substr(2, 44);
      
      mockIPFS.set(ipfsCID, {
        fileName: file.name,
        size: file.size,
        type: documentType,
        uploadedAt: new Date().toISOString()
      });
      
      const txHash = '0x' + Math.random().toString(16).substr(2, 64);
      const blockNumber = Math.floor(Math.random() * 1000000) + 12000000;
      
      mockBlockchain.users.set(wallet, {
        kycHash: documentHash,
        status: 'pending',
        documentType,
        registeredAt: new Date().toISOString(),
        txHash,
        blockNumber,
        ipfsCID
      });

      mockBlockchain.transactions.push({
        type: 'UserRegistered',
        user: wallet,
        hash: documentHash,
        txHash,
        blockNumber,
        timestamp: new Date().toISOString()
      });
      
      mockDatabase.set(wallet, {
        documentType,
        hash: documentHash,
        ipfsCID,
        uploadTime: new Date().toISOString(),
        size: file.size,
        fileName: file.name
      });
      
      setUploadResult({
        hash: documentHash,
        ipfsCID,
        txHash,
        blockNumber,
        uploadTime: new Date().toISOString()
      });
      
      loadStats();
      showNotification('KYC uploaded and registered on blockchain!', 'success');
      setActiveSubTab('status');
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const userKYC = mockBlockchain.users.get(verifyAddress);
      const metadata = mockDatabase.get(verifyAddress);
      
      if (!userKYC) {
        showNotification('User not found', 'error');
        setVerifyResult(null);
        return;
      }

      const permissionKey = `${verifyAddress}-${wallet}`;
      const permission = mockBlockchain.accessPermissions.get(permissionKey);
      
      setVerifyResult({
        ...userKYC,
        ...metadata,
        hasAccess: permission?.status === 'approved',
        permissionStatus: permission?.status || 'none'
      });
      
      showNotification('User data retrieved', 'success');
    } catch (error) {
      showNotification('Verification failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const approveKYC = async (userAddress) => {
    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const user = mockBlockchain.users.get(userAddress);
      if (user) {
        user.status = 'verified';
        user.verifiedBy = wallet;
        user.verifiedAt = new Date().toISOString();

        const txHash = '0x' + Math.random().toString(16).substr(2, 64);
        mockBlockchain.transactions.push({
          type: 'KYCVerified',
          user: userAddress,
          bank: wallet,
          txHash,
          timestamp: new Date().toISOString()
        });

        loadStats();
        showNotification('KYC approved successfully!', 'success');
        handleVerifyUser();
      }
    } catch (error) {
      showNotification('Approval failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAccessControl = async (bankAddr, action) => {
    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const permissionKey = `${wallet}-${bankAddr}`;
      const permission = mockBlockchain.accessPermissions.get(permissionKey);
      const txHash = '0x' + Math.random().toString(16).substr(2, 64);
      
      if (permission) {
        if (action === 'grant') {
          permission.status = 'approved';
          permission.approvedAt = new Date().toISOString();
          permission.txHash = txHash;
          showNotification('Access granted!', 'success');
        } else {
          permission.status = 'revoked';
          permission.revokedAt = new Date().toISOString();
          permission.txHash = txHash;
          showNotification('Access revoked!', 'success');
        }

        mockBlockchain.transactions.push({
          type: action === 'grant' ? 'AccessGranted' : 'AccessRevoked',
          user: wallet,
          bank: bankAddr,
          txHash,
          timestamp: new Date().toISOString()
        });

        loadAccessRequests();
        loadStats();
      }
    } catch (error) {
      showNotification('Action failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard!', 'success');
  };

  const ConnectWalletScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 max-w-md w-full border border-white/20">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl">
              <Shield className="w-16 h-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            TrustLedger
          </h1>
          <p className="text-gray-600 text-lg">Decentralized KYC & Identity Verification</p>
        </div>
        
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="p-2 bg-blue-500 rounded-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">Secure blockchain storage</span>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
            <div className="p-2 bg-green-500 rounded-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">Document privacy guaranteed</span>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="p-2 bg-purple-500 rounded-lg">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">Instant verification</span>
          </div>
        </div>

        <button
          onClick={connectWallet}
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Key className="w-6 h-6" />
              Connect Wallet
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
          No MetaMask? Demo mode available
        </p>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
          <Users className="w-8 h-8 mb-3 opacity-80" />
          <div className="text-3xl font-bold mb-1">{stats.totalUsers}</div>
          <div className="text-sm opacity-90">Total Users</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg">
          <CheckSquare className="w-8 h-8 mb-3 opacity-80" />
          <div className="text-3xl font-bold mb-1">{stats.totalVerifications}</div>
          <div className="text-sm opacity-90">Verifications</div>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white p-6 rounded-2xl shadow-lg">
          <Clock className="w-8 h-8 mb-3 opacity-80" />
          <div className="text-3xl font-bold mb-1">{stats.pendingRequests}</div>
          <div className="text-sm opacity-90">Pending Requests</div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg">
          <Unlock className="w-8 h-8 mb-3 opacity-80" />
          <div className="text-3xl font-bold mb-1">{stats.activePermissions}</div>
          <div className="text-sm opacity-90">Active Permissions</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-blue-600">1</span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Upload KYC</h3>
          <p className="text-sm text-gray-600 mb-4">Submit your identity documents securely to the blockchain</p>
          <button
            onClick={() => { setActiveTab('kyc'); setActiveSubTab('upload'); }}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Get Started →
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Lock className="w-8 h-8 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-green-600">2</span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Access Control</h3>
          <p className="text-sm text-gray-600 mb-4">Manage bank access permissions to your data</p>
          <button
            onClick={() => { setActiveTab('kyc'); setActiveSubTab('permissions'); }}
            className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
          >
            Manage Access →
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <FileCheck className="w-8 h-8 text-purple-600" />
            </div>
            <span className="text-3xl font-bold text-purple-600">3</span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Check Status</h3>
          <p className="text-sm text-gray-600 mb-4">View your verification status and document details</p>
          <button
            onClick={() => { setActiveTab('kyc'); setActiveSubTab('status'); }}
            className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
          >
            View Status →
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-8 rounded-2xl shadow-xl">
        <div className="flex items-start gap-4">
          <Shield className="w-12 h-12 flex-shrink-0 opacity-90" />
          <div>
            <h3 className="text-2xl font-bold mb-2">Your Identity, Your Control</h3>
            <p className="text-indigo-100 mb-4 text-lg">
              TrustLedger ensures your documents never leave your control. Only cryptographic hashes are stored on-chain.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg font-medium">🔒 Encrypted</span>
              <span className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg font-medium">⛓️ Blockchain</span>
              <span className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg font-medium">🚀 Instant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const UploadKYC = () => (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Upload KYC Document</h2>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            >
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
              <option value="passport">Passport</option>
              <option value="drivers_license">Driver License</option>
              <option value="voter_id">Voter ID</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Upload Document
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-indigo-500 hover:bg-indigo-50/50 transition cursor-pointer">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-gray-500">
                  PDF, JPG, or PNG (max. 10MB)
                </p>
              </label>
              {file && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="flex items-center justify-center gap-2">
                    <FileCheck className="w-5 h-5 text-indigo-600" />
                    <p className="text-sm font-medium text-indigo-900">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-lg p-5">
            <div className="flex gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div className="text-sm text-yellow-900">
                <p className="font-semibold mb-2">Privacy & Security</p>
                <ul className="space-y-1 text-xs">
                  <li>Document encrypted before upload</li>
                  <li>Stored on IPFS (decentralized)</li>
                  <li>Only SHA-256 hash on blockchain</li>
                  <li>You control access</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleFileUpload}
            disabled={loading || !file}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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

  const StatusScreen = () => {
    const userKYC = mockBlockchain.users.get(wallet);
    const metadata = mockDatabase.get(wallet);

    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-green-100 rounded-xl">
              <FileCheck className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">KYC Status</h2>
          </div>
          
          {userKYC ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-bold text-green-900 text-lg">KYC Registered Successfully</p>
                  <p className="text-sm text-green-700">Your identity is now on the blockchain</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-600">Document Hash</p>
                  </div>
                  <p className="font-mono text-xs break-all text-gray-800">{userKYC.kycHash}</p>
                  <button
                    onClick={() => copyToClipboard(userKYC.kycHash)}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-600">IPFS CID</p>
                  </div>
                  <p className="font-mono text-xs break-all text-gray-800">{userKYC.ipfsCID}</p>
                  <button
                    onClick={() => copyToClipboard(userKYC.ipfsCID)}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>

                <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileCheck className="w-4 h-4 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-600">Status</p>
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    userKYC.status === 'verified' ? 'bg-green-100 text-green-700' :
                    userKYC.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {userKYC.status.toUpperCase()}
                  </span>
                </div>

                <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-600">Registered</p>
                  </div>
                  <p className="text-sm text-gray-800">{new Date(userKYC.registeredAt).toLocaleString()}</p>
                </div>
              </div>

                <div className="p-5 bg-indigo-50 rounded-xl border border-indigo-200">
                  <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="font-semibold text-indigo-700">KYC Verification Complete</p>
                    <p className="text-sm text-indigo-600">Your identity is successfully validated</p>
                  </div>  {/* close inner wrapper */}
                </div>    {/* close container */}
              </div>      {/* close page wrapper */}
            </div>        {/* close main wrapper */}
          </div>          {/* close whole layout */}
  );
};

export default App;
