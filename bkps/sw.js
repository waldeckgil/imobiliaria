/* =========================================================================
   SGI • Progressive Web App (PWA) - Service Worker Seguro
   Estratégia: Network-First (Garante dados do Supabase sempre em tempo real)
   ========================================================================= */

const CACHE_NAME = 'sgi-pwa-v1';

// Recursos estáticos básicos para carregamento veloz da carcaça do app
const ASSETS_ESTATICOS = [
  './',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pré-carrega apenas recursos estáticos seguros
      return cache.addAll(ASSETS_ESTATICOS).catch(() => {
        // Se alguma CDN falhar no pré-cache, a instalação continua sem quebrar
      });
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de versões antigas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves.map((chave) => {
          if (chave !== CACHE_NAME) {
            return caches.delete(chave);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptação de requisições: Prioriza SEMPRE a internet (Network-First)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGRA DE SEGURANÇA 1: Nunca cacheia chamadas ao Supabase (tempo real garantido)
  if (url.hostname.includes('supabase.co')) {
    return; // Deixa o navegador buscar direto na nuvem sem intermediar
  }

  // REGRA DE SEGURANÇA 2: Métodos que não sejam GET (como envio de leads via POST) vão direto
  if (event.request.method !== 'GET') {
    return;
  }

  // Para páginas e assets: tenta a rede primeiro; se estiver offline, busca no cache
  event.respondWith(
    fetch(event.request)
      .then((respostaRede) => {
        // Se a resposta for válida e for do mesmo domínio, atualiza o cache silenciosamente
        if (respostaRede && respostaRede.status === 200 && url.origin === location.origin) {
          const copia = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }
        return respostaRede;
      })
      .catch(() => {
        // Sem conexão: retorna o que tiver guardado no cache
        return caches.match(event.request);
      })
  );
});