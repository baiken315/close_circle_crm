import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ImportantDate } from '../types';

interface DatesResponse {
  upcoming: ImportantDate[];
  all: ImportantDate[];
}

export function useImportantDates(contactId: string) {
  return useQuery({
    queryKey: ['dates', contactId],
    queryFn: () => api.get<ImportantDate[]>(`/api/contacts/${contactId}/dates`),
    staleTime: 5 * 60_000,
  });
}

export function useAllDates(upcomingDays = 90) {
  return useQuery({
    queryKey: ['dates', 'all', upcomingDays],
    queryFn: () =>
      api.get<DatesResponse>(`/api/dates?upcoming_days=${upcomingDays}`),
    staleTime: 5 * 60_000,
  });
}

export function useAddImportantDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      contactId,
      ...data
    }: { contactId: string; title: string; date: string; notes?: string }) =>
      api.post<ImportantDate>(`/api/contacts/${contactId}/dates`, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['dates'] });
      void queryClient.invalidateQueries({ queryKey: ['contacts', variables.contactId] });
    },
  });
}

export function useUpdateImportantDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, dateId, ...data }: { contactId: string; dateId: string; title?: string; date?: string; notes?: string }) =>
      api.patch<ImportantDate>(`/api/contacts/${contactId}/dates/${dateId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dates'] });
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeleteImportantDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, dateId }: { contactId: string; dateId: string }) =>
      api.delete<{ success: boolean }>(`/api/contacts/${contactId}/dates/${dateId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dates'] });
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
