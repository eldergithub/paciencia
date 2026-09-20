/**
 * Estado da partida: criar, mover, distribuir, desfazer, salvar e recarregar.
 *
 * Decisao de projeto importante: a partida salva guarda apenas a semente e a
 * lista de jogadas. Ao recarregar, o jogo e reconstruido do zero e as jogadas
 * sao reaplicadas. Isso mantem o arquivo salvo minusculo, torna impossivel
 * salvar um estado incoerente, e devolve o historico completo de "desfazer"
 * de graca depois de fechar e reabrir o app.
 */

import { montarBaralho, embaralhar, mulberry32, textoCarta, TOTAL_CARTAS } from './deck.js';
import * as R from './rules.js';

/**
 * Cria uma partida nova a partir de uma semente.
 *
 * Distribuicao do Spider: 54 cartas em 10 colunas, dando uma carta por vez
 * de coluna em coluna. Como 54 = 5 voltas completas + 4, as colunas 1 a 4
 * ficam com 6 cartas e as colunas 5 a 10 com 5. A ultima carta de cada
 * coluna fica virada para cima; as 50 restantes formam o monte, que rende
 * exatamente 5 distribuicoes de 10.
 */
export function novaPartida({ semente, naipes = 1 }) {
  if (!Number.isInteger(semente)) {
    throw new Error('semente deve ser um numero inteiro');
  }
  const sortear = mulberry32(semente);
  const cartas = embaralhar(montarBaralho(naipes), sortear);

  const mesa = [];
  for (let i = 0; i < R.COLUNAS; i++) mesa.push([]);
  for (let i = 0; i < R.CARTAS_INICIAIS; i++) {
    mesa[i % R.COLUNAS].push(cartas[i]);
  }
  for (let i = 0; i < R.COLUNAS; i++) {
    const coluna = mesa[i];
    coluna[coluna.length - 1].up = true;
  }

  return {
    semente,
    naipes,
    mesa,
    monte: cartas.slice(R.CARTAS_INICIAIS),
    completas: 0,
    historico: [],
    jogadas: 0,
  };
}

/**
 * Recolhe sequencias completas que tenham se formado nas colunas indicadas.
 * Registra tudo no `registro` para que "desfazer" consiga reverter.
 */
function recolherCompletas(estado, colunas, registro) {
  for (let k = 0; k < colunas.length; k++) {
    const indice = colunas[k];
    const coluna = estado.mesa[indice];
    if (!R.sequenciaCompletaNoTopo(coluna)) continue;

    const cartas = coluna.splice(coluna.length - R.TAMANHO_SEQUENCIA, R.TAMANHO_SEQUENCIA);
    // Tirar a sequencia pode deixar exposta uma carta virada para baixo.
    let virou = false;
    if (coluna.length > 0 && !coluna[coluna.length - 1].up) {
      coluna[coluna.length - 1].up = true;
      virou = true;
    }
    estado.completas++;
    registro.completadas.push({ coluna: indice, cartas, virou });
  }
}

/**
 * Move `quantas` cartas do topo da coluna `de` para a coluna `para`.
 * Devolve o registro da jogada, ou null se o movimento for ilegal.
 */
export function mover(estado, de, para, quantas) {
  if (!R.podeMover(estado.mesa, de, para, quantas)) return null;

  const origem = estado.mesa[de];
  const movidas = origem.splice(origem.length - quantas, quantas);
  for (let i = 0; i < movidas.length; i++) estado.mesa[para].push(movidas[i]);

  const registro = {
    tipo: 'mover',
    de,
    para,
    quantas,
    virou: false,
    completadas: [],
  };

  // Mover pode expor uma carta virada para baixo na coluna de origem.
  if (origem.length > 0 && !origem[origem.length - 1].up) {
    origem[origem.length - 1].up = true;
    registro.virou = true;
  }

  recolherCompletas(estado, [para], registro);

  estado.historico.push(registro);
  estado.jogadas++;
  return registro;
}

/**
 * Distribui uma carta virada para cima em cada uma das 10 colunas.
 * Devolve o registro da jogada, ou null se a regra nao permitir.
 */
export function distribuir(estado) {
  if (!R.podeDistribuir(estado)) return null;

  const registro = { tipo: 'distribuir', completadas: [] };
  for (let i = 0; i < R.COLUNAS; i++) {
    const carta = estado.monte.pop();
    carta.up = true;
    estado.mesa[i].push(carta);
  }

  // Uma distribuicao pode fechar mais de uma sequencia de uma vez.
  const todas = [];
  for (let i = 0; i < R.COLUNAS; i++) todas.push(i);
  recolherCompletas(estado, todas, registro);

  estado.historico.push(registro);
  estado.jogadas++;
  return registro;
}

/**
 * Desfaz a ultima jogada, devolvendo tudo exatamente ao estado anterior -
 * inclusive cartas que viraram para cima e sequencias que sairam da mesa.
 * Devolve o registro desfeito, ou null se nao havia nada a desfazer.
 */
export function desfazer(estado) {
  const registro = estado.historico.pop();
  if (!registro) return null;

  // Primeiro devolve as sequencias completas, na ordem inversa em que sairam.
  for (let i = registro.completadas.length - 1; i >= 0; i--) {
    const c = registro.completadas[i];
    const coluna = estado.mesa[c.coluna];
    if (c.virou) coluna[coluna.length - 1].up = false;
    for (let j = 0; j < c.cartas.length; j++) coluna.push(c.cartas[j]);
    estado.completas--;
  }

  if (registro.tipo === 'distribuir') {
    // Devolve ao monte na ordem inversa da retirada, para o monte ficar
    // identico ao que era antes.
    for (let i = R.COLUNAS - 1; i >= 0; i--) {
      const carta = estado.mesa[i].pop();
      carta.up = false;
      estado.monte.push(carta);
    }
  } else {
    const destino = estado.mesa[registro.para];
    const movidas = destino.splice(destino.length - registro.quantas, registro.quantas);
    const origem = estado.mesa[registro.de];
    if (registro.virou) origem[origem.length - 1].up = false;
    for (let i = 0; i < movidas.length; i++) origem.push(movidas[i]);
  }

  return registro;
}

/** Ha alguma jogada para desfazer? */
export function podeDesfazer(estado) {
  return estado.historico.length > 0;
}

/**
 * Copia independente do estado, para simular jogadas sem tocar na partida
 * real. Usado pela dica e pelo solucionador.
 */
export function copiarEstado(estado) {
  const mesa = [];
  for (let i = 0; i < R.COLUNAS; i++) {
    const coluna = estado.mesa[i];
    const nova = new Array(coluna.length);
    for (let j = 0; j < coluna.length; j++) {
      const c = coluna[j];
      nova[j] = { id: c.id, v: c.v, n: c.n, up: c.up };
    }
    mesa.push(nova);
  }
  const monte = new Array(estado.monte.length);
  for (let i = 0; i < estado.monte.length; i++) {
    const c = estado.monte[i];
    monte[i] = { id: c.id, v: c.v, n: c.n, up: c.up };
  }
  return {
    semente: estado.semente,
    naipes: estado.naipes,
    mesa,
    monte,
    completas: estado.completas,
    historico: [],
    jogadas: estado.jogadas,
  };
}

/**
 * Texto canonico da posicao atual, ignorando o historico.
 * Serve para comparar estados nos testes e para o solucionador reconhecer
 * posicoes ja visitadas.
 */
export function assinatura(estado) {
  const partes = [];
  for (let i = 0; i < R.COLUNAS; i++) {
    const coluna = estado.mesa[i];
    let s = '';
    for (let j = 0; j < coluna.length; j++) {
      const c = coluna[j];
      s += (c.up ? '+' : '-') + c.v + ':' + c.n + ',';
    }
    partes.push(s);
  }
  return estado.completas + '|' + estado.monte.length + '|' + partes.join('/');
}

/**
 * Confere a integridade do estado: as 104 cartas tem que estar sempre em
 * algum lugar. Usado nos testes e como rede de seguranca ao recarregar uma
 * partida salva.
 */
export function totalDeCartas(estado) {
  let total = estado.monte.length + estado.completas * R.TAMANHO_SEQUENCIA;
  for (let i = 0; i < R.COLUNAS; i++) total += estado.mesa[i].length;
  return total;
}

export function estadoConsistente(estado) {
  return totalDeCartas(estado) === TOTAL_CARTAS;
}

/* ==========================================================================
   Salvar e recarregar
   ========================================================================== */

/** Reduz a partida a semente + lista de jogadas. */
export function paraSalvar(estado) {
  const jogadas = [];
  for (let i = 0; i < estado.historico.length; i++) {
    const r = estado.historico[i];
    if (r.tipo === 'distribuir') jogadas.push([-1]);
    else jogadas.push([r.de, r.para, r.quantas]);
  }
  return { v: 1, semente: estado.semente, naipes: estado.naipes, jogadas };
}

/**
 * Reconstroi a partida a partir do que foi salvo, reaplicando as jogadas.
 * Devolve null se o conteudo salvo estiver corrompido ou incoerente - nesse
 * caso a interface simplesmente comeca uma partida nova, sem mostrar erro.
 */
export function deSalvo(dados) {
  if (!dados || dados.v !== 1) return null;
  if (!Number.isInteger(dados.semente)) return null;
  if (dados.naipes !== 1 && dados.naipes !== 2) return null;
  if (!Array.isArray(dados.jogadas)) return null;

  const estado = novaPartida({ semente: dados.semente, naipes: dados.naipes });
  for (let i = 0; i < dados.jogadas.length; i++) {
    const j = dados.jogadas[i];
    if (!Array.isArray(j)) return null;
    const ok = j[0] === -1 ? distribuir(estado) : mover(estado, j[0], j[1], j[2]);
    if (!ok) return null;
  }
  return estado;
}

/* ==========================================================================
   Depuracao
   ========================================================================== */

/** Desenho do tabuleiro em texto, usado nos testes e na tela da Fase 1. */
export function tabuleiroEmTexto(estado) {
  const linhas = [];
  let altura = 0;
  for (let i = 0; i < R.COLUNAS; i++) {
    if (estado.mesa[i].length > altura) altura = estado.mesa[i].length;
  }
  let cabecalho = '';
  for (let i = 0; i < R.COLUNAS; i++) cabecalho += String(i + 1).padStart(4);
  linhas.push(cabecalho);
  for (let linha = 0; linha < altura; linha++) {
    let s = '';
    for (let i = 0; i < R.COLUNAS; i++) {
      const carta = estado.mesa[i][linha];
      s += (carta ? textoCarta(carta) : '').padStart(4);
    }
    linhas.push(s);
  }
  linhas.push('');
  linhas.push(
    'monte: ' + estado.monte.length + ' cartas (' +
    Math.floor(estado.monte.length / R.COLUNAS) + ' distribuicoes)   ' +
    'prontas: ' + estado.completas + ' de 8   ' +
    'jogadas: ' + estado.jogadas
  );
  return linhas.join('\n');
}
