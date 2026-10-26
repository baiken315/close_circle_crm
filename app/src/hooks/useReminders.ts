import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Reminder } from '../types';

interface RemindersFilter {
  completed?: boolean;
  contact_id?: string;
  due_before?: string;
}

export function useReminders(filter?: RemindersFilter) {
  const params = new URLSearchParams();
  if (filter?.completed !== undefined) params.set('completed', String(filter.completed));
  if (filter?.contact_id) params.set('contact_id', filter.contact_id);
  if (filter?.due_before) params.set('due_before', filter.due_before);
  const qs = params.toString();

  return useQuery({
    queryKey: ['reminders', filter],
    queryFn: () => api.get<Reminder[]>(`/api/reminders${qs ? `?${qs}` : ''}`),
    staleTime: 5 * 60_000,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'completed' | 'contact_name'>) =>
      api.post<Reminder>('/api/reminders', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Reminder> & { id: string }) =>
      api.patch<Reminder>(`/api/reminders/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Reminder>(`/api/reminders/${id}/complete`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/api/reminders/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}
