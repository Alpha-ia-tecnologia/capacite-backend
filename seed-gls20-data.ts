import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, string[]> = {
  'liderança que atende ao momento': ['lideranca-pessoal', 'proposito-visao-legado'],
  'segurança psicológica': ['pessoas-cultura-confianca', 'comunicacao-influencia'],
  'lidere durante o mergulho': ['lideranca-pessoal', 'resiliencia-saude-bemestar'],
  'o obstáculo mais surpreendente à inovação': ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'],
  'como os melhores líderes desenvolvem resiliência': ['resiliencia-saude-bemestar', 'lideranca-pessoal'],
  'o ritmo da liderança': ['lideranca-pessoal', 'estrategia-decisoes-execucao'],
  'seguro não é o suficiente': ['lideranca-pessoal', 'pessoas-cultura-confianca'],
  'como liderar em um recomeço': ['mudanca-inovacao-reinvencao', 'resiliencia-saude-bemestar'],
  'os 6 traços da liderança': ['lideranca-pessoal', 'estrategia-decisoes-execucao'],
  'a ciência da liderança': ['comunicacao-influencia', 'pessoas-cultura-confianca'],
  'liderança amorosa': ['proposito-visao-legado', 'pessoas-cultura-confianca'],
};

function getCategories(title: string): string[] {
  const lower = title.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return ['lideranca-pessoal'];
}

const PALESTRAS_20 = [
  { number: 1, speaker: 'Albert Tate', title: 'Liderança que atende ao momento', duration: '00:33:42' },
  { number: 2, speaker: 'Amy Edmondson', title: 'Segurança psicológica', duration: '00:27:25' },
  { number: 3, speaker: 'Craig Groeschel', title: 'Lidere durante o mergulho', duration: '00:40:52' },
  { number: 4, speaker: 'Lysa TerKeurst', title: 'O obstáculo mais surpreendente à inovação', duration: '00:42:55' },
  { number: 5, speaker: 'Marcus Buckingham', title: 'Como os melhores líderes desenvolvem resiliência', duration: '00:20:08' },
  { number: 6, speaker: 'Michael Todd', title: 'O ritmo da liderança', duration: '00:26:22' },
  { number: 7, speaker: 'Nona Jones', title: 'Seguro não é o suficiente', duration: '00:26:12' },
  { number: 8, speaker: 'Paula Faris', title: 'Como liderar em um recomeço', duration: '00:23:25' },
  { number: 9, speaker: 'Tomas Chamorro-Premuzic', title: 'Os 6 traços da liderança', duration: '00:30:57' },
  { number: 10, speaker: 'Vanessa Van Edwards', title: 'A ciência da liderança: impactando para o bem', duration: '00:26:47' },
  { number: 11, speaker: 'Kaká', title: 'Liderança amorosa – entrevista com Kaká', duration: '00:27:41' },
];

function findTranscriptionSections(lines: string[]) {
  const sections: { speaker: string; title: string; startLine: number; endLine: number }[] = [];
  const headers: { line: number; speaker: string; title: string }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.includes('PALESTRANTE') || l.includes('BIOGRAFIA DOS')) continue;
    
    // Same-line format
    const sameMatch = l.match(/PALESTRANTE[:\s]+(.+?)TEMA DA PALESTRA[:\s]+(.+)/);
    if (sameMatch) {
      headers.push({ line: i, speaker: sameMatch[1].trim(), title: sameMatch[2].trim().replace(/\d+$/, '').trim() });
      continue;
    }
    
    // Multi-line
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
  
  // Filter to transcriptions (near SRT timestamps)
  const filteredHeaders = headers.filter(h => {
    for (let j = h.line + 1; j < Math.min(h.line + 15, lines.length); j++) {
      const nl = lines[j].trim();
      // Standard SRT or this doc's comma-separated format
      if (/\d{2}:\d{2}:\d{2}[,:\.]\d{2,3}\s*[,\s]\s*\d{2}:\d{2}:\d{2}/.test(nl) ||
          /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(nl)) return true;
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
  // Support both SRT and comma-separated timestamp formats
  const tsRegex1 = /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/;
  const tsRegex2 = /^\d{2}:\d{2}:\d{2}:\d{2}\s*,\s*\d{2}:\d{2}:\d{2}:\d{2}\s*,/;
  
  for (let i = start; i < end; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (/^\d{1,4}$/.test(line)) continue;
    if (tsRegex1.test(line)) continue;
    if (tsRegex2.test(line)) {
      // Extract text after the timestamps and comma
      const textPart = line.replace(/^\d{2}:\d{2}:\d{2}:\d{2}\s*,\s*\d{2}:\d{2}:\d{2}:\d{2}\s*,\s*/, '').trim();
      if (textPart) {
        // Clean pipe separators
        textLines.push(textPart.replace(/\|/g, ' '));
      }
      continue;
    }
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
  const bioLabel = text.indexOf('Biografias dos palestrantes');
  const bioStart = bioLabel > -1 ? bioLabel : text.indexOf('BIOGRAFIA DOS PALESTRANTES');
  if (bioStart === -1) return bios;
  
  const transStart = text.indexOf('TRANSCRI', bioStart);
  const endPos = transStart > bioStart ? transStart : text.length;
  
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
        const nameEnd = trimmed.search(/(?:Fundador|Cofundador|Presidente|Pastor|Palestrante|Ex-|Professor|Autor|Criador|CEO|Diretor|Psic|Primeira|Especialista|Renomado|General|Empreendedor|Coach|Estrategista|Jornalista|Designer|Co-pastor|Pesquisador)/i);
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
  const docxFiles = fs.readdirSync(dir).filter(f => f.startsWith('GLS20') && f.endsWith('.docx'));
  if (docxFiles.length === 0) { console.error('No GLS20 docx'); return; }
  
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

  console.log('\n📥 Inserting 2020-2021 palestras...');
  
  for (const p of PALESTRAS_20) {
    const externalId = `gls20_${p.number}`;
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
      if (name.includes(firstName)) { speakerProfileId = id; break; }
    }
    
    const data = {
      externalId,
      title: p.title,
      speaker: p.speaker,
      description: `Palestra "${p.title}" apresentada por ${p.speaker} no Global Leadership Summit 2020-2021.`,
      duration: p.duration,
      categoryIds,
      year: 2020,
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
  console.log(`     ├─ 2020-2021:       ${stats.s20}`);
  console.log(`     ├─ 2021-2022:       ${stats.s21}`);
  console.log(`     ├─ 2022-2023:       ${stats.s22}`);
  console.log(`     ├─ 2023-2024:       ${stats.s23}`);
  console.log(`     ├─ 2024-2025:       ${stats.s24}`);
  console.log(`     └─ 2025-2026:       ${stats.s25}`);
  console.log(`  📝 Com transcrição:    ${stats.withTrans} de ${stats.palestras}`);
  console.log(`  📊 Total palavras:     ${(stats.totalWords._sum.wordCount || 0).toLocaleString()}`);
  console.log('═══════════════════════════════════════════');
  
  fs.writeFileSync('seed-20-summary.txt', JSON.stringify(stats, null, 2), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
