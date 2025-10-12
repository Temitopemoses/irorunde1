import { useState, useEffect } from "react";
import { PaystackButton } from "react-paystack";

const Join = ({ userRole = "member", token = null }) => {
  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    group: "",
    passport: null,
    first_name: "",
    surname: "",
    phone: "",
    address: "",
    kinName: "",
    kinSurname: "",
    kinPhone: "",
    kinAddress: "",
    paymentConfirmed: true,
  });

  // Fetch available groups from backend
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/accounts/groups/");
        if (response.ok) {
          const data = await response.json();
          setGroups(data);
        } else {
          console.warn("Failed to fetch groups, using fallback options");
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
      }
    };
    
    fetchGroups();
  }, []);

  const publicKey = "pk_test_xxxxxxxxxxxxxxxxxxxxxxx";
  const amount = 20300 * 100;
  const email = `${formData.first_name.toLowerCase()}@irorunde.com`;

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === "file" ? files[0] : type === "checkbox" ? checked : value,
    });
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.first_name || !formData.surname || !formData.phone) {
      alert("Please fill in all required fields");
      return;
    }
    
    setLoading(true);

    const url =
      userRole === "admin" || userRole === "superadmin"
        ? "http://127.0.0.1:8000/api/accounts/create-member/"
        : "http://127.0.0.1:8000/api/accounts/register/";

    const data = new FormData();
    
    console.log("Submitting form data:", formData);
    
    // Add all form data with proper handling
    for (const key in formData) {
      if (formData[key] !== null && formData[key] !== "") {
        if (key === 'group') {
          // Send group as NAME instead of ID
          if (formData.group) {
            // Find the group name from the ID
            const selectedGroup = groups.find(g => g.id === parseInt(formData.group));
            if (selectedGroup) {
              console.log('Sending group as NAME:', selectedGroup.name);
              data.append('group', selectedGroup.name);
            } else {
              // Fallback: use the static group names
              const groupNames = {
                '1': 'Irorunde 1',
                '2': 'Irorunde 2', 
                '3': 'Irorunde 4',
                '4': 'Irorunde 6',
                '5': 'Oluwanisola',
                '6': 'Irorunde 7'
              };
              const groupName = groupNames[formData.group] || `Group ${formData.group}`;
              console.log('Sending group as FALLBACK NAME:', groupName);
              data.append('group', groupName);
            }
          }
        } else if (key === 'passport' && formData.passport) {
          // Handle file upload
          data.append('passport', formData.passport);
        } else {
          // All other fields
          data.append(key, formData[key]);
        }
      }
    }

    // Debug: Check what we're sending
    console.log('Final FormData contents:');
    for (let [key, value] of data.entries()) {
      console.log(key + ':', value, typeof value);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers:
          userRole === "admin" || userRole === "superadmin"
            ? { Authorization: `Bearer ${token}` }
            : {},
        body: data,
      });

      const result = await response.json();
      console.log("Server response:", result);

      if (response.ok) {
        alert(result.message || "Registration successful!");
        setStep(1);
        // Reset form
        setFormData({
          group: "",
          passport: null,
          first_name: "",
          surname: "",
          phone: "",
          address: "",
          kinName: "",
          kinSurname: "",
          kinPhone: "",
          kinAddress: "",
          paymentConfirmed: true,
        });
      } else {
        // Handle specific error cases
        if (result.error && result.error.includes('already registered')) {
          alert('You are already registered as a member! Please check your account or contact support.');
        } else if (result.error && result.error.includes('CooperativeGroup')) {
          alert('There was an issue with the group selection. Please try again.');
        } else {
          alert(result.error || "Registration failed. Please check the console for details.");
        }
        console.error("Registration error details:", result);
      }
    } catch (err) {
      console.error("Network error:", err);
      alert("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const paystackProps = {
    email,
    amount,
    metadata: {
      name: `${formData.first_name} ${formData.surname}`,
      phone: formData.phone,
      group: formData.group,
    },
    publicKey,
    text: "Pay ₦20,300",
    onSuccess: () => {
      alert("Payment successful! 🎉");
      setFormData({ ...formData, paymentConfirmed: true });
    },
    onClose: () => alert("Payment window closed."),
  };

  // Get selected group name for display
  const getSelectedGroupName = () => {
    if (!formData.group) return '';
    const selectedGroup = groups.find(g => g.id === parseInt(formData.group));
    return selectedGroup ? selectedGroup.name : `Group ${formData.group}`;
  };

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center pt-24 pb-2 px-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-amber-600 mb-6">
          Join Irorunde Cooperative Society
        </h2>

        {/* Progress Indicator */}
        <div className="flex justify-between items-center mb-8">
          {["Personal Info", "Next of Kin", "Payment"].map((label, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step >= index + 1
                    ? "bg-amber-600 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                {index + 1}
              </div>
              <p className="text-xs mt-2 text-gray-600">{label}</p>
            </div>
          ))}
        </div>

        {/* Step 1: Personal Info */}
        {step === 1 && (
          <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
            {(userRole !== "superadmin") && (
              <div>
                <label className="text-sm text-gray-600 font-medium">Select Irorunde Group *</label>
                <select
                  name="group"
                  value={formData.group}
                  onChange={handleChange}
                  className="border p-3 rounded-md w-full mt-1"
                  required
                >
                  <option value="">-- Choose Group --</option>
                  {/* Dynamic groups from backend */}
                  {groups.length > 0 ? (
                    groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))
                  ) : (
                    /* Fallback static options */
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
                  {groups.length > 0 ? `${groups.length} groups available` : 'Using default groups'}
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
                  className="w-full border p-2 rounded-md mt-1"
                  required
                />
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
                  className="border p-3 rounded-md w-full"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  name="surname"
                  placeholder="Surname *"
                  value={formData.surname}
                  onChange={handleChange}
                  className="border p-3 rounded-md w-full"
                  required
                />
              </div>
            </div>

            <input
              type="tel"
              name="phone"
              placeholder="Phone Number *"
              value={formData.phone}
              onChange={handleChange}
              className="border p-3 rounded-md w-full"
              required
            />
            
            {userRole !== "superadmin" && (
              <textarea
                name="address"
                placeholder="Home Address *"
                value={formData.address}
                onChange={handleChange}
                className="border p-3 rounded-md w-full h-20"
                required
              />
            )}

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={nextStep}
                className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition disabled:bg-amber-400"
                disabled={!formData.first_name || !formData.surname || !formData.phone || (userRole !== "superadmin" && (!formData.group || !formData.address))}
              >
                Next
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Next of Kin Info */}
        {step === 2 && userRole !== "superadmin" && (
          <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                name="kinName"
                placeholder="Next of Kin First Name *"
                value={formData.kinName}
                onChange={handleChange}
                className="border p-3 rounded-md w-full"
                required
              />
              <input
                type="text"
                name="kinSurname"
                placeholder="Next of Kin Surname *"
                value={formData.kinSurname}
                onChange={handleChange}
                className="border p-3 rounded-md w-full"
                required
              />
            </div>
            <input
              type="tel"
              name="kinPhone"
              placeholder="Next of Kin Phone Number *"
              value={formData.kinPhone}
              onChange={handleChange}
              className="border p-3 rounded-md w-full"
              required
            />
            <textarea
              name="kinAddress"
              placeholder="Next of Kin Address *"
              value={formData.kinAddress}
              onChange={handleChange}
              className="border p-3 rounded-md w-full h-20"
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
                className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition disabled:bg-amber-400"
                disabled={!formData.kinName || !formData.kinSurname || !formData.kinPhone || !formData.kinAddress}
              >
                Next
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Payment Confirmation */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="text-center">
            <div className="bg-amber-50 p-6 rounded-lg mb-6">
              <h3 className="text-xl font-semibold text-gray-700 mb-4">Registration Summary</h3>
              
              <div className="text-left space-y-2 text-sm">
                <p><strong>Name:</strong> {formData.first_name} {formData.surname}</p>
                <p><strong>Phone:</strong> {formData.phone}</p>
                {formData.group && (
                  <p><strong>Group:</strong> {getSelectedGroupName()}</p>
                )}
                {formData.address && <p><strong>Address:</strong> {formData.address}</p>}
                {formData.kinName && (
                  <>
                    <p><strong>Next of Kin:</strong> {formData.kinName} {formData.kinSurname}</p>
                    <p><strong>Kin Phone:</strong> {formData.kinPhone}</p>
                  </>
                )}
              </div>
            </div>

            {userRole === "member" && (
              <>
                <h3 className="text-xl font-semibold text-gray-700 mb-4">Membership Payment</h3>
                <p className="text-gray-600 mb-6">
                  To complete your registration, please confirm your payment of <strong>₦20,300</strong>.
                </p>
                <p className="text-green-600 font-semibold mb-6">✅ Payment confirmed</p>
              </>
            )}

            <div className="flex justify-between">
              {step > 1 && (
                <button 
                  type="button" 
                  onClick={prevStep} 
                  className="border border-amber-600 text-amber-600 px-6 py-2 rounded-lg hover:bg-amber-50 transition"
                >
                  Back
                </button>
              )}
              <button 
                type="submit" 
                className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition disabled:bg-amber-400"
                disabled={loading}
              >
                {loading ? "Registering..." : "Complete Registration"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Join;