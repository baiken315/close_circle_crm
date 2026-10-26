import { useState } from 'react';
import type { ToolCall } from '../../types';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

const TOOL_LABELS: Record<string, string> = {
  get_user_context: 'Got user context',
  search_contacts: 'Searched contacts',
  get_contact: 'Retrieved contact',
  create_contact: 'Created contact',
  update_contact: 'Updated contact',
  list_interactions: 'Listed interactions',
  log_interaction: 'Logged interaction',
  list_reminders: 'Listed reminders',
  create_reminder: 'Created reminder',
  complete_reminder: 'Completed reminder',
  list_important_dates: 'Listed important dates',
  add_important_date: 'Added important date',
};

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const label = TOOL_LABELS[toolCall.tool] ?? toolCall.tool;

  return (
    <div className={`text-xs rounded-lg border overflow-hidden ${
      toolCall.success
        ? 'bg-slate-800/60 border-slate-700/50'
        : 'bg-rose-900/10 border-rose-800/30'
    }`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/30 transition-colors"
      >
        <span className={toolCall.success ? 'text-emerald-400' : 'text-rose-400'}>
          {toolCall.success ? '✓' : '✗'}
        </span>
        <span className="text-slate-400">{label}</span>
        <svg
          className={`ml-auto w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-slate-700/50">
          {toolCall.input != null && Object.keys(toolCall.input as Record<string, unknown>).length > 0 && (
            <div className="mt-2">
              <span className="text-slate-500 block mb-1">Input:</span>
              <pre className="text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.output != null && (
            <div className="mt-2">
              <span className="text-slate-500 block mb-1">Output:</span>
              <pre className="text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap break-words max-h-48">
                {JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StreamingToolCallProps {
  tool: string;
  status: 'running' | 'done' | 'error';
  result?: unknown;
  error?: string;
}

export function StreamingToolCall({ tool, status, result, error }: StreamingToolCallProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const label = TOOL_LABELS[tool] ?? tool;

  return (
    <div className={`text-xs rounded-lg border overflow-hidden ${
      status === 'error'
        ? 'bg-rose-900/10 border-rose-800/30'
        : 'bg-slate-800/60 border-slate-700/50'
    }`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/30 transition-colors"
      >
        {status === 'running' ? (
          <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin shrink-0" />
        ) : status === 'done' ? (
          <span className="text-emerald-400">✓</span>
        ) : (
          <span className="text-rose-400">✗</span>
        )}
        <span className="text-slate-400">{label}</span>
        {status !== 'running' && (
          <svg
            className={`ml-auto w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {isExpanded && status !== 'running' && (
        <div className="px-3 pb-3 border-t border-slate-700/50 mt-1">
          {result != null && (
            <pre className="text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap break-words max-h-48 mt-2">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
          {error != null && <p className="text-rose-400 mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
