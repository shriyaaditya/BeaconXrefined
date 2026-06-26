"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X, UserPlus, LogOut, Home, BookOpen, Users, Info, Activity } from "lucide-react"
import { usePathname, useRouter} from "next/navigation"
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  
  const router = useRouter();

  // Navigation links with icons
  const navLinks = [
    ...(user ? [] : [ { name: "Home", path: "/", icon: <Home className="h-5 w-5" /> } ]),
    { name: "Dashboard", path: "/dashboard", icon: <Home className="h-5 w-5" /> },
    { name: "Analyse", path: "/analyze", icon: <Activity className="h-5 w-5" /> },
    ...(user ? [
      { name: "AirFeed", path: "/community", icon: <Users className="h-5 w-5" /> },
    ] : []),
    { name: "About", path: "/about", icon: <Info className="h-5 w-5" /> },
  ]
  

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={`relative w-full z-50 transition-all duration-500 ${
        scrolled
          ? "bg-gradient-to-r from-teal-900 to-teal-700 backdrop-blur-md shadow-xl shadow-teal-900/20"
          : "bg-gradient-to-r from-teal-800 to-teal-600 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex h-20">
          {/* CLUSTER 1: Logo with SVG animation */}
          <div className="flex items-center justify-start w-1/4 pr-6">
            <Link href="/" className="group flex items-center space-x-3">
              <div className="relative h-12 w-12 transition-transform duration-500 group-hover:scale-110">
                <svg
                  className="h-12 w-12 text-white"
                  viewBox="0 0 64 64"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Outer glow */}
                  <circle cx="32" cy="32" r="30" fill="url(#radialGradient)" className="opacity-20" />

                  {/* Beacon rays - animated */}
                  <circle
                    cx="32"
                    cy="32"
                    r="24"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    className="animate-[spin_20s_linear_infinite]"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="16"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    className="animate-[spin_15s_linear_infinite_reverse]"
                  />

                  {/* Beacon triangle */}
                  <path d="M32 12L44.7846 32.7692H19.2154L32 12Z" fill="currentColor" className="drop-shadow-md" />
                  <path d="M32 52L44.7846 31.2308H19.2154L32 52Z" fill="currentColor" className="drop-shadow-md" />

                  {/* Beacon light - animated */}
                  <circle cx="32" cy="32" r="8" fill="white" className="animate-[pulse_2s_ease-in-out_infinite]" />

                  {/* Beacon pole */}
                  <path
                    d="M32 8L32 56"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="drop-shadow-md"
                  />

                  {/* Define gradient */}
                  <defs>
                    <radialGradient id="radialGradient" cx="0.5" cy="0.5" r="0.5">
                      <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                </svg>
              </div>
              <div className="font-bold text-2xl text-white transition-all duration-300 group-hover:text-sky-100">
                Beacon<span className="text-teal-200 group-hover:text-teal-300 transition-colors duration-300">X</span>
              </div>
            </Link>
          </div>

          {/* CLUSTER 3: Navigation Links (centered) */}
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="flex items-center space-x-2 px-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.path
                return (
                  <Link
                    key={link.name}
                    href={link.path}
                    className={`flex items-center space-x-2 mx-1 px-4 py-2.5 rounded-md
                      transition-all duration-300 text-white/90 hover:text-white
                      relative group overflow-hidden ${isActive ? "bg-white/15 text-white" : ""}`}
                  >
                    <span className="relative z-10 transition-transform group-hover:scale-110 duration-300">
                      {link.icon}
                    </span>
                    <span className="relative z-10 font-medium">{link.name}</span>

                    {/* Traveling line effect - left to right on hover */}
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-300 transform scale-x-0 origin-left 
                      transition-transform duration-500 group-hover:scale-x-100">
                    </span>
                    
                  </Link>
                )
              })}
            </div>
          </div>

          {/* CLUSTER 2: Login/Register */}
          <div className="hidden md:flex items-center justify-end w-1/4">
            <div className="flex items-center space-x-3">
              {!user ? (
                <Link
                  href="/login"
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-md 
                    bg-gradient-to-r from-teal-600 to-teal-500 text-white relative group overflow-hidden
                    transition-all duration-300 shadow-lg shadow-teal-500/20 hover:shadow-teal-400/30"
                  aria-label="Login"
                >
                  <span className="relative z-10 transition-transform group-hover:scale-110 duration-300">
                    <UserPlus className="h-5 w-5" />
                  </span>
                  <span className="relative z-10">Login</span>

                  {/* Traveling line effect */}
                  <span className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-r from-teal-400 to-teal-300
                    transform translate-x-[-100%] group-hover:translate-x-0
                    transition-transform duration-500 opacity-30"></span>
                </Link>
              ) : (
                <button
                  onClick={() => router.push("/login")}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-md 
                    bg-gradient-to-r from-teal-600 to-teal-500 text-white relative group overflow-hidden
                    transition-all duration-300 shadow-lg shadow-teal-500/20 hover:shadow-teal-400/30"
                  aria-label="Logout"
                  >
                  <span className="relative z-10 transition-transform group-hover:scale-110 duration-300">
                    <LogOut className="h-5 w-5" />
                  </span>
                  <span className="relative z-10">Logout</span>

                  {/* Traveling line effect */}
                  <span className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-r from-teal-400 to-teal-300
                    transform translate-x-[-100%] group-hover:translate-x-0
                    transition-transform duration-500 opacity-30"></span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center justify-end flex-1">
            <button
              className="p-2 rounded-lg transition-colors duration-300
                hover:bg-white/10 focus:outline-none relative overflow-hidden group"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="h-7 w-7 transition-transform duration-300 text-white" />
              ) : (
                <Menu className="h-7 w-7 transition-transform duration-300 text-white" />
              )}
              {/* Button hover effect */}
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-300 transform scale-x-0 
                transition-transform duration-300 group-hover:scale-x-100"></span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-500 ease-in-out ${
            isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {/* Mobile Navigation Links */}
          <div className="py-3 border-t border-white/10">
            <div className="grid grid-cols-1 gap-2 px-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.path
                return (
                  <Link
                    key={link.name}
                    href={link.path}
                    className={`flex items-center space-x-3 px-4 py-3.5 rounded-md 
                      transition-all duration-500 hover:bg-white/15 group relative overflow-hidden
                      ${isActive ? "bg-gradient-to-r from-teal-600/30 to-teal-500/30 text-white" : ""}`}
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="text-white/90 transition-transform group-hover:scale-110 duration-300">
                      {link.icon}
                    </span>
                    <span className="font-medium">{link.name}</span>
                    
                    {/* Traveling line effect for mobile links */}
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-300 transform scale-x-0 
                      transition-transform duration-500 group-hover:scale-x-100"></span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Mobile Login/Register */}
          <div className="py-4 border-t border-white/10 flex space-x-3 px-1">
          {!user ? (
            <Link
              href="/login"
              className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg 
                bg-gradient-to-r from-teal-600/50 to-teal-500/50
                border border-white/20 transition-all duration-300 hover:bg-white/10
                group relative overflow-hidden"
              onClick={() => setIsOpen(false)}
            >
              <UserPlus className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
              <span>Login</span>
              
              {/* Traveling line effect */}
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-300 transform scale-x-0 
                transition-transform duration-500 group-hover:scale-x-100"></span>
            </Link>
          ) : (
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg 
                bg-gradient-to-r from-teal-600/50 to-teal-500/50
                border border-white/20 transition-all duration-300 hover:bg-white/10
                group relative overflow-hidden"
            >
              <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
              <span>Logout</span>
              
              {/* Traveling line effect */}
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-300 transform scale-x-0 
                transition-transform duration-500 group-hover:scale-x-100"></span>
            </button>
          )}
          </div>
        </div>
      </div>
    </nav>
  )
}