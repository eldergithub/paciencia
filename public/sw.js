/**
 * Service Worker para funcionamento 100% offline do Paciência Spider.
 *
 * Duas estratégias, cada uma onde faz sentido:
 *
 * 1. **Navegação e `index.html`: rede primeiro**, com o cache como rede de
 *    segurança. É o que permite republicar o jogo e ela receber a versão
 *    nova sozinha, sem loja e sem ação dela. Com cache-first aqui, o
 *    `index.html` velho ficaria colado para sempre e nenhuma correção
 *    chegaria no aparelho.
 * 2. **Todo o resto: cache primeiro.** Os arquivos de `assets/` têm o
 *    conteúdo no próprio nome (`index-BjsoWkLT.js`), então nunca mudam — ir
 *    à rede por eles seria desperdício de bateria e de dados.
 *
 * `VERSAO` e `RECURSOS_ESSENCIAIS` são reescritos a cada `npm run build` por
 * `tools/gen-sw.mjs`, que lê a pasta `dist` já construída. Duas consequências
 * importantes:
 *   - cada publicação ganha um cache novo, e o antigo é apagado no `activate`;
 *   - os arquivos com nome sorteado entram no cache já na instalação, então
 *     o jogo funciona offline **desde a primeira vez que ela abrir**, sem
 *     depender de uma segunda visita com internet.
 */

const VERSAO = '__VERSAO__';
const CACHE_NAME = 'spider-cache-' + VERSAO;

const RECURSOS_ESSENCIAIS = __RECURSOS__;

/** Quanto tempo esperar a rede antes de servir o `index.html` guardado. */
const MS_ESPERA_DE_REDE = 3000;

/**
 * `ignoreVary` e o detalhe que faz o modo offline funcionar de verdade.
 *
 * Hospedagens estaticas costumam responder com `Vary: Origin`. Quando isso
 * acontece, o navegador so considera que a copia guardada serve se o
 * cabecalho `Origin` do pedido novo for igual ao do pedido que gravou a
 * copia - e nao e: o `index.html` pede os arquivos de `assets/` com
 * `crossorigin` (manda `Origin`), enquanto a pre-carga da instalacao nao
 * manda nenhum. Sem `ignoreVary`, o cache tem o arquivo certo e mesmo assim
 * responde que nao tem, e ela ve uma tela em branco sem internet.
 */
const BUSCA = { ignoreVary: true };

/** Pasta em que o jogo foi publicado: '/' na raiz, '/nome-do-repo/' no GitHub Pages. */
const RAIZ = new URL('./', self.location).pathname;

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(RECURSOS_ESSENCIAIS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves
          .filter((chave) => chave !== CACHE_NAME)
          .map((chave) => caches.delete(chave))
      );
    }).then(() => self.clients.claim())
  );
});

/** Guarda a resposta no cache desta versão, se ela valer a pena guardar. */
function guardar(requisicao, resposta) {
  if (!resposta || resposta.status !== 200 || resposta.type !== 'basic') return;
  const copia = resposta.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(requisicao, copia));
}

/**
 * Rede primeiro, com prazo. Se a rede demorar mais que `MS_ESPERA_DE_REDE`
 * ou falhar, entrega o que estiver guardado — o jogo abre igual, offline ou
 * numa conexão ruim, e nunca fica numa tela em branco esperando.
 */
async function redePrimeiro(requisicao) {
  try {
    const resposta = await Promise.race([
      // `no-cache` nao desliga o cache: obriga a perguntar ao servidor se
      // mudou, mandando o ETag que ja temos. Sem isto, uma hospedagem que
      // responde `Cache-Control: max-age=600` - o GitHub Pages responde -
      // faria o navegador servir o `index.html` da memoria dele por dez
      // minutos, sem nem consultar a rede, e a correcao recem-publicada
      // demoraria esse tanto para chegar. A resposta e minuscula e, quando
      // nada mudou, volta um `304` sem corpo nenhum.
      fetch(requisicao.url, { cache: 'no-cache', credentials: 'same-origin' }),
      new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('demorou')), MS_ESPERA_DE_REDE)),
    ]);
    guardar(requisicao, resposta);
    return resposta;
  } catch {
    const guardada =
      (await caches.match(requisicao, BUSCA)) ||
      (await caches.match('./index.html', BUSCA)) ||
      (await caches.match('./', BUSCA));
    if (guardada) return guardada;
    // Sem rede e sem cache: melhor uma resposta honesta que um erro cru.
    return new Response('', { status: 504, statusText: 'Sem conexao' });
  }
}

/** Cache primeiro, indo à rede só quando não houver cópia guardada. */
async function cachePrimeiro(requisicao) {
  const guardada = await caches.match(requisicao, BUSCA);
  if (guardada) return guardada;
  try {
    const resposta = await fetch(requisicao);
    guardar(requisicao, resposta);
    return resposta;
  } catch {
    return new Response('', { status: 504, statusText: 'Sem conexao' });
  }
}

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  const url = new URL(evento.request.url);
  if (url.origin !== self.location.origin) return;

  // `RAIZ` e a pasta onde o jogo foi publicado. No GitHub Pages o endereco
  // e `usuario.github.io/nome-do-repo/`, entao comparar com '/' nao serve:
  // a raiz do jogo e '/nome-do-repo/'. `self.location` ja conhece o lugar
  // certo, porque o proprio `sw.js` mora nele.
  const ehNavegacao =
    evento.request.mode === 'navigate' ||
    url.pathname === RAIZ ||
    url.pathname === RAIZ + 'index.html';

  evento.respondWith(ehNavegacao ? redePrimeiro(evento.request) : cachePrimeiro(evento.request));
});
