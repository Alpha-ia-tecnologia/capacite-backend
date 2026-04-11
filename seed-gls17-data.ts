import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, string[]> = {
  'o poder da paixão e da perseverança': ['resiliencia-saude-bemestar', 'lideranca-pessoal'],
  'liderança, agora': ['lideranca-pessoal', 'proposito-visao-legado'],
  'responsabilidade social': ['proposito-visao-legado', 'pessoas-cultura-confianca'],
  'liderança criativa': ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'],
  'não tema, lidere': ['lideranca-pessoal', 'resiliencia-saude-bemestar'],
  'o perdão e o desenvolvimento emocional': ['resiliencia-saude-bemestar', 'pessoas-cultura-confianca'],
  'tempo ocioso': ['estrategia-decisoes-execucao', 'resiliencia-saude-bemestar'],
  'reinventando a gestão da performance': ['estrategia-decisoes-execucao', 'pessoas-cultura-confianca'],
  'liderando você mesmo': ['lideranca-pessoal', 'proposito-visao-legado'],
};

function getCategories(title: string): string[] {
  const lower = title.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return ['lideranca-pessoal'];
}

const PALESTRAS_17 = [
  { number: 1, speaker: 'Angela Duckworth', title: 'O poder da paixão e da perseverança', duration: '00:35:54' },
  { number: 2, speaker: 'Bryan Stevenson', title: 'Liderança agora, responsabilidade social sempre!', duration: '00:30:00' },
  { number: 3, speaker: 'Fredrik Haren', title: 'Liderança criativa em um mundo de grandes transformações', duration: '00:26:22' },
  { number: 4, speaker: 'Gary Haugen', title: 'Não tema, lidere!', duration: '00:39:14' },
  { number: 5, speaker: 'Immaculée Ilibagiza', title: 'O perdão e o desenvolvimento emocional', duration: '00:29:13' },
  { number: 6, speaker: 'Juliet Funt', title: 'O "tempo ocioso" para a construção de soluções', duration: '00:31:57' },
  { number: 7, speaker: 'Marcus Buckingham', title: 'Reinventando a gestão da performance', duration: '00:37:24' },
  { number: 8, speaker: 'Sam Adayemi', title: 'Liderando você mesmo', duration: '00:32:46' },
];

function findTranscriptionSections(lines: string[]) {
  const sections: { speaker: string; title: string; startLine: number; endLine: number }[] = [];
  const headers: { line: number; speaker: string; title: string }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.includes('PALESTRANTE') || l.includes('BIOGRAFIA DOS')) continue;
    
    // Handle separator-embedded PALESTRANTE (like L4998)
    const cleaned = l.replace(/^-+/, '').trim();
    
    const sameMatch = cleaned.match(/PALESTRANTE[:\s]+(.+?)TEMA DA PALESTRA[:\s]+(.+)/);
    if (sameMatch) {
      headers.push({ line: i, speaker: sameMatch[1].trim(), title: sameMatch[2].trim().replace(/\d+$/, '').trim() });
      continue;
    }
    
    const nameMatch = cleaned.match(/PALESTRANTE[:\s]+(.+)/);
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
  
  // Filter to transcription headers (near timestamps)
  const filteredHeaders = headers.filter(h => {
    for (let j = h.line + 1; j < Math.min(h.line + 15, lines.length); j++) {
      const nl = lines[j].trim();
      if (/\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(nl) ||
          /\d{2}:\d{2}:\d{2}:\d{2}/.test(nl)) return true;
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
  const tsRegex1 = /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/;
  const tsRegex2 = /^\d{2}:\d{2}:\d{2}:\d{2}\s*,\s*\d{2}:\d{2}:\d{2}:\d{2}\s*,/;
  const tsRegex3 = /^\d{2}:\d{2}:\d{2}:\d{2},\d{2}:\d{2}:\d{2}:\d{2},/;
  
  for (let i = start; i < end; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (/^\d{1,4}$/.test(line)) continue;
    if (tsRegex1.test(line)) continue;
    if (tsRegex2.test(line) || tsRegex3.test(line)) {
      const textPart = line.replace(/^\d{2}:\d{2}:\d{2}:\d{2}\s*,\s*\d{2}:\d{2}:\d{2}:\d{2}\s*,\s*/, '').trim();
      if (textPart) textLines.push(textPart.replace(/\|/g, ' '));
      continue;
    }
    if (/^\d{2}:\d{2}:\d{2}:\d{2}/.test(line)) {
      const parts = line.split(/\d{2}:\d{2}:\d{2}:\d{2}\s*,?\s*\d{2}:\d{2}:\d{2}:\d{2}\s*,\s*/);
      for (const part of parts) {
        const clean = part.replace(/^\s*,?\s*/, '').trim();
        if (clean && !/^\d{2}:\d{2}/.test(clean)) textLines.push(clean.replace(/\|/g, ' '));
      }
      continue;
    }
    if (line.includes('PALESTRANTE')) continue;
    if (line.includes('TEMA DA PALESTRA')) continue;
    if (/^-{10,}/.test(line)) continue;
    textLines.push(line);
  }
  
  const text = textLines.join(' ').replace(/\s+/g, ' ').trim();
  return { text, wordCount: text.split(/\s+/).length };
}

function parseBiographies(text: string) {
  const bios: { name: string; title: string; bio: string }[] = [];
  const bioLabel = text.indexOf('Biografias dos palestrantes');
  const bioLabel2 = text.indexOf('BIOGRAFIA DOS PALESTRANTES');
  const bioStart = bioLabel > -1 ? bioLabel : bioLabel2;
  if (bioStart === -1) return bios;
  
  const transStart = text.indexOf('TRANSCRI', bioStart);
  const firstPal = text.indexOf('PALESTRANTE:', bioStart + 100);
  let endPos = transStart > bioStart ? transStart : (firstPal > bioStart ? firstPal : text.length);
  
  const bioSection = text.substring(bioStart, endPos);
  const blocks = bioSection.split(/\-{20,}/).filter(b => b.trim().length > 50);
  
  for (const block of blocks) {
    const bLines = block.trim().split('\n').filter(l => l.trim());
    if (bLines.length < 2) continue;
    
    let name = '', title = '', bio = '', inBio = false;
    
    for (const line of bLines) {
      const trimmed = line.trim().replace(/\u200c/g, '').replace(/\u00a0/g, ' ');
      if (trimmed.includes('TEMA DA PALESTRA')) { inBio = false; continue; }
      if (trimmed.includes('Biografias dos palestrantes') || trimmed.includes('BIOGRAFIA DOS PALESTRANTES')) continue;
      
      if (trimmed.includes('BIOGRAFIA')) {
        inBio = true;
        const after = trimmed.replace(/^.*BIOGRAFIA\s*/, '').trim();
        if (after) bio = after;
        continue;
      }
      
      if (inBio) { bio += (bio ? ' ' : '') + trimmed; continue; }
      
      if (!name && trimmed.length > 3) {
        name = trimmed;
        const nameEnd = trimmed.search(/(?:Fundador|Cofundador|Presidente|Pastor|Palestrante|Ex-|Professor|Autor|Criador|CEO|Diretor|Psic|Primeira|Especialista|Renomado|General|Empreendedor|Coach|Estrategista|Jornalista|Designer|Pesquisador|Veterano|Consultor|Escritor|Bispo|Líder)/i);
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
  const docxFiles = fs.readdirSync(dir).filter(f => f.startsWith('GLS17') && f.endsWith('.docx'));
  if (docxFiles.length === 0) { console.error('No GLS17 docx'); return; }
  
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
    const keySpeaker = t.speaker.toLowerCase().trim();
    transMap.set(`speaker:${keySpeaker}`, { text: t.text, wordCount: t.wordCount });
    const firstName = t.speaker.toLowerCase().split(' ')[0];
    if (!transMap.has(`first:${firstName}`)) {
      transMap.set(`first:${firstName}`, { text: t.text, wordCount: t.wordCount });
    }
  }

  console.log('\n📥 Inserting 2017-2018 palestras...');
  
  for (const p of PALESTRAS_17) {
    const externalId = `gls17_${p.number}`;
    const categoryIds = getCategories(p.title);
    
    const normalizedTitle = p.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    let trans: { text: string; wordCount: number } | undefined;
    
    trans = transMap.get(normalizedTitle);
    
    if (!trans) {
      const tw = normalizedTitle.split(/\s+/).slice(0, 3).join(' ');
      for (const [key, val] of transMap.entries()) {
        if (!key.startsWith('speaker:') && !key.startsWith('first:') && key.includes(tw)) { trans = val; break; }
      }
    }
    
    if (!trans) {
      const sf = p.speaker.toLowerCase().trim();
      trans = transMap.get(`speaker:${sf}`);
      if (!trans) trans = transMap.get(`first:${sf.split(' ')[0]}`);
    }
    
    let speakerProfileId: string | null = null;
    const sl = p.speaker.toLowerCase();
    for (const [name, id] of speakerMap.entries()) {
      if (name.includes(sl.split(' ')[0])) { speakerProfileId = id; break; }
    }
    
    const data = {
      externalId,
      title: p.title,
      speaker: p.speaker,
      description: `Palestra "${p.title}" apresentada por ${p.speaker} no Global Leadership Summit 2017-2018.`,
      duration: p.duration,
      categoryIds,
      year: 2017,
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
    s17: await prisma.palestra.count({ where: { year: 2017 } }),
    s18: await prisma.palestra.count({ where: { year: 2018 } }),
    s19: await prisma.palestra.count({ where: { year: 2019 } }),
    s20: await prisma.palestra.count({ where: { year: 2020 } }),
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
  console.log(`     ├─ 2017-2018:       ${stats.s17}`);
  console.log(`     ├─ 2018-2019:       ${stats.s18}`);
  console.log(`     ├─ 2019-2020:       ${stats.s19}`);
  console.log(`     ├─ 2020-2021:       ${stats.s20}`);
  console.log(`     ├─ 2021-2022:       ${stats.s21}`);
  console.log(`     ├─ 2022-2023:       ${stats.s22}`);
  console.log(`     ├─ 2023-2024:       ${stats.s23}`);
  console.log(`     ├─ 2024-2025:       ${stats.s24}`);
  console.log(`     └─ 2025-2026:       ${stats.s25}`);
  console.log(`  📝 Com transcrição:    ${stats.withTrans} de ${stats.palestras}`);
  console.log(`  📊 Total palavras:     ${(stats.totalWords._sum.wordCount || 0).toLocaleString()}`);
  console.log('═══════════════════════════════════════════');
  
  fs.writeFileSync('seed-17-summary.txt', JSON.stringify(stats, null, 2), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
