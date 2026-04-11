import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════
// Category Mapping for 2023-2024 season
// ═══════════════════════════════════════════

const CATEGORY_MAP: Record<string, string[]> = {
  'lidere onde estiver': ['lideranca-pessoal', 'proposito-visao-legado'],
  'liderando em tempos difíceis': ['lideranca-pessoal', 'resiliencia-saude-bemestar'],
  'um sacrifício que vale a pena': ['proposito-visao-legado', 'lideranca-pessoal'],
  'o futuro da liderança é a confiança': ['pessoas-cultura-confianca', 'lideranca-pessoal'],
  'liderando the chosen': ['proposito-visao-legado', 'mudanca-inovacao-reinvencao'],
  'promovendo uma cultura de reinvenção': ['mudanca-inovacao-reinvencao', 'pessoas-cultura-confianca'],
  'mudança de mentalidade': ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'],
  'confiança': ['pessoas-cultura-confianca', 'comunicacao-influencia'],
  'o que está aqui agora': ['lideranca-pessoal', 'resiliencia-saude-bemestar'],
  'o que está aqui, agora': ['lideranca-pessoal', 'resiliencia-saude-bemestar'],
  'o paradoxo da esperança': ['proposito-visao-legado', 'resiliencia-saude-bemestar'],
  'o topo é solitário, mas não precisa ser': ['pessoas-cultura-confianca', 'resiliencia-saude-bemestar'],
  'o topo é solitário - mas não precisa ser': ['pessoas-cultura-confianca', 'resiliencia-saude-bemestar'],
  'construa seu map de carreira': ['estrategia-decisoes-execucao', 'proposito-visao-legado'],
  'construa seu mapa de carreira': ['estrategia-decisoes-execucao', 'proposito-visao-legado'],
  'coragem nos tempos atuais': ['lideranca-pessoal', 'comunicacao-influencia'],
  'aumentando o nível': ['estrategia-decisoes-execucao', 'lideranca-pessoal'],
};

function getCategories(title: string): string[] {
  const lower = title.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return ['lideranca-pessoal'];
}

// ═══════════════════════════════════════════
// The complete palestra list for 2023-2024
// (Hardcoded from analyzed document since table is incomplete)
// ═══════════════════════════════════════════

const PALESTRAS_23: { number: number; speaker: string; title: string; duration: string }[] = [
  { number: 1, speaker: 'Albert Tate', title: 'Lidere onde estiver', duration: '00:17:31' },
  { number: 2, speaker: 'Albert Tate', title: 'Liderando em tempos difíceis', duration: '00:29:01' },
  { number: 3, speaker: 'Chris Mathebula', title: 'Um sacrifício que vale a pena', duration: '00:29:10' },
  { number: 4, speaker: 'Craig Groeschel', title: 'O futuro da liderança é a confiança', duration: '00:41:30' },
  { number: 5, speaker: 'Dallas Jenkins', title: 'Liderando The Chosen', duration: '00:25:08' },
  { number: 6, speaker: 'Erin Meyer', title: 'Promovendo uma cultura de reinvenção', duration: '00:33:29' },
  { number: 7, speaker: 'Erwin McManus', title: 'Mudança de mentalidade', duration: '00:30:00' },
  { number: 8, speaker: 'Henry Cloud', title: 'Confiança', duration: '00:28:00' },
  { number: 9, speaker: 'Jeanne Stevens', title: 'O que está aqui agora?', duration: '00:44:10' },
  { number: 10, speaker: 'Krish Kandiah', title: 'O paradoxo da esperança', duration: '00:27:09' },
  { number: 11, speaker: 'Liz Bohannon', title: 'O topo é solitário, mas não precisa ser', duration: '00:33:31' },
  { number: 12, speaker: 'Pat Gelsinger', title: 'Construa seu MAP de carreira', duration: '00:30:42' },
  { number: 13, speaker: 'Patrick Lencioni', title: 'Coragem nos tempos atuais', duration: '00:27:42' },
  { number: 14, speaker: 'Ryan Leak', title: 'Aumentando o nível – 3 perguntas para líderes de outro nível', duration: '00:32:15' },
];

// ═══════════════════════════════════════════
// Transcription Parser (same proven approach)
// ═══════════════════════════════════════════

function findTranscriptionSections(lines: string[]): { speaker: string; title: string; startLine: number; endLine: number }[] {
  const sections: { speaker: string; title: string; startLine: number; endLine: number }[] = [];
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
    
    let speaker = '', title = '';
    
    // Same-line
    const sameMatch = l.match(/PALESTRANTE[:\s]+(.+?)TEMA DA PALESTRA[:\s]+(.+)/);
    if (sameMatch) {
      speaker = sameMatch[1].trim();
      title = sameMatch[2].trim().replace(/\d+$/, '').trim();
      headers.push({ line: i, speaker, title });
      continue;
    }
    
    // Multi-line
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
  
  // Also check for separator-embedded transcriptions
  for (let i = transStartLine; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.includes('---') && l.length > 30) {
      const nearestHeader = headers.find(h => Math.abs(h.line - i) < 5);
      if (!nearestHeader) {
        // Check if followed by timestamp (= transcription start)
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (/\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(lines[j].trim())) {
            headers.push({ line: i, speaker: 'UNKNOWN', title: `_sep_L${i}` });
            break;
          }
        }
      }
    }
  }
  
  headers.sort((a, b) => a.line - b.line);
  
  console.log(`\nFound ${headers.length} transcription sections:`);
  headers.forEach((h, idx) => console.log(`  ${idx + 1}. L${h.line}: "${h.title}" — ${h.speaker}`));
  
  for (let i = 0; i < headers.length; i++) {
    const current = headers[i];
    const nextStart = i + 1 < headers.length ? headers[i + 1].line : lines.length;
    let contentStart = current.line + 1;
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
  const tsRegex = /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/;
  
  for (let i = startLine; i < endLine; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (/^\d{1,4}$/.test(line)) continue;
    if (tsRegex.test(line)) continue;
    if (line.includes('PALESTRANTE')) continue;
    if (line.includes('TEMA DA PALESTRA')) continue;
    if (/^-{10,}$/.test(line)) continue;
    textLines.push(line);
  }
  
  const text = textLines.join(' ').replace(/\s+/g, ' ').trim();
  return { text, wordCount: text.split(/\s+/).length };
}

// ═══════════════════════════════════════════
// Biography Parser
// ═══════════════════════════════════════════

interface ParsedBio {
  name: string;
  title: string;
  bio: string;
}

function parseBiographies(text: string): ParsedBio[] {
  const bios: ParsedBio[] = [];
  const bioStart = text.indexOf('BIOGRAFIA DOS PALESTRANTES') !== -1 
    ? text.indexOf('BIOGRAFIA DOS PALESTRANTES')
    : text.indexOf('Biografias dos palestrantes');
  const transStart = text.indexOf('TRANSCRI');
  if (bioStart === -1 || transStart === -1) return bios;
  
  const bioSection = text.substring(bioStart, transStart);
  const blocks = bioSection.split(/\-{20,}/).filter(b => b.trim().length > 50);
  
  for (const block of blocks) {
    const bLines = block.trim().split('\n').filter(l => l.trim());
    if (bLines.length < 2) continue;
    
    let name = '', title = '', bio = '', inBio = false;
    
    for (const line of bLines) {
      const trimmed = line.trim().replace(/\u200c/g, '').replace(/\u00a0/g, ' ');
      
      if (trimmed.includes('TEMA DA PALESTRA')) { inBio = false; continue; }
      
      if (trimmed.includes('BIOGRAFIA')) {
        inBio = true;
        const after = trimmed.replace(/^.*BIOGRAFIA\s*/, '').trim();
        if (after) bio = after;
        continue;
      }
      
      if (inBio) { bio += (bio ? ' ' : '') + trimmed; continue; }
      
      if (!name && trimmed.length > 3 && !trimmed.startsWith('BIOGRAFIA')) {
        name = trimmed;
        const nameEnd = trimmed.search(/(?:Fundador|Cofundador|Presidente|Pastor|Palestrante|Ex-|Professor|Autor|Criador|CEO|Diretor|Psic|Primeira|Especialista)/);
        if (nameEnd > 0) {
          name = trimmed.substring(0, nameEnd).trim();
          title = trimmed.substring(nameEnd).trim();
        }
      }
    }
    
    bio = bio.replace(/-{5,}/g, '').replace(/TEMA DA PALESTRA.*$/i, '').trim();
    
    if (name && bio.length > 30) {
      bios.push({ name, title, bio });
    }
  }
  return bios;
}

// ═══════════════════════════════════════════
// Main
// ═══════════════════════════════════════════

async function main() {
  const dir = path.resolve(__dirname, '..');
  const docxFiles = fs.readdirSync(dir).filter(f => f.startsWith('GLS23') && f.endsWith('.docx'));
  if (docxFiles.length === 0) { console.error('No GLS23 docx'); return; }
  
  const { value: text } = await mammoth.extractRawText({ path: path.join(dir, docxFiles[0]) });
  const lines = text.split('\n');
  console.log(`📄 Extracted ${text.length} chars, ${lines.length} lines`);

  // 1. Parse bios
  const bios = parseBiographies(text);
  console.log(`\n👤 ${bios.length} biographies:`);
  bios.forEach(b => console.log(`   - ${b.name}`));

  // 2. Parse transcriptions
  const transSections = findTranscriptionSections(lines);
  console.log(`\n📝 Extracting transcriptions...`);
  
  const transcriptions: { speaker: string; title: string; text: string; wordCount: number }[] = [];
  for (const section of transSections) {
    const { text: cleanText, wordCount } = extractCleanText(lines, section.startLine, section.endLine);
    if (cleanText.length > 100) {
      transcriptions.push({ speaker: section.speaker, title: section.title, text: cleanText, wordCount });
      console.log(`   ✓ "${section.title}" — ${section.speaker} (${wordCount} words)`);
    }
  }

  // 3. Insert speaker profiles
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
      console.log(`   ⚠ Speaker "${cleanName}": ${e.message?.substring(0, 60)}`);
    }
  }
  console.log(`✅ ${speakerMap.size} speaker profiles`);

  // 4. Build transcription lookup
  const transMap = new Map<string, { text: string; wordCount: number }>();
  for (const t of transcriptions) {
    const keyTitle = t.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    transMap.set(keyTitle, { text: t.text, wordCount: t.wordCount });
    const keySpeaker = t.speaker.toLowerCase().split(' ')[0];
    if (!transMap.has(`speaker:${keySpeaker}`)) {
      transMap.set(`speaker:${keySpeaker}`, { text: t.text, wordCount: t.wordCount });
    }
  }

  // 5. Insert palestras
  console.log('\n📥 Inserting 2023-2024 palestras...');
  
  for (const p of PALESTRAS_23) {
    const externalId = `gls23_${p.number}`;
    const categoryIds = getCategories(p.title);
    
    // Find transcription
    const normalizedTitle = p.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    let trans: { text: string; wordCount: number } | undefined;
    
    trans = transMap.get(normalizedTitle);
    
    if (!trans) {
      const titleWords = normalizedTitle.split(/\s+/).slice(0, 3).join(' ');
      for (const [key, val] of transMap.entries()) {
        if (!key.startsWith('speaker:') && key.includes(titleWords)) { trans = val; break; }
      }
    }
    
    if (!trans) {
      const speakerFirst = p.speaker.toLowerCase().split(' ')[0];
      for (const [key, val] of transMap.entries()) {
        if (key === `speaker:${speakerFirst}`) { trans = val; break; }
      }
    }
    
    // Speaker profile
    let speakerProfileId: string | null = null;
    const sl = p.speaker.toLowerCase();
    for (const [name, id] of speakerMap.entries()) {
      if (name.includes(sl.split(' ')[0]) || sl.includes(name.split(' ')[0])) {
        speakerProfileId = id; break;
      }
    }
    
    const data = {
      externalId,
      title: p.title,
      speaker: p.speaker,
      description: `Palestra "${p.title}" apresentada por ${p.speaker} no Global Leadership Summit 2023-2024.`,
      duration: p.duration,
      categoryIds,
      year: 2023,
      glsnowUrl: 'https://glsnow.tv',
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

  // 6. Summary
  const stats = {
    speakers: await prisma.speakerProfile.count(),
    palestras: await prisma.palestra.count(),
    withTrans: await prisma.palestra.count({ where: { transcriptionStatus: 'COMPLETED' } }),
    totalWords: await prisma.palestra.aggregate({ _sum: { wordCount: true } }),
    s23: await prisma.palestra.count({ where: { year: 2023 } }),
    s24: await prisma.palestra.count({ where: { year: 2024 } }),
    s25: await prisma.palestra.count({ where: { year: 2025 } }),
  };
  
  console.log('\n═══════════════════════════════════════════');
  console.log('   RESUMO COMPLETO (TODAS AS TEMPORADAS)');
  console.log('═══════════════════════════════════════════');
  console.log(`  👤 Palestrantes:       ${stats.speakers}`);
  console.log(`  🎤 Palestras total:    ${stats.palestras}`);
  console.log(`     ├─ 2023-2024:       ${stats.s23}`);
  console.log(`     ├─ 2024-2025:       ${stats.s24}`);
  console.log(`     └─ 2025-2026:       ${stats.s25}`);
  console.log(`  📝 Com transcrição:    ${stats.withTrans} de ${stats.palestras}`);
  console.log(`  📊 Total palavras:     ${(stats.totalWords._sum.wordCount || 0).toLocaleString()}`);
  console.log('═══════════════════════════════════════════');
  
  fs.writeFileSync('seed-23-summary.txt', JSON.stringify(stats, null, 2), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
