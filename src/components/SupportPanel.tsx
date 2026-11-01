import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { SupportTicket, SupportMessage } from '../types';
import { MessageSquare, Send, Plus } from 'lucide-react';

export const SupportPanel: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    const res = await apiRequest<SupportTicket[]>('/api/support/tickets');
    if (res.success && res.data) setTickets(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const fetchMessages = async (ticketId: string) => {
    const res = await apiRequest<SupportMessage[]>(`/api/support/tickets/${ticketId}/messages`);
    if (res.success && res.data) setMessages(res.data);
  };

  const handleSelectTicket = (t: SupportTicket) => {
    setActiveTicket(t);
    fetchMessages(t.id);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    const res = await apiRequest<SupportTicket>('/api/support/tickets', {
      method: 'POST', body: JSON.stringify({ subject: newSubject })
    });
    if (res.success && res.data) {
      setNewSubject('');
      fetchTickets();
      handleSelectTicket(res.data);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket) return;
    const res = await apiRequest<SupportMessage>(`/api/support/tickets/${activeTicket.id}/messages`, {
      method: 'POST', body: JSON.stringify({ content: newMessage })
    });
    if (res.success && res.data) {
      setNewMessage('');
      fetchMessages(activeTicket.id);
    }
  };

  if (loading && tickets.length === 0) return <div className="p-8 text-center">در حال بارگذاری...</div>;

  return (
    <div className="bg-liquid-glass rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 border-l border-slate-200 dark:border-slate-800 flex flex-col bg-white/30 dark:bg-slate-800/20">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" /> تیکت‌های پشتیبانی
          </h3>
          <form onSubmit={handleCreateTicket} className="flex gap-2">
            <input
              type="text"
              placeholder="موضوع تیکت جدید..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
            />
            <button type="submit" className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              <Plus className="w-5 h-5" />
            </button>
          </form>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tickets.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">هیچ تیکتی یافت نشد.</div>
          ) : tickets.map(t => (
            <button
              key={t.id}
              onClick={() => handleSelectTicket(t)}
              className={`w-full text-right p-3 rounded-xl transition-colors ${
                activeTicket?.id === t.id ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="font-bold text-sm truncate">{t.subject}</div>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                  t.status === 'CLOSED' ? 'bg-slate-200 text-slate-600 dark:bg-slate-700' :
                  t.status === 'ANSWERED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                }`}>
                  {t.status === 'CLOSED' ? 'بسته شده' : t.status === 'ANSWERED' ? 'پاسخ داده شده' : 'باز'}
                </span>
                <span className="text-[10px] text-slate-400" dir="ltr">{new Date(t.createdAt).toLocaleDateString('fa-IR')}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="w-full md:w-2/3 flex flex-col bg-white/40 dark:bg-slate-900/40">
        {activeTicket ? (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-800 dark:text-white">{activeTicket.subject}</h4>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent">
              {messages.map(m => {
                const isMe = true; // In a real app, compare with current user ID
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                      isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <span className={`text-[9px] block mt-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`} dir="ltr">
                        {new Date(m.createdAt).toLocaleTimeString('fa-IR')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex gap-2">
              <input
                type="text"
                placeholder="پیام خود را بنویسید..."
                className="flex-1 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
              />
              <button type="submit" className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-transform active:scale-95">
                <Send className="w-5 h-5 rtl:-scale-x-100" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p>یک تیکت را برای مشاهده انتخاب کنید یا تیکت جدیدی بسازید.</p>
          </div>
        )}
      </div>
    </div>
  );
};
