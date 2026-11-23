import { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { gatewayFetch } from '../lib/gatewayClient';
import {
  VectorProviderId,
  VectorProviderStatus,
  VectorRecordCategory,
  VectorRecordDocument,
  VectorSearchHit,
  VectorSearchResponse,
} from '../types/humanos';

interface VectorSearchPanelProps {
  documents: VectorRecordDocument[];
  onAfterOperation?: () => void;
}

const CATEGORIES: ('All' | VectorRecordCategory)[] = [
  'All',
  'Session',
  'Journal',
  'Goal',
  'Assessment',
  'Event Analysis',
  'Dynamic User Model',
];

export function VectorSearchPanel({
  documents,
  onAfterOperation,
}: VectorSearchPanelProps) {
  const [providers, setProviders] = useState<VectorProviderStatus[]>([]);
  const [selectedProvider, setSelectedProvider] =
    useState<VectorProviderId>('azure-ai-search');
  const [categoryFilter, setCategoryFilter] =
    useState<'All' | VectorRecordCategory>('All');
  const [query, setQuery] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexNotice, setIndexNotice] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<VectorSearchResponse | null>(null);

  const loadStatuses = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await gatewayFetch('/api/vector/status');
      const data = await res.json();
      if (res.ok && Array.isArray(data.providers)) {
        setProviders(data.providers);
      }
    } catch {
      // Keep non-blocking on initial mount
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const activeProviderMeta = providers.find((p) => p.id === selectedProvider);

  const handleIndexWorkspace = async () => {
    if (documents.length === 0) {
      setError(
        'No workspace records available yet. Add a reflection session, journal, goal, assessment, event analysis, or Dynamic User Model entry first.'
      );
      return;
    }
    setIsIndexing(true);
    setError(null);
    setIndexNotice(null);

    try {
      const res = await gatewayFetch('/api/vector/index', {
        method: 'POST',
        body: JSON.stringify({
          provider: selectedProvider,
          documents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not index records into vector store.');
      }
      if (Array.isArray(data.providers)) {
        setProviders(data.providers);
      }
      setIndexNotice(
        `Indexed ${data.indexedCount} workspace records into ${data.providerName} (${data.embeddingDimension}-dim Gemini vectors, ${data.latencyMs}ms).`
      );
      onAfterOperation?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Vector indexing failed.');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2 || isSearching) return;

    setIsSearching(true);
    setError(null);
    try {
      const res = await gatewayFetch('/api/vector/search', {
        method: 'POST',
        body: JSON.stringify({
          provider: selectedProvider,
          query: trimmed,
          topK: 6,
          categoryFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Vector search failed.');
      }
      setSearchResult(data as VectorSearchResponse);
      onAfterOperation?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Vector search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearProviderIndex = async () => {
    setError(null);
    setIndexNotice(null);
    try {
      const res = await gatewayFetch(`/api/vector/clear?provider=${selectedProvider}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.providers)) {
        setProviders(data.providers);
      }
      setSearchResult(null);
    } catch {
      // Ignore cleanup error gracefully
    }
  };

  return (
    <section className="border border-[#1C1917]/12 rounded-lg bg-[#FBF9F5] p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1C1917]/10 pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-medium text-[#1E3A5F]">
            Memory Engine · Multi-Backend Vector Retrieval
          </div>
          <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
            Azure AI Search, Weaviate, Qdrant & Pinecone
          </h2>
          <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
            Embeds workspace records with server-side Gemini embeddings and routes queries to your selected vector search engine (live cloud cluster via server secrets, or session-scoped local vector runtime).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadStatuses}
            disabled={loadingStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#1C1917]/20 rounded-md hover:bg-[#EBE6DF] whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleIndexWorkspace}
            disabled={isIndexing || documents.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 whitespace-nowrap"
          >
            {isIndexing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Indexing ({documents.length})...</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5" />
                <span className="tabular-nums">Index {documents.length} Records</span>
              </>
            )}
          </button>

          {(activeProviderMeta?.indexedCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={handleClearProviderIndex}
              aria-label="Clear vector index"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#78716C] hover:text-[#9A3412] whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Vector Provider Selector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {providers.map((provider) => {
          const active = selectedProvider === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                setSelectedProvider(provider.id);
                setSearchResult(null);
              }}
              className={`text-left p-4 rounded-lg border transition-colors flex flex-col justify-between space-y-3 ${
                active
                  ? 'border-[#1E3A5F] bg-[#F4F0E8]/85'
                  : 'border-[#1C1917]/12 bg-[#F4F0E8]/35 hover:bg-[#F4F0E8]/65'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-lg font-medium text-[#1C1917]">
                    {provider.name}
                  </span>
                  <span className="font-mono text-xs text-[#1E3A5F] tabular-nums shrink-0">
                    {provider.indexedCount} docs
                  </span>
                </div>
                <p className="text-xs text-[#57534E] leading-relaxed">{provider.subtitle}</p>
              </div>

              <div className="border-t border-[#1C1917]/10 pt-2.5 space-y-1 text-[11px] text-[#78716C]">
                <div className="font-mono truncate text-[#1C1917]">{provider.queryMode}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">Index: {provider.indexOrCollection}</span>
                  <span className="font-medium text-[#1E3A5F] whitespace-nowrap">
                    {provider.cloudConfigured ? 'Cloud Live' : 'Local Runtime'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-md border border-[#9A3412]/25 bg-[#FDF4F2] text-xs sm:text-sm text-[#9A3412]"
        >
          {error}
        </div>
      )}

      {indexNotice && (
        <div className="p-3.5 rounded-md border border-[#1E3A5F]/20 bg-[#F4F0E8]/60 text-xs sm:text-sm text-[#1E3A5F]">
          {indexNotice}
        </div>
      )}

      {/* Semantic & Hybrid Search Bar */}
      <form onSubmit={handleSearch} className="space-y-3 border-t border-[#1C1917]/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-[#57534E]">
            Query Active Index: <span className="text-[#1C1917] font-semibold">{activeProviderMeta?.name || selectedProvider}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#1E3A5F] text-[#FBF9F5]'
                      : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search semantic themes (e.g., boundaries at work, feeling overwhelmed, core values)..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[#1C1917]/15 bg-[#FBF9F5] focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || query.trim().length < 2}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-medium bg-[#1E3A5F] text-[#FBF9F5] rounded-md hover:bg-[#162C49] disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Retrieving...</span>
              </>
            ) : (
              <span>Run Vector Search</span>
            )}
          </button>
        </div>
      </form>

      {/* Ranked Results */}
      {searchResult && (
        <div className="space-y-3 border-t border-[#1C1917]/10 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#78716C] font-mono tabular-nums">
            <span>
              {searchResult.hits.length} matches from {searchResult.providerName} ·{' '}
              {searchResult.embeddingModel}
            </span>
            <span>
              {searchResult.executionMode === 'external-cloud-cluster'
                ? 'External Cloud'
                : 'Local Vector Runtime'}{' '}
              · {searchResult.latencyMs}ms
            </span>
          </div>

          {searchResult.hits.length === 0 ? (
            <div className="p-4 rounded-md bg-[#F4F0E8]/45 text-xs text-[#57534E]">
              No indexed documents matched in {searchResult.providerName}. Click Index Records first if this backend currently has 0 indexed records.
            </div>
          ) : (
            <div className="divide-y divide-[#1C1917]/10 border border-[#1C1917]/10 rounded-md bg-[#F4F0E8]/25">
              {searchResult.hits.map((hit: VectorSearchHit) => (
                <article key={hit.id} className="p-4 space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="text-xs text-[#78716C]">
                      <span className="font-medium text-[#1E3A5F]">{hit.category}</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span className="font-semibold text-[#1C1917]">{hit.title}</span>
                    </div>
                    <div className="font-mono text-xs text-[#57534E] tabular-nums whitespace-nowrap">
                      Score {hit.score.toFixed(3)} · Vec {hit.vectorScore.toFixed(3)} · Lex{' '}
                      {hit.lexicalScore.toFixed(2)}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[#292524] leading-relaxed line-clamp-3">
                    {hit.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
