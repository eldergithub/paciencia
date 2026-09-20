/**
 * Tela de comemoração de vitória.
 *
 * Exibida ao completar as 8 sequências.
 * Foco em reforço positivo, estímulo cognitivo e carinho:
 * - Sem cronômetro, sem número de movimentos ou pontuação.
 * - Texto grande e claro com contraste nítido.
 * - Ilustração de troféu dourado em SVG.
 * - Contador de vitórias conquistadas.
 * - Botão gigante para começar outra partida.
 */

const TROFEU_SVG =
  '<svg class="icone-trofeu" viewBox="0 0 96 96" fill="none" aria-hidden="true">' +
  // Taça
  '<path d="M28 20 H68 V46 C68 57 59 66 48 66 C37 66 28 57 28 46 Z" fill="#ffd23f" stroke="#23211f" stroke-width="3.5"/>' +
  // Asa esquerda
  '<path d="M28 26 H18 C13 26 10 32 12 40 C14 48 20 52 28 52" fill="none" stroke="#ffd23f" stroke-width="4.5" stroke-linecap="round"/>' +
  '<path d="M28 26 H18 C13 26 10 32 12 40 C14 48 20 52 28 52" fill="none" stroke="#23211f" stroke-width="1.8" stroke-linecap="round"/>' +
  // Asa direita
  '<path d="M68 26 H78 C83 26 86 32 84 40 C82 48 76 52 68 52" fill="none" stroke="#ffd23f" stroke-width="4.5" stroke-linecap="round"/>' +
  '<path d="M68 26 H78 C83 26 86 32 84 40 C82 48 76 52 68 52" fill="none" stroke="#23211f" stroke-width="1.8" stroke-linecap="round"/>' +
  // Haste
  '<rect x="44" y="66" width="8" height="12" fill="#d4af37" stroke="#23211f" stroke-width="3"/>' +
  // Base
  '<path d="M26 86 H70 L64 78 H32 Z" fill="#1f6b46" stroke="#23211f" stroke-width="3"/>' +
  // Estrela no corpo da taça
  '<path d="M48 28 L51 36 L59 36 L53 41 L55 49 L48 44 L41 49 L43 41 L37 36 L45 36 Z" fill="#fff"/>' +
  '</svg>';

export function mostrarVitoria({ vitorias, aoJogarOutra }) {
  const camada = document.createElement('div');
  camada.className = 'camada vitoria-camada';

  // Partículas comemorativas (confetes e estrelas em CSS)
  const particulas = document.createElement('div');
  particulas.className = 'vitoria-particulas';
  particulas.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'particula particula-' + (i % 6);
    p.style.left = (Math.random() * 94 + 3) + '%';
    p.style.animationDelay = (Math.random() * 1.5) + 's';
    p.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
    particulas.appendChild(p);
  }
  camada.appendChild(particulas);

  const caixa = document.createElement('div');
  caixa.className = 'caixa vitoria-caixa';

  const trofeu = document.createElement('div');
  trofeu.className = 'vitoria-trofeu';
  trofeu.innerHTML = TROFEU_SVG;
  caixa.appendChild(trofeu);

  const titulo = document.createElement('h1');
  titulo.className = 'vitoria-titulo';
  titulo.textContent = 'Parabéns!';
  caixa.appendChild(titulo);

  const subtitulo = document.createElement('p');
  subtitulo.className = 'vitoria-subtitulo';
  subtitulo.textContent = 'Você venceu a partida!';
  caixa.appendChild(subtitulo);

  const badge = document.createElement('div');
  badge.className = 'vitoria-badge';
  const textoVitorias = vitorias === 1
    ? 'Primeira vitória conquistada!'
    : vitorias + ' vitórias conquistadas no total!';
  badge.textContent = textoVitorias;
  caixa.appendChild(badge);

  const botaoOutra = document.createElement('button');
  botaoOutra.type = 'button';
  botaoOutra.className = 'botao-grande seguro largo vitoria-botao';
  botaoOutra.textContent = 'Jogar outra partida';
  caixa.appendChild(botaoOutra);

  camada.appendChild(caixa);
  document.body.appendChild(camada);

  function fechar() {
    camada.remove();
    if (aoJogarOutra) aoJogarOutra();
  }

  botaoOutra.addEventListener('click', fechar);
  botaoOutra.focus();
}
