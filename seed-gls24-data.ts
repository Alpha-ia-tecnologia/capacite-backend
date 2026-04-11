import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════
// Category Mapping for 2024-2025 season
// ═══════════════════════════════════════════

const CATEGORY_MAP: Record<string, string[]> = {
  'mais feliz em um mundo infeliz': ['resiliencia-saude-bemestar', 'lideranca-pessoal'],
  'alcance de controle': ['estrategia-decisoes-execucao', 'resiliencia-saude-bemestar'],
  'permissão para se obcecar': ['lideranca-pessoal', 'estrategia-decisoes-execucao'],
  'um legado de liderança': ['proposito-visao-legado', 'lideranca-pessoal'],
  'a força oculta que pode destruir seu legado': ['lideranca-pessoal', 'proposito-visao-legado'],
  '7 frequências da comunicação': ['comunicacao-influencia', 'lideranca-pessoal'],
  '7 frequência da comunicação': ['comunicacao-influencia', 'lideranca-pessoal'],
  'amplifique seu propósito para elevar seu impacto': ['proposito-visao-legado', 'mudanca-inovacao-reinvencao'],
  'o paradoxo de liderar a partir de sua fraqueza': ['lideranca-pessoal', 'resiliencia-saude-bemestar'],
  'aproveite o poder da história': ['comunicacao-influencia', 'pessoas-cultura-confianca'],
  'reputação: como você quer ser lembrado como líder': ['proposito-visao-legado', 'lideranca-pessoal'],
  'liberte a força mais poderosa nos negócios': ['pessoas-cultura-confianca', 'estrategia-decisoes-execucao'],
  'engraçado como o conflito funciona': ['comunicacao-influencia', 'pessoas-cultura-confianca'],
  'vitória por meio do trabalho em equipe': ['pessoas-cultura-confianca', 'estrategia-decisoes-execucao'],
  'impulso dinâmico': ['mudanca-inovacao-reinvencao', 'estrategia-decisoes-execucao'],
  'hospitalidade irracional': ['pessoas-cultura-confianca', 'proposito-visao-legado'],
};

function getCategories(title: string): string[] {
  const lower = title.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return ['lideranca-pessoal'];
}

// ═══════════════════════════════════════════
// Parse Transcription Sections
// ═══════════════════════════════════════════

interface TransSection {
  speaker: string;
  title: string;
  startLine: number;
  endLine: number;
}

function findTranscriptionSections(lines: string[]): TransSection[] {
  const sections: TransSection[] = [];
  let transStartLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('TRANSCRI') && lines[i].includes('PALESTRAS')) {
      transStartLine = i;
      break;
    }
  }
  if (transStartLine === -1) return sections;
  
  const headers: { line: number; speaker: string; title: string }[] = [];
  
  for (let i = transStartLine; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.includes('PALESTRANTE')) continue;
    
    let speaker = '';
    let title = '';
    
    // Same-line format: "PALESTRANTE: NameTEMA DA PALESTRA: Title..."
    const sameLineMatch = l.match(/PALESTRANTE[:\s]+(.+?)TEMA DA PALESTRA[:\s]+(.+)/);
    if (sameLineMatch) {
      speaker = sameLineMatch[1].trim();
      title = sameLineMatch[2].trim().replace(/\d+$/, '').trim();
      headers.push({ line: i, speaker, title });
      continue;
    }
    
    // Multi-line format
    const nameMatch = l.match(/PALESTRANTE[:\s]+(.+)/);
    if (nameMatch) {
      speaker = nameMatch[1].trim();
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('TEMA DA PALESTRA')) {
          const tm = lines[j].match(/TEMA DA PALESTRA[:\s]+(.+)/);
          if (tm) title = tm[1].trim().replace(/\d+$/, '').trim();
          break;
        }
      }
      headers.push({ line: i, speaker, title });
    }
  }
  
  // Check for missing transcriptions (Craig Groeschel and Will Guidara are inside separator lines)
  // Look for separator-style blocks with embedded content
  for (let i = transStartLine; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.includes('---') && l.length > 30) {
      // Check nearby lines for timestamp patterns (indicating a transcription starts)
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nl = lines[j].trim();
        if (/\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(nl)) {
          // This separator is followed by a transcription
          // Check if we already have a header for this position
          const nearestHeader = headers.find(h => Math.abs(h.line - i) < 10);
          if (!nearestHeader) {
            // This is a missing header - we need to identify which palestra
            // Look backwards for context
            const prevText = lines.slice(Math.max(0, i - 5), i).join(' ');
            headers.push({ line: i, speaker: 'UNKNOWN', title: `_separator_L${i}` });
          }
          break;
        }
      }
    }
  }
  
  // Sort by line number
  headers.sort((a, b) => a.line - b.line);
  
  console.log(`\nFound ${headers.length} transcription sections:`);
  headers.forEach((h, idx) => console.log(`  ${idx + 1}. L${h.line}: "${h.title}" — ${h.speaker}`));
  
  for (let i = 0; i < headers.length; i++) {
    const current = headers[i];
    const nextStart = i + 1 < headers.length ? headers[i + 1].line : lines.length;
    let contentStart = current.line + 1;
    
    // Skip TEMA line if separate
    for (let j = contentStart; j < Math.min(contentStart + 5, lines.length); j++) {
      if (lines[j].includes('TEMA DA PALESTRA')) { contentStart = j + 1; break; }
    }
    
    sections.push({
      speaker: current.speaker.replace(/\u200c/g, '').trim(),
      title: current.title.replace(/\u200c/g, '').trim(),
      startLine: contentStart,
      endLine: nextStart,
    });
  }
  
  return sections;
}

function extractCleanText(lines: string[], startLine: number, endLine: number): { text: string; wordCount: number } {
  const textLines: string[] = [];
  const timestampRegex = /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/;
  
  for (let i = startLine; i < endLine; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (/^\d{1,4}$/.test(line)) continue;
    if (timestampRegex.test(line)) continue;
    if (line.includes('PALESTRANTE')) continue;
    if (line.includes('TEMA DA PALESTRA')) continue;
    if (/^-{10,}$/.test(line)) continue;
    textLines.push(line);
  }
  
  const text = textLines.join(' ').replace(/\s+/g, ' ').trim();
  return { text, wordCount: text.split(/\s+/).length };
}

// ═══════════════════════════════════════════
// Palestra Table Parser
// ═══════════════════════════════════════════

interface TablePalestra {
  number: number;
  speaker: string;
  title: string;
  duration: string;
  vimeoUrl?: string;
}

function parsePalestraTable(lines: string[]): TablePalestra[] {
  const palestras: TablePalestra[] = [];
  const bioIdx = lines.findIndex(l => l.includes('Biografias dos palestrantes'));
  if (bioIdx === -1) return palestras;
  
  for (let i = 0; i < bioIdx; i++) {
    const l = lines[i].trim();
    if (!/^\d{1,2}$/.test(l)) continue;
    const num = parseInt(l);
    if (num < 1 || num > 20) continue;
    
    const nextNonEmpty: string[] = [];
    let vimeoUrl: string | undefined;
    
    for (let j = i + 1; j < Math.min(i + 20, bioIdx); j++) {
      const nl = lines[j].trim();
      if (!nl) continue;
      if (nl === 'SIM' || nl.startsWith('Sim') || nl.startsWith('SIM.')) continue;
      if (nl.startsWith('http')) { vimeoUrl = nl; continue; }
      if (/^\d{1,2}$/.test(nl)) break; // next entry
      nextNonEmpty.push(nl);
      if (nextNonEmpty.length >= 3) break;
    }
    
    if (nextNonEmpty.length >= 3) {
      palestras.push({
        number: num,
        speaker: nextNonEmpty[0],
        title: nextNonEmpty[1],
        duration: nextNonEmpty[2],
        vimeoUrl,
      });
    }
  }
  return palestras;
}

// ═══════════════════════════════════════════
// Biography Parser
// ═══════════════════════════════════════════

interface ParsedBio {
  name: string;
  title: string;
  bio: string;
  palestraTitle: string;
}

function parseBiographies(text: string): ParsedBio[] {
  const bios: ParsedBio[] = [];
  const bioStart = text.indexOf('Biografias dos palestrantes');
  const transStart = text.indexOf('TRANSCRI');
  if (bioStart === -1 || transStart === -1) return bios;
  
  const bioSection = text.substring(bioStart, transStart);
  const blocks = bioSection.split(/\-{20,}/).filter(b => b.trim().length > 50);
  
  for (const block of blocks) {
    const bLines = block.trim().split('\n').filter(l => l.trim());
    if (bLines.length < 2) continue;
    
    let name = '', title = '', bio = '', palestraTitle = '', inBio = false;
    
    for (const line of bLines) {
      const trimmed = line.trim().replace(/\u200c/g, '').replace(/\u00a0/g, ' ');
      
      if (trimmed.includes('TEMA DA PALESTRA')) {
        const m = trimmed.match(/TEMA DA PALESTRA[:\s]*(.*)/);
        if (m) palestraTitle = m[1].trim();
        inBio = false;
        continue;
      }
      
      if (trimmed.includes('BIOGRAFIA')) {
        inBio = true;
        const after = trimmed.replace(/^.*BIOGRAFIA\s*/, '').trim();
        if (after) bio = after;
        continue;
      }
      
      if (inBio) {
        bio += (bio ? ' ' : '') + trimmed;
        continue;
      }
      
      if (!name && trimmed.length > 3 && !trimmed.startsWith('Biografias')) {
        name = trimmed;
        const nameEnd = trimmed.search(/(?:Professor|Fundador|Cofundador|Presidente|Pastor|Palestrante|Ex-|Autoridade|Cientista|Psic|Especialista|Primeira|Diretor|Autor)/);
        if (nameEnd > 0) {
          name = trimmed.substring(0, nameEnd).trim();
          title = trimmed.substring(nameEnd).trim();
        }
      }
    }
    
    if (bio.includes('TEMA DA PALESTRA')) {
      const m = bio.match(/TEMA DA PALESTRA[:\s]*(.*?)$/);
      if (m && !palestraTitle) palestraTitle = m[1].trim();
      bio = bio.replace(/TEMA DA PALESTRA[:\s]*.*$/, '').trim();
    }
    
    // Clean separator remnants
    bio = bio.replace(/-{5,}/g, '').trim();
    
    if (name && bio.length > 30) {
      bios.push({ name, title, bio, palestraTitle });
    }
  }
  return bios;
}

// ═══════════════════════════════════════════
// Main Ingestion
// ═══════════════════════════════════════════

async function main() {
  const dir = path.resolve(__dirname, '..');
  const docxFiles = fs.readdirSync(dir).filter(f => f.startsWith('GLS24') && f.endsWith('.docx'));
  if (docxFiles.length === 0) { console.error('No GLS24 docx found'); return; }
  
  const { value: text } = await mammoth.extractRawText({ path: path.join(dir, docxFiles[0]) });
  const lines = text.split('\n');
  console.log(`📄 Extracted ${text.length} chars, ${lines.length} lines`);

  // 1. Parse table
  const tablePalestras = parsePalestraTable(lines);
  console.log(`\n🎤 ${tablePalestras.length} palestras from table:`);
  tablePalestras.forEach(p => console.log(`   ${p.number}. "${p.title}" — ${p.speaker} (${p.duration})`));

  // 2. Parse bios
  const bios = parseBiographies(text);
  console.log(`\n👤 ${bios.length} biographies:`);
  bios.forEach(b => console.log(`   - ${b.name}`));

  // 3. Parse transcriptions
  const transSections = findTranscriptionSections(lines);
  console.log(`\n📝 Extracting transcription texts...`);
  
  const transcriptions: { speaker: string; title: string; text: string; wordCount: number }[] = [];
  for (const section of transSections) {
    const { text: cleanText, wordCount } = extractCleanText(lines, section.startLine, section.endLine);
    if (cleanText.length > 100) {
      transcriptions.push({ speaker: section.speaker, title: section.title, text: cleanText, wordCount });
      console.log(`   ✓ "${section.title}" — ${section.speaker} (${wordCount} words)`);
    }
  }

  // 4. Insert speaker profiles (upsert to avoid conflicts with existing)
  console.log('\n═══ INSERTING DATA ═══');
  
  const speakerMap = new Map<string, string>();
  for (const bio of bios) {
    const cleanName = bio.name.replace(/\u200c/g, '').replace(/\u00a0/g, ' ').trim();
    try {
      const profile = await prisma.speakerProfile.upsert({
        where: { name: cleanName },
        update: { bio: bio.bio, expertise: bio.title ? [bio.title] : [] },
        create: { name: cleanName, bio: bio.bio, expertise: bio.title ? [bio.title] : [] },
      });
      speakerMap.set(cleanName.toLowerCase(), profile.id);
    } catch (e: any) {
      console.log(`   ⚠ Skipped speaker "${cleanName}": ${e.message?.substring(0, 60)}`);
    }
  }
  console.log(`✅ ${speakerMap.size} speaker profiles (new + updated)`);

  // 5. Build transcription lookup
  const transMap = new Map<string, { text: string; wordCount: number }>();
  for (const t of transcriptions) {
    const keyTitle = t.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    transMap.set(keyTitle, { text: t.text, wordCount: t.wordCount });
    const keySpeaker = t.speaker.toLowerCase().split(' ')[0];
    transMap.set(`speaker:${keySpeaker}`, { text: t.text, wordCount: t.wordCount });
  }

  // 6. Insert palestras — use prefix "gls24_" to distinguish from 2025-2026
  console.log('\n📥 Inserting 2024-2025 palestras...');
  
  for (const p of tablePalestras) {
    const externalId = `gls24_${p.number}`;
    const categoryIds = getCategories(p.title);
    
    // Find transcription
    const normalizedTitle = p.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    let trans: { text: string; wordCount: number } | undefined;
    
    // Exact title match
    trans = transMap.get(normalizedTitle);
    
    // Partial title match
    if (!trans) {
      const titleWords = normalizedTitle.split(/\s+/).slice(0, 3).join(' ');
      for (const [key, val] of transMap.entries()) {
        if (!key.startsWith('speaker:') && key.includes(titleWords)) {
          trans = val;
          break;
        }
      }
    }
    
    // Speaker name match
    if (!trans) {
      const speakerFirst = p.speaker.toLowerCase().split(' ')[0];
      for (const [key, val] of transMap.entries()) {
        if (key === `speaker:${speakerFirst}`) {
          trans = val;
          break;
        }
      }
    }
    
    // Find speaker profile
    let speakerProfileId: string | null = null;
    const speakerLower = p.speaker.toLowerCase();
    for (const [name, id] of speakerMap.entries()) {
      if (name.includes(speakerLower.split(' ')[0]) || speakerLower.includes(name.split(' ')[0])) {
        speakerProfileId = id;
        break;
      }
    }
    
    const data = {
      externalId,
      title: p.title,
      speaker: p.speaker,
      description: `Palestra "${p.title}" apresentada por ${p.speaker} no Global Leadership Summit 2024-2025.`,
      duration: p.duration,
      categoryIds,
      year: 2024,
      glsnowUrl: p.vimeoUrl || 'https://glsnow.tv',
      transcription: trans?.text || null,
      transcriptionStatus: trans ? 'COMPLETED' as const : 'PENDING' as const,
      wordCount: trans?.wordCount || null,
      isProcessed: false,
      speakerProfileId,
    };
    
    await prisma.palestra.upsert({
      where: { externalId },
      update: data,
      create: data,
    });
    
    const status = trans ? `✅ ${trans.wordCount} words` : '⏳ pending';
    console.log(`   ${p.number}. "${p.title}" — ${p.speaker} [${status}]`);
  }

  // 7. Summary
  const stats = {
    speakers: await prisma.speakerProfile.count(),
    palestras: await prisma.palestra.count(),
    withTranscription: await prisma.palestra.count({ where: { transcriptionStatus: 'COMPLETED' } }),
    totalWords: await prisma.palestra.aggregate({ _sum: { wordCount: true } }),
    season24: await prisma.palestra.count({ where: { year: 2024 } }),
    season25: await prisma.palestra.count({ where: { year: 2025 } }),
  };
  
  console.log('\n═══════════════════════════════════════════');
  console.log('        RESUMO COMPLETO (TODAS TEMPORADAS)');
  console.log('═══════════════════════════════════════════');
  console.log(`  👤 Palestrantes:       ${stats.speakers}`);
  console.log(`  🎤 Palestras total:    ${stats.palestras}`);
  console.log(`     ├─ 2024-2025:       ${stats.season24}`);
  console.log(`     └─ 2025-2026:       ${stats.season25}`);
  console.log(`  📝 Com transcrição:    ${stats.withTranscription} de ${stats.palestras}`);
  console.log(`  📊 Total palavras:     ${(stats.totalWords._sum.wordCount || 0).toLocaleString()}`);
  console.log('═══════════════════════════════════════════');
  
  fs.writeFileSync('seed-24-summary.txt', JSON.stringify(stats, null, 2), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
