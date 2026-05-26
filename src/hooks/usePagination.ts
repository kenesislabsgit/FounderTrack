import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function usePagination<T>(
  tableName: string,
  pageSize: number,
  orderByField: string,
  filterColumn?: string,
  filterValue?: any
): {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
} {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    try {
      let query = supabase
        .from(tableName)
        .select('*')
        .order(orderByField, { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filterColumn && filterValue !== undefined) {
        query = query.eq(filterColumn, filterValue);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        setHasMore(data.length === pageSize);
        if (page === 0) {
          setItems(data as unknown as T[]);
        } else {
          setItems((prev) => [...prev, ...(data as unknown as T[])]);
        }
      }
    } catch (error) {
      console.error('Pagination fetch error:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [tableName, pageSize, orderByField, filterColumn, filterValue]);

  useEffect(() => {
    pageRef.current = 0;
    fetchPage(0);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      pageRef.current += 1;
      fetchPage(pageRef.current);
    }
  }, [loading, hasMore, fetchPage]);

  return { items, loading, hasMore, loadMore };
}
