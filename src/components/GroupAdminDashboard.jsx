// GroupAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const GroupAdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});
  const [recentMembers, setRecentMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [dailyPayments, setDailyPayments] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const navigate = useNavigate();

  const API_BASE = '${API_URL}/';

  useEffect(() => {
    // FIXED: Use the correct localStorage keys from login
    const userData = localStorage.getItem('userData');
    const token = localStorage.getItem('accessToken');

    console.log('Auth check - Token:', token);
    console.log('Auth check - User data:', userData);

    if (!token || !userData) {
      console.log('No auth data found, redirecting to login');
      navigate('/login');
      return;
    }

    try {
      const userObj = JSON.parse(userData);
      console.log('Parsed user data:', userObj);
      
      // FIXED: Check role properly - handle different response formats
      const userRole = userObj.role || userObj.user?.role;
      if (userRole !== 'group_admin') {
        console.log('User role is not group_admin, redirecting to login');
        alert('Access denied. Group admin access only.');
        navigate('/login');
        return;
      }
      
      setUser(userObj);
      fetchDashboardData();
      fetchContributions();
      fetchPendingPayments();
    } catch (error) {
      console.error('Error parsing user data:', error);
      navigate('/login');
    }
  }, [navigate]);

  // FIXED: Update all API calls to use accessToken instead of token
  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('accessToken'); // FIXED: Use accessToken
      console.log('Fetching dashboard data with token:', token);
      
      const membersResponse = await fetch(`${API_BASE}group-admin/members/`, {
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
      });

      let membersData = [];
      if (membersResponse.ok) {
        membersData = await membersResponse.json();
        console.log('Members data:', membersData);
      } else {
        console.warn('Failed to fetch members, trying alternative endpoints...');
        membersData = await tryAlternativeEndpoints(token);
      }

      const formattedMembers = (Array.isArray(membersData) ? membersData : []).map(member => ({
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        phone: member.phone,
        join_date: member.join_date,
        status: member.status,
        card_number: member.card_number,
        email: member.email,
        address: member.address
      }));

      setRecentMembers(formattedMembers);
      setStats(prev => ({
        ...prev,
        total_members: formattedMembers.length,
        active_members: formattedMembers.filter(m => m.status === 'active').length
      }));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showNotification('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Use accessToken and correct endpoints
 // FIXED: Use accessToken and correct endpoints
// FIXED: Enhanced debug version to find calculation issues
const fetchContributions = async () => {
  const token = localStorage.getItem('accessToken');
  try {
    console.log('Fetching contributions with token:', token);
    
    // Use group admin payments endpoint
    const response = await fetch(`${API_BASE}admin/manual-payments/`, {
      headers: { 
        Authorization: `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ RAW API RESPONSE:", data);
      
      const formatted = Array.isArray(data) ? data.map(payment => ({
        id: payment.id,
        member_name: payment.member_name || `${payment.member?.first_name} ${payment.member?.last_name}` || 'Unknown Member',
        card_number: payment.member_card_number || payment.member?.card_number || 'N/A',
        amount: parseFloat(payment.amount) || 0, // Ensure it's a number
        
        // FIXED: Use the properly formatted date and time from the API
        date: payment.date || payment.transfer_date || payment.created_at,
        time: payment.time, // Use the formatted time from the serializer
        
        payment_type: payment.payment_type || 'contribution',
        status: payment.status,
        bank_name: payment.bank_name,
        transaction_reference: payment.transaction_reference,
        
        // Keep original for debugging
        created_at: payment.created_at,
        transfer_date: payment.transfer_date
      })) : [];
      
      console.log("📋 FORMATTED PAYMENTS WITH TIME:", formatted);
      setContributions(formatted);

      // FIXED: Enhanced debugging for payment calculations
      const debugPaymentCalculations = (payments) => {
        console.log("🔍 STARTING PAYMENT CALCULATIONS DEBUG");
        
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 1);

        console.log("📅 DATE RANGES:", {
          today: today.toISOString(),
          todayStart: todayStart.toISOString(),
          todayEnd: todayEnd.toISOString(),
          monthStart: monthStart.toISOString(),
          monthEnd: monthEnd.toISOString()
        });

        // Check all payments
        payments.forEach((payment, index) => {
          const paymentDate = payment.date ? new Date(payment.date) : null;
          const isToday = paymentDate && paymentDate >= todayStart && paymentDate < todayEnd;
          const isThisMonth = paymentDate && paymentDate >= monthStart && paymentDate < monthEnd;
          const isConfirmed = payment.status === 'confirmed' || payment.status === 'completed';
          
          console.log(`Payment ${index + 1}:`, {
            id: payment.id,
            amount: payment.amount,
            status: payment.status,
            type: payment.payment_type,
            date: payment.date,
            time: payment.time, // Added time to debug log
            parsedDate: paymentDate?.toISOString(),
            isToday,
            isThisMonth,
            isConfirmed,
            includedInTotals: isConfirmed
          });
        });

        // Calculate confirmed payments
        const confirmedPayments = payments.filter(payment => 
          payment.status === 'confirmed' || payment.status === 'completed'
        );
        
        console.log("✅ CONFIRMED PAYMENTS:", confirmedPayments);

        // Calculate daily payments
        const dailyPaymentsData = confirmedPayments.filter(payment => {
          if (!payment.date) return false;
          const paymentDate = new Date(payment.date);
          return paymentDate >= todayStart && paymentDate < todayEnd;
        });

        console.log("📊 DAILY PAYMENTS:", dailyPaymentsData);

        // Calculate totals
        const totalContributions = confirmedPayments.reduce((sum, payment) => {
          const amount = parseFloat(payment.amount) || 0;
          console.log(`Adding to total: ${amount} from payment ${payment.id}`);
          return sum + amount;
        }, 0);
        
        const monthlyContributions = confirmedPayments
          .filter(payment => {
            if (!payment.date) return false;
            const paymentDate = new Date(payment.date);
            return paymentDate >= monthStart && paymentDate < monthEnd;
          })
          .reduce((sum, payment) => {
            const amount = parseFloat(payment.amount) || 0;
            console.log(`Adding to monthly: ${amount} from payment ${payment.id}`);
            return sum + amount;
          }, 0);
        
        const dailyContributions = dailyPaymentsData.reduce((sum, payment) => {
          const amount = parseFloat(payment.amount) || 0;
          console.log(`Adding to daily: ${amount} from payment ${payment.id}`);
          return sum + amount;
        }, 0);

        console.log("🎯 FINAL CALCULATIONS:", {
          totalConfirmedPayments: confirmedPayments.length,
          totalContributions,
          monthlyContributions,
          dailyContributions,
          dailyCount: dailyPaymentsData.length
        });

        return {
          confirmedPayments,
          dailyPaymentsData,
          totalContributions,
          monthlyContributions,
          dailyContributions
        };
      };

      // Run the debug calculations
      const results = debugPaymentCalculations(formatted);

      setDailyPayments(results.dailyPaymentsData);

      setStats(prev => ({
        ...prev,
        total_contributions: results.totalContributions,
        monthly_contributions: results.monthlyContributions,
        daily_contributions: results.dailyContributions,
        daily_count: results.dailyPaymentsData.length
      }));

    } else {
      console.error('❌ Failed to fetch group admin payments:', response.status);
      showNotification('Failed to load payment data', 'error');
      setContributions([]);
      setDailyPayments([]);
    }
  } catch (error) {
    console.error('❌ Error fetching group admin payments:', error);
    showNotification('Error loading payment data', 'error');
    setContributions([]);
    setDailyPayments([]);
  }
};
  // FIXED: Fetch pending manual payments with accessToken
  const fetchPendingPayments = async () => {
    const token = localStorage.getItem('accessToken'); // FIXED: Use accessToken
    try {
      console.log('Fetching pending payments with token:', token);
      
      const response = await fetch(`${API_BASE}admin/manual-payments/`, {
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Pending payments data:", data);
        
        const pendingData = Array.isArray(data) ? data
          .filter(payment => payment.status === 'pending')
          .map(payment => ({
            id: payment.id,
            member_name: payment.member_name || `${payment.member?.first_name} ${payment.member?.last_name}` || 'Unknown Member',
            member_card_number: payment.member_card_number || payment.member?.card_number || 'N/A',
            amount: payment.amount || 0,
            bank_name: payment.bank_name,
            transaction_reference: payment.transaction_reference,
            payment_type: payment.payment_type || 'contribution',
            transfer_date: payment.transfer_date,
            created_at: payment.created_at,
            status: payment.status
          })) : [];
        
        setPendingPayments(pendingData);
        
        setStats(prev => ({
          ...prev,
          pending_payments: pendingData.length
        }));
      } else {
        console.error('❌ Failed to fetch pending payments:', response.status);
        setPendingPayments([]);
      }
    } catch (error) {
      console.error('❌ Error fetching pending payments:', error);
      setPendingPayments([]);
    }
  };

  // FIXED: Confirm a manual payment with accessToken
  const confirmPayment = async (paymentId) => {
    const token = localStorage.getItem('accessToken'); // FIXED: Use accessToken
    try {
      console.log('Confirming payment with token:', token);
      
      const response = await fetch(`${API_BASE}admin/manual-payments/${paymentId}/confirm/`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
      });

      if (response.ok) {
        showNotification('Payment confirmed successfully!', 'success');
        fetchPendingPayments();
        fetchContributions();
        fetchDashboardData();
      } else {
        const errorData = await response.json();
        showNotification(`Failed to confirm payment: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      showNotification('Error confirming payment', 'error');
    }
  };

  // FIXED: Reject a manual payment with accessToken
  const rejectPayment = async (paymentId) => {
    const token = localStorage.getItem('accessToken'); // FIXED: Use accessToken
    const reason = prompt('Please provide a reason for rejection:');
    
    if (!reason) {
      showNotification('Rejection reason is required', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}admin/manual-payments/${paymentId}/reject/`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ admin_notes: reason })
      });

      if (response.ok) {
        showNotification('Payment rejected successfully!', 'success');
        fetchPendingPayments();
      } else {
        const errorData = await response.json();
        showNotification(`Failed to reject payment: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      showNotification('Error rejecting payment', 'error');
    }
  };

  const tryAlternativeEndpoints = async (token) => {
    const endpoints = [
      `${API_BASE}accounts/members/`,
      `${API_BASE}members/`,
      `${API_BASE}group-admin/members/`
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${endpoint}:`, error);
      }
    }
    return [];
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  // FIXED: Handle add member with accessToken
  const handleAddMember = async (formData) => {
    const token = localStorage.getItem('accessToken'); // FIXED: Use accessToken
    const memberData = new FormData();
    
    Object.keys(formData).forEach(key => { 
      if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
        memberData.append(key, formData[key]);
      }
    });

    try {
      const response = await fetch(`${API_BASE}group-admin/members/create/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: memberData
      });

      if (response.ok) {
        await fetchDashboardData();
        showNotification(`Member ${formData.first_name} with card ${formData.card_number} added successfully!`);
        setShowModal(false);
      } else {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.error || JSON.stringify(errorData);
        } catch (e) {
          if (response.status === 500) {
            errorMessage = `Server Error (500): Check backend logs for full details.`;
          } else {
            errorMessage = `Status ${response.status}: Failed to parse error details.`;
          }
          console.error('Failed to parse response body, status:', response.status);
        }
        showNotification(`Failed to add member: ${errorMessage}`, 'error');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showNotification('A network or CORS error occurred while adding member', 'error');
    }
  };

  // FIXED: Logout - remove all storage keys used by login
  const handleLogout = () => {
    ['accessToken', 'refreshToken', 'userData', 'userRole'].forEach(key => localStorage.removeItem(key));
    navigate('/login');
  };

  const handleViewAllMembers = () => setActiveTab('members');

  const handleRefreshData = () => {
    setLoading(true);
    Promise.all([fetchDashboardData(), fetchContributions(), fetchPendingPayments()])
      .finally(() => setLoading(false));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-amber-600">Irorunde Cooperative</h1>
            <span className="ml-4 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              Group Admin Dashboard
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefreshData}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition"
            >
              Refresh
            </button>
            <span className="text-gray-700">Welcome, {user?.first_name} {user?.last_name}</span>
            <button onClick={handleLogout} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Logout</button>
          </div>
        </div>
      </header>

      {/* Rest of the component remains the same */}
      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['overview', 'members', 'contributions', 'daily-payments', 'pending-payments', 'reports'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                {tab === 'pending-payments' && pendingPayments.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {pendingPayments.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <OverviewTab 
            stats={stats} 
            recentMembers={recentMembers} 
            dailyPayments={dailyPayments}
            pendingPayments={pendingPayments}
            onAddMember={() => setShowModal(true)} 
            onViewMembers={handleViewAllMembers}
            onConfirmPayment={confirmPayment}
            onRejectPayment={rejectPayment}
          />
        )}
        {activeTab === 'members' && (
          <MembersTab 
            members={recentMembers} 
            onRefresh={handleRefreshData}
          />
        )}
        {activeTab === 'contributions' && (
          <ContributionsTab contributions={contributions} />
        )}
        {activeTab === 'daily-payments' && (
          <DailyPaymentsTab payments={dailyPayments} onRefresh={handleRefreshData} />
        )}
        {activeTab === 'pending-payments' && (
          <PendingPaymentsTab 
            payments={pendingPayments} 
            onConfirm={confirmPayment}
            onReject={rejectPayment}
            onRefresh={fetchPendingPayments}
          />
        )}
        {activeTab === 'reports' && <ReportsTab />}
      </main>

      {showModal && <AddMemberModal onClose={() => setShowModal(false)} onAddMember={handleAddMember} user={user} />}
      {notification.show && <Notification message={notification.message} type={notification.type} />}
    </div>
  );
};


// Updated Overview Tab Component with Pending Payments Section
const OverviewTab = ({ stats, recentMembers, dailyPayments, pendingPayments, onAddMember, onViewMembers, onConfirmPayment, onRejectPayment }) => {
  return (
    <div className="px-4 py-6">
      {/* Stats Grid - Updated with Pending Payments */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Members</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {stats.total_members || 0}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Active Members</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {stats.active_members || 0}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Contributions</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              ₦{(stats.total_contributions || 0).toLocaleString()}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">This Month</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              ₦{(stats.monthly_contributions || 0).toLocaleString()}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Today's Payments</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">
              ₦{(stats.daily_contributions || 0).toLocaleString()}
            </dd>
            <dd className="text-sm text-gray-500 mt-1">
              {stats.daily_count || 0} transactions
            </dd>
          </div>
        </div>

        {/* NEW: Pending Payments Stat */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Pending Confirmations</dt>
            <dd className="mt-1 text-3xl font-semibold text-yellow-600">
              {stats.pending_payments || 0}
            </dd>
            <dd className="text-sm text-gray-500 mt-1">
              Awaiting action
            </dd>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex space-x-4">
          <button
            onClick={onAddMember}
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-medium transition"
          >
            Add New Member
          </button>
          <button
            onClick={onViewMembers}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-6 py-3 rounded-lg font-medium transition"
          >
            View All Members
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Members */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Members
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {recentMembers.length > 0 ? (
              <div className="space-y-4">
                {recentMembers.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {member.phone} • Card: {member.card_number}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      member.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : member.status === 'inactive'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {member.status || 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No members found</p>
            )}
          </div>
        </div>

        {/* Pending Payments - NEW */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Pending Payment Confirmations
              </h3>
              {pendingPayments.length > 0 && (
                <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
                  {pendingPayments.length} pending
                </span>
              )}
            </div>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {pendingPayments.length > 0 ? (
              <div className="space-y-4">
                {pendingPayments.slice(0, 3).map((payment) => (
                  <div key={payment.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{payment.member_name}</h4>
                        <p className="text-sm text-gray-600">Card: {payment.member_card_number}</p>
                        <p className="text-lg font-semibold text-green-600">₦{payment.amount?.toLocaleString()}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          <span>Bank: {payment.bank_name}</span>
                          <span className="mx-2">•</span>
                          <span>Ref: {payment.transaction_reference}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Submitted: {new Date(payment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <button 
                        onClick={() => onConfirmPayment(payment.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition flex-1"
                      >
                        Confirm
                      </button>
                      <button 
                        onClick={() => onRejectPayment(payment.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition flex-1"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {pendingPayments.length > 3 && (
                  <p className="text-center text-sm text-amber-600 mt-2">
                    +{pendingPayments.length - 3} more pending payments
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No pending payments</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// NEW: Pending Payments Tab Component
const PendingPaymentsTab = ({ payments, onConfirm, onReject, onRefresh }) => {
  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Pending Payment Confirmations
        </h2>
        <button
          onClick={onRefresh}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Refresh
        </button>
      </div>

      {payments.length > 0 ? (
        <div className="grid gap-6">
          {payments.map((payment) => (
            <div key={payment.id} className="bg-white border border-yellow-300 rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{payment.member_name}</h3>
                    <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
                      Pending
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Card Number:</span>
                      <p className="text-gray-900 font-mono">{payment.member_card_number}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Amount:</span>
                      <p className="text-green-600 font-bold">₦{payment.amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Bank:</span>
                      <p className="text-gray-900">{payment.bank_name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Reference:</span>
                      <p className="text-gray-900 font-mono text-xs">{payment.transaction_reference}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Payment Type:</span>
                      <p className="text-gray-900 capitalize">{payment.payment_type}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Submitted:</span>
                      <p className="text-gray-900">{new Date(payment.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  {payment.transfer_date && (
                    <div className="mt-2">
                      <span className="font-medium text-gray-700">Transfer Date:</span>
                      <p className="text-gray-900">{new Date(payment.transfer_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button 
                  onClick={() => onConfirm(payment.id)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center justify-center flex-1"
                >
                  ✅ Confirm Payment
                </button>
                <button 
                  onClick={() => onReject(payment.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center justify-center flex-1"
                >
                  ❌ Reject Payment
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Pending Payments</h3>
          <p className="text-gray-600">All payments have been processed. Check back later for new submissions.</p>
        </div>
      )}
    </div>
  );
};

// Keep the existing DailyPaymentsTab, MembersTab, ContributionsTab, ReportsTab, AddMemberModal, and Notification components exactly as they were...

// Daily Payments Tab Component - Updated for card numbers
// Fixed Daily Payments Tab Component
// Fixed DailyPaymentsTab component
const DailyPaymentsTab = ({ payments, onRefresh }) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Filter payments for today only using the date field from API
  const todaysPayments = payments.filter(payment => {
    return payment.date === today;
  });
  
  const totalAmount = todaysPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">
          Today's Payments ({today})
        </h2>
        <button
          onClick={onRefresh}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-2xl font-bold text-green-600">₦{totalAmount.toLocaleString()}</p>
          <p className="text-gray-600">Total Collected Today</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">{todaysPayments.length}</p>
          <p className="text-gray-600">Transactions Today</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-xl font-bold text-purple-600">{today}</p>
          <p className="text-gray-600">Date</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {todaysPayments.length > 0 ? (
            <div className="space-y-4">
              {todaysPayments.map((payment) => (
                <div key={payment.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{payment.member_name}</p>
                      <p className="text-sm text-gray-600">Card: {payment.card_number}</p>
                      <p className="text-xs text-gray-500 capitalize">{payment.payment_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">₦{payment.amount?.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">
                        {/* Use the formatted time from API */}
                        {payment.time || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No payments recorded today</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Members Tab Component - Updated with clickable member names
const MembersTab = ({ members, onRefresh }) => {
  const navigate = useNavigate();
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

 const handleViewMemberDashboard = (member) => {
  // Updated to match the new Django URL pattern
  navigate(`/admin/members/${member.id}/dashboard/`, { state: { member } });
};

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">All Members ({members.length})</h2>
        <button
          onClick={onRefresh}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Refresh
        </button>
      </div>
      
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            All Members
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {members.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Card Number
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Join Date
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <button
                          onClick={() => handleViewMemberDashboard(member)}
                          className="text-amber-600 hover:text-amber-700 font-medium hover:underline text-left"
                        >
                          {member.first_name} {member.last_name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.card_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(member.join_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                          member.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : member.status === 'inactive'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {member.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewMemberDashboard(member)}
                          className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-md text-xs font-medium transition"
                        >
                          View Dashboard
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No members found</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Contributions Tab Component - Updated for card numbers
const ContributionsTab = ({ contributions }) => {
  return (
    <div className="px-4 py-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Contributions Management
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {contributions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card Number</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contributions.map((c) => (
                    <tr key={c.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {c.member_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {c.card_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ₦{c.amount?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {c.date ? new Date(c.date).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No contributions found</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Reports Tab Component
const ReportsTab = () => {
  return (
    <div className="px-4 py-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Reports & Analytics
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <p className="text-gray-500 text-center py-4">
            Reports and analytics feature coming soon...
          </p>
        </div>
      </div>
    </div>
  );
};

// Add Member Modal Component - Updated with required card number
const AddMemberModal = ({ onClose, onAddMember, user }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    surname: '',
    phone: '',
    address: '',
    email: '',
    card_number: '', // Now required
    passport: null,
    kinName: '',
    kinSurname: '',
    kinPhone: '',
    kinAddress: '',
  });

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onAddMember(formData);
    } catch (error) {
      console.error('Error in form submission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file') {
      setFormData({
        ...formData,
        [name]: files[0] || null
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const nextStep = () => {
    // Card number is now required
    if (!formData.first_name || !formData.surname || !formData.phone || !formData.card_number) {
      alert('Please fill in all required fields including card number');
      return;
    }
    setStep(2);
  };

  const prevStep = () => {
    setStep(1);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Add New Member {step === 1 ? '(Basic Info)' : '(Next of Kin)'}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isSubmitting}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Passport Photo (Optional)</label>
                <input
                  type="file"
                  name="passport"
                  accept="image/*"
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Surname *</label>
                <input
                  type="text"
                  name="surname"
                  value={formData.surname}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Card Number *</label>
                <input
                  type="text"
                  name="card_number"
                  value={formData.card_number}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g., 001, 002, etc."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be unique within your group
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                  disabled={isSubmitting}
                  placeholder="member@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Address (Optional)</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="2"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h4 className="font-medium text-gray-900">Next of Kin Information (Optional)</h4>
                <p className="text-sm text-gray-500 mt-1">All fields are optional</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    name="kinName"
                    value={formData.kinName}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    disabled={isSubmitting}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Surname</label>
                  <input
                    type="text"
                    name="kinSurname"
                    value={formData.kinSurname}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  name="kinPhone"
                  value={formData.kinPhone}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  name="kinAddress"
                  value={formData.kinAddress}
                  onChange={handleChange}
                  rows="2"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md disabled:opacity-50 flex items-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    'Add Member'
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// Notification Component
const Notification = ({ message, type }) => (
  <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
    type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
  }`}>
    {message}
  </div>
);

export default GroupAdminDashboard;