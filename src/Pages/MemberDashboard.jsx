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
  
  // Fixed deposit states - initialize empty, will be populated from API
  const [memberFixedDeposits, setMemberFixedDeposits] = useState([]);
  const [loadingFixedDeposits, setLoadingFixedDeposits] = useState(false);

  const API_URL = "https://irorunde1-production.up.railway.app/api/";

  // Simplified useEffect - just fetch data from API
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userData = JSON.parse(localStorage.getItem('userData'));
    
    if (!token || !userData) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
      return;
    }
    
    setUserData(userData);
    
    // Fetch all data from API
    refreshAllData();
  }, []);

  // Simplified refresh function
  const refreshAllData = async () => {
    setLoading(true);
    const token = localStorage.getItem('accessToken');
    const userData = JSON.parse(localStorage.getItem('userData'));
    
    try {
      // Fetch all data in parallel
      await Promise.all([
        fetchDashboardData(token),
        fetchPaymentHistory(token),
        fetchGroupAccount(token),
        fetchMemberFixedDeposits(token) // Always fetch from API
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async (token) => {
    try {
      const response = await fetch(`${API_URL}user/dashboard/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
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
    }
  };

  // Fetch payment history
  const fetchPaymentHistory = async (token) => {
    try {
      const response = await fetch(`${API_URL}user/combined-payment-history/`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data);
      } else {
        console.error("Failed to load payment history:", response.status);
      }
    } catch (err) {
      console.error("Payment history fetch error:", err);
    }
  };

  // Fetch group account
  const fetchGroupAccount = async (token) => {
    try {
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

  // Simplified fixed deposits fetch - always from API
  const fetchMemberFixedDeposits = async (token) => {
    setLoadingFixedDeposits(true);
    try {
      console.log('Fetching fixed deposits from API...');
      
      // Try multiple endpoints
      const endpoints = [
        `${API_URL}user/fixed-deposits/`,
        `${API_URL}fixed-deposits/member/${userData?.id}/`,
        `${API_URL}members/${userData?.id}/fixed-deposits/`,
        `${API_URL}fixed-deposits/?member=${userData?.id}`,
        `${API_URL}admin/fixed-deposits/?member=${userData?.id}`
      ];

      let fixedDepositsData = [];
      let success = false;

      for (const endpoint of endpoints) {
        try {
          console.log('Trying endpoint:', endpoint);
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Fixed deposits data from', endpoint, ':', data);
            
            // Handle different response formats
            if (Array.isArray(data)) {
              fixedDepositsData = data;
            } else if (data.results && Array.isArray(data.results)) {
              fixedDepositsData = data.results;
            } else if (data.fixed_deposits && Array.isArray(data.fixed_deposits)) {
              fixedDepositsData = data.fixed_deposits;
            } else if (data.data && Array.isArray(data.data)) {
              fixedDepositsData = data.data;
            }
            
            if (fixedDepositsData.length > 0) {
              console.log('Found fixed deposits via API:', fixedDepositsData);
              
              // Process the data to ensure consistent format
              const processedDeposits = fixedDepositsData.map(deposit => ({
                id: deposit.id || deposit._id,
                amount: deposit.amount || deposit.deposit_amount,
                created_at: deposit.created_at || deposit.date_created,
                is_active: deposit.is_active !== undefined ? deposit.is_active : 
                          deposit.status === 'active' ? true : 
                          deposit.status === 'collected' ? false : true,
                duration_months: deposit.duration_months || 12,
                interest_rate: deposit.interest_rate || 0,
                member: deposit.member || userData?.id,
                payment_reference: deposit.payment_reference || deposit.reference,
                collected_at: deposit.collected_at,
                status: deposit.status || 'active'
              }));
              
              setMemberFixedDeposits(processedDeposits);
              success = true;
              break;
            }
          } else {
            console.log(`Endpoint ${endpoint} returned status:`, response.status);
          }
        } catch (err) {
          console.log(`Endpoint ${endpoint} error:`, err);
        }
      }

      // If no fixed deposits found via API, create from payment history
      if (!success) {
        console.log('No fixed deposits found via API, checking payment history...');
        createFixedDepositsFromPaymentHistory();
      }
      
    } catch (err) {
      console.error("All fixed deposit API endpoints failed:", err);
      createFixedDepositsFromPaymentHistory();
    } finally {
      setLoadingFixedDeposits(false);
    }
  };

  // Create fixed deposits from payment history as fallback
  const createFixedDepositsFromPaymentHistory = () => {
    try {
      console.log('Creating fixed deposits from payment history...');
      
      const fixedDepositPayments = paymentHistory.filter(payment => 
        payment.payment_type === 'fixed_deposit' && 
        (payment.status === 'confirmed' || payment.is_successful)
      );

      console.log('Fixed deposit payments found in payment history:', fixedDepositPayments);

      if (fixedDepositPayments.length > 0) {
        const fixedDepositsFromPayments = fixedDepositPayments.map((payment, index) => ({
          id: `temp-fd-${payment.id || index}`,
          amount: payment.amount,
          created_at: payment.date || payment.created_at,
          is_active: true,
          duration_months: 12,
          interest_rate: 0,
          member: userData?.id,
          payment_reference: payment.reference_number || payment.transaction_reference || `FD-${index}`,
          _source: 'payment_history'
        }));

        console.log('Created fixed deposits from payments:', fixedDepositsFromPayments);
        setMemberFixedDeposits(fixedDepositsFromPayments);
      } else {
        console.log('No fixed deposit payments found in payment history');
        setMemberFixedDeposits([]);
      }
    } catch (err) {
      console.error('Error creating fixed deposits from payment history:', err);
      setMemberFixedDeposits([]);
    }
  };

  // Manual payment submission
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
        
        // Refresh data after a short delay to allow backend processing
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

  // Reset payment form
  const resetPaymentForm = () => {
    setAmount("");
    setBankName("");
    setTransactionReference("");
    setTransferDate("");
    setPaymentCategory("savings");
  };

  // Function to copy account number to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Account number copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  // Reset modal form when closed
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

  // Helper functions to calculate totals
  const getActiveFixedDepositsTotal = () => {
    if (memberFixedDeposits.length > 0) {
      const activeDeposits = memberFixedDeposits.filter(fd => fd.is_active !== false);
      return activeDeposits.reduce((sum, deposit) => sum + (parseFloat(deposit.amount) || 0), 0);
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

  // Enhanced financial cards with paid amounts
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
              {/* Show paid amount for loans */}
              {type === 'loan' && paidAmount > 0 && (
                <dt className="text-xs font-medium text-gray-400 truncate">
                  Paid: ₦{paidAmount?.toLocaleString() || '0'}
                </dt>
              )}
              {/* Show count for fixed deposits */}
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
              {/* Passport Photo */}
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
              {/* Refresh Button */}
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
              
              {/* Fixed Deposits card using real-time data */}
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
                    onClick={() => fetchMemberFixedDeposits(localStorage.getItem('accessToken'))}
                    disabled={loadingFixedDeposits}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-1"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{loadingFixedDeposits ? "Refreshing..." : "Refresh"}</span>
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

          {/* Payment History */}
          {paymentHistory.length > 0 ? (
            <div className="mt-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Your Payment History ({paymentHistory.length} transactions)
                </h3>
                <button
                  onClick={() => fetchPaymentHistory(localStorage.getItem('accessToken'))}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 text-sm"
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto bg-white shadow rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (₦)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank Name</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentHistory.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {new Date(payment.date || payment.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            payment.payment_type === 'savings' ? 'bg-green-100 text-green-800' :
                            payment.payment_type === 'fixed_deposit' ? 'bg-blue-100 text-blue-800' :
                            payment.payment_type === 'outstanding_balance' ? 'bg-yellow-100 text-yellow-800' :
                            payment.payment_type === 'investment_loan' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {payment.payment_type?.replace('_', ' ') || 'contribution'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₦{payment.amount?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            payment.status === "confirmed" || payment.is_successful
                              ? "bg-green-100 text-green-800"
                              : payment.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : payment.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {payment.status || (payment.is_successful ? "confirmed" : "pending")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                          {payment.reference_number || payment.tx_ref || payment.card_number_reference || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.bank_name || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-10 text-center">
              <div className="bg-white shadow rounded-lg p-8">
                <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment History</h3>
                <p className="text-gray-500 mb-4">You haven't made any payments yet.</p>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
                >
                  Make Your First Payment
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-8">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-white overflow-hidden shadow rounded-lg p-6 text-left hover:shadow-md transition-shadow border border-gray-200"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-amber-100 rounded-md p-2">
                    <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-medium text-gray-900">Make Payment</h4>
                    <p className="mt-1 text-sm text-gray-500">Submit manual payment request</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modern Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Make a Payment</h2>
                  <p className="text-amber-100 text-sm mt-1">Select category and enter payment details</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-white hover:text-amber-200 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Group Account Card */}
              {groupAccount && (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <div className="bg-emerald-100 rounded-lg p-2">
                      <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-emerald-800 text-sm mb-2">Transfer to Group Account</h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-emerald-600 font-medium">Bank:</span>
                          <span className="text-emerald-900">{groupAccount.bank_name || "Not set"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-600 font-medium">Account No:</span>
                          <span className="text-emerald-900 font-mono">{groupAccount.account_number || "Not set"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-600 font-medium">Account Name:</span>
                          <span className="text-emerald-900">{groupAccount.account_name || "Not set"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Category Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  What are you paying for?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "savings", label: "Savings", icon: "💰", color: "green" },
                    { value: "fixed_deposit", label: "Fixed Deposit", icon: "🏦", color: "blue" },
                    { value: "outstanding_balance", label: "Outstanding Balance", icon: "⚡", color: "yellow" },
                    { value: "investment_loan", label: "Investment Loan", icon: "📈", color: "purple" }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPaymentCategory(option.value)}
                      className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                        paymentCategory === option.value
                          ? `border-${option.color}-500 bg-${option.color}-50 shadow-sm`
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="text-2xl mb-1">{option.icon}</div>
                      <div className="text-xs font-medium text-gray-700">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount (₦)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-medium">₦</span>
                  </div>
                  <input
                    type="number"
                    placeholder="Enter amount (min: 1,100)"
                    min="1100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                    required
                  />
                </div>
                {amount && parseFloat(amount) < 1100 && (
                  <p className="text-red-500 text-xs mt-2">Minimum amount is ₦1,100</p>
                )}
              </div>

              {/* Bank Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Bank Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Bank
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g., First Bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Transfer Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Transfer Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Transaction Reference */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Reference
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Enter your name as reference"
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                    required
                  />
                </div>
                <p className="text-gray-500 text-xs mt-2">Use your full name as it appears on your bank account</p>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 rounded-lg p-2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-800 text-sm mb-2">Important Instructions</h4>
                    <ul className="text-blue-700 text-xs space-y-1">
                      <li>• Transfer exact amount to the group account</li>
                      <li>• Use your name as transfer reference</li>
                      <li>• Payments show as pending until admin confirmation</li>
                      <li>• Confirmation typically takes 24 hours</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualPayment}
                  disabled={loadingPayment || !amount || !bankName || !transactionReference || parseFloat(amount) < 1100}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                >
                  {loadingPayment ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    "Submit Payment"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDashboard;