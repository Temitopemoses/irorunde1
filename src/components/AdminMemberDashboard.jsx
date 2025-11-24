import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const MemberDashboardView = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [memberData, setMemberData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [groupAccount, setGroupAccount] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [bankName, setBankName] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [paymentCategory, setPaymentCategory] = useState("savings");
  const [memberFixedDeposits, setMemberFixedDeposits] = useState([]);
  const [loadingFixedDeposits, setLoadingFixedDeposits] = useState(false);

  // Loan management states
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanType, setLoanType] = useState("regular");
  const [purpose, setPurpose] = useState("");
  const [loadingLoan, setLoadingLoan] = useState(false);
  const [memberLoans, setMemberLoans] = useState([]);

 const API_URL = "https://irorunde1-production.up.railway.app/api";
  const API_BASE = `${API_URL}/`;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      navigate('/login');
      return;
    }

    if (location.state?.member) {
      setMemberData(location.state.member);
    }

    fetchMemberDashboardData(memberId, token);
  }, [memberId, navigate, location]);

  const fetchMemberDashboardData = async (memberId, token) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE}admin/members/${memberId}/dashboard/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
        setError(null);
        
        // Fetch data sequentially
        await fetchPaymentHistory(memberId, token);
        await fetchGroupAccount(token);
        await fetchMemberLoans(memberId, token);
        await fetchMemberFixedDeposits(memberId, token);

      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load member dashboard');
      }
    } catch (err) {
      console.error('Error fetching member dashboard:', err);
      setError('Network error loading member dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Fetch payment history for member
  const fetchPaymentHistory = async (memberId, token) => {
    try {
      const response = await fetch(`${API_BASE}admin/members/${memberId}/payments/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data);
        return data;
      } else {
        console.error("Failed to load payment history:", response.status);
        return [];
      }
    } catch (err) {
      console.error("Payment history fetch error:", err);
      return [];
    }
  };

  // Fetch member loans
  const fetchMemberLoans = async (memberId, token) => {
    try {
      const response = await fetch(`${API_BASE}admin/members/${memberId}/loans/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMemberLoans(data);
      } else {
        console.error("Failed to load member loans:", response.status);
      }
    } catch (err) {
      console.error("Member loans fetch error:", err);
    }
  };

  // Enhanced fixed deposits fetch with better error handling
  const fetchMemberFixedDeposits = async (memberId, token) => {
    setLoadingFixedDeposits(true);
    try {
      console.log('Fetching fixed deposits for member:', memberId);
      
      // Try multiple possible endpoints
      const endpoints = [
        `${API_BASE}admin/members/${memberId}/fixed-deposits/`,
        `${API_BASE}fixed-deposits/member/${memberId}/`,
        `${API_BASE}members/${memberId}/fixed-deposits/`,
        `${API_BASE}fixed-deposits/?member=${memberId}`,
        `${API_BASE}admin/fixed-deposits/?member=${memberId}`
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
              setMemberFixedDeposits(fixedDepositsData);
              success = true;
              break; // Exit loop if successful
            }
          } else {
            console.log(`Endpoint ${endpoint} failed with status:`, response.status);
          }
        } catch (err) {
          console.log(`Endpoint ${endpoint} error:`, err);
        }
      }

      // If no fixed deposits found via API, create from payment history
      if (!success) {
        console.log('No fixed deposits found via API, checking payment history...');
        await createFixedDepositsFromPaymentHistory();
      }
      
    } catch (err) {
      console.error("All fixed deposit endpoints failed:", err);
      await createFixedDepositsFromPaymentHistory();
    } finally {
      setLoadingFixedDeposits(false);
    }
  };

  // FIXED: Handle fixed deposit collection WITHOUT page reload
  const handleCollectFixedDeposit = async (fixedDepositId) => {
    const token = localStorage.getItem('accessToken');
    
    if (!confirm("Are you sure you want to mark this fixed deposit as collected? This action cannot be undone.")) {
      return;
    }

    try {
      console.log('=== COLLECTING FIXED DEPOSIT ===');
      console.log('Fixed Deposit ID from click:', fixedDepositId);
      console.log('All memberFixedDeposits:', memberFixedDeposits);
      
      // More robust ID matching
      const fixedDeposit = memberFixedDeposits.find(fd => {
        const fdId = fd.id?.toString();
        const clickId = fixedDepositId?.toString();
        console.log(`Comparing: ${fdId} with ${clickId}`);
        return fdId === clickId;
      });
      
      if (!fixedDeposit) {
        console.error('Fixed deposit not found!');
        console.error('Available IDs:', memberFixedDeposits.map(fd => fd.id));
        alert("Fixed deposit not found! Please refresh and try again.");
        return;
      }

      console.log('Found fixed deposit:', fixedDeposit);

      // Check if it's temporary
      const isTemporaryDeposit = fixedDepositId.includes('temp-') || 
                               (fixedDeposit._source && fixedDeposit._source === 'payment_history');

      if (isTemporaryDeposit) {
        console.log('Handling temporary fixed deposit...');
        
        // Create updated deposits array
        const updatedDeposits = memberFixedDeposits.map(fd => {
          const fdId = fd.id?.toString();
          const clickId = fixedDepositId?.toString();
          if (fdId === clickId) {
            return { 
              ...fd, 
              is_active: false, 
              collected_at: new Date().toISOString(),
              status: 'collected'
            };
          }
          return fd;
        });
        
        console.log('Updated deposits:', updatedDeposits);
        
        // Update state IMMEDIATELY - no refresh
        setMemberFixedDeposits(updatedDeposits);
        
        // Calculate new total from UPDATED data
        const activeDeposits = updatedDeposits.filter(fd => fd.is_active !== false);
        const activeDepositsTotal = activeDeposits.reduce((sum, deposit) => 
          sum + (parseFloat(deposit.amount) || 0), 0
        );
        
        console.log('Active deposits after collection:', activeDeposits);
        console.log('New fixed deposits total:', activeDepositsTotal);
        
        // Update dashboard data IMMEDIATELY - no refresh
        setDashboardData(prev => {
          if (!prev || !prev.financial_summary) return prev;
          
          return {
            ...prev,
            financial_summary: {
              ...prev.financial_summary,
              fixed_deposits: activeDepositsTotal,
              // Also update any other related fields if needed
              active_fixed_deposits: activeDepositsTotal
            }
          };
        });
        
        // FIXED: Simple notification to member dashboard - NO REFRESH
        const updateData = {
          memberId: memberId,
          timestamp: Date.now(),
          action: 'collected',
          depositId: fixedDepositId,
          amount: fixedDeposit.amount,
          type: 'fixed_deposit_update'
        };
        
        // Only use localStorage notification - NO triggers that cause refresh
        localStorage.setItem('member_dashboard_update', JSON.stringify(updateData));
        
        console.log('Notified member dashboard - NO REFRESH TRIGGERED');
        
        alert("✅ Fixed deposit marked as collected!");
        
      } else {
        console.log('Handling real fixed deposit via API...');
        
        const endpoints = [
          `${API_BASE}admin/fixed-deposits/${fixedDepositId}/collect/`,
          `${API_BASE}fixed-deposits/${fixedDepositId}/collect/`,
          `${API_BASE}admin/fixed-deposits/${fixedDepositId}/mark-collected/`,
        ];

        let success = false;

        for (const endpoint of endpoints) {
          try {
            console.log('Trying endpoint:', endpoint);
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });
            
            if (response.ok) {
              console.log('Success with endpoint:', endpoint);
              success = true;
              break;
            }
          } catch (err) {
            console.log(`Endpoint ${endpoint} error:`, err);
          }
        }

        if (success) {
          alert("✅ Fixed deposit marked as collected!");
          
          // FIXED: Simple notification only - NO REFRESH
          const updateData = {
            memberId: memberId,
            timestamp: Date.now(),
            action: 'collected',
            depositId: fixedDepositId,
            amount: fixedDeposit.amount,
            type: 'fixed_deposit_update'
          };
          
          // Only use localStorage notification - NO triggers that cause refresh
          localStorage.setItem('member_dashboard_update', JSON.stringify(updateData));
          
          // Update local state immediately
          const updatedDeposits = memberFixedDeposits.map(fd => {
            const fdId = fd.id?.toString();
            const clickId = fixedDepositId?.toString();
            if (fdId === clickId) {
              return { 
                ...fd, 
                is_active: false, 
                collected_at: new Date().toISOString(),
                status: 'collected'
              };
            }
            return fd;
          });
          
          setMemberFixedDeposits(updatedDeposits);
          
          // Calculate new total from UPDATED data
          const activeDeposits = updatedDeposits.filter(fd => fd.is_active !== false);
          const activeDepositsTotal = activeDeposits.reduce((sum, deposit) => 
            sum + (parseFloat(deposit.amount) || 0), 0
          );
          
          // Update dashboard data immediately
          setDashboardData(prev => {
            if (!prev || !prev.financial_summary) return prev;
            
            return {
              ...prev,
              financial_summary: {
                ...prev.financial_summary,
                fixed_deposits: activeDepositsTotal,
                active_fixed_deposits: activeDepositsTotal
              }
            };
          });
          
          console.log('Notified member dashboard - NO REFRESH TRIGGERED');
          
        } else {
          alert("Unable to collect fixed deposit via API. Please try again.");
        }
      }
    } catch (error) {
      console.error("Fixed deposit collection error:", error);
      alert("Error collecting fixed deposit. Please try again.");
    }
  };

  // FIXED: Calculate active fixed deposits total
  const getActiveFixedDepositsTotal = () => {
    // Use memberFixedDeposits state as primary source
    if (memberFixedDeposits.length > 0) {
      const activeDeposits = memberFixedDeposits.filter(fd => fd.is_active !== false);
      const total = activeDeposits.reduce((sum, deposit) => sum + (parseFloat(deposit.amount) || 0), 0);
      console.log('Active deposits from memberFixedDeposits:', activeDeposits, 'Total:', total);
      return total;
    }
    
    // Fallback to dashboard data
    console.log('Using dashboard data for fixed deposits:', dashboardData.financial_summary?.fixed_deposits);
    return dashboardData.financial_summary?.fixed_deposits || 0;
  };

  // FIXED: Calculate collected fixed deposits total
  const getCollectedFixedDepositsTotal = () => {
    // Use memberFixedDeposits state as primary source
    if (memberFixedDeposits.length > 0) {
      const collectedDeposits = memberFixedDeposits.filter(fd => fd.is_active === false);
      return collectedDeposits.reduce((sum, deposit) => sum + (parseFloat(deposit.amount) || 0), 0);
    }
    
    return 0;
  };

  // Create fixed deposits from payment history as fallback
  const createFixedDepositsFromPaymentHistory = async () => {
    try {
      console.log('Creating fixed deposits from payment history...');
      console.log('Current paymentHistory state:', paymentHistory);
      
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
          member: memberId,
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

  // Refresh fixed deposits manually
  const refreshFixedDeposits = async () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      await fetchMemberFixedDeposits(memberId, token);
    }
  };

  // Update group account endpoint - with better error handling
  const fetchGroupAccount = async (token) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/payments/group-account/", {
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

  // Admin grant loan to member
  const handleGrantLoan = async () => {
    const token = localStorage.getItem('accessToken');

    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      alert("Please enter a valid loan amount.");
      return;
    }

    try {
      setLoadingLoan(true);

      const response = await fetch(`${API_BASE}admin/members/${memberId}/grant-loan/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(loanAmount),
          loan_type: loanType,
          purpose: purpose,
          admin_notes: `Loan granted by admin to member ${memberId}`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Loan granted successfully!");
        fetchMemberLoans(memberId, token);
        fetchMemberDashboardData(memberId, token);
        setShowLoanModal(false);
        resetLoanModal();
      } else {
        console.error("Loan grant failed:", data);
        alert(data.error || data.message || "Unable to grant loan. Please try again.");
      }
    } catch (error) {
      console.error("Loan grant error:", error);
      alert("Network error while granting loan.");
    } finally {
      setLoadingLoan(false);
    }
  };

  // Admin manual payment submission for member
  const handleAdminManualPayment = async () => {
    const token = localStorage.getItem('accessToken');

    if (!amount || parseFloat(amount) < 1100) {
      alert("Minimum contribution is ₦1100.");
      return;
    }

    if (!bankName || !transactionReference) {
      alert("Please provide bank name and transaction reference.");
      return;
    }

    try {
      setLoadingPayment(true);

      const response = await fetch(`${API_BASE}admin/members/${memberId}/record-payment/`, {
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
          admin_notes: `Payment recorded by admin for member ${memberId}`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Payment recorded successfully!");
        fetchPaymentHistory(memberId, token);
        fetchMemberDashboardData(memberId, token);
        setShowPaymentModal(false);
        resetModal();
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

  // Admin payment actions (confirm/reject)
  const handlePaymentAction = async (paymentId, action) => {
    const token = localStorage.getItem('accessToken');
    
    try {
      const endpoint = action === 'confirm' 
        ? `${API_BASE}admin/manual-payments/${paymentId}/confirm/`
        : `${API_BASE}admin/manual-payments/${paymentId}/reject/`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          admin_notes: `Payment ${action}ed by admin`
        }),
      });

      if (response.ok) {
        alert(`Payment ${action}ed successfully!`);
        fetchPaymentHistory(memberId, token);
        fetchMemberDashboardData(memberId, token);
      } else {
        const errorData = await response.json();
        alert(errorData.error || `Failed to ${action} payment`);
      }
    } catch (error) {
      console.error("Payment action error:", error);
      alert("Network error while processing payment action.");
    }
  };

  // Reset loan modal
  const resetLoanModal = () => {
    setLoanAmount("");
    setLoanType("regular");
    setPurpose("");
  };

  const resetModal = () => {
    setAmount("");
    setBankName("");
    setTransactionReference("");
    setTransferDate("");
    setPaymentCategory("savings");
  };

  const handleCloseModal = () => {
    setShowPaymentModal(false);
    resetModal();
  };

  // Close loan modal
  const handleCloseLoanModal = () => {
    setShowLoanModal(false);
    resetLoanModal();
  };

  const handleBackToAdmin = () => {
    navigate('/admin/dashboard');
  };

  // Function to copy account number to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Account number copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  // Helper functions for calculations
  const getTotalContributions = () => {
    return paymentHistory
      .filter(payment => payment.status === "confirmed" || payment.is_successful)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
  };

  // Calculate savings for current week
  const getSavingsThisWeek = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return paymentHistory.filter(payment => {
      if (!payment.date) return false;
      const paymentDate = new Date(payment.date);
      return paymentDate >= startOfWeek && 
             paymentDate <= endOfWeek && 
             (payment.status === "confirmed" || payment.is_successful) &&
             payment.payment_type === 'savings';
    }).reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  };

  // Calculate savings for current month
  const getSavingsThisMonth = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    return paymentHistory.filter(payment => {
      if (!payment.date) return false;
      const paymentDate = new Date(payment.date);
      return paymentDate >= startOfMonth && 
             paymentDate <= endOfMonth && 
             (payment.status === "confirmed" || payment.is_successful) &&
             payment.payment_type === 'savings';
    }).reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  };

  const getContributionsWithoutRegistration = () => {
    return paymentHistory
      .filter(payment => 
        (payment.status === "confirmed" || payment.is_successful) &&
        payment.amount !== 20300
      )
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
  };

  // Calculate loan details for display
  const calculateLoanDetails = (loan) => {
    if (loan.loan_type === 'investment') {
      return {
        monthlyPayment: 0,
        totalRepayment: loan.amount_granted,
        interestAmount: 0
      };
    }
    
    return {
      monthlyPayment: 'Auto-calculated',
      totalRepayment: 'Auto-calculated',
      interestAmount: 'Auto-applied'
    };
  };

  // Use memberFixedDeposits directly for display
  const displayFixedDeposits = memberFixedDeposits;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading member dashboard...</p>
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
            onClick={() => fetchMemberDashboardData(memberId, localStorage.getItem('accessToken'))}
            className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 mr-2"
          >
            Retry
          </button>
          <button 
            onClick={handleBackToAdmin}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
          >
            Back to Admin
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
          <p className="text-gray-600 mb-4">Unable to load member dashboard information</p>
          <button 
            onClick={handleBackToAdmin}
            className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700"
          >
            Back to Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

  console.log('Display fixed deposits:', displayFixedDeposits);
  console.log('Payment history:', paymentHistory);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToAdmin}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                ← Back to Admin
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Member Dashboard - {dashboardData.member_info?.name || 'Member View'}
                </h1>
                <p className="text-gray-600">
                  Viewing dashboard for {dashboardData.member_info?.name} 
                  {dashboardData.member_info?.card_number && ` (Card: ${dashboardData.member_info.card_number})`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500 bg-yellow-100 px-3 py-1 rounded-full">
                Admin View Mode
              </span>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 text-sm"
              >
                Record Payment
              </button>
              <button
                onClick={() => setShowLoanModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
              >
                Grant Loan
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['overview', 'loans', 'fixed-deposits', 'payment-history'].map(tab => (
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
        <div className="px-4 py-6 sm:px-0">
          
          {/* Group Account Information - ADMIN VIEW */}
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
                    <p className="text-sm">Group Account for Payments</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Member Info Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center space-x-6">
                {dashboardData.member_info?.passport_photo ? (
                  <div className="flex-shrink-0">
                    <img
                      src={dashboardData.member_info.passport_photo}
                      alt="Passport"
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
                <div className="flex-1">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {dashboardData.member_info?.name}
                  </h3>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">Card Number:</span> {dashboardData.member_info?.card_number}
                    </div>
                    <div>
                      <span className="font-medium">Group:</span> {dashboardData.member_info?.group}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> 
                      <span className={`ml-1 capitalize ${
                        dashboardData.member_info?.status === 'active' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {dashboardData.member_info?.status}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Phone:</span> {dashboardData.member_info?.phone || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Financial Summary Cards */}
              {dashboardData.financial_summary && (
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Financial Summary</h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Total Savings */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Total Savings</dt>
                              <dd className="text-lg font-medium text-gray-900">
                                ₦{dashboardData.financial_summary.total_savings?.toLocaleString() || '0'}
                              </dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Outstanding Loans */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Outstanding Loans</dt>
                              <dd className="text-lg font-medium text-gray-900">
                                ₦{dashboardData.financial_summary.outstanding_loans?.toLocaleString() || '0'}
                              </dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fixed Deposits */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Active Fixed Deposits</dt>
                              <dd className="text-lg font-medium text-gray-900">
                                ₦{getActiveFixedDepositsTotal().toLocaleString()}
                              </dd>
                              <dt className="text-sm font-medium text-gray-500 truncate mt-1">Collected Fixed Deposits</dt>
                              <dd className="text-sm font-medium text-green-600">
                                ₦{getCollectedFixedDepositsTotal().toLocaleString()}
                              </dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Investment Loans */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                            <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Investment Loans</dt>
                              <dd className="text-lg font-medium text-gray-900">
                                ₦{dashboardData.financial_summary.investment_loans?.toLocaleString() || '0'}
                              </dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Savings Metrics */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mt-5">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Savings</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                          ₦{dashboardData.financial_summary?.total_savings?.toLocaleString() || '0'}
                        </dd>
                      </div>
                    </div>
                    
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Savings This Week</dt>
                        <dd className="mt-1 text-3xl font-semibold text-green-600">
                          ₦{getSavingsThisWeek().toLocaleString()}
                        </dd>
                      </div>
                    </div>
                    
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Savings This Month</dt>
                        <dd className="mt-1 text-3xl font-semibold text-blue-600">
                          ₦{getSavingsThisMonth().toLocaleString()}
                        </dd>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loans Tab */}
          {activeTab === 'loans' && (
            <div className="space-y-6">
              {/* Loan Management Section */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Loan Management
                    </h3>
                    <div className="space-x-2">
                      <button
                        onClick={() => {
                          setShowLoanModal(true);
                          setLoanType("regular");
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Grant Regular Loan
                      </button>
                      <button
                        onClick={() => {
                          setShowLoanModal(true);
                          setLoanType("investment");
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Grant Investment Loan
                      </button>
                    </div>
                  </div>

                  {/* Member's Current Loans */}
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Current Loans ({memberLoans.length})
                    </h4>
                    {memberLoans.length > 0 ? (
                      <div className="space-y-4">
                        {memberLoans.map((loan) => (
                          <div key={loan.id} className={`p-4 rounded-lg border ${
                            loan.loan_type === 'investment' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h5 className="font-medium text-gray-900 capitalize">
                                  {loan.loan_type || 'regular'} Loan
                                </h5>
                                <p className="text-sm text-gray-600">Status: 
                                  <span className={`ml-1 ${
                                    loan.status === 'active' ? 'text-green-600' : 
                                    loan.status === 'pending' ? 'text-yellow-600' : 
                                    loan.status === 'completed' ? 'text-blue-600' :
                                    loan.status === 'defaulted' ? 'text-red-600' :
                                    'text-gray-600'
                                  }`}>
                                    {loan.status || 'pending'}
                                  </span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">
                                  ₦{(loan.amount_granted || loan.amount || 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {loan.loan_type === 'regular' ? '2% interest every 4 weeks' : 'Investment Loan'}
                                </p>
                              </div>
                            </div>
                            
                            {/* Loan details based on your actual Loan model */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Remaining Balance:</span> 
                                <br />₦{(loan.remaining_balance || loan.amount_granted || loan.amount || 0).toLocaleString()}
                              </div>
                              <div>
                                <span className="font-medium">Total Interest:</span> 
                                <br />₦{(loan.total_interest_added || 0).toLocaleString()}
                              </div>
                              <div>
                                <span className="font-medium">Pending Penalty:</span> 
                                <br />₦{(loan.pending_penalty || 0).toLocaleString()}
                              </div>
                              <div>
                                <span className="font-medium">Interest Weeks:</span> 
                                <br />{loan.interest_weeks || 0} weeks
                              </div>
                            </div>
                            
                            {/* Show interest rate only for investment loans */}
                            {loan.loan_type === 'investment' && loan.interest_rate && (
                              <div className="mt-2 text-sm text-gray-600">
                                <span className="font-medium">Interest Rate:</span> {loan.interest_rate}%
                              </div>
                            )}
                            
                            {loan.purpose && (
                              <p className="text-sm text-gray-500 mt-2">
                                <span className="font-medium">Purpose:</span> {loan.purpose}
                              </p>
                            )}
                            
                            {loan.granted_at && (
                              <p className="text-xs text-gray-400 mt-1">
                                Granted: {new Date(loan.granted_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Loans</h3>
                        <p className="text-gray-500 mb-4">This member doesn't have any active loans.</p>
                      </div>
                    )}
                  </div>

                  {/* Loan Eligibility & Limits */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-md font-medium text-blue-900 mb-2">Loan Eligibility</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-700">Maximum Loan Amount:</span>
                        <p className="text-blue-900">₦{dashboardData.financial_summary?.total_savings ? (dashboardData.financial_summary.total_savings * 3).toLocaleString() : '0'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Available for Loan:</span>
                        <p className="text-green-600">₦{dashboardData.financial_summary?.total_savings ? (dashboardData.financial_summary.total_savings * 2).toLocaleString() : '0'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Current Utilization:</span>
                        <p className="text-orange-600">
                          {dashboardData.financial_summary?.total_savings && dashboardData.financial_summary?.outstanding_loans ? 
                            Math.round((dashboardData.financial_summary.outstanding_loans / (dashboardData.financial_summary.total_savings * 3)) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fixed Deposits Tab */}
          {activeTab === 'fixed-deposits' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Fixed Deposit Management
                    </h3>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        Total: {displayFixedDeposits.length}
                      </div>
                      <button
                        onClick={refreshFixedDeposits}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* Loading State */}
                  {loadingFixedDeposits ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading fixed deposits...</p>
                    </div>
                  ) : (
                    <>
                      {/* Active Fixed Deposits */}
                      <div className="mb-6">
                        <h4 className="text-md font-medium text-gray-900 mb-3">
                          Active Fixed Deposits ({displayFixedDeposits.filter(fd => fd.is_active !== false).length})
                        </h4>
                        
                        {displayFixedDeposits.filter(fd => fd.is_active !== false).length > 0 ? (
                          <div className="space-y-4">
                            {displayFixedDeposits.filter(fd => fd.is_active !== false).map((fixedDeposit) => (
                              <div key={fixedDeposit.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h5 className="font-medium text-gray-900">
                                      {typeof fixedDeposit.id === 'string' && fixedDeposit.id.includes('temp-') 
                                        ? 'Fixed Deposit (From Payments)' 
                                        : `Fixed Deposit #${fixedDeposit.id}`}
                                    </h5>
                                    <p className="text-sm text-gray-600">
                                      Created: {new Date(fixedDeposit.created_at).toLocaleDateString()}
                                    </p>
                                  
                                    {fixedDeposit.payment_reference && (
                                      <p className="text-sm text-gray-600">
                                        Reference: {fixedDeposit.payment_reference}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-gray-900">
                                      ₦{(fixedDeposit.amount || fixedDeposit.deposit_amount || 0).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-green-600 font-medium">Active</p>
                                  </div>
                                </div>
                                
                                {/* Additional fixed deposit details */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600 mt-3">
                                  <div>
                                    <span className="font-medium">Amount:</span> 
                                    <br />₦{(fixedDeposit.amount || fixedDeposit.deposit_amount || 0).toLocaleString()}
                                  </div>
                                  <div>
                                    <span className="font-medium">Duration:</span> 
                                    <br />{fixedDeposit.duration_months || '12'} months
                                  </div>
                                  <div>
                                    <span className="font-medium">Interest Rate:</span> 
                                    <br />{fixedDeposit.interest_rate || '0'}%
                                  </div>
                                </div>

                                {/* Collection Button - Show for ALL fixed deposits now */}
                                <div className="flex justify-end mt-3 pt-3 border-t border-blue-200">
                                  {fixedDeposit.is_active !== false ? (
                                    <button
                                      onClick={() => handleCollectFixedDeposit(fixedDeposit.id)}
                                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center"
                                    >
                                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Mark as Collected
                                    </button>
                                  ) : (
                                    <div className="flex items-center space-x-2 text-gray-600">
                                      <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="font-medium">Collected</span>
                                      {fixedDeposit.collected_at && (
                                        <span className="text-sm text-gray-500">
                                          on {new Date(fixedDeposit.collected_at).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Fixed Deposits</h3>
                            <p className="text-gray-500 mb-4">This member doesn't have any active fixed deposits.</p>
                            <div className="space-x-2">
                              <button
                                onClick={refreshFixedDeposits}
                                className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
                              >
                                Refresh Fixed Deposits
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Collected/Inactive Fixed Deposits */}
                      {displayFixedDeposits.filter(fd => fd.is_active === false).length > 0 && (
                        <div>
                          <h4 className="text-md font-medium text-gray-900 mb-3">
                            Collected Fixed Deposits ({displayFixedDeposits.filter(fd => fd.is_active === false).length})
                          </h4>
                          <div className="space-y-3">
                            {displayFixedDeposits.filter(fd => fd.is_active === false).map((fixedDeposit) => (
                              <div key={fixedDeposit.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {typeof fixedDeposit.id === 'string' && fixedDeposit.id.includes('temp-') 
                                        ? 'Fixed Deposit (From Payments)' 
                                        : `Fixed Deposit #${fixedDeposit.id}`}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Amount: ₦{(fixedDeposit.amount || fixedDeposit.deposit_amount || 0).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Collected: {fixedDeposit.collected_at ? new Date(fixedDeposit.collected_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-gray-900">
                                      ₦{(fixedDeposit.amount || fixedDeposit.deposit_amount || 0).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-500">Collected</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment History Tab */}
          {activeTab === 'payment-history' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Payment History ({paymentHistory.length} transactions)
                  </h3>
                  <button
                    onClick={() => fetchPaymentHistory(memberId, localStorage.getItem('accessToken'))}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 text-sm"
                  >
                    Refresh
                  </button>
                </div>

                {paymentHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Payment Category
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bank Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
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
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  payment.status === "confirmed" || payment.is_successful
                                    ? "bg-green-100 text-green-800"
                                    : payment.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : payment.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {payment.status || (payment.is_successful ? "confirmed" : "pending")}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                              {payment.reference_number || payment.tx_ref || payment.card_number_reference || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.bank_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.status === 'pending' && (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handlePaymentAction(payment.id, 'confirm')}
                                    className="text-green-600 hover:text-green-900 text-xs"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => handlePaymentAction(payment.id, 'reject')}
                                    className="text-red-600 hover:text-red-900 text-xs"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment History</h3>
                    <p className="text-gray-500 mb-4">This member hasn't made any payments yet.</p>
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
                    >
                      Record First Payment
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modern Admin Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Record Payment</h2>
                  <p className="text-amber-100 text-sm mt-1">For {dashboardData.member_info?.name}</p>
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
                      <h3 className="font-semibold text-emerald-800 text-sm mb-2">Group Bank Account</h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-emerald-600 font-medium">Bank:</span>
                          <span className="text-emerald-900">{groupAccount.bank_name || "Not set"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-600 font-medium">Account No:</span>
                          <span className="text-emerald-900 font-mono">{groupAccount.account_number || "Not set"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Category Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Payment Category
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
                          ? option.value === "savings" ? "border-green-500 bg-green-50 shadow-sm" :
                            option.value === "fixed_deposit" ? "border-blue-500 bg-blue-50 shadow-sm" :
                            option.value === "outstanding_balance" ? "border-yellow-500 bg-yellow-50 shadow-sm" :
                            "border-purple-500 bg-purple-50 shadow-sm"
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
                    Bank Name
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
                    placeholder="Enter transaction reference"
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                    required
                  />
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
                  onClick={handleAdminManualPayment}
                  disabled={loadingPayment || !amount || !bankName || !transactionReference || parseFloat(amount) < 1100}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                >
                  {loadingPayment ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Recording...</span>
                    </div>
                  ) : (
                    "Record Payment"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Grant Loan Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className={`p-6 ${
              loanType === 'investment' ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 
              'bg-gradient-to-r from-green-500 to-green-600'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Grant {loanType === 'investment' ? 'Investment' : 'Regular'} Loan
                  </h2>
                  <p className="text-white text-sm mt-1 opacity-90">For {dashboardData.member_info?.name}</p>
                </div>
                <button
                  onClick={handleCloseLoanModal}
                  className="text-white hover:opacity-80 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Loan Eligibility Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-blue-800 text-sm mb-2">Loan Information</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-blue-700 font-medium">Member's Savings:</span>
                    <span className="text-blue-900">₦{dashboardData.financial_summary?.total_savings?.toLocaleString() || '0'}</span>
                  </div>
                  {loanType === 'regular' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-blue-700 font-medium">Interest System:</span>
                        <span className="text-green-600">2% every 4 weeks</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700 font-medium">First Interest:</span>
                        <span className="text-green-600">After 4 weeks</span>
                      </div>
                    </>
                  )}
                  {loanType === 'investment' && (
                    <div className="flex justify-between">
                      <span className="text-blue-700 font-medium">Loan Type:</span>
                      <span className="text-purple-600">No interest applied</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Loan Details Form - SIMPLIFIED */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Loan Amount (₦)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">₦</span>
                    </div>
                    <input
                      type="number"
                      placeholder="Enter loan amount"
                      min="1"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Purpose (Optional)
                  </label>
                  <textarea
                    placeholder="Enter loan purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows="2"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                  />
                </div>

                {/* Loan Information Display */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Loan Terms</h4>
                  <div className="space-y-2 text-sm">
                    {loanType === 'regular' && (
                      <>
                        <div className="flex justify-between">
                          <span>Interest:</span>
                          <span className="text-green-600">2% every 4 weeks</span>
                        </div>
                        <div className="flex justify-between">
                          <span>First Interest:</span>
                          <span>After 4 weeks</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Penalty:</span>
                          <span className="text-red-600">₦2,500/week if no payment</span>
                        </div>
                      </>
                    )}
                    {loanType === 'investment' && (
                      <div className="flex justify-between">
                        <span>Interest:</span>
                        <span className="text-purple-600">No interest applied</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span>Amount Granted:</span>
                      <span>₦{loanAmount ? parseFloat(loanAmount).toLocaleString() : '0'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseLoanModal}
                  className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGrantLoan}
                  disabled={loadingLoan || !loanAmount}
                  className={`flex-1 px-4 py-3 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm ${
                    loanType === 'investment' ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 
                    'bg-gradient-to-r from-green-500 to-green-600'
                  }`}
                >
                  {loadingLoan ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Granting...</span>
                    </div>
                  ) : (
                    `Grant ${loanType === 'investment' ? 'Investment' : 'Regular'} Loan`
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

export default MemberDashboardView;