/**
 * Perguntas de confirmação e a tela de "como sair".
 *
 * Toda pergunta tem exatamente **dois botões grandes**, nunca um "X" no canto
 * nem "OK/Cancelar". As duas saídas são escritas por extenso e dizem o que
 * acontece: "Sim, começar outro" e "Não, continuar esta" — não "Sim" e "Não"
 * soltos, que obrigam a reler a pergunta para saber o que se está
 * respondendo.
 */

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
 * Fecha o aplicativo, direto.
 *
 * O Chrome só atende `window.close()` quando a página é a única do histórico
 * — por isso o jogo não empurra estado nenhum em `history` (veja o fim de
 * `main.js`). Aberto pelo ícone da tela inicial, é esse o caso: o "Sim, sair"
 * fecha na hora, sem nenhum gesto depois.
 */
export function sair() {
  window.close();
}
