// Join.jsx
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";

const Join = ({ userRole = "member", token = null }) => {
  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPaymentDone, setIsPaymentDone] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [groupAccount, setGroupAccount] = useState(null);

  // Manual payment fields
  const [amount, setAmount] = useState("20300");
  const [bankName, setBankName] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [transferDate, setTransferDate] = useState("");

  const [formData, setFormData] = useState({
    group: "",
    passport: null,
    first_name: "",
    surname: "",
    phone: "",
    address: "",
    email: "",
    card_number: "",
    kinName: "",
    kinSurname: "",
    kinPhone: "",
    kinAddress: "",
  });

  // Base URL for API calls
const API_URL = "https://irorunde1-production.up.railway.app/api";

  // --- fetch groups with account details ---
  useEffect(() => {
    // Replace the fetchGroups function in your Join.jsx with this:

const fetchGroups = async () => {
  try {
    console.log("🔄 Fetching groups...");
    
    // Try multiple possible endpoints
    const endpoints = [
      `${API_URL}/admin/groups/`,
      `${API_URL}/accounts/groups/`,
      `${API_URL}/api/groups/`
    ];
    
    let groupsData = null;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${endpoint}`);
        const response = await fetch(endpoint);
        
        // Check if response is HTML (starts with <) or JSON
        const contentType = response.headers.get('content-type');
        const text = await response.text();
        
        if (contentType && contentType.includes('application/json')) {
          // It's JSON, parse it
          groupsData = JSON.parse(text);
          console.log(`✅ Groups loaded from: ${endpoint}`, groupsData);
          break;
        } else if (text.trim().startsWith('<')) {
          // It's HTML, skip this endpoint
          console.log(`❌ Endpoint returned HTML (likely 404): ${endpoint}`);
          continue;
        } else {
          // Try to parse as JSON anyway (some APIs don't set content-type properly)
          try {
            groupsData = JSON.parse(text);
            console.log(`✅ Groups loaded from: ${endpoint}`, groupsData);
            break;
          } catch (parseError) {
            console.log(`❌ Could not parse response from: ${endpoint}`);
            continue;
          }
        }
      } catch (endpointError) {
        console.log(`❌ Endpoint failed: ${endpoint}`, endpointError);
        continue;
      }
    }

    if (groupsData) {
      setGroups(groupsData);
    } else {
      console.warn("❌ All group endpoints failed, using fallback groups");
      // Fallback to default groups
      setGroups([
      { id: 1, name: "Irorunde 1", bank_name: "Polaris Bank", account_number: "1140187339", account_name: "IRORUNDE KAJOLA ITOKI (IFO) COOPERATIVE MULTIPURPOSE SOCIETY" },
      { id: 2, name: "Irorunde 2", bank_name: "Keystone Bank", account_number: "1012712510", account_name: "IRORUNDE KAJOLA TWO" },
      { id: 3, name: "Irorunde 4", bank_name: "Monie Point", account_number: "8234689690", account_name: "AJIMOTOKIN MOJISOLA" },
      { id: 4, name: "Irorunde 6", bank_name: "Keystone Bank", account_number: "1011191356", account_name: "AYILARA ABIMBOLA FATIMO" },
      { id: 5, name: "Oluwanisola", bank_name: "", account_number: "", account_name: "" },
      { id: 6, name: "Irorunde 7", bank_name: "", account_number: "", account_name: " " },
      ]);
    }
  } catch (err) {
    console.error("❌ Error in fetchGroups:", err);
    // Fallback to default groups
    setGroups([
      { id: 1, name: "Irorunde 1", bank_name: "Polaris Bank", account_number: "1140187339", account_name: "IRORUNDE KAJOLA ITOKI (IFO) COOPERATIVE MULTIPURPOSE SOCIETY" },
      { id: 2, name: "Irorunde 2", bank_name: "Keystone Bank", account_number: "1012712510", account_name: "IRORUNDE KAJOLA TWO" },
      { id: 3, name: "Irorunde 4", bank_name: "Monie Point", account_number: "8234689690", account_name: "AJIMOTOKIN MOJISOLA" },
      { id: 4, name: "Irorunde 6", bank_name: "Keystone Bank", account_number: "1011191356", account_name: "AYILARA ABIMBOLA FATIMO" },
      { id: 5, name: "Oluwanisola", bank_name: "", account_number: "", account_name: "" },
      { id: 6, name: "Irorunde 7", bank_name: "", account_number: "", account_name: " " },
    ]);
  }
};
    
    fetchGroups();
  }, []);

  // Fetch group account details when group is selected and payment modal opens
  useEffect(() => {
    if (showPaymentModal && formData.group) {
      fetchGroupAccount(formData.group);
    }
  }, [showPaymentModal, formData.group]);

  // --- fetch specific group account details ---
  const fetchGroupAccount = async (groupId) => {
    try {
      console.log("🔄 Fetching account for group:", groupId);
      
      // Try to get account details from the groups data we already have
      const selectedGroup = groups.find(group => group.id === parseInt(groupId));
      if (selectedGroup && selectedGroup.account_number) {
        console.log("✅ Found group account in groups data:", selectedGroup);
        setGroupAccount({
          bank_name: selectedGroup.bank_name,
          account_number: selectedGroup.account_number,
          account_name: selectedGroup.account_name
        });
        return;
      }

      // If not found in groups data, use fallback
      console.log("🔄 Using fallback account details");
      const fallbackAccounts = {
        1:  { bank_name: "Polaris Bank", account_number: "1140187339", account_name: "IRORUNDE KAJOLA ITOKI (IFO) COOPERATIVE MULTIPURPOSE SOCIETY" },
        2:  { bank_name: "Keystone Bank", account_number: "1012712510", account_name: "IRORUNDE KAJOLA TWO" },
        3:  { bank_name: "Monie Point", account_number: "8234689690", account_name: "AJIMOTOKIN MOJISOLA" },
        4:  { bank_name: "Keystone Bank", account_number: "1011191356", account_name: "AYILARA ABIMBOLA FATIMO" },
        5:  { bank_name: "", account_number: "", account_name: "" },
        6:  { bank_name: "", account_number: "", account_name: " " },
    };
      setGroupAccount(fallbackAccounts[groupId] || fallbackAccounts[1]);
      
    } catch (err) {
      console.error("❌ Group account fetch error:", err);
      // Set fallback account details
      const fallbackAccounts = {
        1:  { bank_name: "Polaris Bank", account_number: "1140187339", account_name: "IRORUNDE KAJOLA ITOKI (IFO) COOPERATIVE MULTIPURPOSE SOCIETY" },
        2:  { bank_name: "Keystone Bank", account_number: "1012712510", account_name: "IRORUNDE KAJOLA TWO" },
        3:  { bank_name: "Monie Point", account_number: "8234689690", account_name: "AJIMOTOKIN MOJISOLA" },
        4:  { bank_name: "Keystone Bank", account_number: "1011191356", account_name: "AYILARA ABIMBOLA FATIMO" },
        5:  { bank_name: "", account_number: "", account_name: "" },
        6:  { bank_name: "", account_number: "", account_name: " " },
      };
      setGroupAccount(fallbackAccounts[formData.group] || fallbackAccounts[1]);
    }
  };

  const handleChange = (e) => {
    const { name, value, files, type } = e.target;
    setFormData((s) => ({
      ...s,
      [name]: type === "file" ? files[0] : value,
    }));
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  // --- Manual payment submission for registration ---
  // --- Manual payment submission for registration ---
const handleManualPayment = async () => {
  if (!bankName || !transactionReference) {
    alert("Please provide bank name and transaction reference.");
    return;
  }

  if (!formData.group) {
    alert("Please select a group first.");
    return;
  }

  try {
    setLoading(true);
    console.log("🔄 Submitting registration payment...");

    // Use the correct payment endpoint for registration
    const response = await fetch(`${API_BASE}payments/registration/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        payment_type: "registration",
        bank_name: bankName,
        transaction_reference: transactionReference,
        transfer_date: transferDate || new Date().toISOString().split('T')[0],
        // Registration details for linking
        registration_phone: formData.phone,
        registration_name: `${formData.first_name} ${formData.surname}`,
        registration_email: formData.email,
        registration_card_number: formData.card_number,
        group_id: formData.group,
      }),
    });

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    let data;
    
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error("Non-JSON response:", text);
      throw new Error("Server returned non-JSON response");
    }

    if (response.ok) {
      setIsPaymentDone(true);
      setShowPaymentModal(false);
      alert("✅ Registration payment submitted successfully! Please transfer ₦20,300 to group account. Your registration will be approved once payment is confirmed by admin.");
      
      // Reset payment form
      setBankName("");
      setTransactionReference("");
      setTransferDate("");
    } else {
      console.error("❌ Payment submission failed:", data);
      alert(data.error || data.detail || data.message || "Unable to submit payment. Please try again.");
    }
  } catch (error) {
    console.error("❌ Payment submission error:", error);
    if (error.message.includes("JSON")) {
      alert("Server error. Please try again later.");
    } else {
      alert("Network error while submitting payment. Please check your connection.");
    }
  } finally {
    setLoading(false);
  }
};

  // --- registration submit (only allowed when manual payment is submitted) ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const requiredFields = ['first_name', 'surname', 'phone', 'email', 'card_number'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    // For regular members, require manual payment submission first
    if (userRole === "member" && !isPaymentDone) {
      alert("Please complete the payment process first.");
      return;
    }
  
    setLoading(true);

    // Determine the correct endpoint based on user role
    let url;
    if (userRole === "admin" || userRole === "superadmin") {
      url = `${API_URL}/auth/create-member/`;
    } else {
      url = `${API_URL}/auth/register/`;
    }

    console.log("🔄 Submitting registration to:", url);

    const data = new FormData();

    // Append all formData fields
    for (const key in formData) {
      const value = formData[key];
      if (value !== null && value !== "") {
        if (key === "group") {
          // For admin creation, use group ID; for self-registration, use group name
          if (userRole === "admin" || userRole === "superadmin") {
            data.append("group", value);
          } else {
            const selectedGroup = groups.find((g) => g.id === parseInt(value));
            if (selectedGroup) data.append("group", selectedGroup.id);
          }
        } else if (key === "passport" && formData.passport) {
          data.append("passport", formData.passport);
        } else {
          data.append(key, value);
        }
      }
    }

    // For admin-created members, mark as pre-approved
    if (userRole === "admin" || userRole === "superadmin") {
      data.append("is_approved", "true");
    }

    // For self-registration, include payment confirmation
    if (userRole === "member") {
      data.append("paymentConfirmed", "true");
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers:
          userRole === "admin" || userRole === "superadmin"
            ? { 
                "Authorization": `Bearer ${token}`,
              }
            : {},
        body: data,
      });

      // Handle response
      const contentType = response.headers.get("content-type");
      let result;
      
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server returned non-JSON response");
      }

      if (response.ok) {
        if (userRole === "member") {
          alert("✅ Registration submitted successfully! Your account will be activated once admin confirms your registration payment. You'll receive an SMS when approved.");
        } else {
          alert("✅ Member created successfully!");
        }
        
        // Reset form
        setStep(1);
        setIsPaymentDone(false);
        setFormData({
          group: "",
          passport: null,
          first_name: "",
          surname: "",
          phone: "",
          address: "",
          email: "",
          card_number: "",
          kinName: "",
          kinSurname: "",
          kinPhone: "",
          kinAddress: "",
        });

        // Redirect members to home, admins stay on page
        if (userRole === "member") {
          window.location.href = "/";
        }
      } else {
        console.error("❌ Register failed:", result);
        const errorMessage = result.error || result.detail || result.message || "Registration failed. Please check your information.";
        alert(`Registration failed: ${errorMessage}`);
      }
    } catch (err) {
      console.error("❌ Registration error:", err);
      if (err.message.includes("JSON")) {
        alert("Server error during registration. Please try again later.");
      } else {
        alert("Network error during registration. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getSelectedGroupName = () => {
    if (!formData.group) return "";
    const selectedGroup = groups.find((g) => g.id === parseInt(formData.group));
    return selectedGroup ? selectedGroup.name : `Group ${formData.group}`;
  };

  // Function to copy account number to clipboard
  const copyToClipboard = (text) => {
    if (!text) {
      alert("No account number available to copy.");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Account number copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy: ', err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("✅ Account number copied to clipboard!");
    });
  };

  // Check if step 1 is complete
  const isStep1Complete = () => {
    const baseFields = formData.first_name && formData.surname && formData.phone && formData.email && formData.card_number;
    if (userRole === "superadmin") return baseFields;
    return baseFields && formData.group && formData.address;
  };

  // Check if step 2 is complete
  const isStep2Complete = () => {
    return formData.kinName && formData.kinSurname && formData.kinPhone && formData.kinAddress;
  };

  return (
    <><Helmet>
      <title>Join Irorunde Cooperative Society</title>
      <meta
        name="description"
        content="Join Irorunde Cooperative Society today! Complete our easy 3-step registration process to become a member and enjoy financial empowerment through savings, loans, and cooperative support." />
      <link rel="canonical" href="https://irorunde-cooperative.vercel.app/join" />
    </Helmet><div className="min-h-screen bg-amber-50 flex flex-col items-center pt-24 pb-2 px-6">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-center text-amber-600 mb-6">
            Join Irorunde Cooperative Society
          </h2>

          {/* Progress Indicator */}
          <div className="flex justify-between items-center mb-8">
            {["Personal Info", "Next of Kin", "Payment & Submit"].map((label, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= index + 1 ? "bg-amber-600 text-white" : "bg-gray-300 text-gray-600"}`}
                >
                  {index + 1}
                </div>
                <p className="text-xs mt-2 text-gray-600">{label}</p>
              </div>
            ))}
          </div>

          {/* Step 1 - Personal Information */}
          {step === 1 && (
            <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
              {userRole !== "superadmin" && (
                <div>
                  <label className="text-sm text-gray-600 font-medium">Select Irorunde Group *</label>
                  <select
                    name="group"
                    value={formData.group}
                    onChange={handleChange}
                    className="border p-3 rounded-md w-full mt-1 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required
                  >
                    <option value="">-- Choose Group --</option>
                    {groups.length > 0 ? (
                      groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1">Irorunde 1</option>
                        <option value="2">Irorunde 2</option>
                        <option value="3">Irorunde 4</option>
                        <option value="4">Irorunde 6</option>
                        <option value="5">Oluwanisola</option>
                        <option value="6">Irorunde 7</option>
                      </>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {groups.length > 0 ? `${groups.length} groups available` : "Using default groups"}
                  </p>
                </div>
              )}

              {userRole !== "superadmin" && (
                <div>
                  <label className="text-sm text-gray-600 font-medium">Passport Photo *</label>
                  <input
                    type="file"
                    name="passport"
                    accept="image/*"
                    onChange={handleChange}
                    className="w-full border p-2 rounded-md mt-1 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required />
                  <p className="text-xs text-gray-500 mt-1">Upload a clear passport photograph</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    name="first_name"
                    placeholder="First Name *"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="border p-3 rounded-md w-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required />
                </div>
                <div>
                  <input
                    type="text"
                    name="surname"
                    placeholder="Surname *"
                    value={formData.surname}
                    onChange={handleChange}
                    className="border p-3 rounded-md w-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required />
                </div>
              </div>

              <input
                type="email"
                name="email"
                placeholder="Email Address *"
                value={formData.email}
                onChange={handleChange}
                className="border p-3 rounded-md w-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required />

              <input
                type="text"
                name="card_number"
                placeholder="Card Number *"
                value={formData.card_number}
                onChange={handleChange}
                className="border p-3 rounded-md w-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required />

              <input
                type="tel"
                name="phone"
                placeholder="Phone Number *"
                value={formData.phone}
                onChange={handleChange}
                className="border p-3 rounded-md w-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required />

              {userRole !== "superadmin" && (
                <textarea
                  name="address"
                  placeholder="Home Address *"
                  value={formData.address}
                  onChange={handleChange}
                  className="border p-3 rounded-md w-full h-20 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required />
              )}

              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isStep1Complete()}
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* Step 2 - Next of Kin Information */}
          {step === 2 && userRole !== "superadmin" && (
            <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Next of Kin Information</h3>
                <p className="text-xs text-blue-600">Please provide details of your next of kin for emergency contact purposes.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  name="kinName"
                  placeholder="Next of Kin First Name *"
                  value={formData.kinName}
                  onChange={handleChange}
                  className="border p-3 rounded-md w-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required />
                <input
                  type="text"
                  name="kinSurname"
                  placeholder="Next of Kin Surname *"
                  value={formData.kinSurname}
                  onChange={handleChange}
                  className="border p-3 rounded-md w-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required />
              </div>
              <input
                type="tel"
                name="kinPhone"
                placeholder="Next of Kin Phone Number *"
                value={formData.kinPhone}
                onChange={handleChange}
                className="border p-3 rounded-md w-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required />
              <textarea
                name="kinAddress"
                placeholder="Next of Kin Address *"
                value={formData.kinAddress}
                onChange={handleChange}
                className="border p-3 rounded-md w-full h-20 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              ></textarea>

              <div className="flex justify-between mt-4">
                <button 
                  type="button" 
                  onClick={prevStep} 
                  className="border border-amber-600 text-amber-600 px-6 py-2 rounded-lg hover:bg-amber-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isStep2Complete()}
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Manual Payment + Registration */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="text-center">
              <div className="bg-amber-50 p-6 rounded-lg mb-6 border border-amber-200">
                <h3 className="text-xl font-semibold text-gray-700 mb-4">Registration Summary</h3>
                <div className="text-left space-y-2 text-sm">
                  <p><strong>Name:</strong> {formData.first_name} {formData.surname}</p>
                  <p><strong>Email:</strong> {formData.email}</p>
                  <p><strong>Card Number:</strong> {formData.card_number}</p>
                  <p><strong>Phone:</strong> {formData.phone}</p>
                  {formData.group && <p><strong>Group:</strong> {getSelectedGroupName()}</p>}
                  {formData.address && <p><strong>Address:</strong> {formData.address}</p>}
                  {formData.kinName && <p><strong>Next of Kin:</strong> {formData.kinName} {formData.kinSurname}</p>}
                </div>
              </div>

              {/* Members must complete manual payment first */}
              {userRole === "member" && !isPaymentDone && (
                <>
                  <h3 className="text-xl font-semibold text-gray-700 mb-4">Registration Payment - ₦20,300</h3>
                  <p className="text-gray-600 mb-6">
                    To complete your registration, you need to pay the membership fee of <strong>₦20,300</strong> to your selected group account.
                    This payment must be confirmed by admin before you can login.
                  </p>

                  {formData.group ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition mb-4 font-semibold"
                      >
                        📝 Make Registration Payment
                      </button>
                      <p className="text-sm text-gray-500">
                        After payment submission, you'll complete registration and wait for admin approval.
                      </p>
                    </>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700">Please go back and select a group first.</p>
                    </div>
                  )}
                </>
              )}

              {/* If admin OR payment done, show Complete Registration */}
              {(userRole !== "member" || isPaymentDone) && (
                <div className="mt-6">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Registering...</span>
                      </div>
                    ) : (
                      "✅ Complete Registration"
                    )}
                  </button>
                  {userRole === "member" && (
                    <p className="text-sm text-green-600 mt-3">
                      ✅ Payment submitted! Complete registration and wait for admin approval.
                    </p>
                  )}
                </div>
              )}

              {/* Back button for step 3 */}
              {userRole !== "superadmin" && (
                <div className="mt-4">
                  <button 
                    type="button" 
                    onClick={prevStep} 
                    className="text-amber-600 hover:text-amber-700 text-sm"
                  >
                    ← Back to Previous Step
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Manual Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Registration Payment</h2>
                    <p className="text-amber-100 text-sm mt-1">
                      Pay ₦20,300 to {getSelectedGroupName()}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPaymentModal(false)}
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
                {/* Group Account Information */}
                {groupAccount ? (
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="bg-emerald-100 rounded-lg p-2">
                        <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-emerald-800 text-sm mb-2">
                          Transfer to {getSelectedGroupName()} Account
                        </h3>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-emerald-600 font-medium">Bank:</span>
                            <span className="text-emerald-900">{groupAccount.bank_name || "Not set"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-600 font-medium">Account No:</span>
                            <span className="text-emerald-900 font-mono">{groupAccount.account_number || "Not set"}</span>
                            {groupAccount.account_number && (
                              <button
                                onClick={() => copyToClipboard(groupAccount.account_number)}
                                className="ml-2 text-emerald-600 hover:text-emerald-800 transition-colors"
                                title="Copy to clipboard"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-600 font-medium">Account Name:</span>
                            <span className="text-emerald-900">{groupAccount.account_name || "Not set"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="bg-yellow-100 rounded-lg p-2">
                        <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-yellow-800 text-sm mb-2">Account Details Loading</h3>
                        <p className="text-yellow-700 text-xs">Please contact admin for {getSelectedGroupName()} account details.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount Display (Fixed for registration) */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount (₦)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">₦</span>
                    </div>
                    <input
                      type="text"
                      value="20,300"
                      disabled
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl bg-gray-100 text-gray-700 font-semibold"
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-2">Fixed registration fee</p>
                </div>

                {/* Bank Details */}
                <div className="grid grid-cols-1 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Your Bank *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g., First Bank, GTBank, etc."
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

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
                    Transaction Reference *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter bank transfer reference"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-2">Use the reference provided by your bank app</p>
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
                        <li>• Transfer exactly ₦20,300 to the {getSelectedGroupName()} account above</li>
                        <li>• Use a unique transaction reference from your bank</li>
                        <li>• Registration will be approved after payment confirmation</li>
                        <li>• Confirmation typically takes 24-48 hours</li>
                        <li>• You'll receive an SMS when your account is activated</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualPayment}
                    disabled={loading || !bankName || !transactionReference}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                  >
                    {loading ? (
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
      </div></>
  );
};

export default Join;