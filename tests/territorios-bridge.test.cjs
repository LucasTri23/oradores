const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// Banco falso que imita o encadeamento do supabase-js usado pela ponte.
function bancoFalso(){
  const linhas=[];let relogio=0;
  function consulta(op,payload){
    const filtros=[];let colunas='*';
    const q={
      select(c){colunas=c;return q;},
      eq(k,v){filtros.push(r=>r[k]===v);return q;},
      in(k,vs){filtros.push(r=>vs.includes(r[k]));return q;},
      async maybeSingle(){const r=await q;return {data:r.data[0]||null,error:null};},
      async single(){const r=await q;return {data:r.data[0]||null,error:null};},
      then(ok,fail){return Promise.resolve(exec()).then(ok,fail);}
    };
    function exec(){
      if(op==='upsert'){
        const i=linhas.findIndex(r=>r.workspace_id===payload.workspace_id&&r.collection===payload.collection&&r.id===payload.id);
        const nova={...payload,updated_at:'v'+(++relogio)};
        if(i>=0)linhas[i]=nova;else linhas.push(nova);
        return {data:[nova],error:null};
      }
      const achadas=linhas.filter(r=>filtros.every(f=>f(r)));
      if(op==='delete'){achadas.forEach(r=>linhas.splice(linhas.indexOf(r),1));return {data:null,error:null};}
      return {data:achadas.map(r=>({...r})),error:null};
    }
    return q;
  }
  return {linhas,from:()=>({select:c=>consulta('select').select(c),upsert:p=>consulta('upsert',p),delete:()=>consulta('delete')}),
    // Simula alguém editando de outro aparelho.
    externo(colecao,id,data){const i=linhas.findIndex(r=>r.collection===colecao&&r.id===id);const nova={id,workspace_id:'ws',collection:colecao,data,updated_at:'v'+(++relogio)};if(i>=0)linhas[i]=nova;else linhas.push(nova);}
  };
}

function carregar(banco){
  const ctx={window:{},document:{visibilityState:'visible',addEventListener(){}},setInterval:()=>0,location:{replace(){}},console,
    Conta:{usuario:async()=>({id:'u1',email:'a@b.c'}),vinculo:async()=>({workspaceId:'ws',role:'editor',modulos:['territorios'],nome:'Central'}),supabase:async()=>banco}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('territorios/bridge.js','utf8'),ctx);
  return ctx.window.TerritoriosBridge;
}
const esperar=()=>new Promise(r=>setTimeout(r,10));

test('salva com prefixo terr_ e lê de volta',async()=>{
  const banco=bancoFalso();const {db}=await carregar(banco).iniciar();
  await db.collection('tj').doc('dados').set({dados:[{n:1}]});
  assert.equal(banco.linhas[0].collection,'terr_tj');
  assert.equal(banco.linhas[0].owner_id,'u1');
  const snap=await db.collection('tj').doc('dados').get();
  assert.equal(snap.exists,true);assert.deepEqual(snap.data(),{dados:[{n:1}]});
  assert.equal((await db.collection('tj').doc('nada').get()).exists,false);
});

test('ouvinte da coleção recebe o que existe e as mudanças locais',async()=>{
  const banco=bancoFalso();const {db}=await carregar(banco).iniciar();
  banco.externo('terr_tj_cards','5',{img:'x'});
  const recebidas=[];
  db.collection('tj_cards').onSnapshot(s=>recebidas.push(...s.docChanges().map(c=>c.type+':'+c.doc.id)));
  await esperar();
  assert.deepEqual(recebidas,['added:5']);
  await db.collection('tj_cards').doc('6').set({img:'y'});
  await db.collection('tj_cards').doc('5').delete();
  assert.deepEqual(recebidas,['added:5','added:6','removed:5']);
});

test('ouvinte do documento só recebe o próprio documento',async()=>{
  const banco=bancoFalso();const {db}=await carregar(banco).iniciar();
  const vistos=[];
  db.collection('tj_config').doc('contatos').onSnapshot(s=>vistos.push(s.data()));
  await db.collection('tj_config').doc('mensagens').set({lista:[1]});
  await db.collection('tj_config').doc('contatos').set({lista:[2]});
  assert.deepEqual(vistos,[{lista:[2]}]);
});

test('sem acesso a territórios não cria a conexão',async()=>{
  const banco=bancoFalso();const ponte=carregar(banco);
  let destino=null;
  const ctx2={window:{},document:{visibilityState:'visible',addEventListener(){}},setInterval:()=>0,location:{replace:u=>destino=u},
    Conta:{usuario:async()=>({id:'u2'}),vinculo:async()=>({workspaceId:'ws',role:'editor',modulos:['oradores'],nome:'X'}),supabase:async()=>banco}};
  vm.createContext(ctx2);vm.runInContext(fs.readFileSync('territorios/bridge.js','utf8'),ctx2);
  assert.equal(await ctx2.window.TerritoriosBridge.iniciar(),null);
  assert.equal(destino,'/');
  assert.ok(ponte);
});
