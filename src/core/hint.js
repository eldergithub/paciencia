/**
 * Busca de jogadas: alimenta tanto o botao "Dica" quanto o "tocar para mover".
 *
 * Os dois usam a mesma pontuacao de propósito: se ela tocar numa carta, a
 * carta vai para o mesmo lugar que a dica recomendaria. Um unico criterio de
 * "boa jogada" no app inteiro evita a sensacao de que o jogo age de formas
 * diferentes sem explicacao.
 */

import * as R from './rules.js';
import { copiarEstado, mover, distribuir } from './game.js';

/**
 * Todas as jogadas legais da posicao.
 *
 * Duas reducoes que nao perdem nenhuma jogada util:
 *  - colunas vazias sao equivalentes entre si, entao so a primeira entra
 *    como destino;
 *  - para um destino ocupado existe no maximo uma quantidade legal, porque
 *    os valores dentro de um bloco movel sao estritamente decrescentes.
 */
export function jogadasLegais(estado) {
  const mesa = estado.mesa;
  let primeiraVazia = -1;
  for (let i = 0; i < R.COLUNAS; i++) {
    if (mesa[i].length === 0) { primeiraVazia = i; break; }
  }

  const jogadas = [];
  for (let de = 0; de < R.COLUNAS; de++) {
    const origem = mesa[de];
    const maximo = R.maximoMovel(origem);
    if (maximo === 0) continue;

    for (let quantas = 1; quantas <= maximo; quantas++) {
      const carta = origem[origem.length - quantas];

      for (let para = 0; para < R.COLUNAS; para++) {
        if (para === de) continue;
        const destino = mesa[para];
        if (destino.length === 0) {
          // So a primeira coluna vazia; e nunca mudar um bloco inteiro de
          // uma coluna para outra vazia, que nao muda nada na posicao.
          if (para !== primeiraVazia) continue;
          if (origem.length === quantas) continue;
          jogadas.push({ de, para, quantas });
        } else if (R.podePousar(carta, destino)) {
          jogadas.push({ de, para, quantas });
        }
      }
    }
  }
  return jogadas;
}

/**
 * Nota da posicao. Quanto maior, melhor a situacao de quem joga.
 *
 * Os pesos refletem o que realmente ganha uma partida de Spider, em ordem:
 * fechar sequencias, desvirar cartas, manter colunas vazias e formar blocos
 * do mesmo naipe.
 */
export function avaliar(estado) {
  let nota = estado.completas * 100000;
  nota -= R.cartasViradasParaBaixo(estado) * 120;
  nota += R.colunasVazias(estado) * 250;

  for (let i = 0; i < R.COLUNAS; i++) {
    const coluna = estado.mesa[i];
    for (let j = 1; j < coluna.length; j++) {
      const acima = coluna[j - 1];
      const atual = coluna[j];
      if (!acima.up || !atual.up) continue;
      if (acima.v !== atual.v + 1) continue;
      // Sequencia encaixada vale; do mesmo naipe vale bem mais, porque so
      // essa pode ser movida em bloco depois.
      nota += acima.n === atual.n ? 40 : 8;
    }
  }
  return nota;
}

/** A jogada desfaz exatamente a anterior? Evita a dica ficar indo e voltando. */
function desfazAnterior(estado, jogada) {
  const ultima = estado.historico[estado.historico.length - 1];
  if (!ultima || ultima.tipo !== 'mover') return false;
  if (ultima.completadas.length > 0) return false;
  return ultima.de === jogada.para && ultima.para === jogada.de && ultima.quantas === jogada.quantas;
}

/** Aplica a jogada numa copia e devolve a nota resultante. */
function notaDepoisDe(estado, jogada) {
  const copia = copiarEstado(estado);
  if (!mover(copia, jogada.de, jogada.para, jogada.quantas)) return -Infinity;
  return avaliar(copia);
}

/** Ordena as jogadas da melhor para a pior, com a nota anexada. */
export function jogadasPontuadas(estado, jogadas) {
  const lista = jogadas || jogadasLegais(estado);
  const pontuadas = [];
  for (let i = 0; i < lista.length; i++) {
    pontuadas.push({ ...lista[i], nota: notaDepoisDe(estado, lista[i]) });
  }
  // Empate: prefere mover mais cartas de uma vez, que costuma ser o
  // movimento que a pessoa tinha em mente.
  pontuadas.sort((a, b) => (b.nota - a.nota) || (b.quantas - a.quantas));
  return pontuadas;
}

/**
 * A jogada sugerida pelo botao "Dica", com antevisao de alguns lances.
 *
 * Por que nao basta escolher a melhor jogada imediata: medido na Fase 1, um
 * jogador que sempre faz isso e nunca volta atras venceu **0 de 200** partidas
 * de 1 naipe. Uma dica gulosa guiaria ela direto para becos sem saida.
 *
 * Aqui a busca e em feixe, a mesma ideia do gerador de partidas, so que
 * curta: joga alguns lances a frente mantendo as melhores posicoes em
 * paralelo, e devolve o PRIMEIRO lance da melhor linha encontrada. O custo
 * fica em poucos milissegundos, que e o que cabe entre o toque dela e a
 * resposta na tela.
 *
 * Devolve:
 *   { tipo: 'mover', de, para, quantas, melhora: boolean }
 *   { tipo: 'distribuir' }
 *   null  - nao ha jogada nenhuma, a partida travou
 */
export function melhorJogada(estado, { profundidade = 5, largura = 10, ms = 120 } = {}) {
  const notaAtual = avaliar(estado);
  const prazo = Date.now() + ms;

  // Cada posicao do feixe carrega o primeiro lance que levou ate ela.
  let nivel = [{ estado, primeira: null, nota: notaAtual }];
  let melhor = null;

  for (let passo = 0; passo < profundidade; passo++) {
    if (Date.now() > prazo) break;
    const candidatos = [];

    for (let k = 0; k < nivel.length; k++) {
      // O prazo tambem e conferido aqui dentro: um unico nivel com muitas
      // posicoes ja e capaz de estourar o orcamento sozinho, e a dica precisa
      // responder no tempo de um toque.
      if (Date.now() > prazo) break;
      const atual = nivel[k];
      const jogadas = jogadasLegais(atual.estado);

      for (let i = 0; i < jogadas.length; i++) {
        const j = jogadas[i];
        // No primeiro lance, nunca sugerir o desfazer da jogada anterior: a
        // dica ficaria indo e voltando entre as mesmas duas colunas.
        if (passo === 0 && desfazAnterior(estado, j)) continue;
        const copia = copiarEstado(atual.estado);
        if (!mover(copia, j.de, j.para, j.quantas)) continue;
        const primeira = atual.primeira ||
          { tipo: 'mover', de: j.de, para: j.para, quantas: j.quantas };
        candidatos.push({ estado: copia, primeira, nota: avaliar(copia) });
      }

      if (R.podeDistribuir(atual.estado)) {
        const copia = copiarEstado(atual.estado);
        if (distribuir(copia)) {
          const primeira = atual.primeira || { tipo: 'distribuir' };
          // Distribuir enterra cartas e sempre piora a nota imediata. Sem
          // este desconto na comparacao, a antevisao nunca escolheria
          // distribuir e morreria de fome com o monte cheio.
          candidatos.push({ estado: copia, primeira, nota: avaliar(copia) + 900 });
        }
      }
    }

    if (candidatos.length === 0) break;
    candidatos.sort((a, b) => b.nota - a.nota);
    if (!melhor || candidatos[0].nota > melhor.nota) melhor = candidatos[0];
    nivel = candidatos.slice(0, largura);
  }

  if (!melhor || !melhor.primeira) {
    // Nem um lance existe. So resta distribuir, se a regra permitir.
    return R.podeDistribuir(estado) ? { tipo: 'distribuir' } : null;
  }
  if (melhor.primeira.tipo === 'distribuir') return { tipo: 'distribuir' };
  return { ...melhor.primeira, melhora: melhor.nota > notaAtual };
}

/**
 * Para onde vai a carta quando ela simplesmente toca nela.
 *
 * `quantas` e o tamanho do bloco a partir da carta tocada. Devolve o indice
 * da coluna de destino, ou -1 se nao houver lugar valido.
 */
export function destinoDoToque(estado, de, quantas) {
  const candidatas = [];
  const lista = jogadasLegais(estado);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].de === de && lista[i].quantas === quantas) candidatas.push(lista[i]);
  }
  if (candidatas.length === 0) return -1;

  const pontuadas = jogadasPontuadas(estado, candidatas);
  return pontuadas[0].nota === -Infinity ? -1 : pontuadas[0].para;
}

/**
 * Tamanho do bloco que comeca na carta de indice `indice` da coluna.
 * Devolve 0 se aquela carta nao pode ser pega.
 */
export function blocoAPartirDe(coluna, indice) {
  const inicio = R.inicioDoBloco(coluna);
  if (inicio < 0 || indice < inicio || indice >= coluna.length) return 0;
  return coluna.length - indice;
}

/** A partida travou: nao ha jogada util nem cartas para distribuir. */
export function semSaida(estado) {
  if (R.podeDistribuir(estado)) return false;
  const notaAtual = avaliar(estado);
  const pontuadas = jogadasPontuadas(estado);
  for (let i = 0; i < pontuadas.length; i++) {
    if (pontuadas[i].nota > notaAtual) return false;
  }
  return true;
}
