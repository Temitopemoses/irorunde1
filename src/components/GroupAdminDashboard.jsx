// GroupAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const GroupAdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});
  const [recentMembers, setRecentMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [dailyPayments, setDailyPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const navigate = useNavigate();

  const API_BASE = 'https://irorunde1-production.up.railway.app/api';

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const userObj = JSON.parse(userData);
      if (userObj.role !== 'group_admin') {
        navigate('/login');
        return;
      }
      setUser(userObj);
      fetchDashboardData();
      fetchContributions();
    } catch (error) {
      console.error('Error parsing user data:', error);
      navigate('/login');
    }
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const membersResponse = await fetch(`${API_BASE}/accounts/group-admin/members/`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      let membersData = [];
      if (membersResponse.ok) {
        membersData = await membersResponse.json();
      } else {
        console.warn('Failed to fetch /members/, trying alternative endpoints...');
        membersData = await tryAlternativeEndpoints(token);
      }

      const formattedMembers = (Array.isArray(membersData) ? membersData :
        membersData.results ? membersData.results :
        membersData.members ? membersData.members : []
      ).map(member => ({
        id: member.id,
        first_name: member.user?.first_name || member.first_name,
        last_name: member.user?.last_name || member.last_name || member.surname,
        phone: member.phone,
        join_date: member.registration_date || member.join_date,
        status: member.status || 'active',
        membership_number: member.membership_number,
        email: member.user?.email || member.email,
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

  // ✅ FIXED: Correct API endpoint
  const fetchContributions = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/payment-history/`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Contributions data loaded:", data);
        
        const formatted = Array.isArray(data) ? data.map(c => ({
          id: c.id,
          member_name: `${c.member?.user?.first_name || ''} ${c.member?.user?.last_name || ''}`.trim() || 'Unknown Member',
          membership_number: c.member?.membership_number || 'N/A',
          amount: c.amount || 0,
          date: c.date || c.created_at,
          payment_type: c.payment_type || 'contribution'
        })) : [];
        
        setContributions(formatted);

        // Calculate daily payments
        const today = new Date().toISOString().split('T')[0];
        const dailyPaymentsData = formatted.filter(c => 
          c.date && c.date.toString().startsWith(today)
        );
        setDailyPayments(dailyPaymentsData);

        const totalContributions = formatted.reduce((sum, c) => sum + (c.amount || 0), 0);
        const currentMonth = new Date().getMonth();
        const monthlyContributions = formatted
          .filter(c => c.date && new Date(c.date).getMonth() === currentMonth)
          .reduce((sum, c) => sum + (c.amount || 0), 0);
        
        const dailyContributions = dailyPaymentsData.reduce((sum, c) => sum + (c.amount || 0), 0);

        setStats(prev => ({
          ...prev,
          total_contributions: totalContributions,
          monthly_contributions: monthlyContributions,
          daily_contributions: dailyContributions,
          daily_count: dailyPaymentsData.length
        }));
      } else {
        console.error('❌ Failed to fetch contributions:', response.status);
        showNotification('Failed to load payment data', 'error');
      }
    } catch (error) {
      console.error('❌ Error fetching contributions:', error);
      showNotification('Error loading payment data', 'error');
    }
  };

  // ✅ ADDED: Missing function
  const tryAlternativeEndpoints = async (token) => {
    const endpoints = [
      `${API_BASE}/accounts/members/`,
      `${API_BASE}/members/`,
      `${API_BASE}/group-admin/members/`
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

  const handleAddMember = async (formData) => {
    const token = localStorage.getItem('token');
    const memberData = new FormData();
    Object.keys(formData).forEach(key => { 
      if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
        memberData.append(key, formData[key]);
      }
    });

    try {
      const response = await fetch(`${API_BASE}/accounts/group-admin/members/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: memberData
      });

      if (response.ok) {
        await fetchDashboardData();
        showNotification(`Member ${formData.first_name} added successfully!`);
        setShowModal(false);
      } else {
        const errorData = await response.json();
        showNotification(`Failed to add member: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showNotification('Error adding member', 'error');
    }
  };

  const handleLogout = () => {
    ['token', 'refreshToken', 'user', 'userData'].forEach(key => localStorage.removeItem(key));
    navigate('/login');
  };

  const handleViewAllMembers = () => setActiveTab('members');

  const handleRefreshData = () => {
    setLoading(true);
    Promise.all([fetchDashboardData(), fetchContributions()])
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

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['overview', 'members', 'contributions', 'daily-payments', 'reports'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
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
            onAddMember={() => setShowModal(true)} 
            onViewMembers={handleViewAllMembers} 
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
        {activeTab === 'reports' && <ReportsTab />}
      </main>

      {showModal && <AddMemberModal onClose={() => setShowModal(false)} onAddMember={handleAddMember} user={user} />}
      {notification.show && <Notification message={notification.message} type={notification.type} />}
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ stats, recentMembers, dailyPayments, onAddMember, onViewMembers }) => {
  return (
    <div className="px-4 py-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 mb-8">
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
                      <p className="text-sm text-gray-500">{member.phone} {member.membership_number && `• ${member.membership_number}`}</p>
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

        {/* Today's Payments */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Today's Payments
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {dailyPayments.length > 0 ? (
              <div className="space-y-3">
                {dailyPayments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {payment.member_name}
                      </p>
                      <p className="text-xs text-gray-500">{payment.membership_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">
                        ₦{payment.amount?.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {payment.date ? new Date(payment.date).toLocaleTimeString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
                {dailyPayments.length > 5 && (
                  <p className="text-center text-sm text-amber-600 mt-2">
                    +{dailyPayments.length - 5} more payments today
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No payments today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Daily Payments Tab Component
const DailyPaymentsTab = ({ payments, onRefresh }) => {
  const today = new Date().toISOString().split('T')[0];
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

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
          <p className="text-2xl font-bold text-blue-600">{payments.length}</p>
          <p className="text-gray-600">Transactions Today</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-xl font-bold text-purple-600">{today}</p>
          <p className="text-gray-600">Date</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {payments.length > 0 ? (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{payment.member_name}</p>
                      <p className="text-sm text-gray-600">{payment.membership_number}</p>
                      <p className="text-xs text-gray-500 capitalize">{payment.payment_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">₦{payment.amount?.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">
                        {payment.date ? new Date(payment.date).toLocaleTimeString() : 'N/A'}
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

// Members Tab Component
const MembersTab = ({ members, onRefresh }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
                      Membership No.
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {member.first_name} {member.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.membership_number || 'Pending'}
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

// Contributions Tab Component
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
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membership No.</th>
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
                        {c.membership_number}
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

// Add Member Modal Component
const AddMemberModal = ({ onClose, onAddMember, user }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    surname: '',
    phone: '',
    address: '',
    group: user?.managed_group?.name || '',
    kinName: '',
    kinSurname: '',
    kinPhone: '',
    kinAddress: '',
    paymentConfirmed: true
  });

  const [step, setStep] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddMember(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const nextStep = () => {
    if (!formData.first_name || !formData.surname || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }
    setStep(2);
  };

  const prevStep = () => {
    setStep(1);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Add New Member {step === 1 ? '(Basic Info)' : '(Next of Kin)'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Passport Photo</label>
                <input
                  type="file"
                  name="passport"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, passport: e.target.files[0] })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
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
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md"
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
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  name="kinAddress"
                  value={formData.kinAddress}
                  onChange={handleChange}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md"
                >
                  Add Member
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