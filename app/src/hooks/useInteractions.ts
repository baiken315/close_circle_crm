import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Interaction } from '../types';

export function useInteractions(contactId: string | null) {
  return useQuery({
    queryKey: ['interactions', contactId],
    queryFn: () => api.get<Interaction[]>(`/api/contacts/${contactId}/interactions`),
    enabled: !!contactId,
    staleTime: 5 * 60_000,
  });
}

export function useLogInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      contactId,
      ...data
    }: { contactId: string; type: Interaction['type']; date: string; notes?: string }) =>
      api.post<Interaction>(`/api/contacts/${contactId}/interactions`, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['interactions', variables.contactId] });
      void queryClient.invalidateQueries({ queryKey: ['contacts', variables.contactId] });
    },
  });
}

export function useUpdateInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string; type?: Interaction['type']; date?: string; notes?: string }) =>
      api.patch<Interaction>(`/api/interactions/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interactions'] });
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeleteInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/api/interactions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interactions'] });
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
