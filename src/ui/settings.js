/**
 * Ajustes.
 *
 * Fica atrás de uma engrenagem minúscula e apagada, no canto oposto aos
 * botões de jogo: o app **sempre abre em 1 naipe**, e ela não esbarra nesta
 * tela sem querer. Não há nada destrutivo aqui, e o botão de voltar ao jogo é
 * o maior elemento da tela.
 */

import { perguntar } from './dialogo.js';

function botao(texto, detalhe, marcado) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'opcao' + (marcado ? ' marcada' : '');
  const t = document.createElement('span');
  t.className = 'opcao-titulo';
  t.textContent = texto;
  b.appendChild(t);
  const d = document.createElement('span');
  d.className = 'opcao-detalhe';
  d.textContent = detalhe;
  b.appendChild(d);
  return b;
}

/**
 * Abre o painel. `aoTrocarNaipes` é chamado só quando a escolha muda de
 * verdade e ela confirma a perda da partida em andamento.
 */
export function abrirAjustes({ naipes, vitorias = 0, partidaEmAndamento, aoTrocarNaipes }) {
  const camada = document.createElement('div');
  camada.className = 'camada';

  const caixa = document.createElement('div');
  caixa.className = 'caixa ajustes-caixa';

  const titulo = document.createElement('p');
  titulo.className = 'pergunta';
  titulo.textContent = 'Dificuldade';
  caixa.appendChild(titulo);

  const linha = document.createElement('div');
  linha.className = 'escolhas';
  const umNaipe = botao('1 NAIPE', 'Mais fácil', naipes === 1);
  const doisNaipes = botao('2 NAIPES', 'Mais difícil', naipes === 2);
  linha.appendChild(umNaipe);
  linha.appendChild(doisNaipes);
  caixa.appendChild(linha);

  if (vitorias > 0) {
    const estatistica = document.createElement('p');
    estatistica.className = 'ajustes-estatistica';
    estatistica.textContent = '🏆 ' + vitorias + (vitorias === 1 ? ' partida vencida' : ' partidas vencidas');
    caixa.appendChild(estatistica);
  }

  const voltar = document.createElement('button');
  voltar.type = 'button';
  voltar.className = 'botao-grande seguro largo';
  voltar.textContent = 'Voltar ao jogo';
  caixa.appendChild(voltar);

  camada.appendChild(caixa);
  document.body.appendChild(camada);

  function fechar() {
    camada.remove();
  }

  async function escolher(novo) {
    if (novo === naipes) { fechar(); return; }
    if (partidaEmAndamento) {
      const confirmado = await perguntar({
        pergunta: 'Mudar a dificuldade começa uma partida nova.',
        detalhe: 'A partida de agora será perdida.',
        sim: 'Sim, mudar',
        nao: 'Não, continuar esta',
      });
      if (!confirmado) return;
    }
    fechar();
    aoTrocarNaipes(novo);
  }

  umNaipe.addEventListener('click', () => escolher(1));
  doisNaipes.addEventListener('click', () => escolher(2));
  voltar.addEventListener('click', fechar);
  camada.addEventListener('click', (e) => {
    if (e.target === camada) fechar();
  });
}
