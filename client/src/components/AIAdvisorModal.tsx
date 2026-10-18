import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User as UserIcon,
  Globe,
  TrendingUp,
  CloudSun,
  Loader2,
} from 'lucide-react';
import api from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { useAuth } from '../context/AuthContext.js';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface AIAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIAdvisorModal: React.FC<AIAdvisorModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text:
        language === 'te'
          ? 'నమస్కారం! నేను మీ AgriConnect AI వ్యవసాయ మరియు మార్కెట్ సలహాదారుని. పంట సంరక్షణ, తాజా మార్కెట్ ధరలు, లేదా కొనుగోలుదారుల డిమాండ్ గురించి నన్ను అడగండి.'
          : language === 'hi'
          ? 'नमस्ते! मैं आपका AgriConnect AI कृषि व मंडी सलाहकार हूँ। फसलों के भाव, कीट प्रबंधन, या थोक मांग के बारे में पूछें।'
          : 'Hello! I am your AgriConnect AI Farm & Market Co-Pilot. Ask me about real-time commodity prices, pest management, harvest schedules, or bulk demand trends.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [marketSignals, setMarketSignals] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      api
        .get('/ai/market-signals')
        .then((res) => {
          if (res.data.signals) setMarketSignals(res.data.signals.slice(0, 4));
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const prompt = textToSend || input;
    if (!prompt.trim() || loading) return;

    const userMsg: Message = {
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/advisor', {
        prompt,
        language,
        role: user?.role || 'buyer',
      });

      const aiMsg: Message = {
        sender: 'ai',
        text: res.data.response || 'Advice generated successfully.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        sender: 'ai',
        text: 'Sorry, I am temporarily unable to retrieve market insights. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const sampleChips =
    language === 'te'
      ? ['టమాట మార్కెట్ ధరలు ఎంత?', 'ఉల్లిపాయ పంటకు మంచి రేటు ఎప్పుడు వస్తుంది?', 'సేంద్రీయ బియ్యం డిమాండ్ వివరాలు']
      : language === 'hi'
      ? ['टमाटर का आज का मंडी भाव क्या है?', 'प्याज भंडारण और ग्रेडिंग सलाह', 'होटल और रेस्टोरेंट थोक मांग']
      : ["What are today's commodity price benchmarks?", 'How to protect tomato crops from leaf spot?', 'Which crops have the highest buyer demand this week?'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl h-[650px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-forest to-agri-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>AgriConnect AI Co-Pilot</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  Multilingual 2026
                </span>
              </h3>
              <p className="text-xs text-slate-300">Agricultural Agronomy & Market Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Pill */}
            <div className="flex bg-black/20 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded ${language === 'en' ? 'bg-emerald-500 text-white' : 'text-slate-300'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('te')}
                className={`px-2 py-0.5 rounded ${language === 'te' ? 'bg-emerald-500 text-white' : 'text-slate-300'}`}
              >
                తెలుగు
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2 py-0.5 rounded ${language === 'hi' ? 'bg-emerald-500 text-white' : 'text-slate-300'}`}
              >
                हिंदी
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Market Signals Ticker */}
        {marketSignals.length > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200/60 dark:border-emerald-900/60 px-4 py-2 flex items-center gap-3 overflow-x-auto text-[11px]">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>APMC Signals:</span>
            </span>
            {marketSignals.map((sig, idx) => (
              <span key={idx} className="shrink-0 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-200 dark:border-slate-700">
                <span className="font-semibold">{sig.commodity}: </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{sig.directAgriConnectFarmerPayout}</span>
                <span className="text-[9px] text-emerald-700 ml-1">({sig.trend})</span>
              </span>
            ))}
          </div>
        )}

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-xl bg-forest dark:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-agri-700 text-white rounded-br-none shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700/60'
                }`}
              >
                {msg.text}
                <div
                  className={`text-[9px] mt-1.5 font-mono ${
                    msg.sender === 'user' ? 'text-agri-200 text-right' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pl-11">
              <Loader2 className="w-4 h-4 animate-spin text-agri-600" />
              <span>Analyzing market data & agronomy models...</span>
            </div>
          )}
        </div>

        {/* Sample Prompt Chips */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex gap-1.5 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/50">
          {sampleChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="text-[11px] whitespace-nowrap px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-agri-500 hover:text-agri-600 dark:hover:text-agri-400 transition"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                language === 'te'
                  ? 'మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి...'
                  : language === 'hi'
                  ? 'अपना प्रश्न यहाँ लिखें...'
                  : 'Ask about crop pricing, weather alerts, harvesting, or buyer demand...'
              }
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-agri-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-agri-700 hover:bg-agri-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
