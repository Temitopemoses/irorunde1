// Join.jsx
import { useState, useEffect } from "react";
import { FlutterWaveButton } from "flutterwave-react-v3"; // optional - we do redirect method
import { Helmet } from "react-helmet-async";
const Join = ({ userRole = "member", token = null }) => {
  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPaymentDone, setIsPaymentDone] = useState(false);
  const [txRef, setTxRef] = useState(null);

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
    paymentConfirmed: false,
  });

  // --- fetch groups ---
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch("https://irorunde1-production.up.railway.app/api/accounts/groups/");
        if (response.ok) {
          const data = await response.json();
          setGroups(data);
        } else {
          console.warn("Failed to fetch groups");
        }
      } catch (err) {
        console.error("Error fetching groups:", err);
      }
    };
    fetchGroups();
  }, []);

  // --- detect flutterwave redirect and verify payment ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    // Flutterwave may return transaction_id, tx_ref or status depending on how you configured redirect_url
    const transaction_id = urlParams.get("transaction_id") || urlParams.get("transactionId") || urlParams.get("id");
    const returned_tx_ref = urlParams.get("tx_ref") || urlParams.get("txref") || urlParams.get("txRef");

    // If backend returned tx_ref when initiating, it might be stored; otherwise we use returned params.
    if (transaction_id || returned_tx_ref) {
      // call verify endpoint
      const param = transaction_id ? { transaction_id } : { tx_ref: returned_tx_ref };
      verifyPayment(param);
      // remove query params from URL to avoid repeated verification if user refreshes
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    setFormData((s) => ({
      ...s,
      [name]: type === "file" ? files[0] : type === "checkbox" ? checked : value,
    }));
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  // --- call backend verify endpoint ---
  const verifyPayment = async (payload) => {
    // payload: { transaction_id } OR { tx_ref }
    try {
      setLoading(true);
      const res = await fetch("https://irorunde1-production.up.railway.app/api/flutterwave/verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && (data.status === "success" || data.is_verified === true)) {
        // backend should return something indicating success
        setIsPaymentDone(true);
        setTxRef(data.tx_ref || payload.tx_ref || data.data?.tx_ref || null);
        alert("✅ Payment verified successfully. You can complete registration now.");
      } else {
        console.error("Verify failed response:", data);
        alert("Payment verification failed. If you were charged, contact support with your tx_ref.");
      }
    } catch (err) {
      console.error("Verify error:", err);
      alert("Error verifying payment. Please try again or contact support.");
    } finally {
      setLoading(false);
    }
  };

  // --- initiate payment via backend; backend should return { link, tx_ref } ---
const handleFlutterPayment = async () => {
  if (!formData.group || !formData.first_name || !formData.surname || !formData.phone) {
    alert("Please fill name, phone and select group before paying.");
    return;
  }

  try {
    setLoading(true);
    const payload = {
      group_id: formData.group,
      amount: 20300, // membership fee
      email: `${formData.first_name.toLowerCase()}@irorunde.com`,
      name: `${formData.first_name} ${formData.surname}`,
      phone: formData.phone,
    };

    const res = await fetch("https://irorunde1-production.up.railway.app/api/flutterwave/initialize/", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    });

    const data = await res.json();

    console.log("FLW Init Response:", data);

    if (res.ok && data.payment_link) {
      // ✅ Save tx_ref if backend returned it
      if (data.tx_ref) setTxRef(data.tx_ref);

      // ✅ Redirect user to Flutterwave hosted payment page
      window.location.href = data.payment_link;
    } else {
      console.error("Initiate failed:", data);
      alert(data.error || data.message || "Could not initialize payment. Try again.");
    }
  } catch (err) {
    console.error("Payment init error:", err);
    alert("Network error while initiating payment.");
  } finally {
    setLoading(false);
  }
};


  // --- registration submit (only allowed when isPaymentDone OR admin) ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.first_name || !formData.surname || !formData.phone) {
      alert("Please fill in required fields.");
      return;
    }

    if (userRole === "member" && !isPaymentDone) {
      alert("Please complete payment first (Pay button).");
      return;
    }
  
    setLoading(true);

    const url =
      userRole === "admin" || userRole === "superadmin"
        ? "https://irorunde1-production.up.railway.app/api/accounts/create-member/"
        : "https://irorunde1-production.up.railway.app/api/accounts/register/";

    const data = new FormData();

    // append all formData fields like you already did
    for (const key in formData) {
      const v = formData[key];
      if (v !== null && v !== "") {
        if (key === "group") {
          // append group name (fallback to provided mapping)
          if (v) {
            const selectedGroup = groups.find((g) => g.id === parseInt(v));
            if (selectedGroup) data.append("group", selectedGroup.name);
            else {
              const groupNames = {
                "1": "Irorunde 1",
                "2": "Irorunde 2",
                "3": "Irorunde 4",
                "4": "Irorunde 6",
                "5": "Oluwanisola",
                "6": "Irorunde 7",
              };
              data.append("group", groupNames[v] || `Group ${v}`);
            }
          }
        } else if (key === "passport" && formData.passport) {
          data.append("passport", formData.passport);
        } else {
          data.append(key, v);
        }
      }
    }

    // include payment meta optionally
    if (isPaymentDone) {
      data.append("payment_confirmed", "true");
      if (txRef) data.append("tx_ref", txRef);
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

      if (response.ok) {
        alert(result.message || "Registration successful!, Redirecting to login.");
        window.location.href = "/login";
        // reset
        setStep(1);
        setIsPaymentDone(false);
        setTxRef(null);
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
          paymentConfirmed: false,
        });
      } else {
        console.error("Register failed:", result);
        alert(result.error || "Registration failed. Check console for details.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      alert("Network error during registration.");
    } finally {
      setLoading(false);
    }
  };

  const getSelectedGroupName = () => {
    if (!formData.group) return "";
    const selectedGroup = groups.find((g) => g.id === parseInt(formData.group));
    return selectedGroup ? selectedGroup.name : `Group ${formData.group}`;
  };

  // ----------------- JSX (keeps your layout) -----------------
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
            {["Personal Info", "Next of Kin", "Payment"].map((label, index) => (
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

          {/* Step 1 */}
          {step === 1 && (
            <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
              {userRole !== "superadmin" && (
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
                    className="w-full border p-2 rounded-md mt-1"
                    required />
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
                    required />
                </div>
                <div>
                  <input
                    type="text"
                    name="surname"
                    placeholder="Surname *"
                    value={formData.surname}
                    onChange={handleChange}
                    className="border p-3 rounded-md w-full"
                    required />
                </div>
              </div>

              <input
                type="tel"
                name="phone"
                placeholder="Phone Number *"
                value={formData.phone}
                onChange={handleChange}
                className="border p-3 rounded-md w-full"
                required />

              {userRole !== "superadmin" && (
                <textarea
                  name="address"
                  placeholder="Home Address *"
                  value={formData.address}
                  onChange={handleChange}
                  className="border p-3 rounded-md w-full h-20"
                  required />
              )}

              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
                  disabled={!formData.first_name ||
                    !formData.surname ||
                    !formData.phone ||
                    (userRole !== "superadmin" && (!formData.group || !formData.address))}
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* Step 2 */}
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
                  required />
                <input
                  type="text"
                  name="kinSurname"
                  placeholder="Next of Kin Surname *"
                  value={formData.kinSurname}
                  onChange={handleChange}
                  className="border p-3 rounded-md w-full"
                  required />
              </div>
              <input
                type="tel"
                name="kinPhone"
                placeholder="Next of Kin Phone Number *"
                value={formData.kinPhone}
                onChange={handleChange}
                className="border p-3 rounded-md w-full"
                required />
              <textarea
                name="kinAddress"
                placeholder="Next of Kin Address *"
                value={formData.kinAddress}
                onChange={handleChange}
                className="border p-3 rounded-md w-full h-20"
                required
              ></textarea>

              <div className="flex justify-between mt-4">
                <button type="button" onClick={prevStep} className="border border-amber-600 text-amber-600 px-6 py-2 rounded-lg">
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-amber-600 text-white px-6 py-2 rounded-lg"
                  disabled={!formData.kinName || !formData.kinSurname || !formData.kinPhone || !formData.kinAddress}
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Payment + Register */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="text-center">
              <div className="bg-amber-50 p-6 rounded-lg mb-6">
                <h3 className="text-xl font-semibold text-gray-700 mb-4">Registration Summary</h3>
                <div className="text-left space-y-2 text-sm">
                  <p>
                    <strong>Name:</strong> {formData.first_name} {formData.surname}
                  </p>
                  <p>
                    <strong>Phone:</strong> {formData.phone}
                  </p>
                  {formData.group && (
                    <p>
                      <strong>Group:</strong> {getSelectedGroupName()}
                    </p>
                  )}
                  {formData.address && <p><strong>Address:</strong> {formData.address}</p>}
                </div>
              </div>

              {/* Members must pay first */}
              {userRole === "member" && !isPaymentDone && (
                <>
                  <h3 className="text-xl font-semibold text-gray-700 mb-4">Membership Payment</h3>
                  <p className="text-gray-600 mb-6">To continue, pay <strong>₦20,300</strong> for membership registration.</p>

                  <button
                    type="button"
                    onClick={handleFlutterPayment}
                    className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
                    disabled={loading}
                  >
                    {loading ? "Processing..." : "Pay ₦20,300"}
                  </button>
                </>
              )}

              {/* If admin OR payment done, show Complete Registration */}
              {(userRole !== "member" || isPaymentDone) && (
                <div className="mt-6">
                  <button
                    type="submit"
                    className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
                    disabled={loading}
                  >
                    {loading ? "Registering..." : "Complete Registration"}
                  </button>
                </div>
              )}

              {/* show small note if payment verified */}
              {isPaymentDone && <p className="text-sm text-green-600 mt-3">Payment verified — you may complete registration.</p>}
            </form>
          )}
        </div>
      </div></>
  );
};

export default Join;
