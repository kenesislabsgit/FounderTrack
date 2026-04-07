import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { AttendanceRecord, UserProfile, DailyReport } from '../../types';
import { summarizeForAI } from '../../lib/summarize';
import { Button } from '@heroui/react';
import { Bot, Send, Trash2 } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function BotPage() {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allReports, setAllReports] = useState<DailyReport[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onErr = (err: Error) => console.warn('Firestore listener error:', err.message);
    const unsubs = [
      onSnapshot(collection(db, 'users'), (snap) =>
        setAllUsers(snap.docs.map((d) => d.data() as UserProfile)), onErr),
      onSnapshot(collection(db, 'attendance'), (snap) =>
        setAllAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord))), onErr),
      onSnapshot(collection(db, 'dailyReports'), (snap) =>
        setAllReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyReport))), onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || !user) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const summary = summarizeForAI(allUsers, allAttendance, allReports);
      const token = await user.getIdToken();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          summary,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.text }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I encountered an error processing your request. The AI service may not be available yet.' },
        ]);
      }
    } catch (err) {
      console.error('Bot error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. The AI proxy endpoint may not be configured yet.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))] flex items-center gap-3">
            <Bot size={24} />
            AI Analytics Bot
          </h2>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Ask questions about team performance and analytics.</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setMessages([])}
          >
            <Trash2 size={14} />
            Clear Chat
          </Button>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl glass p-6 space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot size={48} className="text-[hsl(var(--text-muted))]/30 mb-4" />
            <h3 className="text-lg font-bold text-[hsl(var(--text-muted))]/50">Ask me anything</h3>
            <p className="text-sm text-[hsl(var(--text-muted))] mt-1 max-w-md">
              I can analyze team performance, attendance patterns, task completion rates, and more.
            </p>
            <div className="flex flex-wrap gap-2 mt-6 justify-center">
              {[
                'How is the team performing this week?',
                'Who has the best attendance?',
                'What is the average task completion rate?',
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="ghost"
                  size="sm"
                  onPress={() => setInput(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'glass text-[hsl(var(--text-secondary))]'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl glass px-5 py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-[hsl(var(--accent))] border-t-transparent" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — keep as HTML input for onKeyDown support */}
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about team analytics..."
          className="flex-1 rounded-xl inset-well px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))]"
          disabled={loading}
        />
        <Button
          variant="primary"
          onPress={handleSend}
          isDisabled={loading || !input.trim()}
        >
          <Send size={18} />
        </Button>
      </div>
    </div>
  );
}
