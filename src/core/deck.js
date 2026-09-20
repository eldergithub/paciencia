/**
 * Baralho e sorteio deterministico.
 *
 * A mesma semente sempre produz exatamente o mesmo embaralhamento. Isso e o
 * que permite guardar uma partida inteira em um numero, e e a base da lista
 * de partidas comprovadamente venciveis (Fase 2).
 */

export const ESPADAS = 0;
export const COPAS = 1;

/** Simbolo de cada naipe, na ordem dos indices. */
export const SIMBOLO_NAIPE = ['♠', '♥'];

/** Naipes vermelhos precisam de tinta vermelha no desenho da carta. */
export const NAIPE_VERMELHO = [false, true];

/** Rotulo mostrado na carta. Indice 0 nao existe; valores validos: 1 a 13. */
export const ROTULO_VALOR = [
  null, 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

export const VALOR_AS = 1;
export const VALOR_REI = 13;

/** Total de cartas de uma partida de Spider: dois baralhos. */
export const TOTAL_CARTAS = 104;

/** Quantas sequencias completas A..K existem no jogo. */
export const TOTAL_SEQUENCIAS = 8;

/**
 * Gerador pseudoaleatorio mulberry32.
 *
 * Escolhido por ser minusculo, rapido e - o que importa aqui - identico em
 * qualquer navegador e em qualquer versao do Node. Math.random() nao serve,
 * porque nao aceita semente e nao e reproduzivel.
 *
 * @param {number} semente
 * @returns {() => number} funcao que devolve um numero em [0, 1)
 */
export function mulberry32(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monta as 104 cartas.
 *
 * Spider usa sempre 8 sequencias A..K, mudando apenas quantos naipes
 * diferentes participam:
 *   - 1 naipe:  8 sequencias de espadas
 *   - 2 naipes: 4 de espadas e 4 de copas
 *
 * @param {1|2} naipes
 * @returns {Array<{id:number, v:number, n:number, up:boolean}>}
 *   id = identidade unica (0..103), estavel para o desenho reaproveitar
 *        o mesmo elemento na tela; v = valor 1..13; n = naipe; up = virada
 *        para cima.
 */
export function montarBaralho(naipes) {
  if (naipes !== 1 && naipes !== 2) {
    throw new Error('naipes deve ser 1 ou 2, recebido: ' + naipes);
  }
  const cartas = [];
  let id = 0;
  for (let seq = 0; seq < TOTAL_SEQUENCIAS; seq++) {
    const n = naipes === 1 ? ESPADAS : seq % 2;
    for (let v = VALOR_AS; v <= VALOR_REI; v++) {
      cartas.push({ id: id++, v, n, up: false });
    }
  }
  return cartas;
}

/**
 * Embaralhamento Fisher-Yates usando o gerador recebido.
 * Altera e devolve o proprio array.
 */
export function embaralhar(cartas, sortear) {
  for (let i = cartas.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1));
    const tmp = cartas[i];
    cartas[i] = cartas[j];
    cartas[j] = tmp;
  }
  return cartas;
}

/** Texto curto de uma carta, para depuracao e testes. Ex.: "K♠", "??". */
export function textoCarta(carta) {
  if (!carta.up) return '??';
  return ROTULO_VALOR[carta.v] + SIMBOLO_NAIPE[carta.n];
}
