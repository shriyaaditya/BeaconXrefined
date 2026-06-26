"use client"

import { useState, useRef, useEffect, FormEvent } from "react"
import { Send, Mic, AlertCircle, Volume2 } from "lucide-react"
import Image from "next/image"

declare global {
  interface SpeechRecognitionConstructor {
    new(): SpeechRecognition
  }

  interface SpeechRecognition extends EventTarget {
    start(): void
    stop(): void
    abort(): void
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: (event: SpeechRecognitionEvent) => void
    onerror: (event: SpeechRecognitionErrorEvent) => void
    onend: () => void
  }

  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string
    message: string
  }
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

interface ChatResponse {
  response_id: string
  message: string
  timestamp: string
  context?: Record<string, string>
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ""

  useEffect(() => {
    setMessages([{
      id: "1",
      role: "assistant",
      content: "Hi there! 👋 I'm Acon, your friendly helper during emergencies. How can I help you today?",
      timestamp: new Date().toISOString(),
    }])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      setIsListening(false)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error, event.message)
      setIsListening(false)
    }

    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition

    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!recognitionRef.current) return
    
    if (isListening) {
      recognitionRef.current.start()
    } else {
      recognitionRef.current.stop()
    }
  }, [isListening])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input }),
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const data: ChatResponse = await response.json()

      const assistantMessage: Message = {
        id: data.response_id,
        role: "assistant",
        content: data.message,
        timestamp: data.timestamp,
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Removed automatic speech synthesis
    } catch (error) {
      console.error("Chat error:", error)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Oops! Something went wrong. Let's try again! 🙂",
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1.1

      setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      
      window.speechSynthesis.speak(utterance)
    }
  }

  const formatMessage = (text: string): { __html: string } => {
    const formatted = text
      .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br />")
    return { __html: formatted }
  }

  return (
    <div className="flex flex-col h-screen bg-teal-50">
      <header className="bg-teal-500 text-white p-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-5 h-5 rounded-full bg-white p-1 mr-3 flex items-center justify-center">
              <AlertCircle className="text-teal-500" size={15} />
            </div>
            <h1 className="text-[20px] font-bold">Acon</h1>
          </div>
          <div className="text-xs bg-teal-600 px-3 py-1 rounded-full">Emergency Helper</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 container mx-auto max-w-4xl text-xs">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center mr-2">
                  <Image
                    src="https://res.cloudinary.com/dk6m1qejk/image/upload/v1743224946/BeaconX/vucn1vauizfpcsgietkd.png"
                    alt="BeaconX"
                    width={30}
                    height={30}
                    className="rounded-full"
                  />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  message.role === "user" 
                    ? "bg-teal-500 text-white" 
                    : "bg-white text-gray-800 border-2 border-teal-200"
                }`}
              >
                <p 
                  className="whitespace-pre-wrap text-sm" 
                  dangerouslySetInnerHTML={formatMessage(message.content)}
                />
                {message.role === "assistant" && (
                  <button
                    onClick={() => speakText(message.content.replace(/\*(.*?)\*/g, "$1"))}
                    className={`mt-2 flex items-center text-sm ${
                      isSpeaking && message.id === messages[messages.length - 1]?.id
                        ? "text-teal-800 font-bold"
                        : "text-teal-600 hover:text-teal-800"
                    }`}
                    disabled={isSpeaking}
                    aria-label={isSpeaking ? "Currently speaking" : "Read message aloud"}
                  >
                    <Volume2
                      size={13}
                      className={`mr-1 ${
                        isSpeaking && message.id === messages[messages.length - 1]?.id ? "animate-pulse" : ""
                      }`}
                    />
                    {isSpeaking && message.id === messages[messages.length - 1]?.id ? "Speaking..." : "Listen"}
                  </button>
                )}
              </div>
              {message.role === "user" && (
                <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center ml-2">
                  <span className="text-white font-bold">You</span>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center mr-2">
                <Image
                  src="https://res.cloudinary.com/dk6m1qejk/image/upload/v1743224946/BeaconX/vucn1vauizfpcsgietkd.png"
                  alt="BeaconX"
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              </div>
              <div className="max-w-[80%] rounded-2xl p-6 bg-white text-gray-800 border-2 border-teal-200">
                <div className="flex space-x-3">
                  <div className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t-4 border-teal-200 p-3 bg-white h-[90px]">
        <div className="container mx-auto max-w-2xl h-[2px]">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "Ask me anything..."}
              className="flex-1 p-2 text-sm text-black border-2 border-teal-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-200 focus:border-teal-500"
              disabled={isLoading || isListening}
              aria-label="Type your message"
            />
            <button
              type="button"
              onClick={() => setIsListening(prev => !prev)}
              className={`p-2 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-200 ${
                isListening 
                  ? "bg-red-500 text-white hover:bg-red-600" 
                  : "bg-teal-100 text-teal-600 hover:bg-teal-200"
              }`}
              disabled={isLoading}
              aria-label={isListening ? "Stop recording" : "Start voice recording"}
            >
              <Mic size={20} />
            </button>
            <button
              type="submit"
              className="bg-teal-500 text-white p-2 rounded-2xl hover:bg-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </form>
          <p className="text-center mt-2 text-teal-600 text-sm">
            {isListening
              ? "I'm listening to you! Speak clearly..."
              : "Type your question or click the microphone to speak"}
          </p>
        </div>
      </div>
    </div>
  )
}