import React, { useState } from "react";
import { PaystackButton } from "react-paystack";

const Join = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    group: "",
    passport: null,
    name: "",
    surname: "",
    phone: "",
    address: "",
    kinName: "",
    kinSurname: "",
    kinPhone: "",
    kinAddress: "",
    paymentConfirmed: false,
  });

  const publicKey = "pk_test_xxxxxxxxxxxxxxxxxxxxxxx"; // Replace with your real Paystack public key
  const amount = 20300 * 100; // Paystack expects kobo
  const email = `${formData.name.toLowerCase()}@irorunde.com`;

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

  if (!formData.paymentConfirmed) {
    alert("Please confirm your ₦20,300 payment to complete registration.");
    return;
  }

  const data = new FormData();
  for (const key in formData) {
    data.append(key, formData[key]);
  }

  try {
    const response = await fetch("http://127.0.0.1:8000/api/join/", {
      method: "POST",
      body: data,
    });

    if (response.ok) {
      alert("Registration successful! Welcome to Irorunde Cooperative Society.");
      setStep(1);
      setFormData({
        group: "",
        passport: null,
        name: "",
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
      const errData = await response.json();
      console.error(errData);
      alert("Error submitting form. Check console for details.");
    }
  } catch (err) {
    console.error(err);
    alert("Something went wrong. Please try again.");
  }
};

  const paystackProps = {
    email,
    amount,
    metadata: {
      name: `${formData.name} ${formData.surname}`,
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
            {/* Group selection */}
            <div>
              <label className="text-sm text-gray-600 font-medium">
                Select Irorunde Group
              </label>
              <select
                name="group"
                value={formData.group}
                onChange={handleChange}
                className="border p-3 rounded-md w-full mt-1"
                required
              >
                <option value="">-- Choose Group --</option>
                <option value="Irorunde 1">Irorunde 1</option>
                <option value="Irorunde 2">Irorunde 2</option>
                <option value="Irorunde 4">Irorunde 4</option>
                <option value="Irorunde 6">Irorunde 6</option>
                <option value="Oluwanisola">Oluwanisola</option>
                <option value="Irorunde 7">Irorunde 7</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600 font-medium">
                Passport Photo
              </label>
              <input
                type="file"
                name="passport"
                accept="image/*"
                onChange={handleChange}
                className="w-full border p-2 rounded-md mt-1"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                name="name"
                placeholder="First Name"
                value={formData.name}
                onChange={handleChange}
                className="border p-3 rounded-md w-full"
                required
              />
              <input
                type="text"
                name="surname"
                placeholder="Surname"
                value={formData.surname}
                onChange={handleChange}
                className="border p-3 rounded-md w-full"
                required
              />
            </div>

            <input
              type="tel"
              name="phone"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={handleChange}
              className="border p-3 rounded-md w-full"
              required
            />
            <textarea
              name="address"
              placeholder="Home Address"
              value={formData.address}
              onChange={handleChange}
              className="border p-3 rounded-md w-full h-20"
              required
            ></textarea>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={nextStep}
                className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
              >
                Next
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Next of Kin Info */}
        {step === 2 && (
          <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                name="kinName"
                placeholder="Next of Kin First Name"
                value={formData.kinName}
                onChange={handleChange}
                className="border p-3 rounded-md w-full"
                required
              />
              <input
                type="text"
                name="kinSurname"
                placeholder="Next of Kin Surname"
                value={formData.kinSurname}
                onChange={handleChange}
                className="border p-3 rounded-md w-full"
                required
              />
            </div>

            <input
              type="tel"
              name="kinPhone"
              placeholder="Next of Kin Phone Number"
              value={formData.kinPhone}
              onChange={handleChange}
              className="border p-3 rounded-md w-full"
              required
            />
            <textarea
              name="kinAddress"
              placeholder="Next of Kin Address"
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
                className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
              >
                Next
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Payment Confirmation */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="text-center">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">
              Membership Payment
            </h3>
            <p className="text-gray-600 mb-6">
              To complete your registration, please confirm your payment of{" "}
              <strong>₦20,300</strong>.
            </p>

            {!formData.paymentConfirmed ? (
              <div className="flex justify-center mb-6">
                <PaystackButton
                  {...paystackProps}
                  className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
                />
              </div>
            ) : (
              <p className="text-green-600 font-semibold mb-6">
                ✅ Payment confirmed
              </p>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="border border-amber-600 text-amber-600 px-6 py-2 rounded-lg hover:bg-amber-50 transition"
              >
                Back
              </button>
              <button
                type="submit"
                className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
              >
                Complete Registration
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Join;


