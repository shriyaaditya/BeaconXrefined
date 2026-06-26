"use client"

import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, Globe, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const features = [
  {
    name: "Disaster Classification & Risk Assessment",
    role: "Disaster Management Analyst",
    content: "The AI-powered classification system accurately categorizes disaster types and predicts potential impact zones, helping us prepare appropriate response strategies.",
    icon: <AlertTriangle className="h-16 w-16 text-orange-600" />,
    image: "/disaster.jpg", 
    color: "from-orange-500 to-red-600"
  },
  {
    name: "Global Incident Monitoring",
    role: "International Relief Coordinator",
    content: "The comprehensive news aggregation feature provides real-time updates from disaster zones worldwide, allowing us to respond promptly to emerging situations.",
    icon: <Globe className="h-16 w-16 text-blue-600" />,
    image: "/global-mapping.jpg", 
    color: "from-blue-500 to-indigo-600"
  },
  {
    name: "Acon: Emergency Help Chatbot",
    role: "Community Support Specialist",
    content: "The integrated chatbot system enables affected communities to quickly report emergencies and receive critical information when traditional communication channels fail.",
    icon: <MessageCircle className="h-16 w-16 text-green-600" />,
    image: "/Acon.jpg", 
    color: "from-green-500 to-teal-600"
  },
];

const FeatureSlider = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  const resetTimer = () => {
    if (timerRef.current !== null) {
        clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
        if (!isPaused) {
            setCurrentIndex(prev => (prev === features.length - 1 ? 0 : prev + 1));
        }
    }, 5000);
};

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === features.length - 1 ? 0 : prev + 1));
    resetTimer();
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? features.length - 1 : prev - 1));
    resetTimer();
  };

  return (
    <section id="features" className="py-16 bg-teal-100 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-grid-gray-900/5 bg-[size:20px_20px]" />
      </div>
      
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-700 to-blue-800">
              Disaster Management Solutions
            </span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-teal-700 to-blue-800 mx-auto rounded-full mt-3"></div>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
            Comprehensive tools designed to help emergency response teams prepare, respond, and recover effectively.
          </p>
        </div>

        <div 
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-xl shadow-xl overflow-hidden"
            >
              <div className="flex flex-col md:flex-row">
                {/* Left side - Image */}
                <div className="md:w-1/2 relative h-64 md:h-auto">
                  <div className={`absolute inset-0 bg-gradient-to-br ${features[currentIndex].color} opacity-20`}></div>
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <Image 
                      fill
                      src={features[currentIndex].image} 
                      alt={features[currentIndex].name}
                      className="object-cover w-full h-full rounded-lg shadow-md"
                    />
                  </div>
                </div>
                
                {/* Right side - Content */}
                <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                  <div className="mb-4 bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center">
                    {features[currentIndex].icon}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {features[currentIndex].name}
                  </h3>
                  
                  <div className={`h-1 w-20 rounded-full my-3 bg-gradient-to-r ${features[currentIndex].color}`}></div>
                  
                  <blockquote className="text-gray-700 text-lg">
                    `{features[currentIndex].content}`
                  </blockquote>
                  
                  <div className="mt-4 flex items-center">
                    <div className="bg-gray-100 rounded-full h-8 w-8 flex items-center justify-center mr-3">
                      <span className="font-bold text-sm text-teal-700">RM</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{features[currentIndex].role}</span>
                  </div>

                 
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-2 bg-gray-100 overflow-hidden">
                <motion.div
                  key={`progress-${currentIndex}`}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, ease: "linear" }}
                  className={`h-full bg-gradient-to-r ${features[currentIndex].color}`}
                />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons with improved styling */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/90 shadow-lg hover:bg-white transition-all duration-300 border border-gray-100 z-10"
            aria-label="Previous feature"
          >
            <ChevronLeft className="h-6 w-6 text-teal-700" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/90 shadow-lg hover:bg-white transition-all duration-300 border border-gray-100 z-10"
            aria-label="Next feature"
          >
            <ChevronRight className="h-6 w-6 text-teal-700" />
          </button>
        </div>

        {/* Enhanced Slide Indicators */}
        <div className="flex justify-center mt-8 space-x-2">
          {features.map((feature, index) => (
            <motion.button
              key={index}
              className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${
                index === currentIndex 
                  ? `w-10 bg-gradient-to-r ${feature.color}`
                  : "w-3 bg-gray-300"
              }`}
              whileHover={{ scale: 1.2 }}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to feature ${index + 1}: ${feature.name}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureSlider;