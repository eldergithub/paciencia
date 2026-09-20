/**
 * Testes do nucleo de regras. Rodam sem navegador: `npm test`.
 *
 * O objetivo aqui nao e cobertura bonita, e confianca: o solucionador da
 * Fase 2 vai declarar partidas "venciveis" com base neste codigo, e ela vai
 * jogar essas partidas. Se as regras estiverem erradas, o erro chega no
 * celular dela disfarcado de jogo impossivel.
 */

import {
  montarBaralho, embaralhar, mulberry32, TOTAL_CARTAS,
} from '../src/core/deck.js';
import * as R from '../src/core/rules.js';
import {
  novaPartida, mover, distribuir, desfazer, copiarEstado, assinatura,
  totalDeCartas, estadoConsistente, paraSalvar, deSalvo, tabuleiroEmTexto,
} from '../src/core/game.js';
import {
  jogadasLegais, melhorJogada, destinoDoToque, blocoAPartirDe, avaliar,
} from '../src/core/hint.js';

let passou = 0;
let falhou = 0;
const falhas = [];

function ok(condicao, nome) {
  if (condicao) { passou++; return; }
  falhou++;
  falhas.push(nome);
  console.error('  FALHOU: ' + nome);
}

function igual(recebido, esperado, nome) {
  const a = JSON.stringify(recebido);
  const b = JSON.stringify(esperado);
  if (a === b) { passou++; return; }
  falhou++;
  falhas.push(nome);
  console.error('  FALHOU: ' + nome + '\n    esperado: ' + b + '\n    recebido: ' + a);
}

function grupo(nome) { console.log('\n' + nome); }

/** Estado cru para montar situacoes especificas na mao. */
let proximoId = 1000;
function carta(v, n, up = true) { return { id: proximoId++, v, n, up }; }
function estadoCru(colunas) {
  const mesa = [];
  for (let i = 0; i < R.COLUNAS; i++) mesa.push(colunas[i] ? colunas[i] : []);
  return { semente: 0, naipes: 1, mesa, monte: [], completas: 0, historico: [], jogadas: 0 };
}
/** Ordem exata do monte, para provar que desfazer uma distribuicao e fiel. */
function idsDoMonte(estado) { return estado.monte.map((c) => c.id).join(','); }

/* ========================================================================== */
grupo('Baralho e sorteio');

{
  const b1 = montarBaralho(1);
  igual(b1.length, TOTAL_CARTAS, 'baralho de 1 naipe tem 104 cartas');
  ok(b1.every((c) => c.n === 0), '1 naipe: todas as cartas sao de espadas');
  ok(b1.every((c) => !c.up), 'baralho comeca todo virado para baixo');
  igual(new Set(b1.map((c) => c.id)).size, TOTAL_CARTAS, 'todo id de carta e unico');

  const b2 = montarBaralho(2);
  igual(b2.length, TOTAL_CARTAS, 'baralho de 2 naipes tem 104 cartas');
  igual(b2.filter((c) => c.n === 0).length, 52, '2 naipes: 52 espadas');
  igual(b2.filter((c) => c.n === 1).length, 52, '2 naipes: 52 copas');

  const porValor = {};
  for (const c of b1) porValor[c.v] = (porValor[c.v] || 0) + 1;
  ok(Object.values(porValor).every((q) => q === 8), 'ha 8 cartas de cada valor');

  let erro = null;
  try { montarBaralho(3); } catch (e) { erro = e; }
  ok(erro !== null, 'montarBaralho recusa quantidade de naipes invalida');
}

{
  const a = embaralhar(montarBaralho(1), mulberry32(42)).map((c) => c.id).join(',');
  const b = embaralhar(montarBaralho(1), mulberry32(42)).map((c) => c.id).join(',');
  const c = embaralhar(montarBaralho(1), mulberry32(43)).map((x) => x.id).join(',');
  igual(a, b, 'a mesma semente produz sempre o mesmo embaralhamento');
  ok(a !== c, 'sementes diferentes produzem embaralhamentos diferentes');
}

/* ========================================================================== */
grupo('Distribuicao inicial');

{
  const e = novaPartida({ semente: 7, naipes: 1 });
  igual(e.mesa.map((c) => c.length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5],
    'colunas 1 a 4 com 6 cartas e 5 a 10 com 5 cartas');
  igual(e.monte.length, 50, 'sobram 50 cartas no monte');
  igual(e.monte.length / R.COLUNAS, 5, 'o monte rende exatamente 5 distribuicoes');
  igual(totalDeCartas(e), TOTAL_CARTAS, 'as 104 cartas estao em algum lugar');

  ok(e.mesa.every((col) => col[col.length - 1].up), 'a carta do topo de cada coluna esta virada para cima');
  ok(e.mesa.every((col) => col.slice(0, -1).every((c) => !c.up)), 'as demais cartas estao viradas para baixo');
  igual(R.cartasViradasParaBaixo(e), 44, 'ha 44 cartas viradas para baixo no inicio');
  igual(e.completas, 0, 'nenhuma sequencia pronta no inicio');
  igual(R.colunasVazias(e), 0, 'nenhuma coluna vazia no inicio');

  const f = novaPartida({ semente: 7, naipes: 1 });
  igual(assinatura(e), assinatura(f), 'a mesma semente reproduz a mesma partida');

  let erro = null;
  try { novaPartida({ semente: 1.5 }); } catch (x) { erro = x; }
  ok(erro !== null, 'novaPartida recusa semente que nao seja inteira');
}

/* ========================================================================== */
grupo('Regras de movimento');

{
  const coluna = [carta(9, 0, false), carta(7, 0), carta(6, 0), carta(5, 0)];
  igual(R.inicioDoBloco(coluna), 1, 'o bloco movel comeca onde a sequencia do mesmo naipe comeca');
  igual(R.maximoMovel(coluna), 3, '3 cartas podem ser movidas juntas');

  const misturada = [carta(7, 0), carta(6, 1), carta(5, 1)];
  igual(R.maximoMovel(misturada), 2, 'a mudanca de naipe interrompe o bloco movel');

  const comBuraco = [carta(7, 0), carta(5, 0)];
  igual(R.maximoMovel(comBuraco), 1, 'salto de valor interrompe o bloco movel');

  igual(R.maximoMovel([]), 0, 'coluna vazia nao tem bloco movel');
  igual(R.maximoMovel([carta(5, 0, false)]), 0, 'carta virada para baixo nao pode ser movida');
  igual(R.inicioDoBloco([]), -1, 'inicioDoBloco devolve -1 para coluna vazia');

  ok(R.podePousar(carta(5, 0), []), 'coluna vazia aceita qualquer carta');
  ok(R.podePousar(carta(5, 0), [carta(6, 1)]), 'a carta pousa sobre valor um acima de outro naipe');
  ok(!R.podePousar(carta(5, 0), [carta(7, 0)]), 'a carta nao pousa sobre valor distante');
  ok(!R.podePousar(carta(5, 0), [carta(4, 0)]), 'a carta nao pousa sobre valor menor');
  ok(!R.podePousar(carta(5, 0), [carta(6, 0, false)]), 'a carta nao pousa sobre carta virada para baixo');
}

{
  const e = estadoCru([
    [carta(8, 0), carta(7, 0), carta(6, 0)],
    [carta(9, 0)],
    [],
  ]);
  ok(R.podeMover(e.mesa, 0, 1, 3), 'bloco de 3 pousa sobre o 9');
  ok(!R.podeMover(e.mesa, 0, 1, 2), 'bloco de 2 nao pousa sobre o 9');
  ok(R.podeMover(e.mesa, 0, 2, 3), 'bloco inteiro pode ir para a coluna vazia');
  ok(!R.podeMover(e.mesa, 0, 0, 1), 'nao da para mover uma coluna para ela mesma');
  ok(!R.podeMover(e.mesa, 0, 1, 4), 'nao da para mover mais cartas do que existem no bloco');
  ok(!R.podeMover(e.mesa, 0, 1, 0), 'nao da para mover zero cartas');
  ok(!R.podeMover(e.mesa, 0, 99, 1), 'coluna de destino inexistente e recusada');
}

/* ========================================================================== */
grupo('Sequencia completa');

{
  const doze = [];
  for (let v = 13; v >= 2; v--) doze.push(carta(v, 0));
  const e = estadoCru([doze, [carta(1, 0)]]);

  ok(!R.sequenciaCompletaNoTopo(e.mesa[0]), 'faltando o As, a sequencia nao esta completa');

  const registro = mover(e, 1, 0, 1);
  ok(registro !== null, 'o As pode ser colocado sobre o 2');
  igual(e.completas, 1, 'a sequencia completa e recolhida automaticamente');
  igual(e.mesa[0].length, 0, 'a coluna fica vazia depois de recolher a sequencia');
  igual(e.mesa[1].length, 0, 'a coluna de origem fica vazia');
  igual(registro.completadas.length, 1, 'a jogada registra a sequencia recolhida');

  desfazer(e);
  igual(e.completas, 0, 'desfazer devolve a contagem de sequencias');
  igual(e.mesa[0].length, 12, 'desfazer devolve as 12 cartas para a coluna');
  igual(e.mesa[1].length, 1, 'desfazer devolve o As para a origem');
  ok(R.sequenciaCompletaNoTopo(e.mesa[0]) === false, 'a coluna volta a ficar incompleta');
}

{
  // Nao pode recolher sequencia de naipes misturados.
  const mista = [];
  for (let v = 13; v >= 2; v--) mista.push(carta(v, v > 7 ? 0 : 1));
  mista.push(carta(1, 1));
  ok(!R.sequenciaCompletaNoTopo(mista), 'sequencia de naipes misturados nao conta como completa');
}

{
  // Recolher a sequencia expoe e vira a carta que estava embaixo.
  const doze = [carta(4, 1, false)];
  for (let v = 13; v >= 2; v--) doze.push(carta(v, 0));
  const e = estadoCru([doze, [carta(1, 0)]]);
  const registro = mover(e, 1, 0, 1);
  igual(e.completas, 1, 'a sequencia sai mesmo havendo carta embaixo');
  ok(e.mesa[0][0].up, 'a carta que estava embaixo vira para cima');
  igual(registro.completadas[0].virou, true, 'o registro guarda que a carta virou');
  desfazer(e);
  ok(!e.mesa[0][0].up, 'desfazer vira a carta de volta para baixo');
}

/* ========================================================================== */
grupo('Virar carta ao mover');

{
  const e = estadoCru([
    [carta(9, 0)],
    [carta(4, 1, false), carta(8, 0)],
  ]);
  const registro = mover(e, 1, 0, 1);
  igual(registro.virou, true, 'mover a ultima carta vira a de baixo');
  ok(e.mesa[1][0].up, 'a carta exposta fica virada para cima');
  desfazer(e);
  ok(!e.mesa[1][0].up, 'desfazer vira a carta de volta para baixo');
  igual(e.mesa[1].length, 2, 'desfazer devolve a carta movida');
  igual(e.mesa[0].length, 1, 'a coluna de destino volta ao tamanho original');
}

/* ========================================================================== */
grupo('Distribuir do monte');

{
  const e = novaPartida({ semente: 11, naipes: 1 });
  const monteAntes = idsDoMonte(e);
  const assinaturaAntes = assinatura(e);

  ok(R.podeDistribuir(e), 'da para distribuir no inicio');
  igual(R.motivoNaoDistribuir(e), null, 'nao ha motivo que impeca distribuir no inicio');

  const registro = distribuir(e);
  ok(registro !== null, 'a distribuicao acontece');
  igual(e.monte.length, 40, 'o monte perde 10 cartas');
  ok(e.mesa.every((col) => col[col.length - 1].up), 'toda carta distribuida vem virada para cima');
  igual(totalDeCartas(e), TOTAL_CARTAS, 'continuam existindo 104 cartas');

  desfazer(e);
  igual(e.monte.length, 50, 'desfazer devolve as 10 cartas ao monte');
  igual(idsDoMonte(e), monteAntes, 'o monte volta exatamente na mesma ordem');
  igual(assinatura(e), assinaturaAntes, 'a posicao volta a ser identica');
}

{
  const e = estadoCru([[carta(5, 0)], []]);
  e.monte = [carta(3, 0, false)];
  ok(!R.podeDistribuir(e), 'nao da para distribuir com coluna vazia');
  ok(R.motivoNaoDistribuir(e).includes('coluna vazia'), 'o motivo explica a coluna vazia em portugues');
  igual(distribuir(e), null, 'a distribuicao e recusada');
  // A interface pulsa exatamente estas colunas em vez de mostrar texto.
  igual(R.indicesDeColunasVazias(e), [1, 2, 3, 4, 5, 6, 7, 8, 9],
    'as colunas vazias a destacar sao identificadas');

  const f = estadoCru([]);
  for (let i = 0; i < R.COLUNAS; i++) f.mesa[i] = [carta(5, 0)];
  f.monte = [];
  ok(!R.podeDistribuir(f), 'nao da para distribuir com o monte vazio');
  ok(R.motivoNaoDistribuir(f).includes('mais cartas'), 'o motivo explica que o monte acabou');
}

/* ========================================================================== */
grupo('Desfazer em profundidade');

{
  // Joga 400 lances ao acaso e depois desfaz tudo: a posicao final tem que
  // ser identica a inicial, carta por carta, inclusive a ordem do monte.
  const e = novaPartida({ semente: 2024, naipes: 2 });
  const assinaturaInicial = assinatura(e);
  const monteInicial = idsDoMonte(e);
  const sortear = mulberry32(99);

  let consistenteSempre = true;
  let jogadasFeitas = 0;
  for (let i = 0; i < 400; i++) {
    const opcoes = jogadasLegais(e);
    const distribuiu = R.podeDistribuir(e);
    if (opcoes.length === 0 && !distribuiu) break;

    // 15% das vezes distribui, para o teste passar pelos dois caminhos.
    if (distribuiu && (opcoes.length === 0 || sortear() < 0.15)) {
      distribuir(e);
    } else {
      const j = opcoes[Math.floor(sortear() * opcoes.length)];
      mover(e, j.de, j.para, j.quantas);
    }
    jogadasFeitas++;
    if (!estadoConsistente(e)) consistenteSempre = false;
  }

  ok(jogadasFeitas > 100, 'a partida aleatoria avancou o suficiente para o teste valer (' + jogadasFeitas + ' jogadas)');
  ok(consistenteSempre, 'as 104 cartas se mantem em todas as jogadas');

  let desfeitas = 0;
  while (desfazer(e) !== null) desfeitas++;
  igual(desfeitas, jogadasFeitas, 'desfazer volta exatamente o numero de jogadas feitas');
  igual(assinatura(e), assinaturaInicial, 'a posicao volta a ser exatamente a inicial');
  igual(idsDoMonte(e), monteInicial, 'o monte volta exatamente a ordem inicial');
  igual(e.completas, 0, 'a contagem de sequencias volta a zero');
}

/* ========================================================================== */
grupo('Salvar e recarregar');

{
  const e = novaPartida({ semente: 555, naipes: 1 });
  const sortear = mulberry32(7);
  for (let i = 0; i < 60; i++) {
    const opcoes = jogadasLegais(e);
    if (opcoes.length === 0) { if (!distribuir(e)) break; continue; }
    const j = opcoes[Math.floor(sortear() * opcoes.length)];
    mover(e, j.de, j.para, j.quantas);
  }

  const salvo = JSON.parse(JSON.stringify(paraSalvar(e)));
  const voltou = deSalvo(salvo);
  ok(voltou !== null, 'a partida salva recarrega');
  igual(assinatura(voltou), assinatura(e), 'a partida recarregada esta na mesma posicao');
  igual(voltou.historico.length, e.historico.length, 'o historico de desfazer sobrevive ao salvamento');
  igual(totalDeCartas(voltou), TOTAL_CARTAS, 'a partida recarregada tem as 104 cartas');

  // Desfazer depois de recarregar tem que funcionar igual.
  desfazer(voltou);
  desfazer(e);
  igual(assinatura(voltou), assinatura(e), 'desfazer funciona igual depois de recarregar');

  igual(deSalvo(null), null, 'conteudo salvo nulo e recusado');
  igual(deSalvo({ v: 2, semente: 1, naipes: 1, jogadas: [] }), null, 'versao desconhecida e recusada');
  igual(deSalvo({ v: 1, semente: 1, naipes: 9, jogadas: [] }), null, 'quantidade de naipes invalida e recusada');
  igual(deSalvo({ v: 1, semente: 1, naipes: 1, jogadas: [[0, 1, 99]] }), null, 'jogada impossivel e recusada');
  igual(deSalvo({ v: 1, semente: 1, naipes: 1, jogadas: 'x' }), null, 'lista de jogadas corrompida e recusada');
}

/* ========================================================================== */
grupo('Copia independente');

{
  const e = novaPartida({ semente: 3, naipes: 1 });
  const copia = copiarEstado(e);
  igual(assinatura(copia), assinatura(e), 'a copia comeca identica');

  const opcoes = jogadasLegais(copia);
  ok(opcoes.length > 0, 'ha jogadas disponiveis para testar a copia');
  mover(copia, opcoes[0].de, opcoes[0].para, opcoes[0].quantas);
  ok(assinatura(copia) !== assinatura(e), 'mexer na copia nao mexe na partida original');
}

/* ========================================================================== */
grupo('Dica e tocar para mover');

{
  const e = novaPartida({ semente: 88, naipes: 1 });
  const dica = melhorJogada(e);
  ok(dica !== null, 'ha sempre uma dica no inicio da partida');
  if (dica && dica.tipo === 'mover') {
    ok(R.podeMover(e.mesa, dica.de, dica.para, dica.quantas), 'a dica sugere uma jogada legal');
  }
}

{
  // Entre duas opcoes legais iguais em tudo o mais, a dica prefere a que
  // vira uma carta. O rei na coluna 2 existe para que mover o 8 de la nao
  // esvazie a coluna - esvaziar coluna vale ainda mais que virar carta, e
  // isso mascararia o que este teste quer verificar.
  const e = estadoCru([
    [carta(9, 0)],                            // destino possivel
    [carta(4, 1, false), carta(8, 0)],        // mover daqui vira uma carta
    [carta(13, 0), carta(8, 0)],              // mover daqui nao vira nada
  ]);
  const dica = melhorJogada(e);
  ok(dica && dica.tipo === 'mover' && dica.de === 1, 'a dica prefere a jogada que desvira uma carta');
}

{
  // Fechar uma sequencia e sempre a melhor jogada disponivel.
  const doze = [];
  for (let v = 13; v >= 2; v--) doze.push(carta(v, 0));
  const e = estadoCru([doze, [carta(1, 0)], [carta(2, 1)]]);
  const dica = melhorJogada(e);
  ok(dica && dica.tipo === 'mover' && dica.de === 1 && dica.para === 0,
    'a dica prefere fechar a sequencia completa');
}

{
  // Sem jogada util e com monte disponivel, a dica manda distribuir.
  // Todas as colunas com rei no topo: rei so pousa em coluna vazia, e nao
  // ha nenhuma, entao nao existe jogada legal.
  const e = estadoCru([]);
  for (let i = 0; i < R.COLUNAS; i++) e.mesa[i] = [carta(2, 0, false), carta(13, 0)];
  e.monte = [];
  for (let i = 0; i < R.COLUNAS; i++) e.monte.push(carta(5, 0, false));
  const dica = melhorJogada(e);
  ok(dica && dica.tipo === 'distribuir', 'sem jogada util, a dica manda distribuir');
}

{
  const e = estadoCru([
    [carta(8, 0), carta(7, 0), carta(6, 0)],
    [carta(9, 0)],
    [],
  ]);
  igual(blocoAPartirDe(e.mesa[0], 0), 3, 'o bloco a partir da primeira carta tem 3 cartas');
  igual(blocoAPartirDe(e.mesa[0], 2), 1, 'o bloco a partir da ultima carta tem 1 carta');
  igual(blocoAPartirDe(e.mesa[1], 0), 1, 'coluna de uma carta so devolve bloco de 1');

  igual(destinoDoToque(e, 0, 3), 1, 'tocar no bloco de 3 manda encaixar no 9, nao para a coluna vazia');
  igual(destinoDoToque(e, 1, 1), -1, 'sem destino valido, o toque nao move nada');
}

{
  // Jogadas equivalentes para colunas vazias nao devem inchar a lista.
  const e = estadoCru([[carta(5, 0, false), carta(8, 0)], [], [], []]);
  const opcoes = jogadasLegais(e);
  igual(opcoes.length, 1, 'colunas vazias equivalentes geram uma unica jogada');
  igual(opcoes[0].para, 1, 'o destino escolhido e a primeira coluna vazia');
}

{
  const e = estadoCru([[carta(8, 0)], []]);
  igual(jogadasLegais(e).length, 0, 'mudar uma coluna inteira para outra vazia nao e considerado jogada');
}

{
  const e = novaPartida({ semente: 4, naipes: 1 });
  const notaInicial = avaliar(e);
  const melhor = novaPartida({ semente: 4, naipes: 1 });
  melhor.completas = 3;
  ok(avaliar(melhor) > notaInicial, 'fechar sequencias aumenta muito a nota da posicao');
}

/* ========================================================================== */
grupo('Dica com antevisao (Fase 5)');

{
  // A dica nao pode demorar mais que um toque: ela toca e a resposta aparece.
  const e = novaPartida({ semente: 12, naipes: 1 });
  melhorJogada(e);                       // aquece o modulo
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) melhorJogada(e, { ms: 120 });
  const porChamada = (Date.now() - t0) / 20;
  ok(porChamada < 150, 'a dica responde no tempo de um toque (' + porChamada.toFixed(0) + ' ms por chamada)');

  const curta = novaPartida({ semente: 12, naipes: 1 });
  const t1 = Date.now();
  melhorJogada(curta, { ms: 20, profundidade: 30, largura: 60 });
  ok(Date.now() - t1 < 250, 'o orcamento de tempo e respeitado mesmo com feixe largo');

  // A antevisao tem que ser mensuravelmente melhor que escolher o melhor
  // lance imediato. O guloso puro, medido na Fase 1, fecha 0,93 sequencia em
  // media e nunca vence.
  let soma = 0, vitorias = 0;
  for (let s = 1; s <= 12; s++) {
    const partida = novaPartida({ semente: s, naipes: 1 });
    for (let i = 0; i < 2000; i++) {
      if (R.venceu(partida)) break;
      const j = melhorJogada(partida);
      if (!j) break;
      const ok2 = j.tipo === 'distribuir'
        ? distribuir(partida)
        : mover(partida, j.de, j.para, j.quantas);
      if (!ok2) break;
    }
    if (R.venceu(partida)) vitorias++;
    soma += partida.completas;
  }
  const media = soma / 12;
  ok(media > 2, 'jogando sozinha, a dica fecha bem mais que o guloso (' +
    media.toFixed(2) + ' contra 0,93 de 8 sequencias)');
  ok(vitorias >= 0, 'a dica chega ao fim das partidas sem travar (' + vitorias + ' vitorias em 12)');
}

{
  // Fechar sequencia continua sendo a jogada preferida.
  const doze = [];
  for (let v = 13; v >= 2; v--) doze.push(carta(v, 0));
  const e = estadoCru([doze, [carta(1, 0)], [carta(2, 1)]]);
  const dica = melhorJogada(e);
  ok(dica && dica.tipo === 'mover' && dica.de === 1 && dica.para === 0,
    'com antevisao, fechar a sequencia continua sendo a dica');
}

{
  // Toda dica sugerida precisa ser uma jogada que ela consegue fazer.
  let ilegais = 0;
  for (let s = 20; s < 32; s++) {
    const partida = novaPartida({ semente: s, naipes: 1 });
    for (let i = 0; i < 40; i++) {
      const j = melhorJogada(partida);
      if (!j) break;
      if (j.tipo === 'distribuir') {
        if (!R.podeDistribuir(partida)) ilegais++;
        distribuir(partida);
      } else {
        if (!R.podeMover(partida.mesa, j.de, j.para, j.quantas)) ilegais++;
        mover(partida, j.de, j.para, j.quantas);
      }
    }
  }
  igual(ilegais, 0, 'a dica nunca sugere jogada ilegal');
}

/* ========================================================================== */
grupo('Partida completa ate a vitoria');

{
  // Prova que o motor chega ao fim: monta uma partida ja resolvida na mao,
  // recolhendo as 8 sequencias, e confirma a deteccao de vitoria.
  const e = estadoCru([]);
  let completadas = 0;
  for (let s = 0; s < 8; s++) {
    const coluna = [];
    for (let v = 13; v >= 2; v--) coluna.push(carta(v, 0));
    e.mesa[0] = coluna;
    e.mesa[1] = [carta(1, 0)];
    mover(e, 1, 0, 1);
    completadas++;
  }
  igual(e.completas, 8, 'as 8 sequencias sao contadas');
  ok(R.venceu(e), 'o jogo reconhece a vitoria com 8 sequencias');
  igual(completadas, 8, 'todas as 8 foram recolhidas por jogadas de verdade');
}

/* ========================================================================== */
grupo('Tabuleiro em texto');

{
  const e = novaPartida({ semente: 1, naipes: 1 });
  const texto = tabuleiroEmTexto(e);
  ok(texto.includes('monte: 50 cartas'), 'o texto mostra o tamanho do monte');
  ok(texto.includes('prontas: 0 de 8'), 'o texto mostra as sequencias prontas');
  ok(texto.split('\n').length > 6, 'o texto desenha as linhas da mesa');
}

/* ========================================================================== */
grupo('Layout do tabuleiro (Fase 3)');

{
  const { calcularMedidas, calcularRecuos, alturaVisivel, xDaColuna, FOLGA_FRONTEIRA } =
    await import('../src/ui/layout.js');

  // Area util de um 6,5" deitado, ja descontadas as margens de seguranca.
  const m = calcularMedidas(822, 374);
  igual([m.w, m.h], [65, 91], 'carta de 65 x 91 px numa tela de 6,5"');

  const ultimaColuna = xDaColuna(m, R.COLUNAS - 1);
  ok(ultimaColuna + m.w <= 822, 'as 10 colunas cabem na largura sem cortar a ultima');
  ok(ultimaColuna + m.w > 822 - m.w, 'as colunas ocupam a largura toda, sem sobra de uma carta');

  function colunaCom(total, viradas) {
    const coluna = [];
    for (let i = 0; i < viradas; i++) coluna.push(carta(7, 0, false));
    for (let i = 0; i < total - viradas; i++) coluna.push(carta(13 - (i % 13), 0, true));
    return coluna;
  }

  // Alturas medidas em 1600 partidas simuladas: mediana 15-19, p90 21-22,
  // extremo 32. O layout tem que aguentar todas sem estourar a tela.
  for (const total of [6, 15, 21, 23, 32]) {
    const coluna = colunaCom(total, Math.min(6, total - 1));
    const { ys, alturaTotal } = calcularRecuos(coluna, m.alturaColuna, m);
    ok(alturaTotal <= m.alturaColuna,
      'coluna de ' + total + ' cartas cabe na altura (' + Math.round(alturaTotal) + ' de ' + m.alturaColuna + ')');
    igual(ys.length, total, 'coluna de ' + total + ' cartas recebe uma posicao por carta');

    let crescente = true;
    for (let i = 1; i < ys.length; i++) if (ys[i] <= ys[i - 1]) crescente = false;
    ok(crescente, 'as cartas da coluna de ' + total + ' nunca se sobrepoem exatamente');

    for (let i = 0; i < total; i++) {
      if (alturaVisivel(ys, i, m) <= 0) { ok(false, 'altura visivel positiva na coluna de ' + total); break; }
    }
  }

  // A zona de acao e a ultima a ser sacrificada pela compressao.
  const alta = colunaCom(23, 6);
  const r = calcularRecuos(alta, m.alturaColuna, m);
  const recuoSoterrada = r.ys[8] - r.ys[7];
  const recuoNoTopo = r.ys[22] - r.ys[21];
  ok(recuoNoTopo > recuoSoterrada,
    'as cartas jogaveis do topo ficam mais abertas que as soterradas (' +
    recuoNoTopo + ' contra ' + recuoSoterrada + ')');
  ok(recuoNoTopo >= m.minNoTopo,
    'o recuo do topo nunca cai abaixo do piso de legibilidade');
  /* ---- A zona de acao e o bloco movel, nao um numero fixo de cartas ----
     Defeito real relatado por quem joga: com um numero fixo de 5, uma
     sequencia montada de 8 cartas saia com as 3 de cima espremidas na
     exposicao de soterrada. A quebra de exposicao caia no meio da sequencia,
     nao tem significado nenhum na regra, e quem olhava a coluna contava
     menos cartas do que tinha. Agora a exposicao grande acompanha o bloco
     que realmente move junto. */
  {
    /** Coluna com N cobertas, N embaralhadas e um bloco movel de N cartas. */
    function colunaComBloco(viradas, soltas, bloco) {
      const coluna = [];
      for (let i = 0; i < viradas; i++) coluna.push(carta(7, 0, false));
      // Valores que nao encadeiam, para nao entrarem no bloco sem querer.
      for (let i = 0; i < soltas; i++) coluna.push(carta(2 + (i * 5) % 11, i % 4, true));
      for (let i = 0; i < bloco; i++) coluna.push(carta(13 - i, 2, true));
      return coluna;
    }

    const coluna = colunaComBloco(5, 0, 8);
    const inicio = R.inicioDoBloco(coluna);
    igual(inicio, 5, 'o bloco de 8 cartas comeca onde as viradas terminam');

    const { ys } = calcularRecuos(coluna, m.alturaColuna, m);
    const exposicoes = [];
    // A ultima carta aparece inteira, entao nao entra na comparacao de recuo.
    for (let i = inicio; i < coluna.length - 1; i++) exposicoes.push(alturaVisivel(ys, i, m));
    igual(new Set(exposicoes).size, 1,
      'as 8 cartas da sequencia saem todas com a mesma exposicao (' + exposicoes[0] + 'px)');

    // Mesma sequencia, agora com cartas embaralhadas acima dela.
    const mista = colunaComBloco(4, 4, 8);
    const inicioMista = R.inicioDoBloco(mista);
    const rMista = calcularRecuos(mista, m.alturaColuna, m);
    const noBloco = alturaVisivel(rMista.ys, inicioMista, m);
    const embaralhada = alturaVisivel(rMista.ys, inicioMista - 1, m);
    const coberta = alturaVisivel(rMista.ys, 0, m);
    ok(noBloco - embaralhada >= FOLGA_FRONTEIRA,
      'a fronteira da sequencia sobrevive a compressao (' + noBloco + ' contra ' +
      embaralhada + ', folga minima de ' + FOLGA_FRONTEIRA + ')');
    ok(embaralhada >= coberta,
      'carta embaralhada nunca aparece menos que carta virada para baixo');

    // O espelho do mesmo defeito: com numero fixo, cartas embaralhadas logo
    // acima do topo ganhavam exposicao grande e simulavam um bloco que nao
    // existia. Exposicao grande agora quer dizer uma coisa so.
    const curta = colunaComBloco(4, 5, 1);
    const rCurta = calcularRecuos(curta, m.alturaColuna, m);
    const acimaDoTopo = alturaVisivel(rCurta.ys, curta.length - 2, m);
    ok(acimaDoTopo < m.recuoNoTopo,
      'carta embaralhada fora do bloco nao recebe exposicao de carta jogavel');

    // Pior caso possivel: sequencia completa de 13 numa coluna de 32.
    const extrema = colunaComBloco(19, 0, 13);
    const rExtrema = calcularRecuos(extrema, m.alturaColuna, m);
    ok(rExtrema.alturaTotal <= m.alturaColuna,
      'coluna de 32 com sequencia completa de 13 ainda cabe na altura (' +
      Math.round(rExtrema.alturaTotal) + ' de ' + m.alturaColuna + ')');
    const exposicoesExtremas = [];
    for (let i = 19; i < extrema.length - 1; i++) exposicoesExtremas.push(alturaVisivel(rExtrema.ys, i, m));
    igual(new Set(exposicoesExtremas).size, 1,
      'mesmo espremida ate o limite, a sequencia de 13 nao ganha quebra no meio');
  }

  // Coluna vazia e coluna de uma carta nao podem quebrar a conta.
  igual(calcularRecuos([], m.alturaColuna, m).ys, [], 'coluna vazia nao gera posicoes');
  igual(calcularRecuos([carta(5, 0)], m.alturaColuna, m).ys, [0], 'coluna de uma carta comeca no topo');

  /* ---- Trilho de controles ----
     Este bloco existe por causa de um defeito real: com tamanhos fixos, num
     aparelho de 854 x 340 a mesa fica com 324px e o trilho pedia 370px. O que
     sobrava ia parar por cima do botao de baixo - o monte cobria o "JOGO NOVO"
     e cortava o rotulo. A conta agora e elastica, e aqui ela e provada. */
  {
    const { calcularTrilho } = await import('../src/ui/layout.js');

    let piorFolga = Infinity, alturaDaPior = 0, falhas = 0;
    for (let altura = 280; altura <= 440; altura++) {
      const t = calcularTrilho(altura);
      if (!t.cabe || t.alturaTotal > altura) { falhas++; alturaDaPior = altura; }
      const folga = altura - t.alturaTotal;
      if (folga < piorFolga) { piorFolga = folga; }

      // Nenhum piso de legibilidade pode ser furado para caber.
      if (t.disco < 38 || t.rotulo < 10 || t.monte < 52 || t.pino < 12) {
        falhas++;
        alturaDaPior = altura;
      }
      // Area tocavel confortavel: o trilho tem 104px de largura.
      if (t.alturaBotao < 48) { falhas++; alturaDaPior = altura; }
    }
    igual(falhas, 0, 'o trilho cabe em toda altura util de 280 a 440 px sem furar piso' +
      (falhas ? ' (falhou em ' + alturaDaPior + 'px)' : ''));
    ok(piorFolga >= 0, 'a altura exigida pelo trilho nunca ultrapassa a disponivel');

    // Os dois casos concretos que a revisao apontou.
    const baixo = calcularTrilho(324);   // tela de 854 x 340
    const alto = calcularTrilho(374);    // tela de 854 x 390
    ok(baixo.alturaTotal <= 324, 'em 854 x 340 o trilho cabe (' + baixo.alturaTotal + ' de 324)');
    ok(alto.alturaTotal <= 374, 'em 854 x 390 o trilho cabe (' + alto.alturaTotal + ' de 374)');
    ok(baixo.disco < alto.disco, 'na tela baixa os discos encolhem');
    ok(baixo.monte < alto.monte, 'na tela baixa o monte encolhe');
    ok(baixo.rotulo >= 10, 'o rotulo continua legivel na tela baixa (' + baixo.rotulo + 'px)');

    // A ordem de encolhimento protege o que ela le: o rotulo cede por ultimo.
    // Invariante: o rotulo so encolhe depois de os discos chegarem ao piso.
    let ordemQuebrada = 0;
    for (let altura = 280; altura <= 440; altura++) {
      const t = calcularTrilho(altura);
      if (t.rotulo < 12 && t.disco > 38) ordemQuebrada++;
      if (t.disco < 50 && t.monte > 52) ordemQuebrada++;
    }
    igual(ordemQuebrada, 0, 'o rotulo so encolhe depois do disco, e o disco depois do monte');

    const apertado = calcularTrilho(280);
    ok(apertado.disco === 38, 'a 280px os discos chegam ao piso (' + apertado.disco + 'px)');
    ok(apertado.rotulo >= 10, 'a 280px o rotulo continua legivel (' + apertado.rotulo + 'px)');
    ok(alto.rotulo === 12 && alto.disco === 50,
      'em 854 x 390 nada precisa encolher: disco 50, rotulo 12');

    // Altura absurda nao pode gerar numero negativo nem quebrar.
    const impossivel = calcularTrilho(120);
    ok(impossivel.disco >= 38 && impossivel.monte >= 52,
      'abaixo do minimo possivel a conta para nos pisos em vez de virar negativa');
    ok(impossivel.cabe === false, 'e a conta avisa honestamente que nao coube');
  }

  /* ---- Tolerancia de alvo (Fase 4) ----
     A mao treme e solta a carta um pouco ao lado. Estas contas sao o que faz
     a carta grudar na coluna certa em vez de voltar para o lugar. */
  {
    const { colunaSob, colunaMaisProxima, centroDaColuna } =
      await import('../src/ui/layout.js');

    // Centro de cada coluna cai na propria coluna.
    let acertos = 0;
    for (let c = 0; c < R.COLUNAS; c++) {
      if (colunaSob(centroDaColuna(m, c), m) === c) acertos++;
    }
    igual(acertos, R.COLUNAS, 'o centro de cada coluna e reconhecido como aquela coluna');

    igual(colunaSob(0, m), -1, 'toque sobre o trilho nao e coluna nenhuma');
    igual(colunaSob(m.x0 - 1, m), -1, 'toque antes da primeira coluna nao e coluna nenhuma');
    igual(colunaSob(m.x0, m), 0, 'a borda esquerda da primeira coluna ja conta');
    igual(colunaSob(m.x0 + m.w, m), 0, 'a borda direita da primeira coluna ainda conta');
    igual(colunaSob(m.x0 + m.w + 3, m), -1, 'o vao entre duas colunas nao e coluna nenhuma');
    igual(colunaSob(centroDaColuna(m, R.COLUNAS - 1) + m.w, m), -1,
      'depois da ultima coluna nao ha coluna nenhuma');

    // Grudar: solta no vao entre colunas e vai para a valida mais proxima.
    const soA3 = (c) => c === 3;
    igual(colunaMaisProxima(centroDaColuna(m, 3) + 20, m, soA3), 3,
      'solta 20px ao lado e gruda na coluna valida');
    igual(colunaMaisProxima(centroDaColuna(m, 3) - m.w, m, soA3), 3,
      'a tolerancia vale ate uma largura de carta de distancia');
    igual(colunaMaisProxima(centroDaColuna(m, 3) + m.w + 2, m, soA3), -1,
      'mais longe que isso nao gruda: ela quis outra coisa');
    igual(colunaMaisProxima(centroDaColuna(m, 3), m, () => false), -1,
      'sem nenhuma coluna valida nao ha onde grudar');

    // Entre duas validas, gruda na mais perto.
    const tresOuSete = (c) => c === 3 || c === 7;
    igual(colunaMaisProxima(centroDaColuna(m, 3) + 8, m, tresOuSete), 3,
      'entre duas colunas validas, gruda na mais proxima');
    igual(colunaMaisProxima(centroDaColuna(m, 7) - 8, m, tresOuSete), 7,
      'e o mesmo vale para a outra ponta');

    // Solta sobre o trilho: nao e coluna, e a regra seguinte assume.
    igual(colunaMaisProxima(10, m, () => true), -1,
      'solta sobre o trilho nao gruda em coluna nenhuma');
  }

  // Tela menor: um 800 x 360 tambem tem que caber.
  const pequena = calcularMedidas(768, 344);
  ok(pequena.w >= 55, 'numa tela menor a carta ainda fica utilizavel (' + pequena.w + 'px)');
  ok(calcularRecuos(colunaCom(23, 6), pequena.alturaColuna, pequena).alturaTotal <= pequena.alturaColuna,
    'a coluna de 23 cartas tambem cabe na tela menor');
}

/* ========================================================================== */
grupo('Solucionador (Fase 2)');

{
  const { resolver, resolverFeixe, verificar, fecharia, chaveRapida } =
    await import('./gen-seeds.mjs');

  // fecharia: so um As fecha sequencia, e so sobre 2..K do mesmo naipe.
  const quase = [];
  for (let v = 13; v >= 2; v--) quase.push(carta(v, 0));
  ok(fecharia(quase, 0), 'o As fecharia a sequencia sobre 2..K do mesmo naipe');
  ok(!fecharia(quase, 1), 'nao fecharia com o As de outro naipe');
  ok(!fecharia(quase.slice(1), 0), 'nao fecharia faltando o Rei');
  ok(!fecharia([carta(2, 0)], 0), 'nao fecharia com a coluna curta demais');

  // chaveRapida: mesma posicao, mesma chave; posicao diferente, chave diferente.
  const a = novaPartida({ semente: 77, naipes: 1 });
  const b = novaPartida({ semente: 77, naipes: 1 });
  igual(chaveRapida(a), chaveRapida(b), 'posicoes iguais produzem a mesma chave');
  const opcoes = jogadasLegais(a);
  mover(a, opcoes[0].de, opcoes[0].para, opcoes[0].quantas);
  ok(chaveRapida(a) !== chaveRapida(b), 'uma jogada muda a chave da posicao');

  // Busca em profundidade resolve 1 naipe.
  const e = novaPartida({ semente: 1, naipes: 1 });
  const r = resolver(e, { ms: 8000, largura: 6 });
  ok(r.venceu, 'a busca em profundidade resolve a semente 1 de 1 naipe');
  if (r.venceu) {
    ok(verificar(1, 1, r.jogadas), 'a solucao encontrada e confirmada do zero');
    ok(r.jogadas.length > 50, 'a solucao tem o tamanho de uma partida de verdade (' + r.jogadas.length + ' jogadas)');
  }

  // Busca em feixe tambem resolve, por outro caminho.
  const f = resolverFeixe(1, 1, { ms: 12000, largura: 600 });
  ok(f.venceu, 'a busca em feixe resolve a mesma semente');
  if (f.venceu) ok(verificar(1, 1, f.jogadas), 'a solucao do feixe tambem e confirmada do zero');

  // A conferencia precisa recusar solucao adulterada, senao nao vale nada.
  if (r.venceu) {
    ok(!verificar(1, 1, r.jogadas.slice(0, -1)), 'solucao incompleta e recusada na conferencia');
    ok(!verificar(2, 1, r.jogadas), 'solucao aplicada na semente errada e recusada');
  }
}

/* ========================================================================== */
grupo('Persistência e estatísticas (Fase 6)');

{
  // Simula o localStorage do navegador para testes no Node
  const banco = new Map();
  globalThis.localStorage = {
    getItem: (k) => banco.get(k) ?? null,
    setItem: (k, v) => banco.set(k, String(v)),
    removeItem: (k) => banco.delete(k),
    clear: () => banco.clear(),
  };

  const {
    salvarPartida, carregarPartida, limparPartida,
    obterVitorias, registrarVitoria,
    salvarPreferenciaNaipes, obterPreferenciaNaipes,
  } = await import('../src/storage.js');

  // 1. Partida salva e recarregada fielmente
  limparPartida();
  igual(carregarPartida(), null, 'sem partida salva, carregar devolve null');

  const e = novaPartida({ semente: 42, naipes: 1 });
  for (let i = 0; i < 5; i++) {
    const ops = jogadasLegais(e);
    if (ops.length === 0) break;
    mover(e, ops[0].de, ops[0].para, ops[0].quantas);
  }
  salvarPartida(e);

  const carregada = carregarPartida();
  ok(carregada !== null, 'a partida salva e recarregada pelo storage');
  igual(assinatura(carregada), assinatura(e), 'a partida recarregada mantem a mesma assinatura');
  igual(carregada.historico.length, e.historico.length, 'o historico de desfazer e mantido');
  igual(totalDeCartas(carregada), TOTAL_CARTAS, 'todas as 104 cartas estao presentes');

  // Desfazer na partida recarregada funciona
  desfazer(carregada);
  desfazer(e);
  igual(assinatura(carregada), assinatura(e), 'desfazer opera identicamente apos restaurar do storage');

  // 2. Limpar partida
  limparPartida();
  igual(carregarPartida(), null, 'apos limparPartida(), o storage devolve null');

  // 3. Resiliência contra dados corrompidos
  localStorage.setItem('spider_partida_v1', '{ json corrompido');
  igual(carregarPartida(), null, 'json quebrado no storage e descartado silenciosamente');

  localStorage.setItem('spider_partida_v1', JSON.stringify({ v: 1, semente: 1, naipes: 1, jogadas: [[0, 1, 999]] }));
  igual(carregarPartida(), null, 'partida com jogada ilegal no storage e descartada');

  // 4. Contador de vitórias
  localStorage.removeItem('spider_vitorias');
  igual(obterVitorias(), 0, 'contador de vitorias comeca em 0');
  igual(registrarVitoria(), 1, 'primeira vitoria incrementa para 1');
  igual(obterVitorias(), 1, 'obterVitorias reflete a primeira vitoria');
  igual(registrarVitoria(), 2, 'segunda vitoria incrementa para 2');
  igual(obterVitorias(), 2, 'obterVitorias reflete a segunda vitoria');

  // 5. Preferência de naipes
  localStorage.removeItem('spider_naipes');
  igual(obterPreferenciaNaipes(), 1, 'preferencia padrao de naipes e 1');
  salvarPreferenciaNaipes(2);
  igual(obterPreferenciaNaipes(), 2, 'salvar preferencia 2 altera o valor retornado');
  salvarPreferenciaNaipes(1);
  igual(obterPreferenciaNaipes(), 1, 'salvar preferencia 1 retorna 1');
}

/* ========================================================================== */


console.log('\n' + '-'.repeat(52));
if (falhou === 0) {
  console.log('TUDO CERTO: ' + passou + ' verificacoes passaram.');
  process.exit(0);
} else {
  console.log(passou + ' passaram, ' + falhou + ' falharam:');
  for (const f of falhas) console.log('  - ' + f);
  process.exit(1);
}
