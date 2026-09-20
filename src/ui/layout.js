/**
 * Cálculo de tamanhos. Só aritmética: nada aqui toca no DOM.
 *
 * Todo número deste arquivo saiu de protótipo renderizado em tamanho real
 * (854 × 390 px, que é um 6,5" deitado) e conferido com posições de partida
 * geradas pelo próprio motor de regras.
 */

import * as R from '../core/rules.js';

/** Trilho de controles à esquerda. */
export const TRILHO = 104;
/** Vão entre o trilho e a primeira coluna. */
export const VAO = 12;
/** Espaço horizontal entre colunas. */
export const ESPACO = 6;
/** Proporção da carta: altura dividida pela largura. */
export const PROPORCAO = 1.4;

/**
 * Diferença mínima de exposição entre carta do bloco móvel e carta
 * embaralhada, depois de toda a compressão.
 *
 * É o que mantém visível a fronteira da sequência numa coluna alta. Sem esta
 * folga, a compressão pode aproximar os dois recuos até a quebra sumir — e
 * aí não dá mais para ver, de longe, onde a sequência montada começa.
 */
export const FOLGA_FRONTEIRA = 6;

/**
 * Medidas do tabuleiro para uma área útil de largura × altura.
 *
 * A largura da carta é limitada pelas 10 colunas, nunca pela altura, então
 * este é o maior tamanho possível: não dá para aumentar a carta sem tirar
 * coluna da mesa.
 */
export function calcularMedidas(largura, altura) {
  const larguraTabuleiro = largura - TRILHO - VAO;
  const w = Math.max(28, Math.floor((larguraTabuleiro - (R.COLUNAS - 1) * ESPACO) / R.COLUNAS));
  const h = Math.round(w * PROPORCAO);

  return {
    largura,
    altura,
    w,
    h,
    // Onde começa a primeira coluna.
    x0: TRILHO + VAO,
    // Altura disponível para uma coluna inteira.
    alturaColuna: altura,
    // Faixa do índice no alto da carta: valor à esquerda, naipe à direita.
    faixa: Math.round(w * 0.56),
    fonteValor: Math.round(w * 0.58),
    fonteNaipe: Math.round(w * 0.36),
    fontePip: Math.round(w * 0.78),
    // Recuos desejados, antes de qualquer compressão.
    recuoViradaParaBaixo: Math.max(4, Math.round(w * 0.15)),
    recuoSoterrada: Math.max(7, Math.round(w * 0.24)),
    recuoNoTopo: Math.round(w * 0.56) + 2,
    // Pisos de compressão.
    minViradaParaBaixo: 4,
    minSoterrada: 7,
    minNoTopo: Math.round(w * 0.27),
  };
}

/**
 * Tamanhos do trilho de controles, em função da altura útil.
 *
 * Isto existe porque tamanho fixo quebra: num aparelho de 854 × 340 a mesa
 * fica com 324 px, e os tamanhos cheios do trilho pedem 370 px. O que
 * transbordava ia parar por cima do botão de baixo — o monte cobria o
 * "JOGO NOVO" e cortava o rótulo.
 *
 * Não dá para resolver com `@media (max-height: ...)`, porque a altura útil
 * de verdade depende do entalhe e da barra de gestos do aparelho, que só o
 * `env(safe-area-inset-*)` conhece em tempo de execução. Por isso a conta é
 * feita aqui, sobre a altura medida, e aplicada como variáveis de CSS.
 *
 * A ordem em que as coisas encolhem protege a legibilidade: primeiro os
 * espaços, depois o monte, depois os discos, e o **rótulo por último** — é o
 * que ela lê.
 */
export function calcularTrilho(altura) {
  let gap = 6;
  let monte = 74;
  let disco = 50;
  let pino = 18;
  let rotulo = 12;

  const PISO = { gap: 2, monte: 52, disco: 38, pino: 12, rotulo: 10 };

  const alturaDoBotao = () => disco + 3 + Math.round(rotulo * 1.25);
  const alturaDoRodape = () => Math.max(
    26,
    Math.round(disco * 0.68) + 2 + Math.round((rotulo - 1) * 1.25)
  );
  // 4 seções empilhadas (pinos, botões, monte, rodapé) = 3 vãos entre elas.
  // O quarto `gap` é folga proposital: melhor sobrar um fio de espaço que
  // um rótulo encostar no botão de baixo.
  const total = () => pino + 3 * alturaDoBotao() + monte + alturaDoRodape() + 4 * gap;

  const encolher = [
    () => (gap > PISO.gap ? (gap -= 1, true) : false),
    () => (monte > PISO.monte ? (monte -= 2, true) : false),
    () => (disco > PISO.disco ? (disco -= 2, true) : false),
    () => (pino > PISO.pino ? (pino -= 1, true) : false),
    () => (rotulo > PISO.rotulo ? (rotulo -= 1, true) : false),
  ];

  // Uma categoria é esgotada até o piso antes de a seguinte começar a ceder.
  // Encolher um pouco de cada uma por vez pareceria mais suave, mas faria o
  // rótulo diminuir enquanto ainda havia espaçamento de sobra para cortar —
  // e o rótulo é justamente o que ela lê.
  for (let i = 0; i < encolher.length; i++) {
    while (total() > altura && encolher[i]()) { /* esgota esta categoria */ }
    if (total() <= altura) break;
  }

  return {
    gap,
    monte,
    monteLargura: 88,
    folha: monte - 16,        // sobra para as bordas empilhadas do monte
    disco,
    icone: Math.round(disco * 0.56),
    discoSair: Math.round(disco * 0.68),
    iconeSair: Math.round(disco * 0.38),
    pino,
    rotulo,
    rotuloSair: rotulo - 1,
    alturaBotao: alturaDoBotao(),
    alturaRodape: alturaDoRodape(),
    alturaTotal: total(),
    cabe: total() <= altura,
  };
}

/** Posição horizontal da coluna. */
export function xDaColuna(medidas, indice) {
  return medidas.x0 + indice * (medidas.w + ESPACO);
}

/** Centro horizontal da coluna. */
export function centroDaColuna(medidas, indice) {
  return medidas.x0 + indice * (medidas.w + ESPACO) + medidas.w / 2;
}

/**
 * Coluna exatamente sob este x, ou -1 se o ponto caiu no vão entre colunas,
 * sobre o trilho de controles ou fora do tabuleiro.
 */
export function colunaSob(x, medidas) {
  const relativo = x - medidas.x0;
  if (relativo < 0) return -1;
  const passo = medidas.w + ESPACO;
  const indice = Math.floor(relativo / passo);
  if (indice < 0 || indice >= R.COLUNAS) return -1;
  return relativo - indice * passo <= medidas.w ? indice : -1;
}

/**
 * Coluna aceita mais próxima deste x, dentro de uma largura de carta.
 *
 * É a tolerância que faz a carta "grudar" na coluna certa em vez de voltar
 * para o lugar quando a mão treme e a solta um pouco ao lado. `aceita` diz
 * quais colunas podem receber a carta; devolve -1 se nenhuma aceita estiver
 * perto o bastante.
 */
export function colunaMaisProxima(x, medidas, aceita) {
  let melhor = -1;
  let menorDistancia = Infinity;
  for (let c = 0; c < R.COLUNAS; c++) {
    if (!aceita(c)) continue;
    const distancia = Math.abs(x - centroDaColuna(medidas, c));
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = c;
    }
  }
  return menorDistancia <= medidas.w ? melhor : -1;
}

/**
 * Deslocamento vertical de cada carta da coluna.
 *
 * O problema: medido em 1600 partidas simuladas, a coluna mais alta fica em
 * 15 a 19 cartas na mediana, 21 a 22 no percentil 90 e chega a 32 no extremo.
 * Numa tela de 390 px de altura, a soma dos recuos desejados estoura.
 *
 * A compressão segue uma prioridade: o que ela precisa ler por último é o
 * que encolhe primeiro.
 *   1. cartas viradas para baixo  (não há nada para ler nelas)
 *   2. viradas para cima soterradas
 *   3. as do bloco móvel, que são as jogáveis - só em último caso
 *
 * O recuo grande acompanha o bloco móvel de verdade (`inicioDoBloco`), e não
 * um número fixo de cartas do topo. Número fixo desenha uma quebra de
 * exposição no meio de uma sequência montada de 8 cartas, e essa quebra não
 * quer dizer nada na regra: quem olha a coluna lê ali o começo da sequência
 * e conta menos cartas do que tem. Do jeito certo, a quebra de exposição cai
 * exatamente onde o papel também muda de cor, e os dois sinais dizem a mesma
 * coisa.
 *
 * Devolve { ys, alturaTotal }.
 */
export function calcularRecuos(coluna, alturaDisponivel, medidas) {
  const n = coluna.length;
  if (n === 0) return { ys: [], alturaTotal: 0 };

  let paraBaixo = medidas.recuoViradaParaBaixo;
  let soterrada = medidas.recuoSoterrada;
  let noTopo = medidas.recuoNoTopo;

  // `tipos[j]` é o vão abaixo da carta j: o quanto dela fica à mostra antes
  // de a seguinte cobri-la. A última carta não entra, porque aparece inteira.
  const inicio = R.inicioDoBloco(coluna);
  const tipos = new Array(n - 1);
  for (let j = 0; j < n - 1; j++) {
    if (!coluna[j].up) tipos[j] = 0;                                // virada para baixo
    else tipos[j] = inicio >= 0 && j >= inicio ? 2 : 1;             // bloco móvel : soterrada
  }

  const soma = () => {
    let s = 0;
    for (let i = 0; i < tipos.length; i++) {
      s += tipos[i] === 0 ? paraBaixo : tipos[i] === 1 ? soterrada : noTopo;
    }
    return s;
  };

  const cabe = alturaDisponivel - medidas.h;

  while (soma() > cabe && (paraBaixo > medidas.minViradaParaBaixo || soterrada > medidas.minSoterrada)) {
    if (paraBaixo > medidas.minViradaParaBaixo) paraBaixo -= 0.5;
    if (soterrada > medidas.minSoterrada) soterrada -= 0.5;
  }
  while (soma() > cabe && noTopo > medidas.minNoTopo) noTopo -= 0.5;
  // Último recurso: alguém tem que ceder, senão a coluna sai da tela.
  while (soma() > cabe && (paraBaixo > 2 || soterrada > 4 || noTopo > 10)) {
    if (paraBaixo > 2) paraBaixo -= 0.5;
    if (soterrada > 4) soterrada -= 0.5;
    if (noTopo > 10) noTopo -= 0.5;
  }

  // Aperto final que garante a hierarquia virada para baixo < soterrada <
  // bloco. Só encolhe recuo, nunca aumenta, então não há como estourar a
  // altura que os laços acima acabaram de acertar.
  soterrada = Math.max(3, Math.min(soterrada, noTopo - FOLGA_FRONTEIRA));
  paraBaixo = Math.max(2, Math.min(paraBaixo, soterrada));

  const ys = new Array(n);
  ys[0] = 0;
  for (let i = 0; i < tipos.length; i++) {
    ys[i + 1] = ys[i] + (tipos[i] === 0 ? paraBaixo : tipos[i] === 1 ? soterrada : noTopo);
  }
  return { ys, alturaTotal: ys[n - 1] + medidas.h };
}

/**
 * Quanto de cada carta aparece antes da seguinte cobri-la.
 *
 * O índice encolhe junto com essa faixa: **número menor porém inteiro, nunca
 * número grande cortado pela metade**. Algarismo cortado, para vista cansada,
 * vira adivinhação.
 */
export function alturaVisivel(ys, indice, medidas) {
  if (indice >= ys.length - 1) return medidas.h;
  return ys[indice + 1] - ys[indice];
}
