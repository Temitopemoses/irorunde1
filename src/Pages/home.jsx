import React from "react";
import Navbar from "../components/Navbar";
import president from "../assets/president.jpg";
import secretary from "../assets/secretary.jpg";
import ajimotokin from "../assets/Ajimotokin.jpg";

const Home = () => {
  return (
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
            <strong>Vision:</strong> To become Nigeria’s most trusted cooperative society
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
        <form className="max-w-2xl mx-auto grid gap-4">
          <input
            type="text"
            placeholder="Full Name"
            className="border rounded-lg p-3 w-full"
          />
          <input
            type="email"
            placeholder="Email Address"
            className="border rounded-lg p-3 w-full"
          />
          <textarea
            placeholder="Your Message"
            className="border rounded-lg p-3 w-full h-32"
          ></textarea>
          <button className="bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition">
            Send Message
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer className="py-6 bg-amber-600 text-white text-center">
        <p>
          © {new Date().getFullYear()} Irorunde Cooperative Society. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Home;
