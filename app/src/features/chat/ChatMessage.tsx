import { ToolCallBlock } from './ToolCallBlock';
import type { ChatMessage as ChatMessageType } from '../../types';
import { formatDistanceToNow } from 'date-fns';

interface ChatMessageProps {
  message: ChatMessageType;
}

function renderMarkdown(text: string): React.ReactNode {
  // Simple markdown: bold, italic, code, line breaks
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('# ')) {
      return <h1 key={i} className="text-lg font-bold mt-2 mb-1">{line.slice(2)}</h1>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={i} className="text-base font-semibold mt-2 mb-1">{line.slice(3)}</h2>;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return <div key={i} className="flex gap-2"><span>•</span><span>{line.slice(2)}</span></div>;
    }
    if (line.startsWith('```')) {
      return null; // Skip code fence markers
    }
    if (line.trim() === '') {
      return <br key={i} />;
    }

    // Inline formatting
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partIdx = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`(.+?)`/);

      const firstBold = boldMatch?.index ?? Infinity;
      const firstCode = codeMatch?.index ?? Infinity;

      if (firstBold === Infinity && firstCode === Infinity) {
        parts.push(<span key={partIdx++}>{remaining}</span>);
        break;
      }

      if (firstBold < firstCode) {
        if (firstBold > 0) parts.push(<span key={partIdx++}>{remaining.slice(0, firstBold)}</span>);
        parts.push(<strong key={partIdx++} className="font-semibold">{boldMatch![1]}</strong>);
        remaining = remaining.slice(firstBold + (boldMatch![0]?.length ?? 0));
      } else {
        if (firstCode > 0) parts.push(<span key={partIdx++}>{remaining.slice(0, firstCode)}</span>);
        parts.push(
          <code key={partIdx++} className="bg-slate-700 px-1 py-0.5 rounded text-xs font-mono text-amber-300">
            {codeMatch![1]}
          </code>
        );
        remaining = remaining.slice(firstCode + (codeMatch![0]?.length ?? 0));
      }
    }

    return <p key={i} className="leading-relaxed">{parts}</p>;
  });
}

export function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-1">
          <svg className="w-5 h-5 text-accent-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {/* Tool calls (only for assistant messages) */}
        {!isUser && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {message.tool_calls.map((tc, i) => (
              <ToolCallBlock key={i} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message bubble */}
        {message.content && (
          <div className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-accent text-white rounded-br-sm'
              : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-sm'
          }`}>
            {isUser ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="text-sm space-y-0.5">{renderMarkdown(message.content)}</div>
            )}
          </div>
        )}

        <div className={`mt-1 text-xs text-slate-600 ${isUser ? 'text-right' : ''}`}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
