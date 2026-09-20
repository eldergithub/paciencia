/**
 * Fecha o Service Worker depois do `vite build`.
 *
 * O `public/sw.js` é um molde com dois buracos: `__VERSAO__` e
 * `__RECURSOS__`. Este script varre a pasta `dist` já construída e preenche
 * os dois.
 *
 * Por que isso não pode ser escrito à mão:
 *
 * - Os arquivos de `assets/` têm o conteúdo no nome (`index-BjsoWkLT.js`), e
 *   esse nome muda a cada alteração no código. Uma lista fixa ficaria velha
 *   em silêncio, e o jogo deixaria de abrir offline sem ninguém perceber.
 * - O nome do cache precisa mudar a cada publicação. Se não mudar, o
 *   `activate` não apaga o cache antigo e a versão nova nunca chega no
 *   aparelho dela.
 *
 * A versão é o resumo (SHA-1, 10 dígitos) do conteúdo de todos os arquivos
 * publicados: se nada mudou, a versão é a mesma e o aparelho não baixa nada
 * de novo; se qualquer byte mudou, a versão muda sozinha.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist');

/** Arquivos que não entram no cache: o próprio SW e mapas de depuração. */
// `.nojekyll` e um arquivo vazio que so diz ao GitHub Pages para publicar a
// pasta como esta. Nao tem por que ocupar espaco no cache do aparelho dela.
const IGNORADOS = new Set(['sw.js', '.nojekyll']);
const EXTENSOES_IGNORADAS = ['.map'];

function listar(pasta) {
  const encontrados = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listar(caminho));
    } else {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

const arquivos = listar(DIST)
  .map((caminho) => relative(DIST, caminho).split('\\').join('/'))
  .filter((rel) => !IGNORADOS.has(rel))
  .filter((rel) => !EXTENSOES_IGNORADAS.some((ext) => rel.endsWith(ext)))
  .sort();

if (arquivos.length === 0) {
  console.error('gen-sw: dist vazia. Rode `vite build` antes.');
  process.exit(1);
}

const molde = readFileSync(join(RAIZ, 'public', 'sw.js'), 'utf8');
if (!molde.includes('__VERSAO__') || !molde.includes('__RECURSOS__')) {
  console.error('gen-sw: public/sw.js nao tem os marcadores __VERSAO__/__RECURSOS__.');
  process.exit(1);
}

// Resumo de tudo que vai ao ar: nome e conteúdo de cada arquivo, mais o
// próprio molde do Service Worker. O molde entra na conta porque uma
// correção só nele — na estratégia de cache, por exemplo — também precisa
// gerar um cache novo no aparelho dela. Entra o molde, e não o `sw.js`
// final, senão a versão dependeria dela mesma.
const resumo = createHash('sha1');
for (const rel of arquivos) {
  resumo.update(rel);
  resumo.update(readFileSync(join(DIST, rel)));
}
resumo.update(molde);
const versao = resumo.digest('hex').slice(0, 10);

// './' é a própria página: pedida pelo nome do diretório, sem `index.html`.
const recursos = ['./', ...arquivos.map((rel) => './' + rel)];

const saida = molde
  .replace('__VERSAO__', versao)
  .replace('__RECURSOS__', JSON.stringify(recursos, null, 2));

writeFileSync(join(DIST, 'sw.js'), saida, 'utf8');

console.log(
  'Service Worker fechado: versao ' + versao + ', ' + recursos.length +
  ' arquivos no cache offline.'
);
