import { useState, useCallback, useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';

export function usePagination<T>(
  collectionPath: string,
  pageSize: number,
  orderByField: string,
  constraints?: QueryConstraint[]
): {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
} {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const initialLoadDone = useRef(false);

  const fetchPage = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
    setLoading(true);
    try {
      const baseConstraints: QueryConstraint[] = [
        ...(constraints ?? []),
        orderBy(orderByField),
        limit(pageSize),
      ];

      if (cursor) {
        baseConstraints.push(startAfter(cursor));
      }

      const q = query(collection(db, collectionPath), ...baseConstraints);
      const snapshot = await getDocs(q);

      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];

      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }

      setHasMore(snapshot.docs.length === pageSize);

      if (cursor) {
        setItems((prev) => [...prev, ...docs]);
      } else {
        setItems(docs);
      }
    } catch (error) {
      console.error('Pagination fetch error:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [collectionPath, pageSize, orderByField, constraints]);

  // Load first page on mount or when query params change
  useEffect(() => {
    lastDocRef.current = null;
    initialLoadDone.current = true;
    fetchPage(null);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && lastDocRef.current) {
      fetchPage(lastDocRef.current);
    }
  }, [loading, hasMore, fetchPage]);

  return { items, loading, hasMore, loadMore };
}
