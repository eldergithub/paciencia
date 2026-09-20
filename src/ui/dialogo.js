/**
 * Perguntas de confirmação e a tela de "como sair".
 *
 * Toda pergunta tem exatamente **dois botões grandes**, nunca um "X" no canto
 * nem "OK/Cancelar". As duas saídas são escritas por extenso e dizem o que
 * acontece: "Sim, começar outro" e "Não, continuar esta" — não "Sim" e "Não"
 * soltos, que obrigam a reler a pergunta para saber o que se está
 * respondendo.
 */

const ICONE_CASA =
  '<svg viewBox="0 0 120 96" fill="none" aria-hidden="true">' +
  // celular deitado
  '<rect x="8" y="10" width="104" height="62" rx="9" fill="#14181a" stroke="#fff" stroke-width="3"/>' +
  '<rect x="16" y="18" width="88" height="46" rx="4" fill="#256045"/>' +
  // gesto: dedo deslizando de baixo para cima
  '<path d="M60 88 L60 62" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/>' +
  '<path d="M50 72 L60 60 L70 72" stroke="#ffd23f" stroke-width="6" ' +
  'stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '</svg>';

function criarCamada() {
  const camada = document.createElement('div');
  camada.className = 'camada';
  document.body.appendChild(camada);
  return camada;
}

function botaoGrande(texto, classe) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'botao-grande' + (classe ? ' ' + classe : '');
  b.textContent = texto;
  return b;
}

/**
 * Pergunta de duas saídas. Devolve uma promessa com true para o "sim".
 *
 * A resposta segura vem primeiro na ordem de leitura e fica destacada, para
 * que um toque apressado caia no lado que não perde nada.
 */
export function perguntar({ pergunta, detalhe, sim, nao }) {
  return new Promise((resolver) => {
    const camada = criarCamada();
    const caixa = document.createElement('div');
    caixa.className = 'caixa';

    const titulo = document.createElement('p');
    titulo.className = 'pergunta';
    titulo.textContent = pergunta;
    caixa.appendChild(titulo);

    if (detalhe) {
      const p = document.createElement('p');
      p.className = 'detalhe';
      p.textContent = detalhe;
      caixa.appendChild(p);
    }

    const linha = document.createElement('div');
    linha.className = 'escolhas';
    const botaoNao = botaoGrande(nao, 'seguro');
    const botaoSim = botaoGrande(sim);
    linha.appendChild(botaoNao);
    linha.appendChild(botaoSim);
    caixa.appendChild(linha);
    camada.appendChild(caixa);

    function fechar(resposta) {
      camada.remove();
      resolver(resposta);
    }
    botaoSim.addEventListener('click', () => fechar(true));
    botaoNao.addEventListener('click', () => fechar(false));
    // Tocar fora fecha pelo lado seguro: nunca pelo lado que perde a partida.
    camada.addEventListener('click', (e) => {
      if (e.target === camada) fechar(false);
    });
  });
}

/**
 * Último recurso do botão SAIR.
 *
 * `window.close()` funciona na maioria dos aplicativos instalados, mas o
 * Android não garante. Se em meio segundo a tela ainda estiver aqui, ela vê
 * o gesto de voltar à tela inicial desenhado, com uma frase curta — em vez de
 * ficar achando que o jogo travou.
 */
export function mostrarComoSair() {
  const camada = criarCamada();
  const caixa = document.createElement('div');
  caixa.className = 'caixa saida';

  const desenho = document.createElement('div');
  desenho.className = 'desenho';
  desenho.innerHTML = ICONE_CASA;
  caixa.appendChild(desenho);

  const texto = document.createElement('p');
  texto.className = 'pergunta';
  texto.textContent = 'Deslize para cima para sair.';
  caixa.appendChild(texto);

  const voltar = botaoGrande('Voltar ao jogo', 'seguro');
  voltar.addEventListener('click', () => camada.remove());
  caixa.appendChild(voltar);

  camada.appendChild(caixa);
}

/**
 * Tenta fechar o aplicativo e, se o Android não deixar, explica o gesto.
 */
export function tentarSair() {
  try {
    window.close();
  } catch {
    // Alguns navegadores recusam e lançam: o caminho de baixo resolve.
  }
  setTimeout(() => {
    if (!document.hidden) mostrarComoSair();
  }, 500);
}
