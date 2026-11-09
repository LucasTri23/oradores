const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// Banco falso que imita o encadeamento do supabase-js usado pela ponte.
function bancoFalso(){
  const linhas=[];const arquivos=new Map();let relogio=0;
  function consulta(op,payload){
    const filtros=[];
    const q={
      select(){return q;},
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
  return {linhas,arquivos,
    from:()=>({select:c=>consulta('select').select(c),upsert:p=>consulta('upsert',p),delete:()=>consulta('delete')}),
    storage:{from:()=>({
      async upload(caminho,blob){arquivos.set(caminho,blob);return {error:null};},
      async download(caminho){return arquivos.has(caminho)?{data:arquivos.get(caminho),error:null}:{data:null,error:{message:'não existe'}};},
      async remove(caminhos){caminhos.forEach(c=>arquivos.delete(c));return {error:null};}
    })},
    // Simula alguém editando de outro aparelho.
    externo(colecao,id,data){const i=linhas.findIndex(r=>r.collection===colecao&&r.id===id);const nova={id,workspace_id:'ws',collection:colecao,data,updated_at:'v'+(++relogio)};if(i>=0)linhas[i]=nova;else linhas.push(nova);}
  };
}

function carregar(banco,{modulos=['territorios'],somenteLeitura=[]}={}){
  const destinos=[];
  const v={workspaceId:'ws',role:'editor',modulos,somenteLeitura,nome:'Central'};
  const ctx={window:{},document:{visibilityState:'visible',addEventListener(){}},setInterval:()=>0,location:{replace:u=>destinos.push(u)},console,
    Blob,TextEncoder,atob,Buffer,Uint8Array,
    Conta:{usuario:async()=>({id:'u1',email:'a@b.c'}),vinculo:async()=>v,supabase:async()=>banco,
      podeVer:(x,m)=>x.modulos.includes(m),podeEditar:(x,m)=>x.modulos.includes(m)&&!x.somenteLeitura.includes(m)}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('territorios/bridge.js','utf8'),ctx);
  return {ponte:ctx.window.TerritoriosBridge,destinos};
}
const esperar=()=>new Promise(r=>setTimeout(r,10));

test('salva com prefixo terr_ e lê de volta',async()=>{
  const banco=bancoFalso();const {db}=await carregar(banco).ponte.iniciar();
  await db.collection('tj').doc('dados').set({dados:[{n:1}]});
  assert.equal(banco.linhas[0].collection,'terr_tj');
  assert.equal(banco.linhas[0].owner_id,'u1');
  const snap=await db.collection('tj').doc('dados').get();
  assert.equal(snap.exists,true);assert.deepEqual(snap.data(),{dados:[{n:1}]});
  assert.equal((await db.collection('tj').doc('nada').get()).exists,false);
});

test('ouvinte da coleção recebe o que existe e as mudanças locais',async()=>{
  const banco=bancoFalso();const {db}=await carregar(banco).ponte.iniciar();
  banco.externo('terr_tj_config','contatos',{lista:[]});
  const recebidas=[];
  db.collection('tj_config').onSnapshot(s=>recebidas.push(...s.docChanges().map(c=>c.type+':'+c.doc.id)));
  await esperar();
  assert.deepEqual(recebidas,['added:contatos']);
  await db.collection('tj_config').doc('mensagens').set({lista:[1]});
  await db.collection('tj_config').doc('contatos').delete();
  assert.deepEqual(recebidas,['added:contatos','added:mensagens','removed:contatos']);
});

test('ouvinte do documento só recebe o próprio documento',async()=>{
  const banco=bancoFalso();const {db}=await carregar(banco).ponte.iniciar();
  const vistos=[];
  db.collection('tj_config').doc('contatos').onSnapshot(s=>vistos.push(s.data()));
  await db.collection('tj_config').doc('mensagens').set({lista:[1]});
  await db.collection('tj_config').doc('contatos').set({lista:[2]});
  assert.deepEqual(vistos,[{lista:[2]}]);
});

test('cartão de mapa vai para o Storage e volta como imagem',async()=>{
  const banco=bancoFalso();const {db}=await carregar(banco).ponte.iniciar();
  const img='data:image/jpeg;base64,'+Buffer.from('mapa-29').toString('base64');
  await db.collection('tj_cards').doc('29').set({img,updatedAt:'x'});
  const linha=banco.linhas.find(r=>r.collection==='terr_tj_cards');
  assert.equal(linha.data.img,undefined,'a imagem não fica no banco');
  assert.equal(linha.data.arquivo,'ws/cartoes/29');
  assert.ok(banco.arquivos.has('ws/cartoes/29'));
  // Outra pessoa abrindo o app recebe a imagem de volta.
  const {db:outro}=await carregar(banco).ponte.iniciar();
  assert.equal((await outro.collection('tj_cards').doc('29').get()).data().img,img);
  // Cartões antigos (imagem dentro do banco) continuam funcionando.
  banco.externo('terr_tj_cards','7',{img:'data:image/png;base64,AAAA'});
  assert.equal((await outro.collection('tj_cards').doc('7').get()).data().img,'data:image/png;base64,AAAA');
  await db.collection('tj_cards').doc('29').delete();
  assert.equal(banco.arquivos.has('ws/cartoes/29'),false,'apagar o cartão apaga o arquivo');
});

test('quem só pode ver lê, mas não grava',async()=>{
  const banco=bancoFalso();
  banco.externo('terr_tj','dados',{dados:[{n:3}]});
  const {ponte}=carregar(banco,{somenteLeitura:['territorios']});
  const ctx=await ponte.iniciar();
  assert.equal(ctx.somenteLeitura,true);
  assert.deepEqual((await ctx.db.collection('tj').doc('dados').get()).data(),{dados:[{n:3}]});
  await assert.rejects(ctx.db.collection('tj').doc('dados').set({dados:[]}),/só para ver/);
  await assert.rejects(ctx.db.collection('tj').doc('dados').delete(),/só para ver/);
  assert.deepEqual(banco.linhas[0].data,{dados:[{n:3}]});
});

test('sem acesso a territórios volta para o início',async()=>{
  const banco=bancoFalso();
  const {ponte,destinos}=carregar(banco,{modulos:['oradores']});
  assert.equal(await ponte.iniciar(),null);
  assert.deepEqual(destinos,['/']);
});
