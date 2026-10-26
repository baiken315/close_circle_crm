import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { ChatSession, ChatMessage } from '../types';

export function useChatSessions() {
  return useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: () => api.get<ChatSession[]>('/api/chat/sessions'),
    staleTime: 30_000,
  });
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat', 'messages', sessionId],
    queryFn: () => api.get<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`),
    enabled: !!sessionId,
    staleTime: 0,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) =>
      api.post<ChatSession>('/api/chat/sessions', title ? { title } : undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
    },
  });
}

interface StreamingState {
  isStreaming: boolean;
  streamText: string;
  activeTools: Array<{ id: string; tool: string; status: 'running' | 'done' | 'error'; result?: unknown; error?: string }>;
}

export function useSendMessage(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [streamState, setStreamState] = useState<StreamingState>({
    isStreaming: false,
    streamText: '',
    activeTools: [],
  });

  const send = useCallback(
    (content: string): Promise<void> => {
      if (!sessionId || streamState.isStreaming) return Promise.resolve();

      return new Promise((resolve) => {
        setStreamState({ isStreaming: true, streamText: '', activeTools: [] });

        api.streamChatMessage(
          sessionId,
          content,
          (event) => {
            const type = event['type'] as string;
            if (type === 'text') {
              setStreamState((s) => ({ ...s, streamText: s.streamText + (event['text'] as string) }));
            } else if (type === 'tool_start') {
              const toolId = event['id'] as string;
              const toolName = event['tool'] as string;
              setStreamState((s) => ({
                ...s,
                activeTools: [...s.activeTools, { id: toolId, tool: toolName, status: 'running' }],
              }));
            } else if (type === 'tool_end') {
              const toolId = event['id'] as string;
              setStreamState((s) => ({
                ...s,
                activeTools: s.activeTools.map((t) =>
                  t.id === toolId ? { ...t, status: 'done', result: event['result'] } : t
                ),
              }));
            } else if (type === 'tool_error') {
              const toolId = event['id'] as string;
              setStreamState((s) => ({
                ...s,
                activeTools: s.activeTools.map((t) =>
                  t.id === toolId ? { ...t, status: 'error', error: event['error'] as string } : t
                ),
              }));
            }
          },
          () => {
            setStreamState((s) => ({ ...s, isStreaming: false }));
            void queryClient.invalidateQueries({ queryKey: ['chat', 'messages', sessionId] });
            void queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
            // Invalidate CRM data that might have changed
            void queryClient.invalidateQueries({ queryKey: ['contacts'] });
            void queryClient.invalidateQueries({ queryKey: ['reminders'] });
            void queryClient.invalidateQueries({ queryKey: ['dates'] });
            resolve();
          },
          (err) => {
            setStreamState((s) => ({ ...s, isStreaming: false }));
            resolve();
            console.error('Chat stream error:', err);
          }
        );
      });
    },
    [sessionId, streamState.isStreaming, queryClient]
  );

  return { send, ...streamState };
}
