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

  useEffect(() => {
    fetchDashboardData();
    fetchPaymentHistory();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const storedUserData = localStorage.getItem('userData');
      
      if (storedUserData) {
        setUserData(JSON.parse(storedUserData));
      }

      const response = await fetch('https://irorunde1-production.up.railway.app/api/dashboard/', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
        setError(null);
      } else {
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

  // ✅ FIXED: Correct API endpoint (removed duplicate /api/)
  const fetchPaymentHistory = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch("https://irorunde1-production.up.railway.app/api/payment-history/", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Payment history data:", data); // Debug log
        setPaymentHistory(data);
      } else {
        console.error("Failed to load payment history:", response.status);
      }
    } catch (err) {
      console.error("Payment history fetch error:", err);
    }
  };

  // ✅ ENHANCED: Added missing fields for payment
  const handlePayment = async () => {
    const token = localStorage.getItem("accessToken");

    if (!amount || parseFloat(amount) < 1100) {
      alert("Minimum contribution is ₦1100.");
      return;
    }

    if (!dashboardData?.member_info?.group_id || !dashboardData?.member_info?.name) {
      alert("Missing user or group information.");
      return;
    }

    try {
      setLoadingPayment(true);

      // Get user info for payment
      const memberInfo = dashboardData.member_info;
      const userInfo = userData || JSON.parse(localStorage.getItem('userData') || '{}');

      const response = await fetch("https://irorunde1-production.up.railway.app/api/flutterwave/initialize/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          payment_type: "contribution",
          group_id: memberInfo.group_id,
          // ✅ ADDED: Required fields for payment
          name: memberInfo.name,
          email: userInfo.email || `${memberInfo.name.toLowerCase().replace(/\s+/g, '.')}@irorunde.com`,
          phone: memberInfo.phone || userInfo.phone,
        }),
      });

      const data = await response.json();

      if (response.ok && data.payment_link) {
        window.location.href = data.payment_link;
      } else {
        console.error("Payment init failed:", data);
        alert(data.error || data.message || "Unable to start payment. Please try again.");
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Network error while initiating payment.");
    } finally {
      setLoadingPayment(false);
      setShowPaymentModal(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    window.location.href = '/login';
  };

  // ✅ ADDED: Payment verification after redirect
  useEffect(() => {
    const verifyPaymentAfterRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tx_ref = urlParams.get('tx_ref');
      const status = urlParams.get('status');
      
      if (status === 'successful' && tx_ref) {
        try {
          const token = localStorage.getItem('accessToken');
          const response = await fetch(`https://irorunde1-production.up.railway.app/api/verify_flutterwave_payment?tx_ref=${tx_ref}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            alert('✅ Payment verified successfully!');
            // Refresh data
            fetchDashboardData();
            fetchPaymentHistory();
          }
        } catch (error) {
          console.error('Payment verification error:', error);
        }
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    
    verifyPaymentAfterRedirect();
  }, []);

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
          <button 
            onClick={fetchDashboardData}
            className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700"
          >
            Retry
          </button>
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
            onClick={fetchDashboardData}
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
      {/* Header */}
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
          {/* Welcome Card with Larger Photo */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center space-x-6">
                {/* Large Passport Photo */}
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

          {/* Member Information Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Membership Info */}
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
                      <dt className="text-sm font-medium text-gray-500 truncate">Membership No.</dt>
                      <dd className="text-lg font-medium text-gray-900">{dashboardData.member_info.membership_number}</dd>
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

          {/* Financial Summary */}
          {dashboardData.financial_summary && (
            <div className="mt-8">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Financial Summary</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Contributions</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">
                      ₦{dashboardData.financial_summary.total_contributions?.toLocaleString()}
                    </dd>
                  </div>
                </div>
                
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">This Week</dt>
                    <dd className="mt-1 text-3xl font-semibold text-green-600">
                      ₦{dashboardData.financial_summary.weekly_contributions?.toLocaleString()}
                    </dd>
                  </div>
                </div>
                
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">This Month</dt>
                    <dd className="mt-1 text-3xl font-semibold text-blue-600">
                      ₦{dashboardData.financial_summary.monthly_contributions?.toLocaleString()}
                    </dd>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Payment History - ENHANCED */}
          {paymentHistory.length > 0 ? (
            <div className="mt-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Your Payment History ({paymentHistory.length} transactions)
                </h3>
                <button
                  onClick={fetchPaymentHistory}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 text-sm"
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto bg-white shadow rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount (₦)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentHistory.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {new Date(payment.date || payment.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">
                          {payment.payment_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₦{payment.amount?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              payment.status === "successful" || payment.is_successful
                                ? "bg-green-100 text-green-800"
                                : payment.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {payment.status || (payment.is_successful ? "successful" : "pending")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                          {payment.tx_ref || payment.flutterwave_reference || 'N/A'}
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
              {/* Make Contribution Button */}
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
                    <h4 className="text-lg font-medium text-gray-900">Make Contribution</h4>
                    <p className="mt-1 text-sm text-gray-500">Add funds to your account</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Flutterwave Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6 relative">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Make a Contribution</h2>

            <input
              type="number"
              placeholder="Enter amount (₦1100 minimum)"
              min="1100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-gray-300 rounded-lg w-full p-2 mb-4 focus:ring-amber-500 focus:border-amber-500"
            />

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>

              <button
                onClick={handlePayment}
                disabled={loadingPayment}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {loadingPayment ? "Processing..." : "Pay Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDashboard;