import { FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send, Sprout, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { askAdvisor, type AdvisorLanguage } from '@/services/advisor';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

const copy: Record<AdvisorLanguage, { title: string; welcome: string; placeholder: string; send: string; open: string; close: string }> = {
  en: {
    title: 'AgriConnect farm assistant',
    welcome: 'Ask about crops, growing practices, or common farm issues. For urgent crop-protection decisions, contact a local agricultural officer.',
    placeholder: 'Ask an agricultural question…',
    send: 'Send',
    open: 'Open farm assistant',
    close: 'Close assistant',
  },
  te: {
    title: 'AgriConnect వ్యవసాయ సహాయకుడు',
    welcome: 'పంటలు, సాగు పద్ధతులు లేదా సాధారణ వ్యవసాయ సమస్యల గురించి అడగండి. అత్యవసర పంట రక్షణ నిర్ణయాలకు స్థానిక వ్యవసాయ అధికారిని సంప్రదించండి.',
    placeholder: 'వ్యవసాయ ప్రశ్న అడగండి…',
    send: 'పంపండి',
    open: 'వ్యవసాయ సహాయకుడిని తెరవండి',
    close: 'సహాయకుడిని మూసివేయండి',
  },
  hi: {
    title: 'AgriConnect कृषि सहायक',
    welcome: 'फसल, खेती के तरीकों या आम कृषि समस्याओं के बारे में पूछें। फसल-सुरक्षा के ज़रूरी निर्णयों के लिए स्थानीय कृषि अधिकारी से संपर्क करें।',
    placeholder: 'कृषि से जुड़ा सवाल पूछें…',
    send: 'भेजें',
    open: 'कृषि सहायक खोलें',
    close: 'सहायक बंद करें',
  },
};

export function AdvisorChat() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<AdvisorLanguage>('en');
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: 'assistant', text: copy.en.welcome }]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failedQuestion, setFailedQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const labels = copy[language];
  const mobileOffset = location.pathname.startsWith('/dashboard/marketplace') ? 'bottom-40' : 'bottom-24';

  useEffect(() => {
    if (messages.length === 1) {
      setMessages([{ id: 0, role: 'assistant', text: copy[language].welcome }]);
    }
  }, [language, messages.length]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, busy]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || busy) return;

    setPrompt('');
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text: question }]);
    await sendQuestion(question);
  }

  async function sendQuestion(question: string) {
    setError('');
    setBusy(true);
    try {
      const result = await askAdvisor(question, language);
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: result.response }]);
      setFailedQuestion('');
      setPrompt((current) => current === question ? '' : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reach the assistant. Please try again.');
      setFailedQuestion(question);
      setPrompt(question);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`fixed ${mobileOffset} right-4 z-[60] sm:bottom-6 sm:right-6`}>
      {open && (
        <section
          aria-label={labels.title}
          className="mb-3 flex h-[min(70dvh,34rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-forest/10 bg-ivory shadow-cinematic"
        >
          <header className="flex items-center justify-between gap-3 bg-forest px-4 py-3 text-ivory">
            <div className="flex min-w-0 items-center gap-2">
              <Sprout aria-hidden="true" className="h-5 w-5 shrink-0" />
              <h2 className="truncate text-base font-semibold">{labels.title}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={labels.close} className="rounded-lg p-2 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex items-center justify-between gap-3 border-b border-forest/10 px-4 py-2">
            <span className="text-xs text-charcoal/60">Language</span>
            <label>
              <span className="sr-only">Assistant language</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as AdvisorLanguage)}
                className="rounded-md border border-forest/15 bg-white px-2 py-1 text-sm text-charcoal"
              >
                <option value="en">English</option>
                <option value="te">తెలుగు</option>
                <option value="hi">हिन्दी</option>
              </select>
            </label>
          </div>

          <div ref={scrollRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <p
                key={message.id}
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto bg-agri-green text-white'
                    : 'bg-white text-charcoal shadow-sm'
                }`}
              >
                {message.text}
              </p>
            ))}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-charcoal/65" role="status">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Thinking…
              </p>
            )}
            {error && (
              <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                <p>{error}</p>
                <button
                  type="button"
                  disabled={busy || !failedQuestion}
                  onClick={() => void sendQuestion(failedQuestion)}
                  className="mt-2 font-semibold underline disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex items-end gap-2 border-t border-forest/10 bg-white p-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Your question</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={labels.placeholder}
                rows={1}
                maxLength={1000}
                disabled={busy}
                className="max-h-28 min-h-11 w-full resize-y rounded-xl border border-forest/15 bg-ivory px-3 py-2 text-base text-charcoal outline-none focus:border-agri-green focus:ring-2 focus:ring-agri-green/20 disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !prompt.trim()}
              aria-label={labels.send}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-agri-green px-3 text-sm font-medium text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">{labels.send}</span>
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-agri-green text-white shadow-cinematic transition hover:scale-105 hover:bg-forest focus:outline-none focus:ring-4 focus:ring-agri-green/30"
      >
        {open ? <X aria-hidden="true" className="h-6 w-6" /> : <MessageCircle aria-hidden="true" className="h-6 w-6" />}
      </button>
    </div>
  );
}
