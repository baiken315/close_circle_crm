import { useState, useRef, useEffect } from 'react';
import { ChatMessageComponent } from './ChatMessage';
import { StreamingToolCall } from './ToolCallBlock';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useChatSessions, useChatMessages, useCreateSession, useSendMessage } from '../../hooks/useChat';
import { useChatStore } from '../../stores/chat';

export function ChatPage() {
  const { activeSessionId, setActiveSessionId } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: sessions, isLoading: sessionsLoading } = useChatSessions();
  const { data: messages, isLoading: messagesLoading } = useChatMessages(activeSessionId);
  const createSession = useCreateSession();
  const { send, isStreaming, streamText, activeTools } = useSendMessage(activeSessionId);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText, activeTools]);

  const handleNewSession = async () => {
    const session = await createSession.mutateAsync(undefined);
    setActiveSessionId(session.id);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await createSession.mutateAsync(undefined);
      sessionId = session.id;
      setActiveSessionId(session.id);
    }

    const content = input.trim();
    setInput('');
    await send(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <div className="w-64 bg-slate-900/50 border-r border-slate-700/50 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-700/50">
          <button
            onClick={() => void handleNewSession()}
            disabled={createSession.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accent-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessionsLoading ? (
            <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
          ) : sessions?.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No conversations yet</p>
          ) : (
            sessions?.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                  activeSessionId === session.id
                    ? 'bg-accent/20 text-accent-300 border border-accent/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title={session.title}
              >
                {session.title}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mb-4">
              <svg className="w-9 h-9 text-accent-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">AI Assistant</h2>
            <p className="text-slate-400 max-w-sm mb-6">
              Ask me anything about your contacts, or have me create reminders, log interactions, and more.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
              {[
                "Who haven't I talked to in a while?",
                "Show me upcoming birthdays this month",
                "Create a reminder to follow up with John next week",
                "Log a call with Sarah today",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={async () => {
                    const session = await createSession.mutateAsync(undefined);
                    setActiveSessionId(session.id);
                    setTimeout(() => void send(prompt), 100);
                  }}
                  className="text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-sm text-slate-300 transition-colors"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messagesLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : messages?.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <p>Start the conversation by sending a message below.</p>
                </div>
              ) : (
                messages?.map((message) => (
                  <ChatMessageComponent key={message.id} message={message} />
                ))
              )}

              {/* Streaming content */}
              {isStreaming && (
                <div className="flex justify-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-1">
                    <svg className="w-5 h-5 text-accent-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                    </svg>
                  </div>
                  <div className="max-w-[80%] space-y-2">
                    {/* Active tool calls */}
                    {activeTools.length > 0 && (
                      <div className="space-y-1.5">
                        {activeTools.map((tool) => (
                          <StreamingToolCall
                            key={tool.id}
                            tool={tool.tool}
                            status={tool.status}
                            result={tool.result}
                            error={tool.error}
                          />
                        ))}
                      </div>
                    )}

                    {/* Streaming text */}
                    {streamText && (
                      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-bl-sm px-4 py-3">
                        <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">{streamText}</p>
                        <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse" />
                      </div>
                    )}

                    {/* Thinking indicator */}
                    {!streamText && activeTools.every((t) => t.status !== 'running') && (
                      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-bl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message the AI assistant... (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none min-h-[48px] max-h-[200px] leading-relaxed"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
                  }}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isStreaming}
                  className="p-3 bg-accent hover:bg-accent-400 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isStreaming ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
