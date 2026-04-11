import prisma from '../lib/prisma';
import { chatCompletion, ChatMessage } from './deepseek.service';

/**
 * Palestra Ingestion Service
 *
 * Handles the full pipeline for processing palestra transcriptions:
 * 1. Chunking — breaks text into ~500 char pieces with overlap
 * 2. Summary — AI-generated summary of the transcription
 * 3. Key Topics — extracted themes for search/matching
 * 4. Key Quotes — impactful quotes for use in questions/devolutivas
 */

// ═══════════════════════════════════════════
// Text Chunking
// ═══════════════════════════════════════════

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep the last `overlap` characters for context continuity
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ═══════════════════════════════════════════
// AI Processing
// ═══════════════════════════════════════════

async function generateSummary(text: string, title: string, speaker: string): Promise<string> {
  // Use first 3000 chars to stay within context limits
  const excerpt = text.length > 3000 ? text.substring(0, 3000) + '...' : text;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um especialista em liderança. Gere um resumo conciso (~200 palavras) da palestra abaixo, destacando os conceitos principais, lições práticas e aplicações para líderes. Responda apenas com o resumo, sem introdução.`,
    },
    {
      role: 'user',
      content: `Palestra: "${title}" por ${speaker}\n\nTranscrição:\n${excerpt}`,
    },
  ];

  return chatCompletion(messages, 0.3);
}

async function extractMetadata(
  text: string,
  title: string,
  speaker: string
): Promise<{ keyTopics: string[]; keyQuotes: string[] }> {
  const excerpt = text.length > 3000 ? text.substring(0, 3000) + '...' : text;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Analise a transcrição da palestra e extraia:
1. key_topics: 5-8 temas/conceitos principais (ex: "confiança", "vulnerabilidade", "comunicação assertiva")
2. key_quotes: 3-5 frases impactantes ditas pelo palestrante (citações diretas curtas)

Responda APENAS com JSON válido:
{"key_topics": ["tema1", "tema2"], "key_quotes": ["frase1", "frase2"]}`,
    },
    {
      role: 'user',
      content: `Palestra: "${title}" por ${speaker}\n\nTranscrição:\n${excerpt}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, 0.3);
    const parsed = JSON.parse(response);
    return {
      keyTopics: parsed.key_topics || [],
      keyQuotes: parsed.key_quotes || [],
    };
  } catch {
    return { keyTopics: [], keyQuotes: [] };
  }
}

// ═══════════════════════════════════════════
// Main Ingestion Pipeline
// ═══════════════════════════════════════════

export async function ingestTranscription(palestraId: string, rawText: string): Promise<{
  chunksCreated: number;
  summary: string;
  keyTopics: string[];
  keyQuotes: string[];
}> {
  // 1. Get palestra info
  const palestra = await prisma.palestra.findUnique({
    where: { id: palestraId },
  });

  if (!palestra) {
    throw new Error(`Palestra not found: ${palestraId}`);
  }

  console.log(`[Ingestion] Processing: "${palestra.title}" by ${palestra.speaker}`);

  // 2. Chunk the text
  const chunks = chunkText(rawText);
  console.log(`[Ingestion] Created ${chunks.length} chunks`);

  // 3. Generate AI summary
  const summary = await generateSummary(rawText, palestra.title, palestra.speaker);
  console.log(`[Ingestion] Summary generated (${summary.length} chars)`);

  // 4. Extract key topics and quotes
  const { keyTopics, keyQuotes } = await extractMetadata(rawText, palestra.title, palestra.speaker);
  console.log(`[Ingestion] Extracted ${keyTopics.length} topics, ${keyQuotes.length} quotes`);

  // 5. Delete old chunks if re-processing
  await prisma.palestraChunk.deleteMany({
    where: { palestraId },
  });

  // 6. Save chunks
  await prisma.palestraChunk.createMany({
    data: chunks.map((content, i) => ({
      palestraId,
      content,
      chunkIndex: i,
    })),
  });

  // 7. Update palestra with transcription data
  await prisma.palestra.update({
    where: { id: palestraId },
    data: {
      transcription: rawText,
      summary,
      keyTopics,
      keyQuotes,
      isProcessed: true,
    },
  });

  console.log(`[Ingestion] ✓ Completed: "${palestra.title}"`);

  return {
    chunksCreated: chunks.length,
    summary,
    keyTopics,
    keyQuotes,
  };
}

/**
 * Find palestra by externalId (e.g. "p1") or database id
 */
export async function findPalestraByExternalId(externalId: string) {
  return prisma.palestra.findUnique({
    where: { externalId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
  });
}

/**
 * Get processed palestras with their summaries and topics
 */
export async function getProcessedPalestras() {
  return prisma.palestra.findMany({
    where: { isProcessed: true },
    select: {
      id: true,
      externalId: true,
      title: true,
      speaker: true,
      summary: true,
      keyTopics: true,
      keyQuotes: true,
      categoryIds: true,
    },
  });
}

/**
 * Search palestras by topic keyword
 */
export async function searchPalestrasByTopic(keyword: string) {
  const all = await prisma.palestra.findMany({
    where: { isProcessed: true },
    select: {
      id: true,
      externalId: true,
      title: true,
      speaker: true,
      summary: true,
      keyTopics: true,
      categoryIds: true,
    },
  });

  // Filter by keyword in topics or summary
  const lower = keyword.toLowerCase();
  return all.filter((p) => {
    const topics = (p.keyTopics as string[]) || [];
    const matchTopic = topics.some((t) => t.toLowerCase().includes(lower));
    const matchSummary = p.summary?.toLowerCase().includes(lower);
    return matchTopic || matchSummary;
  });
}
