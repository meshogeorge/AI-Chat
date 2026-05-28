/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bot, 
  User, 
  Send, 
  Trash2, 
  Sparkles, 
  Loader2, 
  Settings2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Image as ImageIcon,
  X
} from "lucide-react";

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  timestamp: number;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamingEnabled, setIsStreamingEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      image: selectedImage || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      if (isStreamingEnabled) {
        await handleStreamingResponse(userMessage);
      } else {
        await handleStandardResponse(userMessage);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "I'm sorry, I encountered an error. Please try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStandardResponse = async (userMsg: Message) => {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [...messages, userMsg].map(msg => {
        const parts: any[] = [{ text: msg.text }];
        if (msg.image) {
          const [mimeInfo, data] = msg.image.split(',');
          const mimeType = mimeInfo.split(':')[1].split(';')[0];
          parts.push({
            inlineData: {
              data: data,
              mimeType: mimeType
            }
          });
        }
        return {
          role: msg.role,
          parts: parts
        };
      }),
      config: {
        systemInstruction: getSystemInstruction()
      }
    });

    const aiMessage: Message = {
      id: Date.now().toString(),
      role: 'model',
      text: response.text || "I'm not sure how to respond to that.",
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, aiMessage]);
  };

  const handleStreamingResponse = async (userMsg: Message) => {
    const responseStream = await genAI.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [...messages, userMsg].map(msg => {
        const parts: any[] = [{ text: msg.text }];
        if (msg.image) {
          const [mimeInfo, data] = msg.image.split(',');
          const mimeType = mimeInfo.split(':')[1].split(';')[0];
          parts.push({
            inlineData: {
              data: data,
              mimeType: mimeType
            }
          });
        }
        return {
          role: msg.role,
          parts: parts
        };
      }),
      config: {
        systemInstruction: getSystemInstruction()
      }
    });

    const aiMessageId = (Date.now() + 2).toString();
    const initialAiMessage: Message = {
      id: aiMessageId,
      role: 'model',
      text: '',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, initialAiMessage]);

    let fullText = '';
    for await (const chunk of responseStream) {
      const chunkText = (chunk as GenerateContentResponse).text;
      if (chunkText) {
        fullText += chunkText;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === aiMessageId ? { ...msg, text: fullText } : msg
          )
        );
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSelectedImage(null);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getSystemInstruction = () => {
    const now = new Date();
    const timeStr = now.toLocaleString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
    return `You are a smart, witty AI assistant with a natural and slightly playful personality. You have a sharp, helpful, and professional tone, using humor and emojis where appropriate to keep the conversation engaging. Show your personality through your wit and insights rather than stating it.

Focus on accuracy and organization:
- Be extremely precise and quick with calculations and logic. Do not make mistakes in math.
- Keep your answers highly organized, structured, and easy to read.
- Use clear, professional, yet friendly language. Avoid any weird symbols, broken formatting, or glitches in your output.
- Ensure all your responses are coherent and well-structured.

Strict Safety Rule: Do NOT discuss, mention, or engage with any +18, sexually explicit, or adult content under any circumstances, even if the user asks about personal or marital relationships. Always decline such requests politely but firmly.

Current Date and Time: ${timeStr}

Identity rules: 
1. If anyone asks for your name in English, say: 'I'm your smart AI assistant, designed by Michael George.' 
2. If anyone asks for your name in Arabic (like 'اسمك ايه'), say: 'انا مساعدك الذكي تم تصميمي بواسطة ميشيل جورج'`;
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      <div className="bg-atmosphere" />
      
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0, x: -20 }}
            animate={{ width: 288, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -20 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="aura-sidebar flex-none flex flex-col p-6 h-full overflow-hidden whitespace-nowrap"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm">
                AI
              </div>
              <span className="font-bold text-lg tracking-tight">AI Chat</span>
            </div>

            <button 
              onClick={clearChat}
              className="w-full bg-slate-50 text-slate-900 py-3 rounded-xl font-semibold mb-8 hover:bg-white transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              New Conversation
            </button>

            <div className="flex-1" />

            <div className="mt-auto space-y-1">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`nav-item w-full ${showSettings ? 'active' : ''}`}
              >
                <Settings2 className="w-5 h-5" />
                Settings
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 p-8 relative">
        <header className="flex-none flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <div>
              <h2 className="text-xl font-bold m-0">Conversation</h2>
              <div className="flex items-center gap-2 mt-1 text-[13px] text-slate-400">
                <span className="status-dot"></span>
                System active
              </div>
            </div>
          </div>
        </header>

        {/* Messages List */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-6 mb-6 scrollbar-thin scrollbar-thumb-white/5 pr-2"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-40">
              <Bot className="w-16 h-16" />
              <p className="text-xl font-medium">Start a new dialogue...</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`
                    max-w-[80%] p-4 md:p-5 text-base md:text-lg leading-relaxed whitespace-pre-wrap break-words
                    ${message.role === 'user' ? 'user-bubble text-white' : 'ai-bubble text-slate-100'}
                  `}>
                    {message.image && (
                      <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
                        <img src={message.image} alt="User upload" className="max-w-full h-auto object-cover max-h-64" />
                      </div>
                    )}
                    {message.text || (isLoading && message.role === 'model' && '...')}
                  </div>
                  {/* Timestamp removed for cleaner look as per mockup */}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Container */}
        <div className="flex-none relative">
          {/* Settings Overlay Portaled Inside Main */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-0 mb-4 w-64 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl z-30"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Model Options</h3>
                  <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm font-medium group-hover:text-white transition-colors">Streaming Mode</span>
                  <input 
                    type="checkbox" 
                    checked={isStreamingEnabled}
                    onChange={(e) => setIsStreamingEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-indigo-500/50"
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            {/* Image Preview */}
            <AnimatePresence>
              {selectedImage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-full left-0 mb-4 group"
                >
                  <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl backdrop-blur-xl bg-white/5 p-2">
                    <img src={selectedImage} alt="Preview" className="w-32 h-32 object-cover rounded-xl" />
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Ask anything..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 pr-44 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md placeholder:text-slate-500 transition-all"
              disabled={isLoading}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
                disabled={isLoading}
                title="Attach image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <span className="hidden md:block text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Enter</span>
              <button 
                onClick={handleSend}
                disabled={(!input.trim() && !selectedImage) || isLoading}
                className={`
                  w-9 h-9 rounded-lg flex items-center justify-center transition-all
                  ${(input.trim() || selectedImage) && !isLoading 
                    ? 'bg-indigo-600 text-white hover:shadow-[0_0_15px_rgba(79,70,229,0.5)]' 
                    : 'bg-white/10 text-slate-500 opacity-50 cursor-not-allowed'}
                `}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
