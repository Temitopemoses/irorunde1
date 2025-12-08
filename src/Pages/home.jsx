import React, { useState } from "react";
import Navbar from "../components/Navbar";
import president from "../assets/president.jpg";
import secretary from "../assets/secretary.jpg";
import ajimotokin from "../assets/Ajimotokin.jpg";
import { Helmet } from "react-helmet-async";

const Home = () => {
  const [status, setStatus] = useState({
    submitting: false,
    submitted: false,
    error: null
  });

  // Replace YOUR_FORM_ID with your actual Formspree form ID
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mzznaeoq';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    setStatus({ submitting: true, submitted: false, error: null });

    try {
      const formData = new FormData(form);
      
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        setStatus({
          submitting: false,
          submitted: true,
          error: null
        });
        form.reset();
        
        // Reset success message after 5 seconds
        setTimeout(() => {
          setStatus(prev => ({ ...prev, submitted: false }));
        }, 5000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Submission failed');
      }
    } catch (error) {
      setStatus({
        submitting: false,
        submitted: false,
        error: error.message || 'Failed to send message. Please try again.'
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Irorunde Cooperative Society</title>
        <meta
          name="description"
          content="Irorunde Cooperative Society is a community-focused financial cooperative dedicated to empowering its members through savings, loans, and various financial services."
        />
        <link rel="canonical" href="https://irorunde-cooperative.vercel.app/" />
             
            
        {/* Additional SEO meta tags */}
        <meta name="keywords" content="cooperative society, savings, loans, financial empowerment, Nigeria, community banking" />
        <meta name="author" content="Irorunde Cooperative Society" />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        
        {/* Favicon links (add these if you have favicon files) */}
        <link rel="icon" href="/src/assets/logo.png" />
        <link rel="apple-touch-icon" href="src/assets/logo.png" /> 
      </Helmet>
      
      <div className="font-sans text-gray-800">
        <Navbar />

        {/* Hero Section */}
        <section
          id="home"
          className="h-screen flex flex-col justify-center items-center text-center bg-gradient-to-r from-amber-50 to-white px-6"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-amber-600 mb-4">
            Welcome to Irorunde Cooperative Society
          </h1>
          <p className="max-w-2xl text-gray-600 text-lg mb-6">
            Empowering members through financial inclusion, savings, and cooperative
            support for a better future.
          </p>
          <div className="flex space-x-4">
            <a
              href="/join"
              className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition"
            >
              Join Now
            </a>
            <a
              href="#features"
              className="border border-amber-600 text-amber-600 px-6 py-3 rounded-lg hover:bg-amber-600 hover:text-white transition"
            >
              Learn More
            </a>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 bg-white text-center px-6">
          <h2 className="text-3xl font-bold text-amber-600 mb-8">Our Features</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                title: "Secure Savings",
                desc: "Grow your savings safely with transparent records.",
              },
              {
                title: "Loan Access",
                desc: "Access quick and affordable cooperative loans.",
              },
              {
                title: "Digital Platform",
                desc: "Manage your contributions anytime, anywhere.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="p-6 shadow-lg rounded-xl border hover:shadow-xl transition"
              >
                <h3 className="text-xl font-semibold mb-2 text-amber-600">
                  {f.title}
                </h3>
                <p className="text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-16 bg-amber-50 px-6 text-center">
          <h2 className="text-3xl font-bold text-amber-600 mb-6">About Us</h2>
          <p className="max-w-3xl mx-auto text-gray-700 text-lg">
            Irorunde Cooperative Society is dedicated to promoting savings, investment,
            and mutual financial growth among members. We believe in trust, unity, and
            community empowerment.
          </p>
        </section>

        {/* Services Section */}
        <section id="services" className="py-16 bg-white px-6 text-center">
          <h2 className="text-3xl font-bold text-amber-600 mb-8">Our Services</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                title: "Savings Management",
                desc: "Members can save regularly and monitor growth.",
              },
              {
                title: "Loan Support",
                desc: "Get access to flexible and low-interest loans.",
              },
              {
                title: "Investment Plans",
                desc: "Grow your wealth through secure cooperative investments.",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="p-6 border rounded-xl shadow-sm hover:shadow-lg transition"
              >
                <h3 className="text-xl font-semibold mb-2 text-amber-600">
                  {s.title}
                </h3>
                <p className="text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission & Vision */}
        <section id="mission" className="py-16 bg-amber-50 text-center px-6">
          <h2 className="text-3xl font-bold text-amber-600 mb-6">Mission & Vision</h2>
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-lg text-gray-700">
              <strong>Mission:</strong> To foster financial stability and mutual support
              through transparent cooperative systems.
            </p>
            <p className="text-lg text-gray-700">
              <strong>Vision:</strong> To become Nigeria's most trusted cooperative society
              promoting inclusive financial empowerment.
            </p>
          </div>
        </section>

        {/* FAQs */}
        <section id="faqs" className="py-16 bg-white px-6 text-center">
          <h2 className="text-3xl font-bold text-amber-600 mb-8">Frequently Asked Questions</h2>
          <div className="max-w-4xl mx-auto text-left space-y-4">
            {[
              {
                q: "How do I become a member?",
                a: "Simply click the 'Join Now' button and fill the registration form.",
              },
              {
                q: "Can I access my savings online?",
                a: "Yes, our platform allows members to monitor savings and loans securely.",
              },
              {
                q: "Are my contributions safe?",
                a: "Absolutely! We ensure transparency and security for all transactions.",
              },
            ].map((faq, i) => (
              <div key={i} className="border-b pb-3">
                <h3 className="font-semibold text-amber-600">{faq.q}</h3>
                <p className="text-gray-700">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section id="team" className="py-16 bg-amber-50 px-6 text-center">
          <h2 className="text-3xl font-bold text-amber-600 mb-8">Meet Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { name: "Ayilara Abimbola Fatimoh", role: "President", img: president },
              { name: "Babalola Olufunso Esther", role: "Secretary", img: secretary },
              { name: "Ajimotokin Mojisola", role: "Irorunde 4 President", img: ajimotokin },
            ].map((t, i) => (
              <div key={i} className="p-6 bg-white shadow-lg rounded-xl">
                <img
                  src={t.img}
                  alt={t.name}
                  className="w-32 h-32 md:w-40 md:h-40 mx-auto rounded-full object-cover mb-4"
                />
                <h3 className="font-semibold text-lg text-amber-600">{t.name}</h3>
                <p className="text-gray-600">{t.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="py-16 bg-white px-6 text-center">
          <h2 className="text-3xl font-bold text-amber-600 mb-6">Contact Us</h2>
          <p className="max-w-2xl mx-auto text-gray-700 mb-8">
            Have any questions? Reach out to us anytime.
          </p>
          
          {/* Success/Error Messages */}
          {status.submitted && (
            <div className="max-w-2xl mx-auto mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
              Thank you for your message! We'll get back to you soon.
            </div>
          )}
          
          {status.error && (
            <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
              {status.error}
            </div>
          )}

          <form 
            onSubmit={handleSubmit}
            action={FORMSPREE_ENDPOINT}
            method="POST"
            className="max-w-2xl mx-auto grid gap-4"
          >
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              className="border rounded-lg p-3 w-full focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
              disabled={status.submitting}
              required
            />
            
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              className="border rounded-lg p-3 w-full focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
              disabled={status.submitting}
              required
            />
            
            <textarea
              name="message"
              placeholder="Your Message"
              className="border rounded-lg p-3 w-full h-32 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition resize-none"
              disabled={status.submitting}
              required
            ></textarea>
            
            {/* Hidden fields for better email formatting */}
            <input type="hidden" name="_subject" value="New Contact Form Submission - Irorunde Cooperative" />
            <input type="hidden" name="_format" value="plain" />
            
            <button
              type="submit"
              disabled={status.submitting}
              className={`bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition flex items-center justify-center ${
                status.submitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {status.submitting ? (
                <>
                  <svg 
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    ></circle>
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Sending...
                </>
              ) : 'Send Message'}
            </button>
          </form>
        </section>

        {/* Footer */}
        <footer className="py-6 bg-amber-600 text-white text-center">
          <p>
            © {new Date().getFullYear()} Irorunde Cooperative Society. All rights reserved.
          </p>
          <p className="text-sm mt-2 opacity-90">
            Building financial empowerment through cooperative excellence
          </p>
        </footer>
      </div>
    </>
  );
};

export default Home;