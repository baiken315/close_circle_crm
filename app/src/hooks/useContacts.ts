import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Contact } from '../types';

export function useContacts(search?: string) {
  return useQuery({
    queryKey: ['contacts', search ?? ''],
    queryFn: () => api.get<Contact[]>(`/api/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    staleTime: 5 * 60_000,
  });
}

export function useContact(id: string | null) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: () => api.get<Contact>(`/api/contacts/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Contact>) => api.post<Contact>('/api/contacts', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Contact> & { id: string }) =>
      api.patch<Contact>(`/api/contacts/${id}`, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['contacts', updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/api/contacts/${id}`),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ['contacts', id] });
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useBulkCreateContacts() {
  const queryClient = useQueryClient();
  return {
    mutate: async (contacts: Partial<Contact>[]) => {
      const results: { created: number; skipped: number; failed: number } = {
        created: 0,
        skipped: 0,
        failed: 0,
      };

      for (const data of contacts) {
        try {
          await api.post<Contact>('/api/contacts', data);
          results.created++;
        } catch {
          results.failed++;
        }
      }

      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      return results;
    },
  };
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, photoData }: { contactId: string; photoData: string }) =>
      api.post<{ photo_path: string }>(`/api/contacts/${contactId}/photo`, { photo_data: photoData }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) =>
      api.delete<{ success: boolean }>(`/api/contacts/${contactId}/photo`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
