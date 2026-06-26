"use client"

import Link from 'next/link';
import { useState, FormEvent } from 'react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle newsletter subscription
    alert(`Thanks for subscribing with ${email}!`);
    setEmail('');
  };
  
  return (
    <footer className="bg-gradient-to-tr from-teal-900 via-teal-800 to-teal-900 text-white relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute top-0 left-0 w-full h-1/2">
          {[...Array(6)].map((_, i) => (
            <div 
              key={i}
              className="absolute rounded-full bg-teal-400"
              style={{
                width: `${Math.random() * 400 + 100}px`,
                height: `${Math.random() * 400 + 100}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.1
              }}
            />
          ))}
        </div>
      </div>
          
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-10 pt-10 pb-2 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Brand Column */}
          <div className="space-y-6 pt-12">
            <Link href="/" className="group inline-block">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center transform group-hover:rotate-6 transition-transform duration-300">
                    <span className="text-2xl font-bold text-white">bX</span>
                  </div>
                  <div className="absolute -inset-1.5 bg-teal-400 opacity-30 rounded-lg blur-lg group-hover:opacity-50 transition-opacity"></div>
                </div>
                <span className="text-2xl font-bold tracking-tight text-white">Beacon<span className="text-teal-300">X</span></span>
              </div>
            </Link>       
           
            
        
          </div>                  
          
          {/* <div className="space-y-6 pt-10">
            <ul className="space-y-3">
              {[
                { name: 'About Us', path: '/about' },
                { name: 'Inventory', path: '/inventory' },
                { name: 'Community', path: '/community' },
                { name: 'Alerts', path: '/alerts' },
                { name: 'Survival Guide', path: '/guide' }
              ].map((item) => (
                <li key={item.name}>
                  <Link 
                    href={item.path}
                    className="text-teal-200 hover:text-white transition-colors duration-200 flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full mr-2 transform scale-0 group-hover:scale-100 transition-transform duration-200"></span>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div> */}

          
          {/* Newsletter Section */}
          <div className="space-y-6 pt-10">
            <h3 className="text-lg font-semibold text-teal-100 tracking-wide">Contact Us</h3>
            
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 rounded-lg bg-teal-800/50 border border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-white placeholder-teal-300"
                required
              />
              <button
                type="submit"
                className="absolute right-2 top-2 bottom-2 px-4 rounded-md bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 transition-colors duration-200 text-white font-medium"
              >
                Subscribe
              </button>
            </form>
            
           
            
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-teal-200">beaconx@gmail.com</span>
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-teal-700/30 flex flex-col md:flex-row justify-between items-center">
          <p className="text-md text-teal-300 text-center md:text-left">
            © {currentYear}. All rights reserved.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 mt-4 md:mt-0">
            <Link href="#" className="text-md text-teal-300 hover:text-white transition-colors duration-200">Privacy Policy</Link>
            <Link href="#" className="text-md text-teal-300 hover:text-white transition-colors duration-200">Terms of Service</Link>
            <Link href="#" className="text-md text-teal-300 hover:text-white transition-colors duration-200">Sitemap</Link>
          </div>
        </div>
      </div>
      
    </footer>
  );
}