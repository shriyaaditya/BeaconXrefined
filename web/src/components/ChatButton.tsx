"use client"

import React, { useState } from "react";
import Chatbot from "@/components/Chatbot";
import { X } from "lucide-react"
import Bot from "@/components/Acon"

export default function ChatButton() {
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);

    return (
        <div className="overflow-hidden relative">
        {/* Chatbot Toggle Button */}
            <div className="relative overflow-hidden text-white z-100">
              <button 
               className={`fixed bottom-4 right-4 text-white p-2 rounded-full shadow-lg hover:bg-teal-700 transition ${
                !isChatbotOpen ? 'bg-transparent shadow-none hover:bg-transparent' : 'bg-teal-800'
              }`}
                onClick={() => setIsChatbotOpen(!isChatbotOpen)}
              >
                {isChatbotOpen ? <X size={28}/> : <Bot/>}
              </button>
        
              {/* Chatbot Pop-up */}
              {isChatbotOpen && (
                <div className="fixed bottom-20 right-4 w-96 h-105 overflow-y-auto rounded-lg shadow-xl flex flex-col text-[5px]">
                  <Chatbot />
                </div>
              )}
            </div>
        </div>
    )
}