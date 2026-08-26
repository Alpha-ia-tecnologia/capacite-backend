import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';
import { ingestTranscription } from '../src/services/palestra-ingestion.service';

/**
 * Ingere as transcrições reais das palestras (extraídas dos documentos oficiais
 * das temporadas) no pipeline de RAG: chunks + summary + keyTopics + keyQuotes.
 *
 * Uso: npx tsx tools/ingest-transcripts.ts <dir-com-transcripts>
 * Cada arquivo do diretório deve se chamar <externalId>.txt (ex.: gls24_2.txt).
 * Reprocessável: chunks antigos da palestra são substituídos a cada execução.
 */

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('Uso: npx tsx tools/ingest-transcripts.ts <dir-com-transcripts>');
  process.exit(1);
}

async function main() {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.txt'))
    .sort();
  console.log(`Ingerindo ${files.length} transcrições de ${dir}`);

  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (const [i, f] of files.entries()) {
    const externalId = path.basename(f, '.txt');
    const tag = `[${i + 1}/${files.length}] ${externalId}`;

    const palestra = await prisma.palestra.findUnique({ where: { externalId } });
    if (!palestra) {
      skip++;
      console.log(`${tag} SKIP — externalId não está no banco`);
      continue;
    }

    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      const r = await ingestTranscription(palestra.id, text);
      ok++;
      console.log(`${tag} OK — ${r.chunksCreated} chunks, ${r.keyTopics.length} topics, ${r.keyQuotes.length} quotes`);
    } catch (e) {
      fail++;
      console.error(`${tag} FALHA — ${(e as Error).message}`);
    }
  }

  console.log(`\nConcluído: ${ok} ok, ${fail} falhas, ${skip} puladas, de ${files.length} arquivos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
