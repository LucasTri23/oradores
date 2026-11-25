const {test}=require('node:test');
const assert=require('node:assert/strict');

test('limpeza semanal apaga só as semanas que já terminaram, em todas as congregações',async()=>{
  const L=await import('../api/limpar-arquivos.js');
  // Segunda 00:30 em Brasília = segunda 03:30 UTC.
  assert.equal(L.hojeBrasilia(new Date('2026-11-30T03:30:00Z')),'2026-11-30');
  assert.equal(L.hojeBrasilia(new Date('2026-11-30T02:30:00Z')),'2026-11-29','ainda domingo em Brasília');
  assert.equal(L.vencida('2026-11-28','2026-11-30'),true);
  assert.equal(L.vencida('2026-11-29','2026-11-30'),true,'domingo da semana anterior');
  assert.equal(L.vencida('2026-12-05','2026-11-30'),false,'semana atual fica');
  const arvore={
    '':[{name:'ws1',id:null},{name:'ws2',id:null},{name:'solto.txt',id:'x'}],
    'ws1/discursos/':[{name:'2026-11-28',id:null},{name:'2026-12-05',id:null}],
    'ws2/discursos/':[{name:'2026-11-29',id:null}],
    'ws1/discursos/2026-11-28/':[{name:'a-Discurso.jwpub',id:'1'},{name:'b-Lista.jwlplaylist',id:'2'}],
    'ws2/discursos/2026-11-29/':[{name:'c-X.jwpub',id:'3'}]
  };
  const apagados=[];
  const storage={listar:async p=>arvore[p]||[],apagar:async c=>{apagados.push(...c);}};
  const r=await L.limpar(storage,'2026-11-30');
  assert.deepEqual(apagados.sort(),['ws1/discursos/2026-11-28/a-Discurso.jwpub','ws1/discursos/2026-11-28/b-Lista.jwlplaylist','ws2/discursos/2026-11-29/c-X.jwpub']);
  assert.deepEqual(r,{apagados:3,pastas:2});
});

test('a rota recusa chamadas sem o segredo do Cron',async()=>{
  const L=await import('../api/limpar-arquivos.js');
  process.env.CRON_SECRET='segredo';
  let status,corpo;const res={setHeader(){},status(s){status=s;return this;},json(b){corpo=b;return this;}};
  await L.default({headers:{authorization:'Bearer errado'}},res);
  assert.equal(status,401);
  delete process.env.CRON_SECRET;
});
