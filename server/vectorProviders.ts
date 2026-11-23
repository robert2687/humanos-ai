import crypto from 'crypto';
import type { GoogleGenAI } from '@google/genai';

export type VectorProviderId = 'azure-ai-search' | 'weaviate' | 'qdrant' | 'pinecone';

export type VectorRecordCategory =
  | 'Session'
  | 'Journal'
  | 'Goal'
  | 'Assessment'
  | 'Event Analysis'
  | 'Dynamic User Model';

export interface VectorRecordDocument {
  id: string;
  title: string;
  category: VectorRecordCategory;
  content: string;
  updatedAt: string;
}

export interface VectorProviderMeta {
  id: VectorProviderId;
  name: string;
  subtitle: string;
  queryMode: string;
  capabilities: string[];
  defaultCollection: string;
}

export interface VectorSearchHit {
  id: string;
  title: string;
  category: VectorRecordCategory;
  content: string;
  score: number;
  vectorScore: number;
  lexicalScore: number;
  updatedAt: string;
}

interface StoredVectorRecord extends VectorRecordDocument {
  vector: number[];
}

export const VECTOR_EMBEDDING_MODEL = 'gemini-embedding-2';

export const VECTOR_PROVIDER_CATALOG: readonly VectorProviderMeta[] = [
  {
    id: 'azure-ai-search',
    name: 'Azure AI Search',
    subtitle: 'Enterprise hybrid BM25 lexical + dense vector retrieval with RRF fusion.',
    queryMode: 'Hybrid (Vector + BM25 RRF)',
    capabilities: ['Hybrid BM25 + Vector', 'OData Metadata Filters', 'Reciprocal Rank Fusion'],
    defaultCollection: 'humanos-memory',
  },
  {
    id: 'weaviate',
    name: 'Weaviate',
    subtitle: 'AI-native GraphQL vector database combining HNSW vectors with BM25 alpha weighting.',
    queryMode: 'Hybrid Alpha Fusion (alpha=0.72)',
    capabilities: ['GraphQL Object Schema', 'BM25 + HNSW Hybrid', 'Class Tenancy'],
    defaultCollection: 'HumanosMemory',
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    subtitle: 'High-speed Rust HNSW cosine vector engine with structured payload filtering.',
    queryMode: 'Dense Cosine HNSW + Payload Filter',
    capabilities: ['HNSW Cosine Distance', 'Payload JSON Filtering', 'Deterministic UUID Points'],
    defaultCollection: 'humanos_memory',
  },
  {
    id: 'pinecone',
    name: 'Pinecone',
    subtitle: 'Managed serverless dense vector index with namespace isolation per session/user.',
    queryMode: 'Serverless Cosine + Namespace',
    capabilities: ['Namespace Isolation', 'Metadata Filter Predicates', 'Low-Latency ANN'],
    defaultCollection: 'humanos-memory',
  },
];

const VALID_PROVIDER_IDS = new Set<VectorProviderId>(
  VECTOR_PROVIDER_CATALOG.map((p) => p.id)
);

export function normalizeVectorProvider(raw: unknown): VectorProviderId {
  const clean = String(raw || '').toLowerCase().trim() as VectorProviderId;
  if (VALID_PROVIDER_IDS.has(clean)) return clean;
  if (clean.includes('azure')) return 'azure-ai-search';
  if (clean.includes('weaviate')) return 'weaviate';
  if (clean.includes('qdrant')) return 'qdrant';
  if (clean.includes('pinecone')) return 'pinecone';
  return 'qdrant';
}

// Session-isolated in-memory vector stores keyed by `${sessionHash}:${provider}`
const sessionVectorStores = new Map<string, Map<string, StoredVectorRecord>>();

function getSessionStore(sessionHash: string, provider: VectorProviderId): Map<string, StoredVectorRecord> {
  const key = `${sessionHash}:${provider}`;
  let store = sessionVectorStores.get(key);
  if (!store) {
    store = new Map<string, StoredVectorRecord>();
    sessionVectorStores.set(key, store);
  }
  return store;
}

function validateExternalBaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Configured vector endpoint must use http or https protocol.');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.internal')
  ) {
    throw new Error('Configured vector endpoint points to a restricted metadata host.');
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

function toDeterministicUuid(input: string): string {
  const hex = crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function getProviderEnvConfig(provider: VectorProviderId): {
  cloudConfigured: boolean;
  indexOrCollection: string;
} {
  switch (provider) {
    case 'azure-ai-search': {
      const endpoint = (process.env.AZURE_SEARCH_ENDPOINT || '').trim();
      const apiKey = (process.env.AZURE_SEARCH_API_KEY || '').trim();
      const index = (process.env.AZURE_SEARCH_INDEX || 'humanos-memory').trim();
      return {
        cloudConfigured: Boolean(endpoint && apiKey),
        indexOrCollection: index || 'humanos-memory',
      };
    }
    case 'weaviate': {
      const url = (process.env.WEAVIATE_URL || '').trim();
      const collection = (process.env.WEAVIATE_COLLECTION || 'HumanosMemory').trim();
      return {
        cloudConfigured: Boolean(url),
        indexOrCollection: collection || 'HumanosMemory',
      };
    }
    case 'qdrant': {
      const url = (process.env.QDRANT_URL || '').trim();
      const collection = (process.env.QDRANT_COLLECTION || 'humanos_memory').trim();
      return {
        cloudConfigured: Boolean(url),
        indexOrCollection: collection || 'humanos_memory',
      };
    }
    case 'pinecone': {
      const host = (process.env.PINECONE_HOST || '').trim();
      const apiKey = (process.env.PINECONE_API_KEY || '').trim();
      const namespace = (process.env.PINECONE_NAMESPACE || 'humanos-memory').trim();
      return {
        cloudConfigured: Boolean(host && apiKey),
        indexOrCollection: namespace || 'humanos-memory',
      };
    }
  }
}

export function listVectorProviderStatuses(sessionHash: string) {
  return VECTOR_PROVIDER_CATALOG.map((meta) => {
    const cfg = getProviderEnvConfig(meta.id);
    const localCount = getSessionStore(sessionHash, meta.id).size;
    return {
      ...meta,
      indexOrCollection: cfg.indexOrCollection,
      cloudConfigured: cfg.cloudConfigured,
      executionMode: cfg.cloudConfigured
        ? ('external-cloud-cluster' as const)
        : ('local-gemini-vector-runtime' as const),
      indexedCount: localCount,
    };
  });
}

export function clearVectorStore(sessionHash: string, provider?: VectorProviderId): void {
  if (provider) {
    sessionVectorStores.delete(`${sessionHash}:${provider}`);
    return;
  }
  for (const meta of VECTOR_PROVIDER_CATALOG) {
    sessionVectorStores.delete(`${sessionHash}:${meta.id}`);
  }
}

export async function embedTexts(ai: GoogleGenAI, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const clipped = texts.map((t) => String(t || '').slice(0, 3000));
  const result = await ai.models.embedContent({
    model: VECTOR_EMBEDDING_MODEL,
    contents: clipped,
  });

  const embeddings = result.embeddings || [];
  if (embeddings.length !== clipped.length) {
    throw new Error('Embedding response count did not match input texts.');
  }

  return embeddings.map((emb) => {
    const values = emb.values || [];
    if (values.length === 0) {
      throw new Error('Received empty embedding vector from Gemini.');
    }
    return values;
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (!denom) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

function lexicalOverlapScore(query: string, docText: string): number {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const qTokens = Array.from(new Set(tokenize(query)));
  if (qTokens.length === 0) return 0;
  const dSet = new Set(tokenize(docText));
  let matched = 0;
  for (const token of qTokens) {
    if (dSet.has(token)) matched += 1;
  }
  return matched / qTokens.length;
}

// =========================================================================
// EXTERNAL REST ADAPTERS (used when server env credentials are configured)
// =========================================================================

async function upsertAzureAiSearch(docs: StoredVectorRecord[]): Promise<void> {
  const endpoint = validateExternalBaseUrl(process.env.AZURE_SEARCH_ENDPOINT || '');
  const apiKey = (process.env.AZURE_SEARCH_API_KEY || '').trim();
  const index = encodeURIComponent((process.env.AZURE_SEARCH_INDEX || 'humanos-memory').trim());
  const url = `${endpoint}/indexes/${index}/docs/index?api-version=2024-07-01`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      value: docs.map((d) => ({
        '@search.action': 'mergeOrUpload',
        id: d.id.replace(/[^a-zA-Z0-9_\-=]/g, '_'),
        title: d.title,
        category: d.category,
        content: d.content,
        contentVector: d.vector,
        updatedAt: d.updatedAt,
      })),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Azure AI Search upsert failed (${response.status}).`);
  }
}

async function searchAzureAiSearch(
  query: string,
  queryVector: number[],
  topK: number,
  categoryFilter?: string
): Promise<VectorSearchHit[]> {
  const endpoint = validateExternalBaseUrl(process.env.AZURE_SEARCH_ENDPOINT || '');
  const apiKey = (process.env.AZURE_SEARCH_API_KEY || '').trim();
  const index = encodeURIComponent((process.env.AZURE_SEARCH_INDEX || 'humanos-memory').trim());
  const url = `${endpoint}/indexes/${index}/docs/search?api-version=2024-07-01`;

  const payload: Record<string, unknown> = {
    search: query,
    vectorQueries: [
      {
        kind: 'vector',
        vector: queryVector,
        fields: 'contentVector',
        k: topK,
      },
    ],
    top: topK,
  };
  if (categoryFilter && categoryFilter !== 'All') {
    payload.filter = `category eq '${categoryFilter.replace(/'/g, "''")}'`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Azure AI Search query failed (${response.status}).`);
  }
  const data = (await response.json()) as {
    value?: Array<{
      id?: string;
      title?: string;
      category?: VectorRecordCategory;
      content?: string;
      updatedAt?: string;
      '@search.score'?: number;
    }>;
  };
  return (data.value || []).map((item) => {
    const score = Number(item['@search.score'] ?? 0);
    return {
      id: String(item.id || ''),
      title: String(item.title || ''),
      category: item.category || 'Journal',
      content: String(item.content || ''),
      score,
      vectorScore: score,
      lexicalScore: lexicalOverlapScore(query, `${item.title || ''} ${item.content || ''}`),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    };
  });
}

async function upsertWeaviate(docs: StoredVectorRecord[]): Promise<void> {
  const baseUrl = validateExternalBaseUrl(process.env.WEAVIATE_URL || '');
  const apiKey = (process.env.WEAVIATE_API_KEY || '').trim();
  const className = (process.env.WEAVIATE_COLLECTION || 'HumanosMemory').trim();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/v1/batch/objects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      objects: docs.map((d) => ({
        class: className,
        id: toDeterministicUuid(d.id),
        properties: {
          recordId: d.id,
          title: d.title,
          category: d.category,
          content: d.content,
          updatedAt: d.updatedAt,
        },
        vector: d.vector,
      })),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Weaviate upsert failed (${response.status}).`);
  }
}

async function searchWeaviate(
  query: string,
  queryVector: number[],
  topK: number,
  categoryFilter?: string
): Promise<VectorSearchHit[]> {
  const baseUrl = validateExternalBaseUrl(process.env.WEAVIATE_URL || '');
  const apiKey = (process.env.WEAVIATE_API_KEY || '').trim();
  const className = (process.env.WEAVIATE_COLLECTION || 'HumanosMemory').replace(/[^a-zA-Z0-9_]/g, '') || 'HumanosMemory';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const escapedQuery = JSON.stringify(query);
  const whereClause =
    categoryFilter && categoryFilter !== 'All'
      ? `where: { path: ["category"], operator: Equal, valueText: ${JSON.stringify(categoryFilter)} },`
      : '';

  const gql = `{
    Get {
      ${className}(
        ${whereClause}
        hybrid: {
          query: ${escapedQuery},
          vector: [${queryVector.join(',')}],
          alpha: 0.72
        },
        limit: ${topK}
      ) {
        recordId
        title
        category
        content
        updatedAt
        _additional { score }
      }
    }
  }`;

  const response = await fetch(`${baseUrl}/v1/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: gql }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Weaviate query failed (${response.status}).`);
  }
  const data = (await response.json()) as {
    data?: {
      Get?: Record<
        string,
        Array<{
          recordId?: string;
          title?: string;
          category?: VectorRecordCategory;
          content?: string;
          updatedAt?: string;
          _additional?: { score?: string | number };
        }>
      >;
    };
  };
  const rows = data.data?.Get?.[className] || [];
  return rows.map((row) => {
    const score = Number(row._additional?.score ?? 0);
    return {
      id: String(row.recordId || ''),
      title: String(row.title || ''),
      category: row.category || 'Journal',
      content: String(row.content || ''),
      score,
      vectorScore: score,
      lexicalScore: lexicalOverlapScore(query, `${row.title || ''} ${row.content || ''}`),
      updatedAt: String(row.updatedAt || new Date().toISOString()),
    };
  });
}

async function upsertQdrant(docs: StoredVectorRecord[]): Promise<void> {
  const baseUrl = validateExternalBaseUrl(process.env.QDRANT_URL || '');
  const apiKey = (process.env.QDRANT_API_KEY || '').trim();
  const collection = encodeURIComponent((process.env.QDRANT_COLLECTION || 'humanos_memory').trim());
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['api-key'] = apiKey;

  const response = await fetch(`${baseUrl}/collections/${collection}/points?wait=true`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      points: docs.map((d) => ({
        id: toDeterministicUuid(d.id),
        vector: d.vector,
        payload: {
          recordId: d.id,
          title: d.title,
          category: d.category,
          content: d.content,
          updatedAt: d.updatedAt,
        },
      })),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Qdrant upsert failed (${response.status}).`);
  }
}

async function searchQdrant(
  query: string,
  queryVector: number[],
  topK: number,
  categoryFilter?: string
): Promise<VectorSearchHit[]> {
  const baseUrl = validateExternalBaseUrl(process.env.QDRANT_URL || '');
  const apiKey = (process.env.QDRANT_API_KEY || '').trim();
  const collection = encodeURIComponent((process.env.QDRANT_COLLECTION || 'humanos_memory').trim());
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['api-key'] = apiKey;

  const body: Record<string, unknown> = {
    vector: queryVector,
    limit: topK,
    with_payload: true,
  };
  if (categoryFilter && categoryFilter !== 'All') {
    body.filter = {
      must: [{ key: 'category', match: { value: categoryFilter } }],
    };
  }

  const response = await fetch(`${baseUrl}/collections/${collection}/points/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Qdrant query failed (${response.status}).`);
  }
  const data = (await response.json()) as {
    result?: Array<{
      id?: string | number;
      score?: number;
      payload?: {
        recordId?: string;
        title?: string;
        category?: VectorRecordCategory;
        content?: string;
        updatedAt?: string;
      };
    }>;
  };
  return (data.result || []).map((pt) => {
    const score = Number(pt.score ?? 0);
    return {
      id: String(pt.payload?.recordId || pt.id || ''),
      title: String(pt.payload?.title || ''),
      category: pt.payload?.category || 'Journal',
      content: String(pt.payload?.content || ''),
      score,
      vectorScore: score,
      lexicalScore: lexicalOverlapScore(
        query,
        `${pt.payload?.title || ''} ${pt.payload?.content || ''}`
      ),
      updatedAt: String(pt.payload?.updatedAt || new Date().toISOString()),
    };
  });
}

async function upsertPinecone(docs: StoredVectorRecord[]): Promise<void> {
  const host = validateExternalBaseUrl(process.env.PINECONE_HOST || '');
  const apiKey = (process.env.PINECONE_API_KEY || '').trim();
  const namespace = (process.env.PINECONE_NAMESPACE || 'humanos-memory').trim();

  const response = await fetch(`${host}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
    },
    body: JSON.stringify({
      namespace,
      vectors: docs.map((d) => ({
        id: d.id,
        values: d.vector,
        metadata: {
          title: d.title,
          category: d.category,
          content: d.content.slice(0, 1800),
          updatedAt: d.updatedAt,
        },
      })),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Pinecone upsert failed (${response.status}).`);
  }
}

async function searchPinecone(
  query: string,
  queryVector: number[],
  topK: number,
  categoryFilter?: string
): Promise<VectorSearchHit[]> {
  const host = validateExternalBaseUrl(process.env.PINECONE_HOST || '');
  const apiKey = (process.env.PINECONE_API_KEY || '').trim();
  const namespace = (process.env.PINECONE_NAMESPACE || 'humanos-memory').trim();

  const body: Record<string, unknown> = {
    namespace,
    vector: queryVector,
    topK,
    includeMetadata: true,
  };
  if (categoryFilter && categoryFilter !== 'All') {
    body.filter = { category: { $eq: categoryFilter } };
  }

  const response = await fetch(`${host}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Pinecone query failed (${response.status}).`);
  }
  const data = (await response.json()) as {
    matches?: Array<{
      id?: string;
      score?: number;
      metadata?: {
        title?: string;
        category?: VectorRecordCategory;
        content?: string;
        updatedAt?: string;
      };
    }>;
  };
  return (data.matches || []).map((match) => {
    const score = Number(match.score ?? 0);
    return {
      id: String(match.id || ''),
      title: String(match.metadata?.title || ''),
      category: match.metadata?.category || 'Journal',
      content: String(match.metadata?.content || ''),
      score,
      vectorScore: score,
      lexicalScore: lexicalOverlapScore(
        query,
        `${match.metadata?.title || ''} ${match.metadata?.content || ''}`
      ),
      updatedAt: String(match.metadata?.updatedAt || new Date().toISOString()),
    };
  });
}

// =========================================================================
// UNIFIED INDEX & SEARCH DISPATCHER
// =========================================================================

export async function indexDocumentsToProvider(params: {
  ai: GoogleGenAI;
  sessionHash: string;
  provider: VectorProviderId;
  documents: VectorRecordDocument[];
}): Promise<{
  provider: VectorProviderId;
  providerName: string;
  executionMode: 'external-cloud-cluster' | 'local-gemini-vector-runtime';
  indexedCount: number;
  totalIndexed: number;
  embeddingDimension: number;
}> {
  const { ai, sessionHash, provider, documents } = params;
  const meta = VECTOR_PROVIDER_CATALOG.find((p) => p.id === provider)!;
  const cfg = getProviderEnvConfig(provider);

  const texts = documents.map((d) => `[${d.category}] ${d.title}\n${d.content}`);
  const vectors = await embedTexts(ai, texts);

  const enriched: StoredVectorRecord[] = documents.map((doc, idx) => ({
    ...doc,
    vector: vectors[idx],
  }));

  const store = getSessionStore(sessionHash, provider);
  for (const item of enriched) {
    store.set(item.id, item);
  }

  if (cfg.cloudConfigured) {
    if (provider === 'azure-ai-search') await upsertAzureAiSearch(enriched);
    else if (provider === 'weaviate') await upsertWeaviate(enriched);
    else if (provider === 'qdrant') await upsertQdrant(enriched);
    else if (provider === 'pinecone') await upsertPinecone(enriched);
  }

  return {
    provider,
    providerName: meta.name,
    executionMode: cfg.cloudConfigured
      ? 'external-cloud-cluster'
      : 'local-gemini-vector-runtime',
    indexedCount: enriched.length,
    totalIndexed: store.size,
    embeddingDimension: vectors[0]?.length || 0,
  };
}

export async function searchProviderVectors(params: {
  ai: GoogleGenAI;
  sessionHash: string;
  provider: VectorProviderId;
  query: string;
  topK?: number;
  categoryFilter?: string;
}): Promise<{
  provider: VectorProviderId;
  providerName: string;
  executionMode: 'external-cloud-cluster' | 'local-gemini-vector-runtime';
  embeddingModel: string;
  query: string;
  totalIndexed: number;
  hits: VectorSearchHit[];
}> {
  const { ai, sessionHash, provider, query, categoryFilter } = params;
  const topK = Math.min(20, Math.max(1, Number(params.topK) || 6));
  const meta = VECTOR_PROVIDER_CATALOG.find((p) => p.id === provider)!;
  const cfg = getProviderEnvConfig(provider);
  const store = getSessionStore(sessionHash, provider);

  const [queryVector] = await embedTexts(ai, [query]);

  if (cfg.cloudConfigured) {
    let cloudHits: VectorSearchHit[] = [];
    if (provider === 'azure-ai-search') {
      cloudHits = await searchAzureAiSearch(query, queryVector, topK, categoryFilter);
    } else if (provider === 'weaviate') {
      cloudHits = await searchWeaviate(query, queryVector, topK, categoryFilter);
    } else if (provider === 'qdrant') {
      cloudHits = await searchQdrant(query, queryVector, topK, categoryFilter);
    } else if (provider === 'pinecone') {
      cloudHits = await searchPinecone(query, queryVector, topK, categoryFilter);
    }
    return {
      provider,
      providerName: meta.name,
      executionMode: 'external-cloud-cluster',
      embeddingModel: VECTOR_EMBEDDING_MODEL,
      query,
      totalIndexed: store.size,
      hits: cloudHits,
    };
  }

  // Local Gemini Embedding Runtime executing provider-specific scoring weights
  const candidates = Array.from(store.values()).filter((doc) => {
    if (categoryFilter && categoryFilter !== 'All') {
      return doc.category === categoryFilter;
    }
    return true;
  });

  const hits: VectorSearchHit[] = candidates
    .map((doc) => {
      const vectorScore = cosineSimilarity(queryVector, doc.vector);
      const lexicalScore = lexicalOverlapScore(query, `${doc.title} ${doc.content}`);
      let score = vectorScore;
      if (provider === 'azure-ai-search') {
        score = vectorScore * 0.62 + lexicalScore * 0.38;
      } else if (provider === 'weaviate') {
        score = vectorScore * 0.72 + lexicalScore * 0.28;
      } else if (provider === 'qdrant') {
        score = vectorScore;
      } else if (provider === 'pinecone') {
        score = vectorScore * 0.94 + lexicalScore * 0.06;
      }
      return {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        content: doc.content,
        score: Number(score.toFixed(4)),
        vectorScore: Number(vectorScore.toFixed(4)),
        lexicalScore: Number(lexicalScore.toFixed(4)),
        updatedAt: doc.updatedAt,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    provider,
    providerName: meta.name,
    executionMode: 'local-gemini-vector-runtime',
    embeddingModel: VECTOR_EMBEDDING_MODEL,
    query,
    totalIndexed: store.size,
    hits,
  };
}
