import {useFixtureInput} from 'react-cosmos/client';
import {useEffect, useMemo, useRef} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {createQueryClient} from '@/api/react-query/tsr';
import {tagApi, tagQueries} from '@/api/tag';
import type {TagDTO} from '@package/contract';
import {TagEditor} from './BookTagsExample';

// In-memory stores to simulate domain tags and book-attached tags
function createStores() {
  const domainTags = new Map<string, TagDTO>();
  const bookTags = new Map<string, TagDTO>();
  return {domainTags, bookTags};
}

export default function Fixture() {
  const qc = useMemo(() => createQueryClient(), []);
  const storesRef = useRef(createStores());

  const [controls] = useFixtureInput('Controls', {
    bookUnitId: 'book-1',
    domainId: 'domain-1',
    seedDomain: ['Fantasy', 'Sci-Fi', 'Classic'],
    seedAttached: ['Fantasy'],
  });

  // Monkey patch tagApi methods to use in-memory stores for this fixture
  useEffect(() => {
    const {domainTags, bookTags} = storesRef.current;

    // Reset stores based on controls
    domainTags.clear();
    controls.seedDomain.forEach((name, i) => {
      const t = {
        id: `d${i + 1}`,
        name,
        type: name === 'Classic' ? 'general' : 'genre',
      } as TagDTO;
      domainTags.set(t.id, t);
    });
    bookTags.clear();
    controls.seedAttached.forEach(name => {
      const found = Array.from(domainTags.values()).find(t => t.name === name);
      if (found) bookTags.set(found.id, found);
    });

    // Override list to support domain or object lookups (and optional type)
    const originalList = tagApi.list;
    const originalAttach = tagApi.attachToUnit;
    const originalDetach = tagApi.detachFromUnit;
    const originalCreate = tagApi.create;

    tagApi.list = async (params?: any) => {
      if (params?.objectId) {
        // Return tags attached to the book
        let list = Array.from(bookTags.values());
        if (params?.type) list = list.filter(t => t.type === params.type);
        return {tags: list, total: list.length};
      }
      if (params?.domainId) {
        // Return domain tags available
        let list = Array.from(domainTags.values());
        if (params?.type) list = list.filter(t => t.type === params.type);
        return {tags: list, total: list.length};
      }
      // Fallback: return union
      const list = Array.from(
        new Set([...domainTags.values(), ...bookTags.values()]),
      );
      return {tags: list, total: list.length};
    };

    tagApi.attachToUnit = async (tagId: string, _bookUnitId: string) => {
      const t = domainTags.get(tagId);
      if (t) bookTags.set(tagId, t);
      // Simulate refetch by updating cache for both lists
      const listKey = tagQueries.list({
        objectId: controls.bookUnitId,
        limit: 100,
      }).queryKey;
      const availableKey = tagQueries.list({
        domainId: controls.domainId,
        limit: 1000,
      }).queryKey;
      const attached = Array.from(bookTags.values());
      const available = Array.from(domainTags.values()).filter(
        t => !bookTags.has(t.id),
      );
      qc.setQueryData(listKey, {tags: attached, total: attached.length});
      qc.setQueryData(availableKey, {tags: available, total: available.length});
      return {message: 'attached'} as any;
    };

    tagApi.detachFromUnit = async (tagId: string, _bookUnitId: string) => {
      bookTags.delete(tagId);
      const listKey = tagQueries.list({
        objectId: controls.bookUnitId,
        limit: 100,
      }).queryKey;
      const availableKey = tagQueries.list({
        domainId: controls.domainId,
        limit: 1000,
      }).queryKey;
      const attached = Array.from(bookTags.values());
      const available = Array.from(domainTags.values()).filter(
        t => !bookTags.has(t.id),
      );
      qc.setQueryData(listKey, {tags: attached, total: attached.length});
      qc.setQueryData(availableKey, {tags: available, total: available.length});
      return {message: 'detached'} as any;
    };

    tagApi.create = async (input: any) => {
      const id = `d${domainTags.size + 1}`;
      const t = {
        id,
        name: input?.name ?? `New ${id}`,
        type: input?.type ?? 'general',
      } as TagDTO;
      domainTags.set(id, t);
      // Also keep domain cache fresh
      const availableKey = tagQueries.list({
        domainId: controls.domainId,
        limit: 1000,
      }).queryKey;
      const available = Array.from(domainTags.values()).filter(
        x => !bookTags.has(x.id),
      );
      qc.setQueryData(availableKey, {tags: available, total: available.length});
      return t as any;
    };

    // Seed initial caches for lists used by TagEditor
    const listKey = tagQueries.list({
      objectId: controls.bookUnitId,
      limit: 100,
    }).queryKey;
    const availableKey = tagQueries.list({
      domainId: controls.domainId,
      limit: 1000,
    }).queryKey;
    const attached = Array.from(bookTags.values());
    const available = Array.from(domainTags.values()).filter(
      t => !bookTags.has(t.id),
    );
    qc.setQueryData(listKey, {tags: attached, total: attached.length});
    qc.setQueryData(availableKey, {tags: available, total: available.length});

    return () => {
      // restore originals when controls change/unmount
      tagApi.list = originalList;
      tagApi.attachToUnit = originalAttach;
      tagApi.detachFromUnit = originalDetach;
      tagApi.create = originalCreate;
    };
  }, [controls, qc]);

  return (
    <QueryClientProvider client={qc}>
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">TagEditor</h3>
        <p className="text-sm text-gray-500">
          Domain: {controls.domainId} · Book: {controls.bookUnitId}
        </p>
        <TagEditor
          bookUnitId={controls.bookUnitId}
          domainId={controls.domainId}
        />
      </div>
    </QueryClientProvider>
  );
}
