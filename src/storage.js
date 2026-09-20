/**
 * Persistência no aparelho da jogadora (localStorage).
 *
 * 100% offline: nenhum dado sai do dispositivo.
 *
 * Proteções:
 * - Toda chamada a localStorage é envolvida em try/catch para nunca quebrar o
 *   jogo se o armazenamento estiver desativado ou sem espaço.
 * - Partida salva usa `paraSalvar()` e `deSalvo()` de `game.js`, garantindo
 *   que dados corrompidos ou versões inválidas sejam descartados silenciosamente.
 * - Vibração tátil encapsulada com checagem de suporte da API do navegador.
 */

import { paraSalvar, deSalvo } from './core/game.js';

const CHAVE_PARTIDA = 'spider_partida_v1';
const CHAVE_VITORIAS = 'spider_vitorias';
const CHAVE_NAIPES = 'spider_naipes';

/**
 * Salva a partida atual.
 */
export function salvarPartida(estado) {
  try {
    if (!estado) {
      limparPartida();
      return;
    }
    const dados = paraSalvar(estado);
    localStorage.setItem(CHAVE_PARTIDA, JSON.stringify(dados));
  } catch {
    // Falha silenciosa: o jogo segue normalmente na memória.
  }
}

/**
 * Carrega a partida salva se houver e for válida.
 * Devolve o estado reconstruído ou null.
 */
export function carregarPartida() {
  try {
    const bruto = localStorage.getItem(CHAVE_PARTIDA);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    return deSalvo(dados);
  } catch {
    return null;
  }
}

/**
 * Limpa a partida salva do armazenamento.
 * Usado ao vencer a partida ou ao iniciar um jogo novo.
 */
export function limparPartida() {
  try {
    localStorage.removeItem(CHAVE_PARTIDA);
  } catch {
    // Silencioso
  }
}

/**
 * Devolve o total acumulado de vitórias.
 */
export function obterVitorias() {
  try {
    const valor = localStorage.getItem(CHAVE_VITORIAS);
    const n = parseInt(valor, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Incrementa o contador de vitórias em 1 e devolve o novo total.
 */
export function registrarVitoria() {
  try {
    const atual = obterVitorias();
    const novo = atual + 1;
    localStorage.setItem(CHAVE_VITORIAS, String(novo));
    return novo;
  } catch {
    return 1;
  }
}

/**
 * Salva a preferência de naipes (1 ou 2).
 */
export function salvarPreferenciaNaipes(naipes) {
  try {
    if (naipes === 1 || naipes === 2) {
      localStorage.setItem(CHAVE_NAIPES, String(naipes));
    }
  } catch {
    // Silencioso
  }
}

/**
 * Recupera a preferência de naipes salva (padrão: 1).
 */
export function obterPreferenciaNaipes() {
  try {
    const v = parseInt(localStorage.getItem(CHAVE_NAIPES), 10);
    return v === 2 ? 2 : 1;
  } catch {
    return 1;
  }
}

/**
 * Vibração suave ao completar uma sequência de cartas (K a A).
 * Sem som, apenas retorno tátil.
 */
export function vibrarSequencia() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([60, 40, 60]);
    }
  } catch {
    // Silencioso
  }
}

/**
 * Vibração comemorativa de vitória.
 */
export function vibrarVitoria() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([120, 60, 120, 60, 240]);
    }
  } catch {
    // Silencioso
  }
}
