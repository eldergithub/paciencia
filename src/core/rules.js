/**
 * Regras puras do Spider.
 *
 * Nada neste arquivo conhece o DOM, o navegador ou o desenho das cartas.
 * Sao funcoes que so olham para arrays de cartas e respondem perguntas.
 * O solucionador da Fase 2 usa exatamente estas mesmas funcoes, entao o que
 * for validado como vencivel e garantidamente o mesmo jogo que ela joga.
 */

import { VALOR_REI, TOTAL_SEQUENCIAS } from './deck.js';

/** Numero de colunas na mesa. */
export const COLUNAS = 10;

/** Cartas em uma sequencia completa (K ate A). */
export const TAMANHO_SEQUENCIA = 13;

/** Cartas distribuidas no inicio (4 colunas de 6 + 6 colunas de 5). */
export const CARTAS_INICIAIS = 54;

/**
 * Indice em que comeca o bloco movel no topo da coluna.
 *
 * Um bloco so pode ser movido junto se for uma sequencia decrescente do
 * mesmo naipe e estiver toda virada para cima. Devolve -1 se nao ha nada
 * movel (coluna vazia ou carta do topo virada para baixo).
 */
export function inicioDoBloco(coluna) {
  if (coluna.length === 0) return -1;
  let i = coluna.length - 1;
  if (!coluna[i].up) return -1;
  while (i > 0) {
    const acima = coluna[i - 1];
    const atual = coluna[i];
    if (!acima.up) break;
    if (acima.n !== atual.n) break;
    if (acima.v !== atual.v + 1) break;
    i--;
  }
  return i;
}

/** Quantas cartas do topo desta coluna podem ser movidas de uma vez. */
export function maximoMovel(coluna) {
  const inicio = inicioDoBloco(coluna);
  return inicio < 0 ? 0 : coluna.length - inicio;
}

/**
 * A carta pode pousar nesta coluna de destino?
 *
 * Coluna vazia aceita qualquer carta. Caso contrario, a carta precisa valer
 * exatamente um a menos que a carta do topo - de qualquer naipe, que e o que
 * diferencia o Spider das outras paciencias.
 */
export function podePousar(carta, colunaDestino) {
  if (colunaDestino.length === 0) return true;
  const topo = colunaDestino[colunaDestino.length - 1];
  return topo.up && topo.v === carta.v + 1;
}

/** O movimento de `quantas` cartas da coluna `de` para a coluna `para` e legal? */
export function podeMover(mesa, de, para, quantas) {
  if (de === para) return false;
  if (de < 0 || de >= COLUNAS || para < 0 || para >= COLUNAS) return false;
  const origem = mesa[de];
  if (quantas <= 0 || quantas > maximoMovel(origem)) return false;
  return podePousar(origem[origem.length - quantas], mesa[para]);
}

/**
 * O topo desta coluna forma uma sequencia completa K..A do mesmo naipe?
 * Quando isso acontece, a sequencia sai da mesa automaticamente.
 */
export function sequenciaCompletaNoTopo(coluna) {
  if (coluna.length < TAMANHO_SEQUENCIA) return false;
  const inicio = coluna.length - TAMANHO_SEQUENCIA;
  const primeira = coluna[inicio];
  if (!primeira.up || primeira.v !== VALOR_REI) return false;
  const naipe = primeira.n;
  for (let i = 0; i < TAMANHO_SEQUENCIA; i++) {
    const c = coluna[inicio + i];
    if (!c.up || c.n !== naipe || c.v !== VALOR_REI - i) return false;
  }
  return true;
}

/**
 * Pode distribuir do monte?
 *
 * A regra do Spider exige que nenhuma coluna esteja vazia. E a unica regra
 * do jogo que costuma surpreender quem joga, entao a interface vai explicar
 * isso em portugues claro em vez de simplesmente nao reagir ao toque.
 */
export function podeDistribuir(estado) {
  if (estado.monte.length === 0) return false;
  for (let i = 0; i < COLUNAS; i++) {
    if (estado.mesa[i].length === 0) return false;
  }
  return true;
}

/** Motivo pelo qual nao da para distribuir, em portugues, ou null se da. */
export function motivoNaoDistribuir(estado) {
  if (estado.monte.length === 0) return 'Nao ha mais cartas para distribuir.';
  for (let i = 0; i < COLUNAS; i++) {
    if (estado.mesa[i].length === 0) {
      return 'Preencha a coluna vazia antes de distribuir novas cartas.';
    }
  }
  return null;
}

/** A partida terminou em vitoria? */
export function venceu(estado) {
  return estado.completas === TOTAL_SEQUENCIAS;
}

/** Quantas cartas ainda estao viradas para baixo na mesa. */
export function cartasViradasParaBaixo(estado) {
  let total = 0;
  for (let i = 0; i < COLUNAS; i++) {
    const coluna = estado.mesa[i];
    for (let j = 0; j < coluna.length; j++) {
      if (!coluna[j].up) total++;
    }
  }
  return total;
}

/** Quantas colunas estao vazias. */
export function colunasVazias(estado) {
  let total = 0;
  for (let i = 0; i < COLUNAS; i++) {
    if (estado.mesa[i].length === 0) total++;
  }
  return total;
}

/**
 * Quais colunas estao vazias.
 *
 * A interface usa isto para fazer as colunas vazias pulsarem quando ela toca
 * no monte sem poder distribuir: ela entende o impedimento olhando, sem ter
 * que ler nenhuma mensagem.
 */
export function indicesDeColunasVazias(estado) {
  const indices = [];
  for (let i = 0; i < COLUNAS; i++) {
    if (estado.mesa[i].length === 0) indices.push(i);
  }
  return indices;
}
