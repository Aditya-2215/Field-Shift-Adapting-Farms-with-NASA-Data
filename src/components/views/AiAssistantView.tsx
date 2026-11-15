import React, { useEffect, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { DEMO_FARM_ID } from '../../../shared/data/demoFarm';
import type { AiChatMessage } from '../../../shared/types/agri';
import { useAuth } from '../../contexts/AuthContext';
import { useFarms } from '../../contexts/FarmContext';
import { apiClient } from '../../services/api';

const QUICK_PROMPTS = [
  'Why is my farm experiencing water stress?',
  'Which crops are suitable for my soil?',
  'Why is chickpea suggested in my rotation?',
  'How can crop rotation improve soil health?',
  'What happens if rainfall decreases?',
  'What are the risks of continuing my current rotation?'
];

function buildWelcomeMessage(farmName: string): AiChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: `Hello! I am AgriShift AI's Agricultural Assistant grounded in your selected farm (${farmName}), its NASA POWER climate metrics, soil profile, and crop rotation scores. Ask any question below—I will explain trade-offs transparently and highlight any missing data.`,
    timestamp: new Date().toISOString()
  };
}

export function AiAssistantView() {
  const { user } = useAuth();
  const { activeFarm, weights, assessment, nasaPower } = useFarms();
  const [messages, setMessages] = useState<AiChatMessage[]>([buildWelcomeMessage(activeFarm.name)]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPersistedParcel = Boolean(user && activeFarm.id !== DEMO_FARM_ID);

  useEffect(() => {
    let cancelled = false;
    const welcome = buildWelcomeMessage(activeFarm.name);

    if (!isPersistedParcel) {
      setMessages([welcome]);
      return;
    }

    setLoadingHistory(true);
    apiClient
      .getAiConversation(activeFarm.id)
      .then((conv) => {
        if (cancelled) return;
        if (conv && conv.messages.length > 0) {
          setMessages([welcome, ...conv.messages]);
        } else {
          setMessages([welcome]);
        }
      })
      .catch(() => {
        if (!cancelled) setMessages([welcome]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFarm.id, activeFarm.name, isPersistedParcel]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: AiChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString()
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.sendAiChat(
        activeFarm,
        trimmed,
        nextHistory.map((m) => ({ role: m.role, content: m.content })),
        weights
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Gemini assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111C15]">
            AI Agricultural Assistant
          </h1>
          <p className="text-sm text-[#4A5D50]">
            Grounded in {activeFarm.name} · Risk: {assessment?.overallRiskLevel ?? 'Analyzing'} ·{' '}
            {nasaPower?.isDemonstrationFallback ? 'Demonstration climate baseline' : 'Live NASA POWER'} ·{' '}
            {isPersistedParcel ? 'History saved to Database' : 'Session-only demo chat'}
            {loadingHistory ? ' · Loading history...' : ''}
          </p>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={loading}
            onClick={() => sendQuestion(q)}
            className="px-3 py-1.5 rounded-lg border border-[#DCE3DC] bg-white text-xs font-medium text-[#111C15] hover:border-[#1B4D3E] hover:bg-[#EDF2EC] transition-colors text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Container */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white flex flex-col h-[520px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#1B4D3E] text-white'
                    : 'bg-[#F6F8F5] border border-[#DCE3DC] text-[#111C15]'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1B4D3E] mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>AgriShift Scientific Assistant</span>
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-3 bg-[#F6F8F5] border border-[#DCE3DC] text-xs text-[#4A5D50]">
                Analyzing farm climate, soil metrics, and rotation scores...
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-lg border border-[#DC2626]/30 bg-[#FEE2E2]/40 px-3 py-2 text-xs text-[#DC2626]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-[#DCE3DC] p-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about water stress, soil health, crop suitability, or rotation trade-offs..."
            aria-label="Ask the agricultural assistant"
            className="flex-1 rounded-lg border border-[#DCE3DC] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send question"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1B4D3E] text-white text-sm font-semibold hover:bg-[#143B2F] disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Ask</span>
          </button>
        </form>
      </div>

      <p className="text-xs text-[#4A5D50]">
        Disclaimer: Responses summarize modeled indicators and agronomic references. They do not guarantee yield or income—validate major cropping decisions with your local agricultural officer or KVK.
      </p>
    </div>
  );
}
