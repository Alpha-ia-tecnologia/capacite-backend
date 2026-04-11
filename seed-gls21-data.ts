import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, string[]> = {
  'expandindo sua capacidade de liderança': ['lideranca-pessoal', 'estrategia-decisoes-execucao'],
  'talento rebelde': ['mudanca-inovacao-reinvencao', 'pessoas-cultura-confianca'],
  'um minuto para pensar': ['estrategia-decisoes-execucao', 'resiliencia-saude-bemestar'],
  'a labuta da liderança': ['lideranca-pessoal', 'resiliencia-saude-bemestar'],
  'resiliência bilionária': ['resiliencia-saude-bemestar', 'lideranca-pessoal'],
  'exigir civilidade para liderar': ['pessoas-cultura-confianca', 'comunicacao-influencia'],
  'o poder de escolha do líder': ['lideranca-pessoal', 'estrategia-decisoes-execucao'],
  'olá, medo': ['resiliencia-saude-bemestar', 'mudanca-inovacao-reinvencao'],
  'a escolha de liderar': ['lideranca-pessoal', 'proposito-visao-legado'],
  'encontre o seu ritmo': ['resiliencia-saude-bemestar', 'lideranca-pessoal'],
  'liderança extraordinária': ['lideranca-pessoal', 'proposito-visao-legado'],
  'liderança e saúde mental': ['resiliencia-saude-bemestar', 'pessoas-cultura-confianca'],
  'dominando o risco': ['estrategia-decisoes-execucao', 'mudanca-inovacao-reinvencao'],
  'colaboração, criatividade e convicção': ['mudanca-inovacao-reinvencao', 'pessoas-cultura-confianca'],
};

function getCategories(title: string): string[] {
  const lower = title.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return ['lideranca-pessoal'];
}

const PALESTRAS_21 = [
  { number: 1, speaker: 'Craig Groeschel', title: 'Expandindo sua capacidade de liderança', duration: '00:42:02' },
  { number: 2, speaker: 'Francesca Gino', title: 'Talento rebelde', duration: '00:24:23' },
  { number: 3, speaker: 'Juliet Funt', title: 'Um minuto para pensar', duration: '00:25:26' },
  { number: 4, speaker: 'Rich Wilkeson', title: 'A Labuta da Liderança', duration: '00:24:39' },
  { number: 5, speaker: 'Jamie Kern Lima', title: 'Resiliência bilionária', duration: '00:33:47' },
  { number: 6, speaker: 'Shola Richards', title: 'Exigir civilidade para liderar', duration: '00:31:36' },
  { number: 7, speaker: 'Ibukun Awosika', title: 'O Poder de Escolha do Líder', duration: '00:28:21' },
  { number: 8, speaker: 'Michelle Poler', title: 'Olá, medo!', duration: '00:31:26' },
  { number: 9, speaker: 'Bianca Olthoff', title: 'A escolha de liderar', duration: '00:27:22' },
  { number: 10, speaker: 'Albert Tate', title: 'Encontre o seu Ritmo', duration: '00:40:07' },
  { number: 11, speaker: 'A.R. Bernard', title: 'Liderança Extraordinária: Um-a-um com A.R. Bernard', duration: '00:34:12' },
  { number: 12, speaker: 'Henry Cloud', title: 'Liderança e saúde mental', duration: '00:54:54' },
  { number: 13, speaker: 'Stanley McChrystal', title: 'Dominando o risco', duration: '00:29:37' },
  { number: 14, speaker: 'Jerry Lorenzo', title: 'Colaboração, Criatividade e Convicção', duration: '00:18:40' },
];

function findTranscriptionSections(lines: string[]) {
  const sections: { speaker: string; title: string; startLine: number; endLine: number }[] = [];
  const headers: { line: number; speaker: string; title: string }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.includes('PALESTRANTE') || l.includes('BIOGRAFIA DOS')) continue;
    
    const sameMatch = l.match(/PALESTRANTE[:\s]+(.+?)TEMA DA PALESTRA[:\s]+(.+)/);
    if (sameMatch) {
      headers.push({
        line: i,
        speaker: sameMatch[1].trim(),
        title: sameMatch[2].trim().replace(/\d+$/, '').trim(),
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
  
  // Filter to real transcription headers (skip bio section markers)
  const transIdx = lines.findIndex(l => l.includes('TRANSCRI') && l.includes('PALESTRAS'));
  const filteredHeaders = transIdx > -1 
    ? headers.filter(h => h.line > transIdx - 50)
    : headers.filter(h => {
        // Check if followed by SRT timestamps within 10 lines
        for (let j = h.line + 1; j < Math.min(h.line + 10, lines.length); j++) {
          if (/\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(lines[j].trim())) return true;
        }
        return false;
      });
  
  filteredHeaders.sort((a, b) => a.line - b.line);
  
  console.log(`\nFound ${filteredHeaders.length} transcription sections:`);
  filteredHeaders.forEach((h, i) => console.log(`  ${i + 1}. L${h.line}: "${h.title}" — ${h.speaker}`));
  
  for (let i = 0; i < filteredHeaders.length; i++) {
    const cur = filteredHeaders[i];
    const nextStart = i + 1 < filteredHeaders.length ? filteredHeaders[i + 1].line : lines.length;
    let contentStart = cur.line + 1;
    for (let j = contentStart; j < Math.min(contentStart + 5, lines.length); j++) {
      if (lines[j].includes('TEMA DA PALESTRA')) { contentStart = j + 1; break; }
    }
    sections.push({
      speaker: cur.speaker.replace(/\u200c/g, '').trim(),
      title: cur.title.replace(/\u200c/g, '').trim(),
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

function parseBiographies(text: string) {
  const bios: { name: string; title: string; bio: string }[] = [];
  const bioStart = text.indexOf('BIOGRAFIA DOS PALESTRANTES');
  if (bioStart === -1) return bios;
  
  let bioEnd = text.indexOf('PALESTRANTE:', bioStart + 100);
  if (bioEnd === -1) bioEnd = text.indexOf('TRANSCRI', bioStart);
  if (bioEnd === -1) bioEnd = text.length;
  
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
        const nameEnd = trimmed.search(/(?:Fundador|Cofundador|Presidente|Pastor|Palestrante|Ex-|Professor|Autor|Criador|CEO|Diretor|Psic|Primeira|Especialista|Renomado|General|Empreendedor|Coach|Estrategista|Jornalista|Designer)/i);
        if (nameEnd > 0) {
          name = trimmed.substring(0, nameEnd).trim();
          title = trimmed.substring(nameEnd).trim();
        }
      }
    }
    
    bio = bio.replace(/-{5,}/g, '').replace(/TEMA DA PALESTRA.*$/i, '').trim();
    if (name && bio.length > 30) bios.push({ name, title, bio });
  }
  return bios;
}

async function main() {
  const dir = path.resolve(__dirname, '..');
  const docxFiles = fs.readdirSync(dir).filter(f => f.startsWith('GLS21') && f.endsWith('.docx'));
  if (docxFiles.length === 0) { console.error('No GLS21 docx'); return; }
  
  const { value: text } = await mammoth.extractRawText({ path: path.join(dir, docxFiles[0]) });
  const lines = text.split('\n');
  console.log(`📄 Extracted ${text.length} chars, ${lines.length} lines`);

  const bios = parseBiographies(text);
  console.log(`\n👤 ${bios.length} biographies:`);
  bios.forEach(b => console.log(`   - ${b.name}`));

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

  const transMap = new Map<string, { text: string; wordCount: number }>();
  for (const t of transcriptions) {
    const keyTitle = t.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    transMap.set(keyTitle, { text: t.text, wordCount: t.wordCount });
    const keySpeaker = t.speaker.toLowerCase().split(' ')[0];
    if (!transMap.has(`speaker:${keySpeaker}`)) {
      transMap.set(`speaker:${keySpeaker}`, { text: t.text, wordCount: t.wordCount });
    }
  }

  console.log('\n📥 Inserting 2021-2022 palestras...');
  
  for (const p of PALESTRAS_21) {
    const externalId = `gls21_${p.number}`;
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
      const firstName = sl.split(' ')[0];
      const lastName = sl.split(' ').pop() || '';
      if (name.includes(firstName) && (name.includes(lastName) || lastName.length < 3)) {
        speakerProfileId = id; break;
      }
    }
    
    const data = {
      externalId,
      title: p.title,
      speaker: p.speaker,
      description: `Palestra "${p.title}" apresentada por ${p.speaker} no Global Leadership Summit 2021-2022.`,
      duration: p.duration,
      categoryIds,
      year: 2021,
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

  const stats = {
    speakers: await prisma.speakerProfile.count(),
    palestras: await prisma.palestra.count(),
    withTrans: await prisma.palestra.count({ where: { transcriptionStatus: 'COMPLETED' } }),
    totalWords: await prisma.palestra.aggregate({ _sum: { wordCount: true } }),
    s21: await prisma.palestra.count({ where: { year: 2021 } }),
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
  console.log(`     ├─ 2021-2022:       ${stats.s21}`);
  console.log(`     ├─ 2022-2023:       ${stats.s22}`);
  console.log(`     ├─ 2023-2024:       ${stats.s23}`);
  console.log(`     ├─ 2024-2025:       ${stats.s24}`);
  console.log(`     └─ 2025-2026:       ${stats.s25}`);
  console.log(`  📝 Com transcrição:    ${stats.withTrans} de ${stats.palestras}`);
  console.log(`  📊 Total palavras:     ${(stats.totalWords._sum.wordCount || 0).toLocaleString()}`);
  console.log('═══════════════════════════════════════════');
  
  fs.writeFileSync('seed-21-summary.txt', JSON.stringify(stats, null, 2), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
