import { useQuery } from '@tanstack/react-query';
import { listReferenceItems } from './api-client';

/**
 * `{ id, name }` options for a referenced collection.
 *
 * Every consumer (the form pickers, the cards resolving stored ids to names, and
 * the dashboard filters) shares this query key, so a referenced collection is
 * fetched once per session no matter how many components read it.
 */
export function useReferenceOptions(refCollectionId: string) {
  return useQuery({
    queryKey: ['reference-items', refCollectionId],
    queryFn: () => listReferenceItems(refCollectionId),
    staleTime: 5 * 60 * 1000, // options change rarely; cache for the session
  });
}
