'use client'

import React, { useState, useEffect } from 'react';

const BouncingEarth = () => {
  const [position, setPosition] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const bounceInterval = setInterval(() => {
      if (position >= 20) {
        setDirection(-1);
      } else if (position <= 0) {
        setDirection(1);
      }
      
      setPosition(prevPosition => prevPosition + direction);
    }, 50);

    return () => clearInterval(bounceInterval);
  }, [position, direction]);

  return (
    <div className="flex flex-col items-center justify-center ">
      <div 
        className="transition-transform duration-200 ease-in-out"
        style={{ transform: `translateY(${position}px)` }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100" height="100">
              
          
          {/* Earth body */}
          <circle cx="100" cy="100" r="50" fill="#4DB6DC" stroke="black" strokeWidth="3" />
          
          {/* Continents */}
          <path d="M70,70 Q90,65 85,90 Q75,110 65,100 Q60,85 70,70" fill="#68C270" stroke="black" strokeWidth="1" />
          <path d="M100,60 Q120,70 135,80 Q130,100 115,110 Q105,95 100,60" fill="#68C270" stroke="black" strokeWidth="1" />
          <path d="M50,110 Q70,120 90,125 Q95,140 75,145 Q55,130 50,110" fill="#68C270" stroke="black" strokeWidth="1" />
          <path d="M120,120 Q135,110 145,130 Q130,145 120,120" fill="#68C270" stroke="black" strokeWidth="1" />
          
          {/* North pole ice cap */}
          <path d="M90,55 Q100,50 110,55 Q115,60 105,65 Q95,65 85,60 Q85,55 90,55" fill="white" stroke="black" strokeWidth="1" />
          
          {/* Face */}
          <circle cx="85" cy="95" r="3" fill="black" />
          <circle cx="115" cy="95" r="3" fill="black" />
          <path d="M90,110 Q100,120 110,110" fill="none" stroke="black" strokeWidth="2" />
          
          {/* Arms */}
          <line x1="50" y1="100" x2="25" y2="85" stroke="black" strokeWidth="3" />
          <line x1="150" y1="100" x2="175" y2="85" stroke="black" strokeWidth="3" />
          
          {/* Hands */}
          <path d="M22,85 Q20,80 25,78" stroke="black" strokeWidth="2" fill="none" />
          <path d="M22,85 Q20,90 25,92" stroke="black" strokeWidth="2" fill="none" />
          
          <path d="M178,85 Q180,80 175,78" stroke="black" strokeWidth="2" fill="none" />
          <path d="M178,85 Q180,90 175,92" stroke="black" strokeWidth="2" fill="none" />
          
          {/* Legs */}
          <line x1="95" y1="150" x2="95" y2="180" stroke="black" strokeWidth="3" />
          <line x1="105" y1="150" x2="105" y2="180" stroke="black" strokeWidth="3" />
          
          {/* Feet */}
          <line x1="95" y1="180" x2="85" y2="180" stroke="black" strokeWidth="3" />
          <line x1="105" y1="180" x2="115" y2="180" stroke="black" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
};

export default BouncingEarth;