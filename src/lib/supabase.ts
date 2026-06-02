import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SubscriptionFilter {
  column: string;
  value: any;
  operator?: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
}

// Global in-memory query cache to eliminate page transition skeleton loaders
const globalQueryCache = new Map<string, any[]>();

/**
 * Clears the entire in-memory query cache.
 * Must be called on user sign-out to prevent data leakage between different
 * users sharing the same browser session or tab.
 */
export function clearQueryCache(): void {
  globalQueryCache.clear();
}

/**
 * Subscribes to real-time changes on a Supabase table.
 * Fetches the initial data set matching the filters, sorting, and limits,
 * and sets up a realtime postgres change channel to re-fetch and invoke the callback on updates.
 *
 * @param table - The name of the database table
 * @param options - Query configuration (orderBy, filters, limit)
 * @param callback - Callback invoked with the updated list of records
 * @returns An unsubscribe function that cancels the real-time subscription
 */
export function subscribeToTable<T>(
  table: string,
  options: {
    orderBy?: { column: string; ascending?: boolean };
    filters?: SubscriptionFilter[];
    limit?: number;
  },
  callback: (data: T[]) => void
): () => void {
  // Construct a stable cache key
  const cacheKey = JSON.stringify({ table, options });

  // If a dataset is already present in our memory cache, deliver it synchronously
  // to avoid skeleton loader flashes or layout resets upon component remounts.
  const cached = globalQueryCache.get(cacheKey);
  if (cached) {
    callback(cached as T[]);
  }

  const fetchData = async () => {
    let query = supabase.from(table).select('*');

    if (options.filters) {
      for (const filter of options.filters) {
        const op = filter.operator ?? 'eq';
        if (op === 'eq') {
          query = query.eq(filter.column, filter.value);
        } else if (op === 'neq') {
          query = query.neq(filter.column, filter.value);
        } else if (op === 'gt') {
          query = query.gt(filter.column, filter.value);
        } else if (op === 'lt') {
          query = query.lt(filter.column, filter.value);
        } else if (op === 'gte') {
          query = query.gte(filter.column, filter.value);
        } else if (op === 'lte') {
          query = query.lte(filter.column, filter.value);
        } else if (op === 'in') {
          query = query.in(filter.column, filter.value);
        }
      }
    }

    if (options.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`[Supabase] Error fetching initial data for ${table}:`, error.message);
      // Even on error, we must invoke the callback to clear loading states in components.
      // We pass the cached version if it exists, otherwise an empty array.
      callback((globalQueryCache.get(cacheKey) || []) as T[]);
      return;
    }

    // Keep global cache in sync with the latest fetched dataset
    globalQueryCache.set(cacheKey, data);

    callback(data as T[]);
  };

  // Fetch initial data immediately
  fetchData();

  // Create real-time subscription channel
  const channelId = `${table}_changes_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        // Optimization: Only re-fetch if the changed row matches our filters
        // This prevents the "thundering herd" where User A's update causes User B to re-fetch
        if (options.filters && options.filters.length > 0) {
          const matches = options.filters.every(filter => {
            const val = payload.new[filter.column] ?? payload.old[filter.column];
            return val === filter.value;
          });
          if (!matches) return;
        }
        
        console.log(`[Realtime] ${table} updated, re-fetching...`);
        fetchData();
      }
    )
    .subscribe();

  // Return the unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}
