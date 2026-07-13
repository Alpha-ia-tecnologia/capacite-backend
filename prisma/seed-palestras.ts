import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the 112 GLS palestras (somente as que constam nos documentos oficiais
 * das temporadas 2017-18 a 2025-26) into the database.
 * Gerado a partir de frontend/src/data/capacite-data.ts — mantenha os dois em sincronia.
 * Run with: npx tsx prisma/seed-palestras.ts
 */

const PALESTRAS = [
  { externalId: 'gls17_1', title: 'O poder da paixão e da perseverança', speaker: 'Angela Duckworth', description: 'O poder da paixão e da perseverança — Angela Duckworth.', duration: '35:54', categoryIds: ['resiliencia-saude-bemestar', 'lideranca-pessoal'], year: 2017 },
  { externalId: 'gls17_2', title: 'Liderança agora, responsabilidade social sempre!', speaker: 'Bryan Stevenson', description: 'Liderança agora, responsabilidade social sempre! — Bryan Stevenson.', duration: '30 min', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2017 },
  { externalId: 'gls17_3', title: 'Liderança criativa em um mundo de grandes transformações', speaker: 'Fredrik Haren', description: 'Liderança criativa em um mundo de grandes transformações — Fredrik Haren.', duration: '26:22', categoryIds: ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'], year: 2017 },
  { externalId: 'gls17_4', title: 'Não tema, lidere!', speaker: 'Gary Haugen', description: 'Não tema, lidere! — Gary Haugen.', duration: '39:14', categoryIds: ['lideranca-pessoal', 'resiliencia-saude-bemestar'], year: 2017 },
  { externalId: 'gls17_5', title: 'O perdão e o desenvolvimento emocional', speaker: 'Immaculée Ilibagiza', description: 'O perdão e o desenvolvimento emocional — Immaculée Ilibagiza.', duration: '29:13', categoryIds: ['resiliencia-saude-bemestar', 'pessoas-cultura-confianca'], year: 2017 },
  { externalId: 'gls17_6', title: 'O "tempo ocioso" para a construção de soluções', speaker: 'Juliet Funt', description: 'O "tempo ocioso" para a construção de soluções — Juliet Funt.', duration: '31:57', categoryIds: ['estrategia-decisoes-execucao', 'resiliencia-saude-bemestar'], year: 2017 },
  { externalId: 'gls17_7', title: 'Reinventando a gestão da performance', speaker: 'Marcus Buckingham', description: 'Reinventando a gestão da performance — Marcus Buckingham.', duration: '37:24', categoryIds: ['estrategia-decisoes-execucao', 'pessoas-cultura-confianca'], year: 2017 },
  { externalId: 'gls17_8', title: 'Liderando você mesmo', speaker: 'Sam Adayemi', description: 'Liderando você mesmo — Sam Adayemi.', duration: '32:46', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2017 },
  { externalId: 'gls18_1', title: 'O líder que as pessoas amam seguir', speaker: 'Craig Groeschel', description: 'O líder que as pessoas amam seguir — Craig Groeschel.', duration: '40:44', categoryIds: ['lideranca-pessoal', 'pessoas-cultura-confianca'], year: 2018 },
  { externalId: 'gls18_2', title: 'Liderança preventiva', speaker: 'Craig Groeschel', description: 'Liderança preventiva — Craig Groeschel.', duration: '46:08', categoryIds: ['estrategia-decisoes-execucao', 'lideranca-pessoal'], year: 2018 },
  { externalId: 'gls18_3', title: 'Lições de liderança', speaker: 'Angela Ahrendts', description: 'Lições de liderança — Angela Ahrendts.', duration: '35:20', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2018 },
  { externalId: 'gls18_4', title: 'Juntos somos melhores', speaker: 'Danielle Strickland', description: 'Juntos somos melhores — Danielle Strickland.', duration: '30:51', categoryIds: ['pessoas-cultura-confianca', 'comunicacao-influencia'], year: 2018 },
  { externalId: 'gls18_5', title: 'Inteligência Cultural', speaker: 'David Livermore', description: 'Inteligência Cultural — David Livermore.', duration: '29:49', categoryIds: ['pessoas-cultura-confianca', 'mudanca-inovacao-reinvencao'], year: 2018 },
  { externalId: 'gls18_6', title: 'A última flecha: não pare até ter terminado', speaker: 'Erwin McManus', description: 'A última flecha: não pare até ter terminado — Erwin McManus.', duration: '39:52', categoryIds: ['proposito-visao-legado', 'resiliencia-saude-bemestar'], year: 2018 },
  { externalId: 'gls18_7', title: 'Ver mais e ver antes', speaker: 'John Maxwell', description: 'Ver mais e ver antes — John Maxwell.', duration: '25:35', categoryIds: ['estrategia-decisoes-execucao', 'proposito-visao-legado'], year: 2018 },
  { externalId: 'gls18_8', title: 'A vantagem da simplicidade', speaker: 'Juliet Funt', description: 'A vantagem da simplicidade — Juliet Funt.', duration: '26:03', categoryIds: ['estrategia-decisoes-execucao', 'mudanca-inovacao-reinvencao'], year: 2018 },
  { externalId: 'gls18_9', title: 'O difícil trabalho de impulsionar a visão', speaker: 'Nthabiseng Legoete', description: 'O difícil trabalho de impulsionar a visão — Nthabiseng Legoete.', duration: '20:07', categoryIds: ['proposito-visao-legado', 'lideranca-pessoal'], year: 2018 },
  { externalId: 'gls18_10', title: 'Como manter o sucesso', speaker: 'Rasmus Ankersen', description: 'Como manter o sucesso — Rasmus Ankersen.', duration: '34:09', categoryIds: ['estrategia-decisoes-execucao', 'mudanca-inovacao-reinvencao'], year: 2018 },
  { externalId: 'gls18_11', title: 'Navegando em conversas difíceis', speaker: 'Sheila Heen', description: 'Navegando em conversas difíceis — Sheila Heen.', duration: '38:48', categoryIds: ['comunicacao-influencia', 'pessoas-cultura-confianca'], year: 2018 },
  { externalId: 'gls18_12', title: 'Filantropia e Inovação', speaker: 'Strive Masiyiwa', description: 'Filantropia e Inovação — Strive Masiyiwa.', duration: '44:51', categoryIds: ['proposito-visao-legado', 'mudanca-inovacao-reinvencao'], year: 2018 },
  { externalId: 'gls18_13', title: 'Planar!', speaker: 'TD Jakes', description: 'Planar! — TD Jakes.', duration: '16:17', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2018 },
  { externalId: 'gls19_1', title: 'Um-a-um com Paula Faris', speaker: 'Chris Voss', description: 'Um-a-um com Paula Faris — Chris Voss.', duration: '30:57', categoryIds: ['comunicacao-influencia', 'lideranca-pessoal'], year: 2019 },
  { externalId: 'gls19_2', title: 'Coração acima da Razão', speaker: 'Craig Groeschel', description: 'Coração acima da Razão — Craig Groeschel.', duration: '39:53', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2019 },
  { externalId: 'gls19_3', title: 'Endireite a Curva', speaker: 'Craig Groeschel', description: 'Endireite a Curva — Craig Groeschel.', duration: '40:46', categoryIds: ['estrategia-decisoes-execucao', 'lideranca-pessoal'], year: 2019 },
  { externalId: 'gls19_4', title: 'Conduzindo à mudança transformadora', speaker: 'Danielle Strickland', description: 'Conduzindo à mudança transformadora — Danielle Strickland.', duration: '26:42', categoryIds: ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'], year: 2019 },
  { externalId: 'gls19_5', title: 'A sua diferença é o seu destino', speaker: 'DeVon Franklin', description: 'A sua diferença é o seu destino — DeVon Franklin.', duration: '31:09', categoryIds: ['proposito-visao-legado', 'lideranca-pessoal'], year: 2019 },
  { externalId: 'gls19_6', title: 'Revelando os Segredos das Gerações', speaker: 'Jason Dorsey', description: 'Revelando os Segredos das Gerações — Jason Dorsey.', duration: '33:03', categoryIds: ['pessoas-cultura-confianca', 'comunicacao-influencia'], year: 2019 },
  { externalId: 'gls19_7', title: 'Sem Medo da Rejeição', speaker: 'Jia Jiang', description: 'Sem Medo da Rejeição — Jia Jiang.', duration: '31:49', categoryIds: ['resiliencia-saude-bemestar', 'mudanca-inovacao-reinvencao'], year: 2019 },
  { externalId: 'gls19_8', title: 'Aumente o nível da sua liderança', speaker: 'Jo Saxton', description: 'Aumente o nível da sua liderança — Jo Saxton.', duration: '30:44', categoryIds: ['lideranca-pessoal', 'estrategia-decisoes-execucao'], year: 2019 },
  { externalId: 'gls19_9', title: 'Liderança VIP', speaker: 'Krish Kandiah', description: 'Liderança VIP — Krish Kandiah.', duration: '29:42', categoryIds: ['pessoas-cultura-confianca', 'proposito-visao-legado'], year: 2019 },
  { externalId: 'gls19_10', title: 'Coragem de Principiante', speaker: 'Liz Bohannon', description: 'Coragem de Principiante — Liz Bohannon.', duration: '39:53', categoryIds: ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'], year: 2019 },
  { externalId: 'gls19_11', title: 'Domesticando Tigres', speaker: 'Todd Henry', description: 'Domesticando Tigres — Todd Henry.', duration: '29:46', categoryIds: ['estrategia-decisoes-execucao', 'resiliencia-saude-bemestar'], year: 2019 },
  { externalId: 'gls20_1', title: 'Liderança que atende ao momento', speaker: 'Albert Tate', description: 'Liderança que atende ao momento — Albert Tate.', duration: '33:42', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2020 },
  { externalId: 'gls20_2', title: 'Segurança psicológica', speaker: 'Amy Edmondson', description: 'Segurança psicológica — Amy Edmondson.', duration: '27:25', categoryIds: ['pessoas-cultura-confianca', 'comunicacao-influencia'], year: 2020 },
  { externalId: 'gls20_3', title: 'Lidere durante o mergulho', speaker: 'Craig Groeschel', description: 'Lidere durante o mergulho — Craig Groeschel.', duration: '40:52', categoryIds: ['lideranca-pessoal', 'resiliencia-saude-bemestar'], year: 2020 },
  { externalId: 'gls20_4', title: 'O obstáculo mais surpreendente à inovação', speaker: 'Lysa TerKeurst', description: 'O obstáculo mais surpreendente à inovação — Lysa TerKeurst.', duration: '42:55', categoryIds: ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'], year: 2020 },
  { externalId: 'gls20_5', title: 'Como os melhores líderes desenvolvem resiliência', speaker: 'Marcus Buckingham', description: 'Como os melhores líderes desenvolvem resiliência — Marcus Buckingham.', duration: '20:08', categoryIds: ['resiliencia-saude-bemestar', 'lideranca-pessoal'], year: 2020 },
  { externalId: 'gls20_6', title: 'O ritmo da liderança', speaker: 'Michael Todd', description: 'O ritmo da liderança — Michael Todd.', duration: '26:22', categoryIds: ['lideranca-pessoal', 'estrategia-decisoes-execucao'], year: 2020 },
  { externalId: 'gls20_7', title: 'Seguro não é o suficiente', speaker: 'Nona Jones', description: 'Seguro não é o suficiente — Nona Jones.', duration: '26:12', categoryIds: ['lideranca-pessoal', 'pessoas-cultura-confianca'], year: 2020 },
  { externalId: 'gls20_8', title: 'Como liderar em um recomeço', speaker: 'Paula Faris', description: 'Como liderar em um recomeço — Paula Faris.', duration: '23:25', categoryIds: ['mudanca-inovacao-reinvencao', 'resiliencia-saude-bemestar'], year: 2020 },
  { externalId: 'gls20_9', title: 'Os 6 traços da liderança', speaker: 'Tomas Chamorro-Premuzic', description: 'Os 6 traços da liderança — Tomas Chamorro-Premuzic.', duration: '30:57', categoryIds: ['comunicacao-influencia', 'pessoas-cultura-confianca'], year: 2020 },
  { externalId: 'gls20_10', title: 'A ciência da liderança: impactando para o bem', speaker: 'Vanessa Van Edwards', description: 'A ciência da liderança: impactando para o bem — Vanessa Van Edwards.', duration: '26:47', categoryIds: ['comunicacao-influencia', 'pessoas-cultura-confianca'], year: 2020 },
  { externalId: 'gls20_11', title: 'Liderança amorosa – entrevista com Kaká', speaker: 'Kaká', description: 'Liderança amorosa – entrevista com Kaká — Kaká.', duration: '27:41', categoryIds: ['proposito-visao-legado', 'pessoas-cultura-confianca'], year: 2020 },
  { externalId: 'gls21_1', title: 'Expandindo sua capacidade de liderança', speaker: 'Craig Groeschel', description: 'Expandindo sua capacidade de liderança — Craig Groeschel.', duration: '42:02', categoryIds: ['lideranca-pessoal', 'estrategia-decisoes-execucao'], year: 2021 },
  { externalId: 'gls21_2', title: 'Talento rebelde', speaker: 'Francesca Gino', description: 'Talento rebelde — Francesca Gino.', duration: '24:23', categoryIds: ['mudanca-inovacao-reinvencao', 'pessoas-cultura-confianca'], year: 2021 },
  { externalId: 'gls21_3', title: 'Um minuto para pensar', speaker: 'Juliet Funt', description: 'Um minuto para pensar — Juliet Funt.', duration: '25:26', categoryIds: ['estrategia-decisoes-execucao', 'resiliencia-saude-bemestar'], year: 2021 },
  { externalId: 'gls21_4', title: 'A Labuta da Liderança', speaker: 'Rich Wilkeson', description: 'A Labuta da Liderança — Rich Wilkeson.', duration: '24:39', categoryIds: ['lideranca-pessoal', 'resiliencia-saude-bemestar'], year: 2021 },
  { externalId: 'gls21_5', title: 'Resiliência bilionária', speaker: 'Jamie Kern Lima', description: 'Resiliência bilionária — Jamie Kern Lima.', duration: '33:47', categoryIds: ['resiliencia-saude-bemestar', 'lideranca-pessoal'], year: 2021 },
  { externalId: 'gls21_6', title: 'Exigir civilidade para liderar', speaker: 'Shola Richards', description: 'Exigir civilidade para liderar — Shola Richards.', duration: '31:36', categoryIds: ['pessoas-cultura-confianca', 'comunicacao-influencia'], year: 2021 },
  { externalId: 'gls21_7', title: 'O Poder de Escolha do Líder', speaker: 'Ibukun Awosika', description: 'O Poder de Escolha do Líder — Ibukun Awosika.', duration: '28:21', categoryIds: ['lideranca-pessoal', 'estrategia-decisoes-execucao'], year: 2021 },
  { externalId: 'gls21_8', title: 'Olá, medo!', speaker: 'Michelle Poler', description: 'Olá, medo! — Michelle Poler.', duration: '31:26', categoryIds: ['resiliencia-saude-bemestar', 'mudanca-inovacao-reinvencao'], year: 2021 },
  { externalId: 'gls21_9', title: 'A escolha de liderar', speaker: 'Bianca Olthoff', description: 'A escolha de liderar — Bianca Olthoff.', duration: '27:22', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2021 },
  { externalId: 'gls21_10', title: 'Encontre o seu Ritmo', speaker: 'Albert Tate', description: 'Encontre o seu Ritmo — Albert Tate.', duration: '40:07', categoryIds: ['resiliencia-saude-bemestar', 'lideranca-pessoal'], year: 2021 },
  { externalId: 'gls21_11', title: 'Liderança Extraordinária: Um-a-um com A.R. Bernard', speaker: 'A.R. Bernard', description: 'Liderança Extraordinária: Um-a-um com A.R. Bernard — A.R. Bernard.', duration: '34:12', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2021 },
  { externalId: 'gls21_12', title: 'Liderança e saúde mental', speaker: 'Henry Cloud', description: 'Liderança e saúde mental — Henry Cloud.', duration: '54:54', categoryIds: ['resiliencia-saude-bemestar', 'pessoas-cultura-confianca'], year: 2021 },
  { externalId: 'gls21_13', title: 'Dominando o risco', speaker: 'Stanley McChrystal', description: 'Dominando o risco — Stanley McChrystal.', duration: '29:37', categoryIds: ['estrategia-decisoes-execucao', 'mudanca-inovacao-reinvencao'], year: 2021 },
  { externalId: 'gls21_14', title: 'Colaboração, Criatividade e Convicção', speaker: 'Jerry Lorenzo', description: 'Colaboração, Criatividade e Convicção — Jerry Lorenzo.', duration: '18:40', categoryIds: ['mudanca-inovacao-reinvencao', 'pessoas-cultura-confianca'], year: 2021 },
  { externalId: 'gls22_1', title: 'A viagem de uma vida', speaker: 'Bob Iger', description: 'A viagem de uma vida — Bob Iger.', duration: '28:16', categoryIds: ['proposito-visao-legado', 'lideranca-pessoal'], year: 2022 },
  { externalId: 'gls22_2', title: 'Aprenda a liderar em uma nova realidade', speaker: 'Carey Nieuwhof', description: 'Aprenda a liderar em uma nova realidade — Carey Nieuwhof.', duration: '32:22', categoryIds: ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'], year: 2022 },
  { externalId: 'gls22_3', title: 'Liderança única', speaker: 'Craig Groeschel', description: 'Liderança única — Craig Groeschel.', duration: '39:07', categoryIds: ['lideranca-pessoal', 'estrategia-decisoes-execucao'], year: 2022 },
  { externalId: 'gls22_4', title: 'Recupere seu poder', speaker: 'Deb Liu', description: 'Recupere seu poder — Deb Liu.', duration: '20:12', categoryIds: ['lideranca-pessoal', 'resiliencia-saude-bemestar'], year: 2022 },
  { externalId: 'gls22_5', title: 'O papel crítico da empatia na liderança', speaker: 'Johnny C. Taylor', description: 'O papel crítico da empatia na liderança — Johnny C. Taylor.', duration: '28:43', categoryIds: ['pessoas-cultura-confianca', 'comunicacao-influencia'], year: 2022 },
  { externalId: 'gls22_6', title: 'Trilhas sonoras da mente', speaker: 'Jon Acuff', description: 'Trilhas sonoras da mente — Jon Acuff.', duration: '33:56', categoryIds: ['resiliencia-saude-bemestar', 'lideranca-pessoal'], year: 2022 },
  { externalId: 'gls22_7', title: 'Liderando com a dor', speaker: 'Judah Smith', description: 'Liderando com a dor — Judah Smith.', duration: '36:46', categoryIds: ['resiliencia-saude-bemestar', 'lideranca-pessoal'], year: 2022 },
  { externalId: 'gls22_8', title: 'O coração por trás do In-N-Out Burger', speaker: 'Lynsi Snyder', description: 'O coração por trás do In-N-Out Burger — Lynsi Snyder.', duration: '19:31', categoryIds: ['proposito-visao-legado', 'pessoas-cultura-confianca'], year: 2022 },
  { externalId: 'gls22_9', title: 'Desbloqueando a mentalidade de start-up em sua organização', speaker: 'Sahar Hashemi', description: 'Desbloqueando a mentalidade de start-up em sua organização — Sahar Hashemi.', duration: '31:18', categoryIds: ['mudanca-inovacao-reinvencao', 'estrategia-decisoes-execucao'], year: 2022 },
  { externalId: 'gls22_10', title: 'Adaptando sua liderança para os desafios de hoje', speaker: 'Stephanie Chung', description: 'Adaptando sua liderança para os desafios de hoje — Stephanie Chung.', duration: '29:04', categoryIds: ['lideranca-pessoal', 'mudanca-inovacao-reinvencao'], year: 2022 },
  { externalId: 'gls22_11', title: 'Ciência da conexão', speaker: 'Vanessa Van Edwards', description: 'Ciência da conexão — Vanessa Van Edwards.', duration: '37:25', categoryIds: ['comunicacao-influencia', 'pessoas-cultura-confianca'], year: 2022 },
  { externalId: 'gls23_1', title: 'Lidere onde estiver', speaker: 'Albert Tate', description: 'Lidere onde estiver — Albert Tate.', duration: '17:31', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2023 },
  { externalId: 'gls23_2', title: 'Liderando em tempos difíceis', speaker: 'Albert Tate', description: 'Liderando em tempos difíceis — Albert Tate.', duration: '29:01', categoryIds: ['lideranca-pessoal', 'resiliencia-saude-bemestar'], year: 2023 },
  { externalId: 'gls23_3', title: 'Um sacrifício que vale a pena', speaker: 'Chris Mathebula', description: 'Um sacrifício que vale a pena — Chris Mathebula.', duration: '29:10', categoryIds: ['proposito-visao-legado', 'lideranca-pessoal'], year: 2023 },
  { externalId: 'gls23_4', title: 'O futuro da liderança é a confiança', speaker: 'Craig Groeschel', description: 'O futuro da liderança é a confiança — Craig Groeschel.', duration: '41:30', categoryIds: ['pessoas-cultura-confianca', 'lideranca-pessoal'], year: 2023 },
  { externalId: 'gls23_5', title: 'Liderando The Chosen', speaker: 'Dallas Jenkins', description: 'Liderando The Chosen — Dallas Jenkins.', duration: '25:08', categoryIds: ['proposito-visao-legado', 'mudanca-inovacao-reinvencao'], year: 2023 },
  { externalId: 'gls23_6', title: 'Promovendo uma cultura de reinvenção', speaker: 'Erin Meyer', description: 'Promovendo uma cultura de reinvenção — Erin Meyer.', duration: '33:29', categoryIds: ['mudanca-inovacao-reinvencao', 'pessoas-cultura-confianca'], year: 2023 },
  { externalId: 'gls23_7', title: 'Mudança de mentalidade', speaker: 'Erwin McManus', description: 'Mudança de mentalidade — Erwin McManus.', duration: '19:15', categoryIds: ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'], year: 2023 },
  { externalId: 'gls23_8', title: 'Confiança', speaker: 'Henry Cloud', description: 'Confiança — Henry Cloud.', duration: '19:19', categoryIds: ['pessoas-cultura-confianca', 'comunicacao-influencia'], year: 2023 },
  { externalId: 'gls23_9', title: 'O que está aqui agora?', speaker: 'Jeanne Stevens', description: 'O que está aqui agora? — Jeanne Stevens.', duration: '44:10', categoryIds: ['lideranca-pessoal', 'resiliencia-saude-bemestar'], year: 2023 },
  { externalId: 'gls23_10', title: 'O paradoxo da esperança', speaker: 'Krish Kandiah', description: 'O paradoxo da esperança — Krish Kandiah.', duration: '27:09', categoryIds: ['proposito-visao-legado', 'resiliencia-saude-bemestar'], year: 2023 },
  { externalId: 'gls23_11', title: 'O topo é solitário, mas não precisa ser', speaker: 'Liz Bohannon', description: 'O topo é solitário, mas não precisa ser — Liz Bohannon.', duration: '33:31', categoryIds: ['pessoas-cultura-confianca', 'resiliencia-saude-bemestar'], year: 2023 },
  { externalId: 'gls23_12', title: 'Construa seu MAP de carreira', speaker: 'Pat Gelsinger', description: 'Construa seu MAP de carreira — Pat Gelsinger.', duration: '30:42', categoryIds: ['estrategia-decisoes-execucao', 'proposito-visao-legado'], year: 2023 },
  { externalId: 'gls23_13', title: 'Coragem nos tempos atuais', speaker: 'Patrick Lencioni', description: 'Coragem nos tempos atuais — Patrick Lencioni.', duration: '27:42', categoryIds: ['lideranca-pessoal', 'comunicacao-influencia'], year: 2023 },
  { externalId: 'gls23_14', title: 'Aumentando o nível – 3 perguntas para líderes de outro nível', speaker: 'Ryan Leak', description: 'Aumentando o nível – 3 perguntas para líderes de outro nível — Ryan Leak.', duration: '32:15', categoryIds: ['estrategia-decisoes-execucao', 'lideranca-pessoal'], year: 2023 },
  { externalId: 'gls24_2', title: 'Mais feliz em um mundo infeliz', speaker: 'Arthur C. Brooks', description: 'Mais feliz em um mundo infeliz — Arthur C. Brooks.', duration: '35:37', categoryIds: ['resiliencia-saude-bemestar', 'lideranca-pessoal'], year: 2024 },
  { externalId: 'gls24_3', title: 'Alcance de controle', speaker: 'Carey Lohrenz', description: 'Alcance de controle — Carey Lohrenz.', duration: '26:36', categoryIds: ['lideranca-pessoal', 'estrategia-decisoes-execucao'], year: 2024 },
  { externalId: 'gls24_4', title: 'Permissão para se obcecar', speaker: 'Craig Groeschel', description: 'Permissão para se obcecar — Craig Groeschel.', duration: '40:51', categoryIds: ['lideranca-pessoal', 'estrategia-decisoes-execucao'], year: 2024 },
  { externalId: 'gls24_5', title: 'Um legado de liderança', speaker: 'Dan Owolabi', description: 'Um legado de liderança — Dan Owolabi.', duration: '27:44', categoryIds: ['proposito-visao-legado', 'lideranca-pessoal'], year: 2024 },
  { externalId: 'gls24_6', title: 'A força oculta que pode destruir seu legado', speaker: 'David Ashcraft', description: 'A força oculta que pode destruir seu legado — David Ashcraft.', duration: '39:10', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2024 },
  { externalId: 'gls24_7', title: '7 frequências da comunicação', speaker: 'Erwin McManus', description: '7 frequências da comunicação — Erwin McManus.', duration: '38:33', categoryIds: ['comunicacao-influencia', 'lideranca-pessoal'], year: 2024 },
  { externalId: 'gls24_8', title: 'Amplifique seu propósito para elevar seu impacto', speaker: 'Jo Saxton', description: 'Amplifique seu propósito para elevar seu impacto — Jo Saxton.', duration: '17:48', categoryIds: ['proposito-visao-legado', 'lideranca-pessoal'], year: 2024 },
  { externalId: 'gls24_9', title: 'O paradoxo de liderar a partir de sua fraqueza', speaker: 'Joni Eareckson', description: 'O paradoxo de liderar a partir de sua fraqueza — Joni Eareckson.', duration: '20:36', categoryIds: ['lideranca-pessoal', 'resiliencia-saude-bemestar'], year: 2024 },
  { externalId: 'gls24_10', title: 'Aproveite o poder da história', speaker: 'Kindra Hall', description: 'Aproveite o poder da história — Kindra Hall.', duration: '28:30', categoryIds: ['comunicacao-influencia', 'pessoas-cultura-confianca'], year: 2024 },
  { externalId: 'gls24_11', title: 'Reputação: Como você quer ser lembrado como líder', speaker: 'Krish Kandiah', description: 'Reputação: Como você quer ser lembrado como líder — Krish Kandiah.', duration: '31:51', categoryIds: ['proposito-visao-legado', 'lideranca-pessoal'], year: 2024 },
  { externalId: 'gls24_12', title: 'Liberte a força mais poderosa nos negócios', speaker: 'Marcus Buckingham', description: 'Liberte a força mais poderosa nos negócios — Marcus Buckingham.', duration: '34:31', categoryIds: ['pessoas-cultura-confianca', 'estrategia-decisoes-execucao'], year: 2024 },
  { externalId: 'gls24_13', title: 'Engraçado como o conflito funciona', speaker: 'Michael Jr.', description: 'Engraçado como o conflito funciona — Michael Jr..', duration: '19:10', categoryIds: ['comunicacao-influencia', 'pessoas-cultura-confianca'], year: 2024 },
  { externalId: 'gls24_14', title: 'Vitória por meio do trabalho em equipe', speaker: 'Mike Krzyzewski', description: 'Vitória por meio do trabalho em equipe — Mike Krzyzewski.', duration: '31:17', categoryIds: ['pessoas-cultura-confianca', 'estrategia-decisoes-execucao'], year: 2024 },
  { externalId: 'gls24_15', title: 'Impulso dinâmico', speaker: 'Molly Fletcher', description: 'Impulso dinâmico — Molly Fletcher.', duration: '32:57', categoryIds: ['estrategia-decisoes-execucao', 'mudanca-inovacao-reinvencao'], year: 2024 },
  { externalId: 'gls24_16', title: 'Hospitalidade irracional', speaker: 'Will Guidara', description: 'Hospitalidade irracional — Will Guidara.', duration: '34:02', categoryIds: ['pessoas-cultura-confianca', 'proposito-visao-legado'], year: 2024 },
  { externalId: 'gls25_1', title: 'A monotonia é o segredo do sucesso', speaker: 'Craig Groeschel', description: 'A monotonia é o segredo do sucesso — Craig Groeschel.', duration: '40:27', categoryIds: ['lideranca-pessoal', 'estrategia-decisoes-execucao'], year: 2025 },
  { externalId: 'gls25_2', title: 'O excesso na liderança', speaker: 'Juliet Funt', description: 'O excesso na liderança — Juliet Funt.', duration: '35:25', categoryIds: ['resiliencia-saude-bemestar', 'estrategia-decisoes-execucao'], year: 2025 },
  { externalId: 'gls25_3', title: 'Conexão humana na era digital', speaker: 'Erica Dhawan', description: 'Conexão humana na era digital — Erica Dhawan.', duration: '31:14', categoryIds: ['comunicacao-influencia', 'pessoas-cultura-confianca'], year: 2025 },
  { externalId: 'gls25_4', title: 'Liderando no hífen', speaker: 'Gabriel Salguero', description: 'Liderando no hífen — Gabriel Salguero.', duration: '34:12', categoryIds: ['lideranca-pessoal', 'pessoas-cultura-confianca'], year: 2025 },
  { externalId: 'gls25_5', title: 'Entrevista com David Ashcraft', speaker: 'Thasunda Brown Duckett', description: 'Entrevista com David Ashcraft — Thasunda Brown Duckett.', duration: '35:06', categoryIds: ['lideranca-pessoal', 'proposito-visao-legado'], year: 2025 },
  { externalId: 'gls25_6', title: 'Como prosperar quando só resiliência não basta', speaker: 'Tasha Eurich', description: 'Como prosperar quando só resiliência não basta — Tasha Eurich.', duration: '38:08', categoryIds: ['resiliencia-saude-bemestar', 'lideranca-pessoal'], year: 2025 },
  { externalId: 'gls25_7', title: 'Entre na roda', speaker: 'Bradley Rapier', description: 'Entre na roda — Bradley Rapier.', duration: '26:38', categoryIds: ['mudanca-inovacao-reinvencao', 'pessoas-cultura-confianca'], year: 2025 },
  { externalId: 'gls25_8', title: 'Desempenho regenerativo', speaker: 'James Hewitt', description: 'Desempenho regenerativo — James Hewitt.', duration: '32:54', categoryIds: ['resiliencia-saude-bemestar', 'estrategia-decisoes-execucao'], year: 2025 },
  { externalId: 'gls25_9', title: 'Como liderar pessoas diferentes de você', speaker: 'Stephanie Chung', description: 'Como liderar pessoas diferentes de você — Stephanie Chung.', duration: '17:05', categoryIds: ['pessoas-cultura-confianca', 'comunicacao-influencia'], year: 2025 },
  { externalId: 'gls25_10', title: 'Deixando um legado que importa', speaker: 'John Maxwell', description: 'Deixando um legado que importa — John Maxwell.', duration: '34:47', categoryIds: ['proposito-visao-legado', 'lideranca-pessoal'], year: 2025 },
  { externalId: 'gls25_11', title: 'Uma visão que ancora', speaker: 'Christine Caine', description: 'Uma visão que ancora — Christine Caine.', duration: '38:16', categoryIds: ['proposito-visao-legado', 'resiliencia-saude-bemestar'], year: 2025 },
  { externalId: 'gls25_12', title: 'À prova de procrastinação', speaker: 'Jon Acuff', description: 'À prova de procrastinação — Jon Acuff.', duration: '37:23', categoryIds: ['estrategia-decisoes-execucao', 'lideranca-pessoal'], year: 2025 },
  { externalId: 'gls25_13', title: 'Mude a sua pergunta', speaker: 'David Ashcraft', description: 'Mude a sua pergunta — David Ashcraft.', duration: '16:14', categoryIds: ['mudanca-inovacao-reinvencao', 'lideranca-pessoal'], year: 2025 },
  { externalId: 'gls25_14', title: 'Em qual atividade você está?', speaker: 'David Ashcraft', description: 'Em qual atividade você está? — David Ashcraft.', duration: '48:07', categoryIds: ['estrategia-decisoes-execucao', 'lideranca-pessoal'], year: 2025 },
  { externalId: 'gls25_15', title: 'Oportunidade acima do obstáculo', speaker: 'Khalil Halaseh', description: 'Oportunidade acima do obstáculo — Khalil Halaseh.', duration: '35:43', categoryIds: ['mudanca-inovacao-reinvencao', 'resiliencia-saude-bemestar'], year: 2025 },
];

async function main() {
  console.log(`Seeding ${PALESTRAS.length} palestras...`);

  // Remove palestras que não constam nos documentos (ex.: mocks antigos p1-p21).
  // Chunks e insights associados caem por cascade.
  const validIds = PALESTRAS.map((p) => p.externalId);
  const removed = await prisma.palestra.deleteMany({
    where: { externalId: { notIn: validIds } },
  });
  console.log(`  removidas ${removed.count} palestras fora dos documentos`);

  for (const p of PALESTRAS) {
    await prisma.palestra.upsert({
      where: { externalId: p.externalId },
      update: {
        title: p.title,
        speaker: p.speaker,
        description: p.description,
        duration: p.duration,
        categoryIds: p.categoryIds,
        year: p.year,
      },
      create: {
        externalId: p.externalId,
        title: p.title,
        speaker: p.speaker,
        description: p.description,
        duration: p.duration,
        categoryIds: p.categoryIds,
        year: p.year,
      },
    });
  }
  console.log('  ✓ upsert concluído');

  const total = await prisma.palestra.count();
  console.log(`Palestras seed completed! Total no banco: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
