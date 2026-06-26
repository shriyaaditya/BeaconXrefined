"use client"

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  User,
  Lock,
  Mail,
  Shield,
  Cloud,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from "next/navigation";


export default function LoginPage() {
  const { signUp, signIn, user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  });
  const [location, setLocation] = useState({
    latitude: 0,
    longitude: 0,
    address: '',
  });
  const [passwordStrength, setPasswordStrength] = useState(0);

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length > 5) strength += 1;
    if (password.match(/[a-z]+/)) strength += 1;
    if (password.match(/[A-Z]+/)) strength += 1;
    if (password.match(/[0-9]+/)) strength += 1;
    if (password.match(/[$@#&!]+/)) strength += 1;
    return strength;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === "password") setPasswordStrength(calculatePasswordStrength(value));
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({
            latitude,
            longitude,
            address: 'Location detected successfully'
          });
        },
        (error) => {
          console.error('Location error:', error);
        }
      );
    }
  };

  const router = useRouter();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signIn(formData.email, formData.password);
        router.push('/dashboard');
      } else {
        await signUp(formData.name, formData.email, formData.password, location.address);
        router.push('/dashboard');
      }
    } catch (error) {
      console.error("Authentication error:", error);
    }
  };


  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-500 to-teal-950 flex items-center justify-center p-4 relative overflow-hidden">

      <div className="bg-white/80 backdrop-blur-lg shadow-2xl rounded-3xl w-full max-w-md p-8 space-y-6 border border-white/30 relative z-10">
        {/* Animated logo/header */}
        <div className="flex items-center justify-center mb-6">
          <Cloud className="text-teal-600 w-12 h-12 mr-3 animate-bounce" />
          <h2 className="text-4xl font-bold text-teal-800 tracking-tight">
            BeaconX
          </h2>
        </div>

        {/* Toggle switch */}
        <div className="flex justify-center mb-4">
          <div className="rounded-full p-1 flex items-center">
            <button
              onClick={() => setIsLogin(true)}
              className={`px-4 py-2 rounded-full transition-colors ${isLogin
                ? 'bg-teal-600 text-white'
                : 'text-teal-600 hover:bg-teal-200'
                }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`px-4 py-2 rounded-full transition-colors ${!isLogin
                ? 'bg-teal-600 text-white'
                : 'text-teal-600 hover:bg-teal-200'
                }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative group">
              <User className="absolute left-3 top-3 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                autoComplete='name'
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required={!isLogin}
              />
            </div>
          )}

          <div className="relative group">
            <Mail className="absolute left-3 top-3 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              autoComplete="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              required
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-3 top-3 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={formData.password}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              required
            />
            {/* Password strength indicator */}
            <div className="mt-1 flex space-x-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`h-1 w-full rounded-full transition-colors ${level <= passwordStrength
                    ? 'bg-teal-500'
                    : 'bg-gray-200'
                    }`}
                />
              ))}
            </div>
          </div>

          {!isLogin && (
            <div className="relative group">
              <MapPin className="absolute left-3 top-3 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
              <input
                type="text"
                name="address"
                placeholder="Location Address"
                autoComplete='street-address'
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                value={location.address}
                onChange={(e) => setLocation(prev => ({ ...prev, address: e.target.value }))}
              />
              <button
                type="button"
                onClick={getCurrentLocation}
                className="absolute right-3 top-3 bg-teal-500 text-white p-1 rounded-full hover:bg-teal-600 transition-colors"
              >
                <Shield className="w-5 h-5" />
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-teal-600 text-white py-3 rounded-xl hover:bg-teal-700 transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-xl"
          >
            {isLogin ? 'Secure Login' : 'Create Account'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-gray-600">
            {isLogin
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-teal-600 hover:underline font-semibold"
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}