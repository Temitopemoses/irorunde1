import React, { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <header className="fixed top-0 left-0 w-full bg-white shadow-md z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <img
            src={logo}
            alt="Irorunde Logo"
            className="w-10 h-10 rounded-full"
          />
          <span className="text-xl font-bold text-amber-600 tracking-wide">
            Irorunde
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-6 font-medium text-gray-700">
          <a href="#features" className="hover:text-amber-600 transition">
            Features
          </a>
          <a href="#about" className="hover:text-amber-600 transition">
            About
          </a>
          <a href="#services" className="hover:text-amber-600 transition">
            Services
          </a>
          <a href="#mission" className="hover:text-amber-600 transition">
            Mission & Vision
          </a>
          <a href="#faqs" className="hover:text-amber-600 transition">
            FAQs
          </a>
          <a href="#team" className="hover:text-amber-600 transition">
            Team
          </a>
          <a href="#contact" className="hover:text-amber-600 transition">
            Contact
          </a>
        </nav>

        {/* Desktop Buttons */}
        <div className="hidden md:flex space-x-3">
          <Link
            to="/login"
            className="border border-amber-600 text-amber-600 px-5 py-2 rounded-full hover:bg-amber-50 transition"
          >
            Login
          </Link>
          <Link
            to="/join"
            className="bg-amber-600 text-white px-5 py-2 rounded-full hover:bg-amber-700 transition"
          >
            Join
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-amber-600 focus:outline-none"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white shadow-lg border-t">
          <nav className="flex flex-col space-y-3 p-4 text-gray-700 font-medium">
            <a href="#features" onClick={toggleMenu} className="hover:text-amber-600">
              Features
            </a>
            <a href="#about" onClick={toggleMenu} className="hover:text-amber-600">
              About
            </a>
            <a href="#services" onClick={toggleMenu} className="hover:text-amber-600">
              Services
            </a>
            <a href="#mission" onClick={toggleMenu} className="hover:text-amber-600">
              Mission & Vision
            </a>
            <a href="#faqs" onClick={toggleMenu} className="hover:text-amber-600">
              FAQs
            </a>
            <a href="#team" onClick={toggleMenu} className="hover:text-amber-600">
              Team
            </a>
            <a href="#contact" onClick={toggleMenu} className="hover:text-amber-600">
              Contact
            </a>

            <div className="flex flex-col space-y-3 pt-4 border-t">
              <Link
                to="/login"
                onClick={toggleMenu}
                className="border border-amber-600 text-amber-600 px-5 py-2 rounded-full hover:bg-amber-50 transition text-center"
              >
                Login
              </Link>
              <Link
                to="/join"
                onClick={toggleMenu}
                className="bg-amber-600 text-white px-5 py-2 rounded-full text-center hover:bg-amber-700 transition"
              >
                Join
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
