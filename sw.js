// Service worker do Designa: permite instalar no celular.
// Sempre tenta a internet primeiro (dados e telas atualizados); a cópia salva só é usada sem conexão.
const CACHE='designa-v1';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  const url=new URL(req.url);
  // Só páginas e arquivos do próprio site; nunca a API nem o banco.
  if(req.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
  e.respondWith(
    fetch(req).then(resp=>{
      if(resp.ok){const copia=resp.clone();caches.open(CACHE).then(c=>c.put(req,copia));}
      return resp;
    }).catch(()=>caches.match(req).then(r=>r||caches.match('/')))
  );
});
