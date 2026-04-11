import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════
// Category Mapping
// ═══════════════════════════════════════════

const CATEGORY_MAP: Record<string, string[]> = {
  'a monotonia é o segredo do sucesso': ['lideranca-pessoal', 'estrategia-decisoes-execucao'],
  'o excesso na liderança': ['resiliencia-saude-bemestar', 'estrategia-decisoes-execucao'],
  'conexão humana na era digital': ['comunicacao-influencia', 'pessoas-cultura-confianca'],
  'liderando no hífen': ['lideranca-pessoal', 'pessoas-cultura-confianca'],
  'entrevista com david ashcraft': ['lideranca-pessoal', 'proposito-visao-legado'],
  'como prosperar quando só resiliência não basta': ['resiliencia-saude-bemestar', 'lideranca-pessoal'],
  'entre na roda': ['mudanca-inovacao-reinvencao', 'pessoas-cultura-confianca'],
  'desempenho regenerativo': ['resiliencia-saude-bemestar', 'estrategia-decisoes-execucao'],
  'como liderar pessoas diferentes de você': ['pessoas-cultura-confianca', 'comunicacao-influencia'],
  'deixando um legado que importa': ['proposito-visao-legado', 'lideranca-pessoal'],
  'uma visão que ancora': ['proposito-visao-legado', 'resiliencia-saude-bemestar'],
  'à prova de procrastinação': ['estrategia-decisoes-execucao', 'lideranca-pessoal'],
  'mude a sua pergunta': ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'],
  'mude sua pergunta': ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'],
  'em qual atividade você está?': ['estrategia-decisoes-execucao', 'lideranca-pessoal'],
  'oportunidade acima do obstáculo': ['mudanca-inovacao-reinvencao', 'resiliencia-saude-bemestar'],
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
  
  // Find the transcription start
  let transStartLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('TRANSCRI') && lines[i].includes('PALESTRAS')) {
      transStartLine = i;
      break;
    }
  }
  if (transStartLine === -1) return sections;
  
  // Find all PALESTRANTE markers after the transcription start
  const palestraHeaders: { line: number; speaker: string; title: string }[] = [];
  
  for (let i = transStartLine; i < lines.length; i++) {
    const l = lines[i].trim();
    
    if (l.includes('PALESTRANTE')) {
      let speaker = '';
      let title = '';
      
      // Case 1: "PALESTRANTE: Name TEMA DA PALESTRA: Title" on same line
      const sameLineMatch = l.match(/PALESTRANTE[:\s]+(.+?)TEMA DA PALESTRA[:\s]+(.+)/);
      if (sameLineMatch) {
        speaker = sameLineMatch[1].trim();
        title = sameLineMatch[2].trim().replace(/\d+$/, '').trim();
        palestraHeaders.push({ line: i, speaker, title });
        continue;
      }
      
      // Case 2: "PALESTRANTE: Name" on one line, "TEMA DA PALESTRA: Title" on next
      const nameMatch = l.match(/PALESTRANTE[:\s]+(.+)/);
      if (nameMatch) {
        speaker = nameMatch[1].trim();
        // Look for TEMA on next non-empty line
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine.includes('TEMA DA PALESTRA')) {
            const titleMatch = nextLine.match(/TEMA DA PALESTRA[:\s]+(.+)/);
            if (titleMatch) {
              title = titleMatch[1].trim().replace(/\d+$/, '').trim();
            }
            break;
          }
        }
        palestraHeaders.push({ line: i, speaker, title });
      }
    }
  }
  
  console.log(`\nFound ${palestraHeaders.length} transcription sections:`);
  palestraHeaders.forEach((h, i) => console.log(`  ${i + 1}. L${h.line}: "${h.title}" — ${h.speaker}`));
  
  // Build sections with start/end lines
  for (let i = 0; i < palestraHeaders.length; i++) {
    const current = palestraHeaders[i];
    const nextStart = i + 1 < palestraHeaders.length ? palestraHeaders[i + 1].line : lines.length;
    
    // Actual content starts a few lines after the header
    let contentStart = current.line + 1;
    // Skip the TEMA line if it's separate
    for (let j = contentStart; j < Math.min(contentStart + 5, lines.length); j++) {
      if (lines[j].includes('TEMA DA PALESTRA')) {
        contentStart = j + 1;
        break;
      }
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
    if (/^\d{1,4}$/.test(line)) continue;  // SRT index
    if (timestampRegex.test(line)) continue; // timestamp
    if (line.includes('PALESTRANTE')) continue;
    if (line.includes('TEMA DA PALESTRA')) continue;
    textLines.push(line);
  }
  
  const text = textLines.join(' ').replace(/\s+/g, ' ').trim();
  return { text, wordCount: text.split(/\s+/).length };
}

// ═══════════════════════════════════════════
// Palestra table parser
// ═══════════════════════════════════════════

interface TablePalestra {
  number: number;
  speaker: string;
  title: string;
  duration: string;
}

function parsePalestraTable(lines: string[]): TablePalestra[] {
  const palestras: TablePalestra[] = [];
  const bioIdx = lines.findIndex(l => l.includes('Biografias dos palestrantes'));
  if (bioIdx === -1) return palestras;
  
  for (let i = 0; i < bioIdx; i++) {
    const line = lines[i].trim();
    const numMatch = line.match(/^(\d{1,2})$/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num >= 1 && num <= 15) {
        // Find next non-empty lines for speaker, title, duration
        const nextNonEmpty: string[] = [];
        for (let j = i + 1; j < Math.min(i + 20, bioIdx); j++) {
          const nl = lines[j].trim();
          if (nl && nl !== 'SIM' && nl !== '' && !/^\d{1,2}$/.test(nl)) {
            nextNonEmpty.push(nl);
            if (nextNonEmpty.length >= 3) break;
          }
        }
        if (nextNonEmpty.length >= 3) {
          palestras.push({
            number: num,
            speaker: nextNonEmpty[0],
            title: nextNonEmpty[1],
            duration: nextNonEmpty[2],
          });
        }
      }
    }
  }
  return palestras;
}

// ═══════════════════════════════════════════
// Biography parser
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
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) continue;
    
    let name = '';
    let title = '';
    let bio = '';
    let palestraTitle = '';
    let inBio = false;
    
    for (const line of lines) {
      const trimmed = line.trim().replace(/\u200c/g, '');
      
      if (trimmed.includes('TEMA DA PALESTRA')) {
        const match = trimmed.match(/TEMA DA PALESTRA[:\s]*(.*)/);
        if (match) palestraTitle = match[1].trim();
        inBio = false;
        continue;
      }
      
      if (trimmed.startsWith('BIOGRAFIA') || trimmed === 'BIOGRAFIA') {
        inBio = true;
        const afterBio = trimmed.replace(/^BIOGRAFIA\s*/, '').trim();
        if (afterBio) bio = afterBio;
        continue;
      }
      
      if (inBio) {
        bio += (bio ? ' ' : '') + trimmed;
        continue;
      }
      
      // First substantive line = name + title
      if (!name && trimmed.length > 3 && !trimmed.startsWith('Biografias')) {
        // Name is usually all-caps or starts with caps
        name = trimmed;
        // Try to separate name from professional title
        const nameEnd = trimmed.search(/(?:Fundador|Cofundador|Presidente|Pastor|Palestrante|Ex-|Autoridade|Cientista|Psic|Especialista)/);
        if (nameEnd > 0) {
          name = trimmed.substring(0, nameEnd).trim();
          title = trimmed.substring(nameEnd).trim();
        }
      }
    }
    
    // Clean bio: sometimes TEMA is embedded
    if (bio.includes('TEMA DA PALESTRA')) {
      const m = bio.match(/TEMA DA PALESTRA[:\s]*(.*?)$/);
      if (m && !palestraTitle) palestraTitle = m[1].trim();
      bio = bio.replace(/TEMA DA PALESTRA[:\s]*.*$/, '').trim();
    }
    
    if (name && bio.length > 30) {
      bios.push({ name, title, bio, palestraTitle });
    }
  }
  
  return bios;
}

// ═══════════════════════════════════════════
// Main
// ═══════════════════════════════════════════

async function main() {
  const dir = path.resolve(__dirname, '..');
  const docxFiles = fs.readdirSync(dir).filter(f => f.startsWith('GLS') && f.endsWith('.docx'));
  if (docxFiles.length === 0) { console.error('No GLS docx'); return; }
  
  const { value: text } = await mammoth.extractRawText({ path: path.join(dir, docxFiles[0]) });
  const lines = text.split('\n');
  console.log(`📄 Extracted ${text.length} chars, ${lines.length} lines`);

  // 1. Parse table
  const tablePalestras = parsePalestraTable(lines);
  console.log(`\n🎤 Parsed ${tablePalestras.length} palestras from table:`);
  tablePalestras.forEach(p => console.log(`   ${p.number}. "${p.title}" — ${p.speaker} (${p.duration})`));

  // 2. Parse bios
  const bios = parseBiographies(text);
  console.log(`\n👤 Parsed ${bios.length} biographies:`);
  bios.forEach(b => console.log(`   - ${b.name} → "${b.palestraTitle}"`));

  // 3. Parse transcriptions
  const transSections = findTranscriptionSections(lines);
  console.log(`\n📝 Extracting transcription texts...`);
  
  const transcriptions: { speaker: string; title: string; text: string; wordCount: number }[] = [];
  for (const section of transSections) {
    const { text: cleanText, wordCount } = extractCleanText(lines, section.startLine, section.endLine);
    transcriptions.push({ speaker: section.speaker, title: section.title, text: cleanText, wordCount });
    console.log(`   ✓ "${section.title}" — ${section.speaker} (${wordCount} words, ${cleanText.length} chars)`);
  }

  // 4. Insert categories
  console.log('\n═══ INSERTING DATA ═══');
  
  const categories = [
    { slug: 'lideranca-pessoal', name: 'Liderança Pessoal', shortName: 'Liderança', description: 'Consistência, coerência e clareza do líder sob pressão.', icon: 'Crown', color: '#FF1493', sortOrder: 1 },
    { slug: 'pessoas-cultura-confianca', name: 'Pessoas, Cultura e Confiança', shortName: 'Pessoas & Cultura', description: 'Segurança psicológica, confiança e respeito.', icon: 'Users', color: '#8B5CF6', sortOrder: 2 },
    { slug: 'comunicacao-influencia', name: 'Comunicação e Influência', shortName: 'Comunicação', description: 'Clareza, conversas difíceis e decisões em grupo.', icon: 'MessageSquare', color: '#FF6B35', sortOrder: 3 },
    { slug: 'estrategia-decisoes-execucao', name: 'Estratégia, Decisões e Execução', shortName: 'Estratégia', description: 'Foco, papéis claros e acompanhamento.', icon: 'Target', color: '#173DED', sortOrder: 4 },
    { slug: 'mudanca-inovacao-reinvencao', name: 'Mudança, Inovação e Reinvenção', shortName: 'Inovação', description: 'Organização em mudanças, aprendizado com erros.', icon: 'Lightbulb', color: '#22c55e', sortOrder: 5 },
    { slug: 'resiliencia-saude-bemestar', name: 'Resiliência, Saúde Emocional e Bem-estar', shortName: 'Resiliência', description: 'Ritmo sustentável, limites e apoio mútuo.', icon: 'Heart', color: '#eab308', sortOrder: 6 },
    { slug: 'proposito-visao-legado', name: 'Propósito, Visão, Legado e Impacto', shortName: 'Propósito', description: 'Clareza de propósito, visão compartilhada, valores praticados.', icon: 'Compass', color: '#06b6d4', sortOrder: 7 },
  ];
  for (const cat of categories) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: cat, create: cat });
  }
  console.log(`✅ ${categories.length} categories`);

  // 5. Insert questions
  const questions = [
    { questionId: 'q1', categoryId: 'lideranca-pessoal', text: 'Há direção estável: prioridades não mudam toda semana.', sortOrder: 1 },
    { questionId: 'q2', categoryId: 'lideranca-pessoal', text: 'A liderança é coerente (fala e prática combinam).', sortOrder: 2 },
    { questionId: 'q3', categoryId: 'lideranca-pessoal', text: 'Sob pressão, a liderança mantém clareza e equilíbrio (não gera caos).', sortOrder: 3 },
    { questionId: 'q4', categoryId: 'pessoas-cultura-confianca', text: 'Há confiança: baixa política interna e baixa defensividade.', sortOrder: 4 },
    { questionId: 'q5', categoryId: 'pessoas-cultura-confianca', text: 'Existe segurança para discordar e trazer problemas sem medo.', sortOrder: 5 },
    { questionId: 'q6', categoryId: 'pessoas-cultura-confianca', text: 'A equipe trata as pessoas com respeito mesmo em tensões.', sortOrder: 6 },
    { questionId: 'q7', categoryId: 'comunicacao-influencia', text: 'Informações importantes chegam com clareza e no tempo certo.', sortOrder: 7 },
    { questionId: 'q8', categoryId: 'comunicacao-influencia', text: 'Conversas difíceis acontecem com respeito (sem silêncio e sem fofoca).', sortOrder: 8 },
    { questionId: 'q9', categoryId: 'comunicacao-influencia', text: 'Reuniões viram decisões e combinados claros.', sortOrder: 9 },
    { questionId: 'q10', categoryId: 'estrategia-decisoes-execucao', text: 'Existe foco claro (o que é prioridade agora).', sortOrder: 10 },
    { questionId: 'q11', categoryId: 'estrategia-decisoes-execucao', text: 'Papéis e responsabilidades são claros.', sortOrder: 11 },
    { questionId: 'q12', categoryId: 'estrategia-decisoes-execucao', text: 'O que se decide vira ação com acompanhamento e cadência.', sortOrder: 12 },
    { questionId: 'q13', categoryId: 'mudanca-inovacao-reinvencao', text: 'Mudanças são conduzidas com organização (não viram bagunça prolongada).', sortOrder: 13 },
    { questionId: 'q14', categoryId: 'mudanca-inovacao-reinvencao', text: 'A equipe aprende com erros e ajusta rápido (sem caça às bruxas).', sortOrder: 14 },
    { questionId: 'q15', categoryId: 'mudanca-inovacao-reinvencao', text: 'Há espaço para testar melhorias com critério (inovar com propósito).', sortOrder: 15 },
    { questionId: 'q16', categoryId: 'resiliencia-saude-bemestar', text: 'O ritmo é sustentável (há margem para respirar e recuperar).', sortOrder: 16 },
    { questionId: 'q17', categoryId: 'resiliencia-saude-bemestar', text: 'Limites são respeitados (urgência não é regra).', sortOrder: 17 },
    { questionId: 'q18', categoryId: 'resiliencia-saude-bemestar', text: 'Em semanas difíceis, a equipe se apoia (não vira "cada um por si").', sortOrder: 18 },
    { questionId: 'q19', categoryId: 'proposito-visao-legado', text: 'O time sabe por que o trabalho importa (propósito é claro).', sortOrder: 19 },
    { questionId: 'q20', categoryId: 'proposito-visao-legado', text: 'Existe visão compartilhada que orienta escolhas.', sortOrder: 20 },
    { questionId: 'q21', categoryId: 'proposito-visao-legado', text: 'Valores são praticados especialmente sob pressão.', sortOrder: 21 },
  ];
  for (const q of questions) {
    await prisma.diagnosticQuestion.upsert({ where: { questionId: q.questionId }, update: q, create: q });
  }
  console.log(`✅ ${questions.length} questions`);

  // 6. Insert speaker profiles
  const speakerMap = new Map<string, string>();
  for (const bio of bios) {
    const cleanName = bio.name.replace(/\u200c/g, '').trim();
    const profile = await prisma.speakerProfile.upsert({
      where: { name: cleanName },
      update: { bio: bio.bio, expertise: bio.title ? [bio.title] : [] },
      create: { name: cleanName, bio: bio.bio, expertise: bio.title ? [bio.title] : [] },
    });
    speakerMap.set(cleanName.toLowerCase(), profile.id);
  }
  console.log(`✅ ${bios.length} speaker profiles`);

  // 7. Build transcription lookup by title (normalized)
  const transMap = new Map<string, { text: string; wordCount: number }>();
  for (const t of transcriptions) {
    const keyTitle = t.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    transMap.set(keyTitle, { text: t.text, wordCount: t.wordCount });
    // Also store by speaker
    const keySpeaker = t.speaker.toLowerCase().trim();
    transMap.set(`speaker:${keySpeaker}`, { text: t.text, wordCount: t.wordCount });
  }

  // 8. Insert palestras with transcriptions
  console.log('\n📥 Inserting palestras with transcriptions...');
  let matchedCount = 0;
  
  for (const p of tablePalestras) {
    const externalId = `gls${p.number}`;
    const categoryIds = getCategories(p.title);
    
    // Find transcription by title match
    const normalizedTitle = p.title.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, '').trim();
    let trans = transMap.get(normalizedTitle);
    
    // Fallback: try partial title match
    if (!trans) {
      const titleWords = normalizedTitle.split(/\s+/).slice(0, 3).join(' ');
      for (const [key, val] of transMap.entries()) {
        if (key.includes(titleWords) && !key.startsWith('speaker:')) {
          trans = val;
          break;
        }
      }
    }
    
    // Fallback: match by speaker name
    if (!trans) {
      const speakerFirst = p.speaker.toLowerCase().split(' ')[0];
      for (const [key, val] of transMap.entries()) {
        if (key.startsWith('speaker:') && key.includes(speakerFirst)) {
          trans = val;
          break;
        }
      }
    }
    
    if (trans) matchedCount++;
    
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
      description: `Palestra "${p.title}" apresentada por ${p.speaker} no Global Leadership Summit 2025-2026.`,
      duration: p.duration,
      categoryIds,
      year: 2025,
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
  
  // 9. Summary
  const stats = {
    categories: await prisma.category.count(),
    questions: await prisma.diagnosticQuestion.count(),
    speakers: await prisma.speakerProfile.count(),
    palestras: await prisma.palestra.count(),
    withTranscription: await prisma.palestra.count({ where: { transcriptionStatus: 'COMPLETED' } }),
    totalWords: await prisma.palestra.aggregate({ _sum: { wordCount: true } }),
  };
  
  console.log('\n═══════════════════════════════════════════');
  console.log('           RESUMO FINAL                    ');
  console.log('═══════════════════════════════════════════');
  console.log(`  📂 Categorias:         ${stats.categories}`);
  console.log(`  ❓ Perguntas:          ${stats.questions}`);
  console.log(`  👤 Palestrantes:       ${stats.speakers}`);
  console.log(`  🎤 Palestras:          ${stats.palestras}`);
  console.log(`  📝 Com transcrição:    ${stats.withTranscription} de ${stats.palestras}`);
  console.log(`  📊 Total palavras:     ${(stats.totalWords._sum.wordCount || 0).toLocaleString()}`);
  console.log('═══════════════════════════════════════════');
  
  // Write summary to file
  fs.writeFileSync('seed-summary.txt', [
    `Categorias: ${stats.categories}`,
    `Perguntas: ${stats.questions}`,
    `Palestrantes: ${stats.speakers}`,
    `Palestras: ${stats.palestras}`,
    `Com transcricao: ${stats.withTranscription}`,
    `Total palavras: ${stats.totalWords._sum.wordCount || 0}`,
  ].join('\n'), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
