import React, { useState, useEffect } from 'react';

const MemberDashboard = () => {
  const [userData, setUserData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [groupAccount, setGroupAccount] = useState(null);
  const [bankName, setBankName] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [paymentCategory, setPaymentCategory] = useState("savings");

  // Fixed deposit states
  const [memberFixedDeposits, setMemberFixedDeposits] = useState([]);
  const [loadingFixedDeposits, setLoadingFixedDeposits] = useState(false);

  const API_URL = "https://irorunde1-production.up.railway.app/api/";

  // Simple and effective fixed deposits sync
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const memberId = userData?.id;
    
    if (!memberId) return;

    // Load initial fixed deposits
    loadFixedDeposits();

    // Set up periodic refresh every 10 seconds
    const interval = setInterval(() => {
      console.log('Auto-refreshing fixed deposits...');
      loadFixedDeposits();
    }, 10000);

    // Listen for storage changes (from admin dashboard)
    const handleStorageChange = (event) => {
      if (event.key === `fixed_deposits_${memberId}`) {
        console.log('Fixed deposits updated in localStorage, refreshing...');
        loadFixedDeposits();
      }
    };

    // Listen for custom events from admin
    const handleFixedDepositEvent = (event) => {
      if (event.detail?.memberId === memberId) {
        console.log('Received fixed deposit event, refreshing...', event.detail);
        loadFixedDeposits();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('fixedDepositUpdated', handleFixedDepositEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('fixedDepositUpdated', handleFixedDepositEvent);
    };
  }, []);

  // Simple fixed deposits loader
  const loadFixedDeposits = async () => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const memberId = userData?.id;
    
    if (!memberId) return;

    try {
      // First try to get from localStorage (updated by admin)
      const savedFixedDeposits = localStorage.getItem(`fixed_deposits_${memberId}`);
      if (savedFixedDeposits) {
        const parsedDeposits = JSON.parse(savedFixedDeposits);
        console.log('Loaded fixed deposits from localStorage:', parsedDeposits);
        setMemberFixedDeposits(parsedDeposits);
        return;
      }

      // If not in localStorage, create from payment history
      await createFixedDepositsFromPaymentHistory();
    } catch (error) {
      console.error('Error loading fixed deposits:', error);
    }
  };

  // Create fixed deposits from payment history
  const createFixedDepositsFromPaymentHistory = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData'));
      const memberId = userData?.id;
      
      if (!memberId) return;
      
      console.log('Creating fixed deposits from payment history...');
      
      const fixedDepositPayments = paymentHistory.filter(payment => 
        payment.payment_type === 'fixed_deposit' && 
        (payment.status === 'confirmed' || payment.is_successful)
      );

      console.log('Fixed deposit payments found:', fixedDepositPayments);

      if (fixedDepositPayments.length > 0) {
        const fixedDepositsFromPayments = fixedDepositPayments.map((payment, index) => ({
          id: `temp-fd-${payment.id || index}`,
          amount: payment.amount,
          created_at: payment.date || payment.created_at,
          is_active: true,
          duration_months: 12,
          interest_rate: 0,
          member: memberId,
          payment_reference: payment.reference_number || payment.transaction_reference || `FD-${index}`,
          _source: 'payment_history'
        }));

        console.log('Created fixed deposits from payments:', fixedDepositsFromPayments);
        
        // Save to both state and localStorage
        setMemberFixedDeposits(fixedDepositsFromPayments);
        localStorage.setItem(`fixed_deposits_${memberId}`, JSON.stringify(fixedDepositsFromPayments));
      } else {
        console.log('No fixed deposit payments found');
        setMemberFixedDeposits([]);
        localStorage.setItem(`fixed_deposits_${memberId}`, JSON.stringify([]));
      }
    } catch (err) {
      console.error('Error creating fixed deposits from payment history:', err);
    }
  };

  // Refresh all data
  const refreshAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardData(),
      fetchPaymentHistory(),
      fetchGroupAccount()
    ]);
    // Also load fixed deposits after payment history is loaded
    await loadFixedDeposits();
    setLoading(false);
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Helper functions for fixed deposits
  const getActiveFixedDepositsTotal = () => {
    if (memberFixedDeposits.length > 0) {
      const activeDeposits = memberFixedDeposits.filter(fd => fd.is_active !== false);
      const total = activeDeposits.reduce((sum, deposit) => sum + (parseFloat(deposit.amount) || 0), 0);
      return total;
    }
    return dashboardData?.financial_summary?.fixed_deposits || 0;
  };

  const getCollectedFixedDepositsTotal = () => {
    if (memberFixedDeposits.length > 0) {
      const collectedDeposits = memberFixedDeposits.filter(fd => fd.is_active === false);
      return collectedDeposits.reduce((sum, deposit) => sum + (parseFloat(deposit.amount) || 0), 0);
    }
    return 0;
  };

  const refreshFixedDeposits = async () => {
    await loadFixedDeposits();
  };

  // Existing functions (keep all your existing code below)
  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const storedUserData = localStorage.getItem('userData');
      
      if (storedUserData) {
        setUserData(JSON.parse(storedUserData));
      }

      const response = await fetch(`${API_URL}user/dashboard/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Dashboard data:", data);
        setDashboardData(data);
        setError(null);
      } else {
        if (response.status === 401) {
          handleLogout();
          return;
        }
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load dashboard');
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Network error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${API_URL}user/combined-payment-history/`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Payment history data:", data);
        setPaymentHistory(data);
      } else {
        console.error("Failed to load payment history:", response.status);
      }
    } catch (err) {
      console.error("Payment history fetch error:", err);
    }
  };

  const fetchGroupAccount = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${API_URL}payments/group-account/`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGroupAccount(data);
      } else {
        console.error("Failed to load group account:", response.status);
      }
    } catch (err) {
      console.error("Group account fetch error:", err);
    }
  };

  const handleManualPayment = async () => {
    const token = localStorage.getItem("accessToken");

    if (!amount || parseFloat(amount) < 1100) {
      alert("Minimum contribution is ₦1100.");
      return;
    }

    if (!dashboardData?.member_info?.group_id) {
      alert("Missing group information.");
      return;
    }

    if (!bankName || !transactionReference) {
      alert("Please provide bank name and transaction reference.");
      return;
    }

    try {
      setLoadingPayment(true);

      const response = await fetch(`${API_URL}payments/manual/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          payment_type: paymentCategory,
          bank_name: bankName,
          transaction_reference: transactionReference,
          transfer_date: transferDate || new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Payment submitted successfully! Please transfer the funds to the group account and await admin confirmation.");
        
        setTimeout(() => {
          refreshAllData();
        }, 1000);
        
        setShowPaymentModal(false);
        resetPaymentForm();
      } else {
        console.error("Payment submission failed:", data);
        alert(data.error || data.message || "Unable to submit payment. Please try again.");
      }
    } catch (error) {
      console.error("Payment submission error:", error);
      alert("Network error while submitting payment.");
    } finally {
      setLoadingPayment(false);
    }
  };

  const resetPaymentForm = () => {
    setAmount("");
    setBankName("");
    setTransactionReference("");
    setTransferDate("");
    setPaymentCategory("savings");
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Account number copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleCloseModal = () => {
    setShowPaymentModal(false);
    resetPaymentForm();
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    window.location.href = '/login';
  };

  // FinancialCard component
  const FinancialCard = ({ title, amount, paidAmount, icon, color, type = 'default' }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 bg-${color}-100 rounded-md p-3`}>
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-lg font-medium text-gray-900">
                ₦{amount?.toLocaleString() || '0'}
              </dd>
              {type === 'loan' && paidAmount > 0 && (
                <dt className="text-xs font-medium text-gray-400 truncate">
                  Paid: ₦{paidAmount?.toLocaleString() || '0'}
                </dt>
              )}
              {type === 'fixed_deposit' && memberFixedDeposits.filter(fd => fd.is_active !== false).length > 0 && (
                <dt className="text-xs font-medium text-gray-400 truncate">
                  {memberFixedDeposits.filter(fd => fd.is_active !== false).length} active deposit(s)
                </dt>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  // Icons for financial cards
  const icons = {
    savings: (
      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    loan: (
      <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    fixed: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    investment: (
      <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Dashboard Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-2">
            <button 
              onClick={refreshAllData}
              className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700"
            >
              Retry
            </button>
            <button 
              onClick={handleLogout}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
            >
              Login Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No Dashboard Data</h2>
          <p className="text-gray-600 mb-4">Unable to load dashboard information</p>
          <button 
            onClick={refreshAllData}
            className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Refresh Button */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              {dashboardData.member_info.passport_photo ? (
                <div className="flex-shrink-0">
                  <img
                    src={dashboardData.member_info.passport_photo}
                    alt="Passport Photo"
                    className="h-12 w-12 rounded-full object-cover border-2 border-amber-600"
                  />
                </div>
              ) : (
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center border-2 border-amber-600">
                    <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Irorunde Member Dashboard</h1>
                <p className="text-gray-600">Welcome to your member portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={refreshAllData}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm flex items-center space-x-2 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{loading ? "Refreshing..." : "Refresh"}</span>
              </button>
              <span className="text-gray-700">
                {dashboardData.member_info.name}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Welcome Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center space-x-6">
                {dashboardData.member_info.passport_photo ? (
                  <div className="flex-shrink-0">
                    <img
                      src={dashboardData.member_info.passport_photo}
                      alt="Passport Photo"
                      className="h-24 w-24 rounded-full object-cover border-4 border-amber-600 shadow-lg"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0">
                    <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center border-4 border-amber-600 shadow-lg">
                      <svg className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Welcome back, {dashboardData.member_info.name}!
                  </h3>
                  <div className="mt-2 max-w-xl text-sm text-gray-500">
                    <p>You are successfully logged in to your Irorunde member dashboard.</p>
                    {!dashboardData.member_info.passport_photo && (
                      <p className="text-amber-600 mt-1">
                        No passport photo uploaded yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Group Account Information */}
          {groupAccount && (
            <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Group Bank Account Details</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-32">Bank Name:</span>
                      <span className="text-green-900">{groupAccount.bank_name || "Not set"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-32">Account Number:</span>
                      <span className="text-green-900 font-mono">{groupAccount.account_number || "Not set"}</span>
                      {groupAccount.account_number && (
                        <button
                          onClick={() => copyToClipboard(groupAccount.account_number)}
                          className="ml-2 text-green-600 hover:text-green-800"
                          title="Copy to clipboard"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-32">Account Name:</span>
                      <span className="text-green-900">{groupAccount.account_name || "Not set"}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-green-600 text-white px-4 py-2 rounded-lg">
                    <p className="text-sm">Use this account for all payments</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Member Information Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card Number */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-amber-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Card number</dt>
                      <dd className="text-lg font-medium text-gray-900">{dashboardData.member_info.card_number}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Group Info */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Group</dt>
                      <dd className="text-lg font-medium text-gray-900">{dashboardData.member_info.group}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Status</dt>
                      <dd className="text-lg font-medium text-gray-900 capitalize">{dashboardData.member_info.status}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Photo Status */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                    <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Passport Photo</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {dashboardData.member_info.has_photo ? 'Uploaded' : 'Not Uploaded'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Financial Summary */}
          <div className="mt-8">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Financial Summary</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <FinancialCard
                title="Total Savings"
                amount={dashboardData.financial_summary?.total_savings}
                icon={icons.savings}
                color="green"
              />
              
              <FinancialCard
                title="Outstanding Loans"
                amount={dashboardData.financial_summary?.outstanding_loans}
                paidAmount={dashboardData.financial_summary?.total_outstanding_payments}
                icon={icons.loan}
                color="red"
                type="loan"
              />
              
              {/* UPDATED: Fixed Deposits card using real-time data */}
              <FinancialCard
                title="Fixed Deposits"
                amount={getActiveFixedDepositsTotal()}
                icon={icons.fixed}
                color="blue"
                type="fixed_deposit"
              />
              
              <FinancialCard
                title="Investment Loans"
                amount={dashboardData.financial_summary?.investment_loans}
                paidAmount={dashboardData.financial_summary?.total_investment_loan_payments}
                icon={icons.investment}
                color="purple"
                type="loan"
              />
            </div>

            {/* Fixed Deposits Summary */}
            {memberFixedDeposits.length > 0 && (
              <div className="mt-6 bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-medium text-gray-900">Fixed Deposits Summary</h4>
                  <button
                    onClick={refreshFixedDeposits}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center space-x-1"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{memberFixedDeposits.filter(fd => fd.is_active !== false).length}</div>
                    <div className="text-sm text-gray-600">Active Deposits</div>
                    <div className="text-xs text-green-600">₦{getActiveFixedDepositsTotal().toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{memberFixedDeposits.filter(fd => fd.is_active === false).length}</div>
                    <div className="text-sm text-gray-600">Collected Deposits</div>
                    <div className="text-xs text-green-600">₦{getCollectedFixedDepositsTotal().toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">{memberFixedDeposits.length}</div>
                    <div className="text-sm text-gray-600">Total Deposits</div>
                    <div className="text-xs text-green-600">₦{(getActiveFixedDepositsTotal() + getCollectedFixedDepositsTotal()).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rest of your existing JSX for Payment History, Quick Actions, and Payment Modal */}
          {/* ... (keep all your existing JSX code below) */}
          
        </div>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal content remains the same */}
            {/* ... */}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDashboard;