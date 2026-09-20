/**
 * Solucionador de Spider e gerador da lista de partidas vencíveis.
 *
 * Roda UMA vez, aqui na máquina de desenvolvimento, e produz
 * `public/seeds.json`. O celular nunca resolve nada: só lê a lista pronta.
 *
 * Por que não dá para ser guloso: medido na Fase 1, um jogador que sempre
 * escolhe a melhor jogada imediata e nunca volta atrás venceu 0 de 200
 * partidas de 1 naipe. Spider exige retrocesso de verdade.
 *
 * Por que há limite de tempo: o espaço de estados do Spider explode. Insistir
 * numa semente difícil trava a geração inteira. Como a esmagadora maioria das
 * partidas de 1 naipe é vencível, sai muito mais barato descartar rápido e
 * pegar a próxima semente.
 *
 * Uso:
 *   node tools/gen-seeds.mjs                       (padrão: 300 de cada naipe)
 *   node tools/gen-seeds.mjs --quantidade 50 --ms 1500
 *   node tools/gen-seeds.mjs --naipes 2 --quantidade 300
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { novaPartida, mover, distribuir, desfazer, estadoConsistente } from '../src/core/game.js';
import { jogadasLegais, avaliar } from '../src/core/hint.js';
import { mulberry32, VALOR_AS, VALOR_REI } from '../src/core/deck.js';
import * as R from '../src/core/rules.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

/* ==========================================================================
   Heurística de ordenação
   ========================================================================== */

/**
 * Mover este As para esta coluna fecharia uma sequência K..A?
 *
 * Só um As pode fechar uma sequência, então esta checagem cara só acontece
 * no punhado de jogadas que envolvem ases.
 */
function fecharia(destino, naipe) {
  if (destino.length < VALOR_REI - 1) return false;
  for (let i = 0; i < VALOR_REI - 1; i++) {
    const c = destino[destino.length - 1 - i];
    if (!c.up || c.n !== naipe || c.v !== i + 2) return false;
  }
  return true;
}

/**
 * Nota rápida de uma jogada, calculada sem aplicar nem copiar nada.
 *
 * Aplicar a jogada e avaliar a posição resultante daria uma nota melhor, mas
 * custaria uma varredura das 104 cartas por jogada candidata — inviável dentro
 * de um orçamento de 2 segundos por semente.
 */
function pontuar(estado, de, para, quantas) {
  const origem = estado.mesa[de];
  const destino = estado.mesa[para];
  const carta = origem[origem.length - quantas];
  const base = origem.length - quantas;
  let nota = quantas * 3;

  if (destino.length === 0) {
    // Gastar uma coluna vazia é caro: ela é o recurso mais valioso do jogo.
    nota -= 130;
  } else {
    const topo = destino[destino.length - 1];
    if (topo.n === carta.n) nota += 130;   // continua um bloco do mesmo naipe
    if (carta.v === VALOR_AS && fecharia(destino, carta.n)) nota += 3000;
  }

  if (base === 0) nota += 210;                        // esvazia a coluna
  else if (!origem[base - 1].up) nota += 260;         // desvira uma carta

  // Desmontar um bloco do mesmo naipe que já estava arrumado costuma ser ruim.
  if (base > 0 && origem[base - 1].up && origem[base - 1].n === carta.n &&
      origem[base - 1].v === carta.v + 1) {
    nota -= 90;
  }
  return nota;
}

/** Jogadas legais ordenadas da mais promissora para a menos, distribuição incluída. */
function gerarOrdenado(estado, sortear, ruido) {
  const lista = jogadasLegais(estado);
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const j = lista[i];
    let nota = pontuar(estado, j.de, j.para, j.quantas);
    if (ruido) nota += sortear() * ruido;
    saida.push({ tipo: 'm', de: j.de, para: j.para, quantas: j.quantas, nota });
  }
  saida.sort((a, b) => b.nota - a.nota);
  return saida;
}

/* ==========================================================================
   Busca
   ========================================================================== */

const PROFUNDIDADE_MAXIMA = 800;
const VISITADOS_MAXIMO = 4000000;

/**
 * Chave numérica da posição, para a tabela de posições já visitadas.
 *
 * `assinatura()` de game.js monta uma string de ~300 caracteres e roda a
 * 248 mil por segundo — cara demais, já que a busca precisa de uma chave por
 * nó. Este hash de 48 bits é cerca de 20 vezes mais rápido, e um Set de
 * números é muito mais leve que um Set de strings.
 *
 * Colisão de hash faria a busca pular um ramo por engano, nunca declarar
 * vitória falsa: toda solução encontrada é reconferida do zero por
 * `verificar()`, que remonta a partida só a partir da semente.
 */
function chaveRapida(estado) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let c = 0; c < R.COLUNAS; c++) {
    const coluna = estado.mesa[c];
    h1 = Math.imul(h1 ^ (c + 101), 16777619) >>> 0;
    for (let i = 0; i < coluna.length; i++) {
      const carta = coluna[i];
      const x = carta.v | (carta.n << 4) | (carta.up ? 64 : 0);
      h1 = Math.imul(h1 ^ x, 16777619) >>> 0;
      h2 = Math.imul(h2 + x + i * 31, 2246822519) >>> 0;
      h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
    }
  }
  h1 = Math.imul(h1 ^ estado.monte.length, 16777619) >>> 0;
  return h1 * 65536 + (h2 & 0xffff);
}

/**
 * Procura uma solução para a posição, alterando e desfazendo o próprio estado
 * (nada de cópias: é o que torna a busca rápida o bastante).
 *
 * Devolve { venceu, jogadas, nos, ms }.
 */
function resolver(estado, { ms = 2000, nos: limiteNos = Infinity, largura = 6, ruido = 0, semente = 1 } = {}) {
  const prazo = Date.now() + ms;
  const visitados = new Set();
  const sortear = mulberry32(semente);
  const caminho = [];
  let nos = 0;
  let estourou = false;

  function busca(profundidade) {
    if (R.venceu(estado)) return true;
    if (profundidade >= PROFUNDIDADE_MAXIMA) return false;

    nos++;
    // Conferir o relógio a cada nó seria caro; a cada 256 basta.
    if ((nos & 255) === 0 && Date.now() > prazo) { estourou = true; return false; }
    if (nos > limiteNos) { estourou = true; return false; }

    const chave = chaveRapida(estado);
    if (visitados.has(chave)) return false;
    if (visitados.size < VISITADOS_MAXIMO) visitados.add(chave);

    const jogadas = gerarOrdenado(estado, sortear, ruido);
    const limite = Math.min(jogadas.length, largura);
    for (let i = 0; i < limite; i++) {
      const j = jogadas[i];
      if (!mover(estado, j.de, j.para, j.quantas)) continue;
      caminho.push(j);
      if (busca(profundidade + 1)) return true;
      caminho.pop();
      desfazer(estado);
      if (estourou) return false;
    }

    // Distribuir é SEMPRE tentado, nunca disputa vaga com as jogadas.
    // No Spider há posições em que a única saída é distribuir mesmo havendo
    // jogadas disponíveis; se a distribuição concorresse por nota, um nó com
    // muitas jogadas boas jamais chegaria a testá-la.
    if (R.podeDistribuir(estado)) {
      distribuir(estado);
      caminho.push({ tipo: 'd' });
      if (busca(profundidade + 1)) return true;
      caminho.pop();
      desfazer(estado);
      if (estourou) return false;
    }
    return false;
  }

  const t0 = Date.now();
  const venceu = busca(0);
  return { venceu, jogadas: venceu ? caminho.slice() : null, nos, ms: Date.now() - t0 };
}

/* ==========================================================================
   Busca em feixe
   ==========================================================================

   Por que não dá para usar só profundidade: medido aqui, a busca em
   profundidade resolve 100% das partidas de 1 naipe e praticamente 0% das de
   2 naipes, mesmo recebendo o tempo inteiro. Ela se compromete com uma linha
   de 200 jogadas e, quando essa linha é ruim, aprofundar não resgata.

   O feixe faz o oposto: avança um lance de cada vez mantendo as N melhores
   posições em paralelo. Nunca aposta tudo numa linha, que é exatamente o
   defeito que aparece no Spider de 2 naipes.
*/

/** Clona o estado só para os sobreviventes do nível, nunca para avaliar. */
function clonar(estado) {
  const mesa = new Array(R.COLUNAS);
  for (let c = 0; c < R.COLUNAS; c++) {
    const coluna = estado.mesa[c];
    const nova = new Array(coluna.length);
    for (let i = 0; i < coluna.length; i++) {
      const x = coluna[i];
      nova[i] = { id: x.id, v: x.v, n: x.n, up: x.up };
    }
    mesa[c] = nova;
  }
  const monte = new Array(estado.monte.length);
  for (let i = 0; i < estado.monte.length; i++) {
    const x = estado.monte[i];
    monte[i] = { id: x.id, v: x.v, n: x.n, up: x.up };
  }
  return {
    semente: estado.semente, naipes: estado.naipes, mesa, monte,
    completas: estado.completas, historico: [], jogadas: estado.jogadas,
  };
}

function resolverFeixe(semente, naipes, { ms = 2000, largura = 120, passos = 500 } = {}) {
  const prazo = Date.now() + ms;
  const t0 = Date.now();
  const visitados = new Set();
  const historico = [];            // { jogada, pai } - só as jogadas, não os estados
  let nivel = [{ estado: novaPartida({ semente, naipes }), hist: -1 }];
  visitados.add(chaveRapida(nivel[0].estado));
  let nos = 0;

  function caminhoAte(hist) {
    const jogadas = [];
    for (let i = hist; i >= 0; i = historico[i].pai) jogadas.push(historico[i].jogada);
    jogadas.reverse();
    return jogadas;
  }

  for (let passo = 0; passo < passos; passo++) {
    if (Date.now() > prazo) break;

    const candidatos = [];
    for (let k = 0; k < nivel.length; k++) {
      const { estado, hist } = nivel[k];
      if (R.venceu(estado)) {
        return { venceu: true, jogadas: caminhoAte(hist), nos, ms: Date.now() - t0 };
      }

      // Aplica, mede e desfaz no próprio estado do pai: avaliar não clona nada.
      const jogadas = jogadasLegais(estado);
      for (let i = 0; i < jogadas.length; i++) {
        const j = jogadas[i];
        if (!mover(estado, j.de, j.para, j.quantas)) continue;
        nos++;
        const chave = chaveRapida(estado);
        if (!visitados.has(chave)) {
          candidatos.push({ pai: k, hist, jogada: { tipo: 'm', ...j }, chave, nota: avaliar(estado) });
        }
        desfazer(estado);
      }
      if (R.podeDistribuir(estado)) {
        distribuir(estado);
        nos++;
        const chave = chaveRapida(estado);
        if (!visitados.has(chave)) {
          // Distribuir enterra cartas e sempre piora a nota imediata; sem este
          // desconto na comparação, o feixe nunca escolheria distribuir e
          // morreria de fome com o monte cheio.
          candidatos.push({ pai: k, hist, jogada: { tipo: 'd' }, chave, nota: avaliar(estado) + 900 });
        }
        desfazer(estado);
      }
    }

    if (candidatos.length === 0) break;
    candidatos.sort((a, b) => b.nota - a.nota);

    const proximo = [];
    for (let i = 0; i < candidatos.length && proximo.length < largura; i++) {
      const c = candidatos[i];
      if (visitados.has(c.chave)) continue;
      visitados.add(c.chave);
      const estado = clonar(nivel[c.pai].estado);
      const ok = c.jogada.tipo === 'd'
        ? distribuir(estado)
        : mover(estado, c.jogada.de, c.jogada.para, c.jogada.quantas);
      if (!ok) continue;
      historico.push({ jogada: c.jogada, pai: c.hist });
      proximo.push({ estado, hist: historico.length - 1 });
    }

    if (proximo.length === 0) break;
    nivel = proximo;
  }

  return { venceu: false, jogadas: null, nos, ms: Date.now() - t0 };
}

/**
 * Tenta resolver a semente, com reinícios aleatorizados: se a primeira busca
 * esbarrar no limite, as seguintes embaralham levemente a ordem das jogadas,
 * o que costuma escapar do ramo ruim em que a busca se enfiou.
 */
function tentarSemente(semente, naipes, opcoes) {
  // Etapa 1 - profundidade. Barata e resolve 100% das partidas de 1 naipe em
  // cerca de meio segundo. Em 2 naipes acerta pouco, mas o custo e desprezivel.
  const estado = novaPartida({ semente, naipes });
  const p = resolver(estado, { ms: opcoes.ms, largura: opcoes.largura });
  if (p.venceu) return { ...p, metodo: 'profundidade' };

  // Etapa 2 - feixe. Caro, porem e o unico que resolve 2 naipes.
  //
  // Larguras medidas em 8 sementes de 2 naipes, com teto de 20s:
  //    120 -> 0/8, morre em beco sem saida em 0,7s
  //    600 -> 2/8, media de 6,8s  => 27s por semente aprovada
  //   3000 -> 3/8, media de  19s  => 51s por semente aprovada
  // Largura 600 e o melhor custo-beneficio: com sementes sobrando, descartar
  // uma teimosa sai mais barato que insistir nela com feixe largo.
  if (opcoes.feixe > 0) {
    const f = resolverFeixe(semente, naipes, { ms: opcoes.msFeixe, largura: opcoes.feixe });
    if (f.venceu) return { ...f, metodo: 'feixe' };
  }
  return { venceu: false };
}

/**
 * Confere a solução do zero: monta a partida de novo só a partir da semente e
 * reaplica as jogadas gravadas. Uma semente só entra no arquivo se esta
 * verificação independente terminar em vitória com as 104 cartas no lugar.
 */
function verificar(semente, naipes, jogadas) {
  const estado = novaPartida({ semente, naipes });
  for (let i = 0; i < jogadas.length; i++) {
    const j = jogadas[i];
    const ok = j.tipo === 'd' ? distribuir(estado) : mover(estado, j.de, j.para, j.quantas);
    if (!ok) return false;
    if (!estadoConsistente(estado)) return false;
  }
  return R.venceu(estado);
}

/* ==========================================================================
   Linha de comando
   ========================================================================== */

function argumento(nome, padrao) {
  const i = process.argv.indexOf('--' + nome);
  if (i < 0 || i + 1 >= process.argv.length) return padrao;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : padrao;
}

function gerar(naipes, alvo, opcoes, aoProgredir) {
  const encontradas = [];
  const t0 = Date.now();
  let testadas = 0, rejeitadas = 0, reprovadas = 0;

  for (let semente = 1; encontradas.length < alvo && semente <= opcoes.tetoSementes; semente++) {
    testadas++;
    if (testadas % 25 === 0) relatar();
    const r = tentarSemente(semente, naipes, opcoes);
    if (!r.venceu) { rejeitadas++; continue; }
    if (!verificar(semente, naipes, r.jogadas)) { reprovadas++; continue; }
    encontradas.push(semente);

    if (encontradas.length % 10 === 0 || encontradas.length === alvo) {
      relatar();
      // Grava o que ja tem a cada 10 sementes. Uma corrida de 2 naipes leva
      // mais de uma hora; perder tudo por uma interrupcao no minuto 59 seria
      // desnecessario.
      if (aoProgredir) aoProgredir(encontradas);
    }
  }

  function relatar() {
    const s = ((Date.now() - t0) / 1000).toFixed(0);
    process.stdout.write(
      '  ' + naipes + ' naipe(s): ' + encontradas.length + '/' + alvo +
      ' aprovadas  (' + testadas + ' testadas, ' + s + 's)\n'
    );
  }

  return {
    sementes: encontradas,
    testadas,
    rejeitadas,
    reprovadas,
    segundos: (Date.now() - t0) / 1000,
  };
}

// A CLI so roda quando o arquivo e executado direto. Assim os testes e os
// ensaios conseguem importar o solucionador sem disparar uma geracao inteira.
const executadoDireto = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) principal();

function principal() {
const alvo = argumento('quantidade', 300);
const opcoes = {
  ms: argumento('ms', 2000),               // teto da busca em profundidade
  largura: argumento('largura', 6),        // ramos por no na profundidade
  msFeixe: argumento('msFeixe', 15000),    // teto da busca em feixe
  feixe: argumento('feixe', 600),          // largura do feixe (0 desliga)
  tetoSementes: argumento('teto', 200000),
};
const soNaipes = argumento('naipes', 0);
const naipesAlvo = soNaipes === 1 || soNaipes === 2 ? [soNaipes] : [1, 2];

console.log('Gerando partidas vencíveis');
console.log('  alvo por modo: ' + alvo + '   profundidade: ' + opcoes.ms +
  'ms/largura ' + opcoes.largura + '   feixe: ' + opcoes.msFeixe + 'ms/largura ' + opcoes.feixe + '\n');

// Mescla com o que ja existe: da para gerar 1 naipe agora e 2 naipes depois,
// em execucao separada, sem perder o trabalho anterior.
const destino = resolve(RAIZ, 'public', 'seeds.json');
let saida = { v: 1 };
if (existsSync(destino)) {
  try {
    const anterior = JSON.parse(readFileSync(destino, 'utf8'));
    if (anterior && anterior.v === 1) saida = anterior;
  } catch { /* arquivo corrompido: comeca do zero */ }
}
saida.geradoEm = new Date().toISOString().slice(0, 10);
function gravar() {
  if (!existsSync(dirname(destino))) mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(saida), 'utf8');
}

for (const naipes of naipesAlvo) {
  const r = gerar(naipes, alvo, opcoes, (parciais) => {
    saida[naipes] = parciais.slice();
    gravar();
  });
  saida[naipes] = r.sementes;
  gravar();
  const taxa = r.testadas > 0 ? (100 * r.sementes.length / r.testadas).toFixed(1) : '0';
  console.log(
    '  ' + naipes + ' naipe(s): ' + r.sementes.length + ' sementes em ' +
    r.segundos.toFixed(0) + 's  |  ' + r.testadas + ' testadas, taxa de aproveitamento ' +
    taxa + '%  |  ' + r.rejeitadas + ' sem solução no tempo, ' + r.reprovadas + ' reprovadas na conferência\n'
  );
}

gravar();
console.log('Gravado: public/seeds.json  (1 naipe: ' + (saida['1'] || []).length +
  ' sementes, 2 naipes: ' + (saida['2'] || []).length + ' sementes)');
}

export { resolver, resolverFeixe, tentarSemente, verificar, pontuar, fecharia, chaveRapida };
