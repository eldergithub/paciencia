/**
 * Ponto de entrada.
 *
 * Fase 6 & 7: persistência automática no aparelho, histórico de vitórias,
 * comemoração, vibração tátil em sequências/vitória, PWA offline e bloqueio
 * de tela (Wake Lock).
 */

import { novaPartida, mover, distribuir, desfazer } from './core/game.js';
import { melhorJogada } from './core/hint.js';
import * as R from './core/rules.js';
import { criarTabuleiro } from './ui/render.js';
import { ligarInteracao } from './ui/drag.js';
import { perguntar, tentarSair } from './ui/dialogo.js';
import { abrirAjustes } from './ui/settings.js';
import {
  salvarPartida, carregarPartida, limparPartida,
  obterVitorias, registrarVitoria,
  salvarPreferenciaNaipes, obterPreferenciaNaipes,
  vibrarSequencia, vibrarVitoria,
} from './storage.js';
import { mostrarVitoria } from './ui/victory.js';

const raiz = document.getElementById('app');

/** Sementes comprovadamente vencíveis, geradas em `tools/gen-seeds.mjs`. */
let sementes = null;
let naipes = obterPreferenciaNaipes();
let estado = null;

async function carregarSementes() {
  try {
    const resposta = await fetch('./seeds.json', { cache: 'no-cache' });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    return dados && dados.v === 1 ? dados : null;
  } catch {
    // Sem a lista o jogo continua funcionando, só não há garantia de vitória.
    return null;
  }
}

function sortearSemente(quantosNaipes) {
  const lista = sementes && sementes[String(quantosNaipes)];
  if (lista && lista.length > 0) {
    return lista[Math.floor(Math.random() * lista.length)];
  }
  return Math.floor(Math.random() * 1e9);
}

function comecarPartida(quantosNaipes = naipes) {
  naipes = quantosNaipes;
  salvarPreferenciaNaipes(naipes);
  estado = novaPartida({ semente: sortearSemente(naipes), naipes });
  salvarPartida(estado);
  tabuleiro.desenhar(estado);
}

/** Há partida em andamento que valha confirmar antes de perder? */
function partidaEmAndamento() {
  return estado !== null && estado.historico.length > 0;
}

function aposJogada(registro) {
  if (!registro) return;
  salvarPartida(estado);

  if (registro.completadas && registro.completadas.length > 0) {
    vibrarSequencia();
  }

  if (R.venceu(estado)) {
    tratarVitoria();
  }
}

function tratarVitoria() {
  const total = registrarVitoria();
  limparPartida();
  vibrarVitoria();
  mostrarVitoria({
    vitorias: total,
    aoJogarOutra() {
      comecarPartida(naipes);
    },
  });
}

/**
 * Trava contra pergunta em cima de pergunta.
 *
 * A confirmação de saída tem duas portas: o botão SAIR e o "voltar" do
 * Android. Com a mão trêmula, um toque vira dois, e sem esta trava a mesma
 * pergunta se empilhava em duas ou três camadas - ela respondia "não",
 * a pergunta continuava na tela, e a sensação era de jogo travado.
 */
let perguntandoSaida = false;

async function confirmarSaida() {
  if (perguntandoSaida) return;
  perguntandoSaida = true;
  let confirmado = false;
  try {
    confirmado = await perguntar({
      pergunta: 'Quer sair do jogo?',
      detalhe: 'Sua partida fica guardada para você continuar depois.',
      sim: 'Sim, sair',
      nao: 'Não, continuar jogando',
    });
  } finally {
    perguntandoSaida = false;
  }
  if (confirmado) tentarSair();
}

const tabuleiro = criarTabuleiro(raiz, {
  voltar() {
    const reg = desfazer(estado);
    if (reg) {
      salvarPartida(estado);
      tabuleiro.desenhar(estado);
    }
  },

  monte() {
    const reg = distribuir(estado);
    if (reg) {
      aposJogada(reg);
      tabuleiro.desenhar(estado);
      return;
    }
    // A regra do Spider não deixa distribuir com coluna vazia. Em vez de
    // mensagem escrita, as colunas vazias pulsam em dourado: ela entende
    // olhando que precisa pôr alguma coisa ali primeiro.
    const vazias = R.indicesDeColunasVazias(estado);
    if (vazias.length > 0) tabuleiro.pulsarColunasVazias(vazias);
  },

  async jogoNovo() {
    if (partidaEmAndamento()) {
      const confirmado = await perguntar({
        pergunta: 'Começar uma partida nova?',
        detalhe: 'A partida de agora será perdida.',
        sim: 'Sim, começar outra',
        nao: 'Não, continuar esta',
      });
      if (!confirmado) return;
    }
    limparPartida();
    comecarPartida();
  },

  dica() {
    const jogada = melhorJogada(estado);
    if (!jogada) return;
    // A dica mostra, não descreve: acende a carta que sai e a coluna que
    // recebe, e deixa ela fazer o movimento.
    tabuleiro.piscarJogada(jogada, estado);
  },

  sair: confirmarSaida,

  ajustes() {
    abrirAjustes({
      naipes,
      vitorias: obterVitorias(),
      partidaEmAndamento: partidaEmAndamento(),
      aoTrocarNaipes: (novo) => {
        salvarPreferenciaNaipes(novo);
        limparPartida();
        comecarPartida(novo);
      },
    });
  },
});

// Tenta restaurar partida salva anteriormente; se não houver ou já estiver
// vencida, cria uma partida nova.
const salva = carregarPartida();
if (salva && !R.venceu(salva)) {
  estado = salva;
  naipes = salva.naipes;
} else {
  limparPartida();
  estado = novaPartida({ semente: sortearSemente(naipes), naipes });
  salvarPartida(estado);
}

// Arrastar e soltar, e tocar para mover. As duas coisas passam pelo mesmo
// critério de "melhor destino", então a carta vai para o mesmo lugar quer ela
// arraste, quer ela só toque.
ligarInteracao({
  elemento: tabuleiro.tabuleiro,
  estado: () => estado,
  medidas: () => tabuleiro.medidas(),
  redesenhar: () => tabuleiro.desenhar(estado),
  mover: (de, para, quantas) => {
    const reg = mover(estado, de, para, quantas);
    if (reg) {
      aposJogada(reg);
      return true;
    }
    return false;
  },
});

tabuleiro.desenhar(estado);

/**
 * O botão "voltar" do Android não fecha o jogo direto.
 *
 * Um estado empurrado no histórico faz o "voltar" virar um `popstate` em vez
 * de fechar o aplicativo. Ele abre a mesma confirmação do botão SAIR — então
 * ela não cai fora do jogo sem querer, e também nunca fica presa.
 */
history.pushState({ jogo: true }, '');
addEventListener('popstate', () => {
  history.pushState({ jogo: true }, '');
  confirmarSaida();
});

// A tela pode mudar de tamanho ao girar, ao aparecer a barra de gestos ou ao
// entrar em tela cheia; as medidas são recalculadas a cada desenho.
let redesenho = 0;
addEventListener('resize', () => {
  cancelAnimationFrame(redesenho);
  redesenho = requestAnimationFrame(() => tabuleiro.desenhar(estado));
});

carregarSementes().then((dados) => {
  sementes = dados;
  // Se a partida em curso ainda não teve jogada e não veio salva do storage,
  // troca por uma garantidamente vencível da lista.
  if (dados && !salva && !partidaEmAndamento()) {
    comecarPartida();
  }
});

/* ---------------- Wake Lock & Orientação (Fase 7) ---------------- */

let bloqueioTela = null;
async function pedirWakeLock() {
  try {
    if ('wakeLock' in navigator && !bloqueioTela) {
      bloqueioTela = await navigator.wakeLock.request('screen');
      bloqueioTela.addEventListener('release', () => { bloqueioTela = null; });
    }
  } catch {
    // Silencioso se negado pelo sistema operacional ou bateria baixa.
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pedirWakeLock();
});
pedirWakeLock();

try {
  if (screen.orientation && typeof screen.orientation.lock === 'function') {
    screen.orientation.lock('landscape').catch(() => {});
  }
} catch {
  // Nem todos os navegadores suportam lock sem tela cheia ativa.
}

// Registro do Service Worker offline para produção (PWA)
if ('serviceWorker' in navigator && (!import.meta.env || import.meta.env.PROD)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Atalhos só de desenvolvimento, para testes rápidos no navegador.
if (import.meta.env && import.meta.env.DEV) {
  Object.defineProperty(window, '__jogo', { get: () => estado });
  Object.defineProperty(window, '__vencer', {
    value: () => {
      estado.completas = 8;
      tabuleiro.desenhar(estado);
      tratarVitoria();
    },
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      const passos = e.key === 'D' ? 20 : 1;
      for (let i = 0; i < passos; i++) {
        const j = melhorJogada(estado);
        if (!j) break;
        const reg = j.tipo === 'distribuir'
          ? distribuir(estado)
          : mover(estado, j.de, j.para, j.quantas);
        if (!reg) break;
        aposJogada(reg);
        if (R.venceu(estado)) break;
      }
      tabuleiro.desenhar(estado);
    } else if (e.key === 'z') {
      const reg = desfazer(estado);
      if (reg) {
        salvarPartida(estado);
        tabuleiro.desenhar(estado);
      }
    } else if (e.key === 'v' || e.key === 'V') {
      estado.completas = 8;
      tabuleiro.desenhar(estado);
      tratarVitoria();
    }
  });
}
