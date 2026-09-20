/**
 * Desenho do tabuleiro.
 *
 * Cada carta tem um elemento próprio, reaproveitado entre redesenhos pelo id
 * da carta. Isso importa por dois motivos: o navegador não refaz o DOM
 * inteiro a cada jogada, e na Fase 4 as animações de arrasto pegam de graça,
 * porque o elemento que se move é sempre o mesmo.
 */

import * as R from '../core/rules.js';
import { SIMBOLO_NAIPE, NAIPE_VERMELHO, ROTULO_VALOR, TOTAL_SEQUENCIAS } from '../core/deck.js';
import { calcularMedidas, calcularRecuos, alturaVisivel, xDaColuna, calcularTrilho } from './layout.js';

const ICONES = {
  voltar: '<path d="M4 8h11a5 5 0 0 1 0 10H8"/><path d="M8 4 4 8l4 4"/>',
  dica: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.7 1 1.5 1 2.5h6c0-1 .4-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  jogoNovo: '<rect x="3" y="5" width="12" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
  sair: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 16l-4-4 4-4"/><path d="M5 12h10"/>',
  ajustes: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
};

/**
 * Aranha do monte, desenhada como SVG.
 *
 * Emoji não serve: depende da fonte instalada no aparelho e simplesmente não
 * aparece em parte deles - aconteceu no protótipo.
 */
const ARANHA =
  '<svg class="aranha" viewBox="0 0 24 24" fill="#151515" aria-hidden="true">' +
  '<ellipse cx="12" cy="12.6" rx="3.1" ry="3.8"/><circle cx="12" cy="8.4" r="1.9"/>' +
  '<g stroke="#151515" stroke-width="1.35" stroke-linecap="round" fill="none">' +
  '<path d="M9 10.5 4.6 7.8M9 12.4 4.2 12M9.2 14.3 5 16.6M9.6 16 6.6 19.4"/>' +
  '<path d="M15 10.5 19.4 7.8M15 12.4 19.8 12M14.8 14.3 19 16.6M14.4 16 17.4 19.4"/>' +
  '</g></svg>';

function icone(nome, classe) {
  return '<svg class="' + classe + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICONES[nome] + '</svg>';
}

function elemento(tag, classe, pai) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (pai) pai.appendChild(el);
  return el;
}

/**
 * Monta a estrutura fixa da tela e devolve o desenhador.
 *
 * `aoTocar` reúne as ações dos controles. O arrasto e o toque nas cartas
 * entram na Fase 4; aqui as cartas já nascem com `data-coluna` e
 * `data-indice` para o acerto de alvo ficar trivial depois.
 */
export function criarTabuleiro(raiz, aoTocar = {}) {
  raiz.innerHTML = '';

  const mesa = elemento('div', 'mesa', raiz);
  const trilho = elemento('div', 'trilho', mesa);
  const tabuleiro = elemento('div', 'tabuleiro', mesa);

  /* ---------------- trilho de controles ---------------- */

  const prontas = elemento('div', 'prontas', trilho);
  const pinos = [];
  for (let i = 0; i < TOTAL_SEQUENCIAS; i++) {
    const p = elemento('div', 'pino', prontas);
    pinos.push(p);
  }

  const acoes = elemento('div', 'acoes', trilho);
  function criarAcao(nome, rotulo, pai, classe) {
    const botao = elemento('button', 'acao' + (classe ? ' ' + classe : ''), pai);
    botao.type = 'button';
    const disco = elemento('span', 'disco', botao);
    disco.innerHTML = icone(nome, 'icone');
    const texto = elemento('span', 'rotulo', botao);
    texto.textContent = rotulo;
    if (aoTocar[nome]) botao.addEventListener('click', aoTocar[nome]);
    return botao;
  }

  const botaoVoltar = criarAcao('voltar', 'VOLTAR', acoes, 'voltar');
  criarAcao('dica', 'DICA', acoes, 'dica');
  criarAcao('jogoNovo', 'JOGO NOVO', acoes, 'jogo-novo');

  const monte = elemento('button', 'monte', trilho);
  monte.type = 'button';
  monte.setAttribute('aria-label', 'Distribuir cartas do monte');
  if (aoTocar.monte) monte.addEventListener('click', aoTocar.monte);

  const rodape = elemento('div', 'rodape', trilho);
  criarAcao('sair', 'SAIR', rodape, 'sair');
  const ajustes = elemento('button', 'ajustes', rodape);
  ajustes.type = 'button';
  ajustes.innerHTML = icone('ajustes', 'icone');
  ajustes.setAttribute('aria-label', 'Ajustes');
  if (aoTocar.ajustes) ajustes.addEventListener('click', aoTocar.ajustes);

  /* ---------------- colunas vazias ---------------- */

  const marcasVazias = [];
  for (let i = 0; i < R.COLUNAS; i++) {
    marcasVazias.push(elemento('div', 'coluna-vazia', tabuleiro));
  }

  /* ---------------- cartas ---------------- */

  const porCarta = new Map();

  function elementoDaCarta(carta) {
    let el = porCarta.get(carta.id);
    if (el) return el;
    el = elemento('div', 'carta novo', tabuleiro);
    const faixa = elemento('div', 'faixa', el);
    el.__valor = elemento('span', 'valor', faixa);
    el.__naipe = elemento('span', 'naipe', faixa);
    el.__faixa = faixa;
    el.__pip = elemento('div', 'pip', el);
    porCarta.set(carta.id, el);
    return el;
  }

  let medidas = calcularMedidas(1, 1);
  let montados = '';   // distribuições mostradas + altura em que foram desenhadas

  let trilhoAplicado = -1;

  /**
   * Repassa os tamanhos do trilho ao CSS como variáveis.
   *
   * O trilho é dimensionado em JavaScript, e não por `@media`, porque a
   * altura útil de verdade só se conhece depois de descontado o entalhe e a
   * barra de gestos do aparelho.
   */
  function aplicarTrilho(altura) {
    if (altura === trilhoAplicado) return;
    trilhoAplicado = altura;
    const t = calcularTrilho(altura);
    const v = trilho.style;
    v.setProperty('--trilho-gap', t.gap + 'px');
    v.setProperty('--disco', t.disco + 'px');
    v.setProperty('--icone', t.icone + 'px');
    v.setProperty('--disco-sair-tamanho', t.discoSair + 'px');
    v.setProperty('--icone-sair', t.iconeSair + 'px');
    v.setProperty('--rotulo-fonte', t.rotulo + 'px');
    v.setProperty('--rotulo-sair-fonte', t.rotuloSair + 'px');
    v.setProperty('--pino-altura', t.pino + 'px');
    v.setProperty('--monte-altura', t.monte + 'px');
    v.setProperty('--monte-largura', t.monteLargura + 'px');
    v.setProperty('--folha-altura', t.folha + 'px');
    v.setProperty('--acao-altura', t.alturaBotao + 'px');
    v.setProperty('--rodape-altura', t.alturaRodape + 'px');
  }

  function medir() {
    // A mesa é a área útil depois de descontado o entalhe e a margem de
    // segurança contra os gestos do Android, que ficam no padding de #app.
    const largura = Math.max(320, mesa.clientWidth);
    const altura = Math.max(200, mesa.clientHeight);
    medidas = calcularMedidas(largura, altura);
    aplicarTrilho(altura);
    return medidas;
  }

  function desenharMonte(estado, alturaDaMesa) {
    const distribuicoes = Math.floor(estado.monte.length / R.COLUNAS);
    const assinatura = distribuicoes + ':' + alturaDaMesa;
    if (assinatura === montados) return;
    montados = assinatura;
    monte.innerHTML = '';
    monte.classList.toggle('vazio', distribuicoes === 0);
    monte.disabled = distribuicoes === 0;
    // Uma folha por distribuição restante: ela vê o bolo diminuir de 5 para
    // 1 sem precisar ler contagem nenhuma.
    for (let i = distribuicoes - 1; i >= 0; i--) {
      const folha = elemento('div', 'folha', monte);
      folha.style.bottom = (i * 4) + 'px';
      folha.style.zIndex = String(R.COLUNAS - i);
      if (i === 0) folha.innerHTML = ARANHA;
    }
  }

  function desenhar(estado) {
    const m = medir();
    const vivos = new Set();

    for (let c = 0; c < R.COLUNAS; c++) {
      const coluna = estado.mesa[c];
      const x = xDaColuna(m, c);

      const marca = marcasVazias[c];
      marca.style.transform = 'translate(' + x + 'px, 0px)';
      marca.style.width = m.w + 'px';
      marca.style.height = m.h + 'px';
      marca.hidden = coluna.length > 0;
      if (coluna.length === 0) continue;

      const { ys } = calcularRecuos(coluna, m.alturaColuna, m);
      // Cartas já montadas em sequência ficam com o papel branco; as
      // embaralhadas, acinzentado. A tinta não muda, então o contraste de
      // leitura continua o mesmo.
      const inicioDoBloco = R.inicioDoBloco(coluna);

      for (let i = 0; i < coluna.length; i++) {
        const carta = coluna[i];
        const el = elementoDaCarta(carta);
        vivos.add(carta.id);

        el.style.width = m.w + 'px';
        el.style.height = m.h + 'px';
        el.style.transform = 'translate(' + x + 'px, ' + ys[i] + 'px)';
        el.style.zIndex = String(i + 1);
        // O arrasto precisa saber de onde a carta partiu para o movimento
        // ser relativo e ela nao pular ao ser pega.
        el.dataset.x = String(x);
        el.dataset.y = String(ys[i]);
        el.dataset.coluna = String(c);
        el.dataset.indice = String(i);
        el.hidden = false;

        const naSequencia = inicioDoBloco >= 0 && i >= inicioDoBloco;
        el.classList.toggle('verso', !carta.up);
        el.classList.toggle('fora', carta.up && !naSequencia);
        el.classList.toggle('vermelha', carta.up && NAIPE_VERMELHO[carta.n]);

        if (!carta.up) continue;

        const visivel = alturaVisivel(ys, i, m);
        const alturaFaixa = Math.max(9, Math.min(m.faixa, visivel - 1));
        const escala = alturaFaixa / m.faixa;
        el.__faixa.style.height = alturaFaixa + 'px';
        el.__valor.style.fontSize = Math.max(9, Math.round(m.fonteValor * escala)) + 'px';
        el.__naipe.style.fontSize = Math.max(8, Math.round(m.fonteNaipe * escala)) + 'px';
        el.__valor.textContent = ROTULO_VALOR[carta.v];
        el.__naipe.textContent = SIMBOLO_NAIPE[carta.n];

        // O símbolo grande no corpo só aparece na carta do topo, a única que
        // tem corpo visível.
        const noTopo = i === coluna.length - 1;
        el.__pip.hidden = !noTopo;
        if (noTopo) {
          el.__pip.style.top = alturaFaixa + 'px';
          el.__pip.style.height = (m.h - alturaFaixa) + 'px';
          el.__pip.style.fontSize = m.fontePip + 'px';
          el.__pip.textContent = SIMBOLO_NAIPE[carta.n];
        }
      }
    }

    // Cartas que saíram da mesa em sequências completas, ou que ficaram de
    // uma partida anterior. Os dados de posição são apagados junto: elemento
    // escondido com coluna e índice velhos é armadilha para quem for
    // procurar carta por seletor depois.
    for (const [id, el] of porCarta) {
      if (vivos.has(id)) continue;
      el.hidden = true;
      delete el.dataset.coluna;
      delete el.dataset.indice;
    }

    for (let i = 0; i < pinos.length; i++) {
      pinos[i].classList.toggle('cheio', i < estado.completas);
    }
    botaoVoltar.disabled = estado.historico.length === 0;
    desenharMonte(estado, m.altura);

    // Cartas recem-criadas nao podem animar da origem ate o lugar delas: numa
    // partida nova as 54 cartas sairiam voando do canto. Elas nascem sem
    // transicao e so passam a animar no quadro seguinte.
    const novas = tabuleiro.querySelectorAll('.carta.novo');
    if (novas.length > 0) {
      requestAnimationFrame(() => {
        for (const el of novas) el.classList.remove('novo');
      });
    }
  }

  /* ---------------- destaques pedidos de fora ---------------- */

  function cartasDaColuna(c) {
    return [...tabuleiro.querySelectorAll('.carta[data-coluna="' + c + '"]:not([hidden])')];
  }

  function aplicarPorUmTempo(elementos, classe, ms) {
    for (const el of elementos) el.classList.add(classe);
    setTimeout(() => {
      for (const el of elementos) el.classList.remove(classe);
    }, ms);
  }

  /**
   * Acende a jogada sugerida: a carta que sai e a coluna que recebe.
   * A dica é mostrada, não descrita — ela não precisa ler nada.
   */
  function piscarJogada(jogada, estado, ms = 1800) {
    if (!jogada) return;
    if (jogada.tipo === 'distribuir') {
      aplicarPorUmTempo([monte], 'piscando', ms);
      return;
    }
    const coluna = estado.mesa[jogada.de];
    const inicio = coluna.length - jogada.quantas;
    const origem = cartasDaColuna(jogada.de).filter((el) => +el.dataset.indice >= inicio);
    aplicarPorUmTempo(origem, 'dica-origem', ms);

    const destino = estado.mesa[jogada.para];
    if (destino.length === 0) {
      const marca = marcasVazias[jogada.para];
      if (marca && !marca.hidden) aplicarPorUmTempo([marca], 'dica-destino', ms);
    } else {
      const cartas = cartasDaColuna(jogada.para);
      if (cartas.length > 0) {
        const topo = cartas.reduce((a, b) => (+a.dataset.indice > +b.dataset.indice ? a : b));
        aplicarPorUmTempo([topo], 'dica-destino', ms);
      }
    }
  }

  /**
   * Ela tocou no monte mas há coluna vazia, e a regra não deixa distribuir.
   * Em vez de mensagem escrita, as colunas vazias pulsam em dourado: o
   * recado chega olhando, que é o caminho mais curto para ela.
   */
  function pulsarColunasVazias(indices, ms = 2000) {
    const marcas = indices.map((i) => marcasVazias[i]).filter((el) => el && !el.hidden);
    aplicarPorUmTempo(marcas, 'pulsando', ms);
  }

  return {
    desenhar,
    medidas: () => medidas,
    tabuleiro,
    trilho,
    elementoDaCarta,
    piscarJogada,
    pulsarColunasVazias,
  };
}
