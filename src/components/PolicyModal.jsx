import React, { useState } from "react";

const PolicyModal = ({ show, onClose, onAgree }) => {
  const [agreed, setAgreed] = useState(false);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl mx-auto rounded-xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] relative">
        
        {/* Close (X) Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Close policy modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-amber-600 mb-2">
            Irorunde Cooperative Society Policy Statement
          </h2>
          <p className="text-gray-600 text-sm">
            Please review and agree to continue to your dashboard
          </p>
        </div>

        {/* Policy Content */}
        <div className="space-y-4 text-gray-700 leading-relaxed overflow-y-auto max-h-[50vh] border border-gray-200 p-6 rounded-lg bg-gray-50">
          <p className="font-medium text-amber-700 mb-3">Important Policies:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start space-x-2">
              <span className="text-amber-600 mt-1">•</span>
              <p>Meeting starts at 1 PM with a grace of 15 minutes. Late arrival attracts ₦200 fine.</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-amber-600 mt-1">•</span>
              <p>Absenteeism attracts ₦500 fine, while loan repayment delay attracts ₦2,500 fine.</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-amber-600 mt-1">•</span>
              <p>Referrals must guarantee the people they introduce and are liable for default.</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-amber-600 mt-1">•</span>
              <p>No member shall attend meetings without a valid ID card.</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-amber-600 mt-1">•</span>
              <p>Mismanaged societies will be taken over by a caretaker committee.</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-amber-600 mt-1">•</span>
              <p>Guarantors are not eligible for new loans until 75% of previous loans are repaid.</p>
            </div>
            <div className="flex items-start space-x-2 col-span-1 md:col-span-2">
              <span className="text-amber-600 mt-1">•</span>
              <p>All loan forms must be certified by the society secretary before approval.</p>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              — Signed: <span className="font-semibold text-amber-700">Alhaji Mukail Adekunle Adebayo</span>, President
            </p>
          </div>
        </div>

        {/* Agreement Checkbox */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-lg">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
              className="w-5 h-5 text-amber-600 mt-0.5 focus:ring-amber-500 focus:ring-2"
            />
            <label htmlFor="agree" className="text-gray-700 leading-relaxed">
              I have read, understood, and agree to abide by all the policies of the Irorunde Cooperative Society as stated above.
              I acknowledge that failure to comply may result in penalties as outlined.
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-gray-200 space-y-4 sm:space-y-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            Cancel & Logout
          </button>

          <button
            onClick={() => {
              if (agreed) {
                onAgree();
              }
            }}
            disabled={!agreed}
            className={`px-6 py-2.5 rounded-lg font-medium ${
              agreed
                ? "bg-amber-600 text-white hover:bg-amber-700 shadow-md"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            } transition-colors w-full sm:w-auto`}
          >
            Agree & Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolicyModal;