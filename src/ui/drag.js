/**
 * Arrastar e soltar, e tocar para mover.
 *
 * A regra que manda em tudo aqui é: **toda ação faz alguma coisa**.
 *
 * Quem tem tremor frequentemente toca e, ao levantar o dedo, escorrega 10 a
 * 20 px sem querer. Se isso for tratado como "arrasto cancelado", a carta
 * volta sozinha e nada acontece — e a sensação é "toquei e não funcionou".
 * Por isso o desfecho de um arrasto segue uma ordem em que só o último caso
 * deixa de mover a carta.
 */

import * as R from '../core/rules.js';
import { blocoAPartirDe, destinoDoToque } from '../core/hint.js';
import { colunaSob, colunaMaisProxima } from './layout.js';

/** Tremor até aqui não é arrasto, é toque. */
const LIMIAR_DE_ARRASTO = 8;

/**
 * A carta sobe este tanto acima do dedo enquanto é arrastada, para o dedo
 * não tapar justamente o que ela precisa enxergar.
 */
const ACIMA_DO_DEDO = 30;

/** Quanto tempo o destaque de "essas aqui podem mover" fica aceso. */
const MS_DESTAQUE = 700;

export function ligarInteracao({ elemento, estado, medidas, redesenhar, mover, bloqueado }) {
  let arrasto = null;

  function posicaoLocal(evento) {
    const caixa = elemento.getBoundingClientRect();
    return { x: evento.clientX - caixa.left, y: evento.clientY - caixa.top };
  }


  /* ---------------- destaques ---------------- */

  function elementosDaColuna(c) {
    return [...elemento.querySelectorAll('.carta[data-coluna="' + c + '"]:not([hidden])')];
  }

  function limparDestaques() {
    for (const el of elemento.querySelectorAll('.pode-mover')) {
      el.classList.remove('pode-mover');
    }
  }

  /**
   * Ela tocou numa carta soterrada ou virada para baixo, que não tem como
   * mover. Em vez de não acontecer nada, o bloco que PODE mover naquela
   * coluna pisca — ela aprende olhando qual é, sem nenhuma carta sair do
   * lugar por engano.
   */
  function mostrarOQuePodeMover(c) {
    const coluna = estado().mesa[c];
    const inicio = R.inicioDoBloco(coluna);
    if (inicio < 0) return;
    const cartas = elementosDaColuna(c);
    for (const el of cartas) {
      if (+el.dataset.indice >= inicio) el.classList.add('pode-mover');
    }
    setTimeout(limparDestaques, MS_DESTAQUE);
  }

  function recusar(elementos) {
    for (const el of elementos) {
      el.classList.add('recusada');
      el.addEventListener('animationend', () => el.classList.remove('recusada'), { once: true });
    }
  }

  /* ---------------- movimento ---------------- */

  /**
   * Executa a jogada e redesenha. A carta anima do lugar onde o dedo a
   * largou até o destino, porque o elemento é o mesmo e o CSS tem transição
   * em `transform` — ela vê para onde a carta foi, em vez de a carta
   * teleportar.
   */
  function executar(de, para, quantas) {
    const ok = mover(de, para, quantas);
    if (!ok) redesenhar();
    return ok;
  }

  /* ---------------- ponteiro ---------------- */

  function aoApertar(evento) {
    if (bloqueado && bloqueado()) return;
    if (arrasto) return;
    if (evento.button !== undefined && evento.button !== 0) return;

    const alvo = evento.target.closest('.carta');
    if (!alvo || alvo.hidden) return;

    const c = Number(alvo.dataset.coluna);
    const i = Number(alvo.dataset.indice);
    const coluna = estado().mesa[c];
    const quantas = blocoAPartirDe(coluna, i);

    if (quantas === 0) {
      // Carta soterrada ou virada para baixo: nada se move, mas ela vê qual
      // parte daquela coluna pode mover.
      limparDestaques();
      mostrarOQuePodeMover(c);
      return;
    }

    const inicio = coluna.length - quantas;
    const elementos = elementosDaColuna(c).filter((el) => +el.dataset.indice >= inicio);
    const local = posicaoLocal(evento);

    arrasto = {
      ponteiro: evento.pointerId,
      de: c,
      quantas,
      elementos,
      origemX: local.x,
      origemY: local.y,
      // Onde cada carta estava, para o arrasto ser relativo e não pular.
      basesX: elementos.map((el) => parseFloat(el.dataset.x || '0')),
      basesY: elementos.map((el) => parseFloat(el.dataset.y || '0')),
      arrastando: false,
    };

    limparDestaques();
    elemento.setPointerCapture?.(evento.pointerId);
    evento.preventDefault();
  }

  function aoMover(evento) {
    if (bloqueado && bloqueado()) return;
    if (!arrasto || evento.pointerId !== arrasto.ponteiro) return;
    const local = posicaoLocal(evento);
    const dx = local.x - arrasto.origemX;
    const dy = local.y - arrasto.origemY;

    if (!arrasto.arrastando) {
      // Tremor de até 8 px não vira arrasto.
      if (Math.abs(dx) < LIMIAR_DE_ARRASTO && Math.abs(dy) < LIMIAR_DE_ARRASTO) return;
      arrasto.arrastando = true;
      // Nenhuma coluna de destino acende aqui: quem quer saber para onde a
      // carta vai pede a dica. Pegar a carta nao entrega a jogada de graca.
      for (const el of arrasto.elementos) el.classList.add('arrastando');
    }

    for (let k = 0; k < arrasto.elementos.length; k++) {
      const el = arrasto.elementos[k];
      el.style.transform = 'translate(' +
        (arrasto.basesX[k] + dx) + 'px, ' +
        (arrasto.basesY[k] + dy - ACIMA_DO_DEDO) + 'px)';
      el.style.zIndex = String(1000 + k);
    }
    evento.preventDefault();
  }

  function aoSoltar(evento) {
    if (bloqueado && bloqueado()) return;
    if (!arrasto || evento.pointerId !== arrasto.ponteiro) return;
    const atual = arrasto;
    arrasto = null;
    elemento.releasePointerCapture?.(evento.pointerId);

    const local = posicaoLocal(evento);
    for (const el of atual.elementos) el.classList.remove('arrastando');
    limparDestaques();

    const { de, quantas } = atual;

    // 1. Soltou sobre uma coluna que aceita: vai para lá.
    const sob = colunaSob(local.x, medidas());
    if (sob >= 0 && R.podeMover(estado().mesa, de, sob, quantas)) {
      executar(de, sob, quantas);
      return;
    }

    // 2. Soltou perto de uma que aceita: gruda nela.
    const perto = colunaMaisProxima(local.x, medidas(),
      (c) => R.podeMover(estado().mesa, de, c, quantas));
    if (perto >= 0) {
      executar(de, perto, quantas);
      return;
    }

    // 3. Arrasto curto vira toque; 4. arrasto longo em lugar inválido também
    //    vai para a melhor coluna. Os dois acabam no mesmo lugar de
    //    propósito: para este perfil, "sempre acontece algo, e dá para
    //    desfazer" frustra menos que "às vezes não acontece nada".
    const melhor = destinoDoToque(estado(), de, quantas);
    if (melhor >= 0) {
      executar(de, melhor, quantas);
      return;
    }

    // 5. Não existe destino nenhum: a carta volta com um balanço suave.
    //    Sem vermelho, sem aviso - a mensagem é "essa carta não tem para
    //    onde ir agora", e é passada pelo movimento.
    redesenhar();
    recusar(atual.elementos);
  }

  function aoCancelar(evento) {
    if (bloqueado && bloqueado()) return;
    if (!arrasto || evento.pointerId !== arrasto.ponteiro) return;
    const atual = arrasto;
    arrasto = null;
    for (const el of atual.elementos) el.classList.remove('arrastando');
    limparDestaques();
    redesenhar();
  }

  elemento.addEventListener('pointerdown', aoApertar);
  elemento.addEventListener('pointermove', aoMover);
  elemento.addEventListener('pointerup', aoSoltar);
  elemento.addEventListener('pointercancel', aoCancelar);

  return {
    arrastando: () => arrasto !== null && arrasto.arrastando,
    limparDestaques,
  };
}
