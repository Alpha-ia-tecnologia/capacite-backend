import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════
// Category Mapping 2022-2023
// ═══════════════════════════════════════════

const CATEGORY_MAP: Record<string, string[]> = {
  'a viagem de uma vida': ['proposito-visao-legado', 'lideranca-pessoal'],
  'aprenda a liderar em uma nova realidade': ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'],
  'liderança única': ['lideranca-pessoal', 'estrategia-decisoes-execucao'],
  'recupere seu poder': ['lideranca-pessoal', 'resiliencia-saude-bemestar'],
  'o papel crítico da empatia na liderança': ['pessoas-cultura-confianca', 'comunicacao-influencia'],
  'trilhas sonoras da mente': ['resiliencia-saude-bemestar', 'lideranca-pessoal'],
  'liderando com a dor': ['resiliencia-saude-bemestar', 'lideranca-pessoal'],
  'o coração por trás do in-n-out burger': ['proposito-visao-legado', 'pessoas-cultura-confianca'],
  'desbloqueando a mentalidade de start-up em sua organização': ['mudanca-inovacao-reinvencao', 'estrategia-decisoes-execucao'],
  'adaptando sua liderança para os desafios de hoje': ['lideranca-pessoal', 'mudanca-inovacao-reinvencao'],
  'ciência da conexão': ['comunicacao-influencia', 'pessoas-cultura-confianca'],
};

function getCategories(title: string): string[] {
  const lower = title.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return ['lideranca-pessoal'];
}

// ═══════════════════════════════════════════
// Hardcoded palestra list (from document analysis)
// ═══════════════════════════════════════════

const PALESTRAS_22 = [
  { number: 1, speaker: 'Bob Iger', title: 'A viagem de uma vida', duration: '00:28:16' },
  { number: 2, speaker: 'Carey Nieuwhof', title: 'Aprenda a liderar em uma nova realidade', duration: '00:32:22' },
  { number: 3, speaker: 'Craig Groeschel', title: 'Liderança única', duration: '00:39:07' },
  { number: 4, speaker: 'Deb Liu', title: 'Recupere seu poder', duration: '00:20:12' },
  { number: 5, speaker: 'Johnny C. Taylor', title: 'O papel crítico da empatia na liderança', duration: '00:28:43' },
  { number: 6, speaker: 'Jon Acuff', title: 'Trilhas sonoras da mente', duration: '00:33:56' },
  { number: 7, speaker: 'Judah Smith', title: 'Liderando com a dor', duration: '00:36:46' },
  { number: 8, speaker: 'Lynsi Snyder', title: 'O coração por trás do In-N-Out Burger', duration: '00:19:31' },
  { number: 9, speaker: 'Sahar Hashemi', title: 'Desbloqueando a mentalidade de start-up em sua organização', duration: '00:31:18' },
  { number: 10, speaker: 'Stephanie Chung', title: 'Adaptando sua liderança para os desafios de hoje', duration: '00:29:04' },
  { number: 11, speaker: 'Vanessa Van Edwards', title: 'Ciência da conexão', duration: '00:37:25' },
];

// ═══════════════════════════════════════════
// Transcription Parser
// ═══════════════════════════════════════════

function findTranscriptionSections(lines: string[]) {
  const sections: { speaker: string; title: string; startLine: number; endLine: number }[] = [];
  const headers: { line: number; speaker: string; title: string }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.includes('PALESTRANTE') || l.includes('BIOGRAFIA DOS PALESTRANTES')) continue;
    
    const sameMatch = l.match(/PALESTRANTE[:\s]+(.+?)TEMA DA PALESTRA[:\s]+(.+)/);
    if (sameMatch) {
      headers.push({
        line: i,
        speaker: sameMatch[1].trim(),
        title: sameMatch[2].trim().replace(/\d+$/, '').replace(/X{5,}/, '').trim(),
      });
      continue;
    }
    
    const nameMatch = l.match(/PALESTRANTE[:\s]+(.+)/);
    if (nameMatch) {
      let title = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('TEMA DA PALESTRA')) {
          const tm = lines[j].match(/TEMA DA PALESTRA[:\s]+(.+)/);
          if (tm) title = tm[1].trim().replace(/\d+$/, '').trim();
          break;
        }
      }
      headers.push({ line: i, speaker: nameMatch[1].trim(), title });
    }
  }
  
  // Check for separator-embedded sections
  const transIdx = lines.findIndex(l => l.includes('TRANSCRI') && l.includes('PALESTRAS'));
  if (transIdx > -1) {
    for (let i = transIdx; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l.includes('---') && l.length > 30) {
        const nearestHeader = headers.find(h => Math.abs(h.line - i) < 5);
        if (!nearestHeader) {
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            if (/\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(lines[j].trim())) {
              headers.push({ line: i, speaker: 'UNKNOWN', title: `_sep_L${i}` });
              break;
            }
          }
        }
      }
    }
  }
  
  headers.sort((a, b) => a.line - b.line);
  
  // Filter to only transcription headers (after TRANSCRI marker or after bios)
  const bioEnd = lines.findIndex(l => l.includes('TRANSCRI') && l.includes('PALESTRAS'));
  const transHeaders = headers.filter(h => h.line > (bioEnd > 0 ? bioEnd - 50 : 200));
  
  console.log(`\nFound ${transHeaders.length} transcription sections:`);
  transHeaders.forEach((h, i) => console.log(`  ${i + 1}. L${h.line}: "${h.title}" — ${h.speaker}`));
  
  for (let i = 0; i < transHeaders.length; i++) {
    const current = transHeaders[i];
    const nextStart = i + 1 < transHeaders.length ? transHeaders[i + 1].line : lines.length;
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

function extractCleanText(lines: string[], start: number, end: number) {
  const textLines: string[] = [];
  const tsRegex = /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/;
  for (let i = start; i < end; i++) {
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

function parseBiographies(text: string) {
  const bios: { name: string; title: string; bio: string }[] = [];
  const bioStart = text.indexOf('BIOGRAFIA DOS PALESTRANTES');
  if (bioStart === -1) return bios;
  
  // Find transcription start or end of bios
  let bioEnd = text.indexOf('TRANSCRI', bioStart);
  if (bioEnd === -1) bioEnd = text.length;
  
  // Check for PALESTRANTE marker before TRANSCRI (in case bios and transcriptions aren't separated)
  const firstPalestrante = text.indexOf('PALESTRANTE:', bioStart);
  if (firstPalestrante > -1 && firstPalestrante < bioEnd) {
    bioEnd = firstPalestrante;
  }
  
  const bioSection = text.substring(bioStart, bioEnd);
  const blocks = bioSection.split(/\-{20,}/).filter(b => b.trim().length > 50);
  
  for (const block of blocks) {
    const bLines = block.trim().split('\n').filter(l => l.trim());
    if (bLines.length < 2) continue;
    
    let name = '', title = '', bio = '', inBio = false;
    
    for (const line of bLines) {
      const trimmed = line.trim().replace(/\u200c/g, '').replace(/\u00a0/g, ' ');
      
      if (trimmed.includes('TEMA DA PALESTRA')) { inBio = false; continue; }
      if (trimmed.includes('BIOGRAFIA DOS PALESTRANTES')) continue;
      
      if (trimmed.includes('BIOGRAFIA')) {
        inBio = true;
        const after = trimmed.replace(/^.*BIOGRAFIA\s*/, '').trim();
        if (after) bio = after;
        continue;
      }
      
      if (inBio) { bio += (bio ? ' ' : '') + trimmed; continue; }
      
      if (!name && trimmed.length > 3) {
        name = trimmed;
        const nameEnd = trimmed.search(/(?:Fundador|Cofundador|Presidente|Pastor|Palestrante|Ex-|Professor|Autor|Criador|CEO|Diretor|Psic|Primeira|Especialista|Renomado|Piloto|Vice)/i);
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
  const docxFiles = fs.readdirSync(dir).filter(f => f.startsWith('GLS22') && f.endsWith('.docx'));
  if (docxFiles.length === 0) { console.error('No GLS22 docx'); return; }
  
  const { value: text } = await mammoth.extractRawText({ path: path.join(dir, docxFiles[0]) });
  const lines = text.split('\n');
  console.log(`📄 Extracted ${text.length} chars, ${lines.length} lines`);

  // Bios
  const bios = parseBiographies(text);
  console.log(`\n👤 ${bios.length} biographies:`);
  bios.forEach(b => console.log(`   - ${b.name}`));

  // Transcriptions
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

  // Insert speakers
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

  // Build transcription lookup
  const transMap = new Map<string, { text: string; wordCount: number }>();
  for (const t of transcriptions) {
    const keyTitle = t.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    transMap.set(keyTitle, { text: t.text, wordCount: t.wordCount });
    const keySpeaker = t.speaker.toLowerCase().split(' ')[0];
    if (!transMap.has(`speaker:${keySpeaker}`)) {
      transMap.set(`speaker:${keySpeaker}`, { text: t.text, wordCount: t.wordCount });
    }
  }

  // Insert palestras
  console.log('\n📥 Inserting 2022-2023 palestras...');
  
  for (const p of PALESTRAS_22) {
    const externalId = `gls22_${p.number}`;
    const categoryIds = getCategories(p.title);
    
    const normalizedTitle = p.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    let trans: { text: string; wordCount: number } | undefined;
    
    trans = transMap.get(normalizedTitle);
    
    if (!trans) {
      const tw = normalizedTitle.split(/\s+/).slice(0, 3).join(' ');
      for (const [key, val] of transMap.entries()) {
        if (!key.startsWith('speaker:') && key.includes(tw)) { trans = val; break; }
      }
    }
    
    if (!trans) {
      const sf = p.speaker.toLowerCase().split(' ')[0];
      for (const [key, val] of transMap.entries()) {
        if (key === `speaker:${sf}`) { trans = val; break; }
      }
    }
    
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
      description: `Palestra "${p.title}" apresentada por ${p.speaker} no Global Leadership Summit 2022-2023.`,
      duration: p.duration,
      categoryIds,
      year: 2022,
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

  // Summary
  const stats = {
    speakers: await prisma.speakerProfile.count(),
    palestras: await prisma.palestra.count(),
    withTrans: await prisma.palestra.count({ where: { transcriptionStatus: 'COMPLETED' } }),
    totalWords: await prisma.palestra.aggregate({ _sum: { wordCount: true } }),
    s22: await prisma.palestra.count({ where: { year: 2022 } }),
    s23: await prisma.palestra.count({ where: { year: 2023 } }),
    s24: await prisma.palestra.count({ where: { year: 2024 } }),
    s25: await prisma.palestra.count({ where: { year: 2025 } }),
  };
  
  console.log('\n═══════════════════════════════════════════');
  console.log('   RESUMO COMPLETO (TODAS AS TEMPORADAS)');
  console.log('═══════════════════════════════════════════');
  console.log(`  👤 Palestrantes:       ${stats.speakers}`);
  console.log(`  🎤 Palestras total:    ${stats.palestras}`);
  console.log(`     ├─ 2022-2023:       ${stats.s22}`);
  console.log(`     ├─ 2023-2024:       ${stats.s23}`);
  console.log(`     ├─ 2024-2025:       ${stats.s24}`);
  console.log(`     └─ 2025-2026:       ${stats.s25}`);
  console.log(`  📝 Com transcrição:    ${stats.withTrans} de ${stats.palestras}`);
  console.log(`  📊 Total palavras:     ${(stats.totalWords._sum.wordCount || 0).toLocaleString()}`);
  console.log('═══════════════════════════════════════════');
  
  fs.writeFileSync('seed-22-summary.txt', JSON.stringify(stats, null, 2), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
