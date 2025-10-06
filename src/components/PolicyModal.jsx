import React, { useState } from "react";

const PolicyModal = ({ show, onClose, onAgree }) => {
  const [agreed, setAgreed] = useState(false);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl mx-4 rounded-xl shadow-lg p-6 overflow-y-auto max-h-[80vh]">
        <h2 className="text-2xl font-bold text-amber-600 mb-4 text-center">
          Irorunde Cooperative Society Policy Statement
        </h2>

        {/* Policy Content */}
        <div className="space-y-3 text-gray-700 text-sm leading-relaxed overflow-y-auto max-h-[50vh] border p-4 rounded-md">
          <p>• Meeting starts at 1 PM with a grace of 15 minutes. Late arrival attracts ₦200 fine.</p>
          <p>• Absenteeism attracts ₦500 fine, while loan repayment delay attracts ₦2,500 fine.</p>
          <p>• Referrals must guarantee the people they introduce and are liable for default.</p>
          <p>• No member shall attend meetings without a valid ID card.</p>
          <p>• Mismanaged societies will be taken over by a caretaker committee.</p>
          <p>• Guarantors are not eligible for new loans until 75% of previous loans are repaid.</p>
          <p>• Members must comply with all meeting schedules and financial obligations.</p>
          <p>• All loan forms must be certified by the society secretary before approval.</p>
          <p>• Members without valid deposit cards are not entitled to financial assistance.</p>
          <p>— Signed: <span className="font-semibold text-amber-700">Alhaji Mukail Adekunle Adebayo</span>, President</p>
        </div>

        {/* Agreement Checkbox */}
        <div className="flex items-center mt-4 space-x-2">
          <input
            type="checkbox"
            id="agree"
            checked={agreed}
            onChange={() => setAgreed(!agreed)}
            className="w-4 h-4 text-amber-600"
          />
          <label htmlFor="agree" className="text-sm text-gray-700">
            I have read and agree to the Irorunde Cooperative Society Policy.
          </label>
        </div>

        {/* Buttons */}
        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-gray-300 hover:bg-gray-100 transition"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              if (agreed) {
                onAgree();
              }
            }}
            disabled={!agreed}
            className={`px-6 py-2 rounded-full ${
              agreed
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            } transition`}
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolicyModal;
