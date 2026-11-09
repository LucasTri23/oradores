// Ponte entre o app de Territórios (escrito para o Firestore) e o Supabase.
// Imita só o que o app usa: collection(x).doc(id).get/set/delete/onSnapshot e collection(x).onSnapshot.
// Tudo fica em app_records, com o nome da coleção prefixado por "terr_" (é assim que o banco sabe que é Territórios).
// As imagens dos cartões de mapa vão para o Storage (bucket "territorios"); no banco fica só o caminho do arquivo.
window.TerritoriosBridge=(function(){
  const PREFIXO='terr_';
  const INTERVALO=20000; // busca alterações feitas por outras pessoas a cada 20s
  const BUCKET='territorios';
  const COLECAO_CARTOES='tj_cards';

  async function blobParaDataURL(blob){
    if(typeof FileReader!=='undefined'){
      return await new Promise((ok,erro)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=erro;r.readAsDataURL(blob);});
    }
    const buf=Buffer.from(await blob.arrayBuffer());
    return 'data:'+(blob.type||'image/jpeg')+';base64,'+buf.toString('base64');
  }
  async function dataURLParaBlob(url){
    const m=/^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
    if(!m)throw new Error('Imagem inválida');
    const tipo=m[1]||'image/jpeg';
    const bytes=m[2]?Uint8Array.from(atob(m[3]),c=>c.charCodeAt(0)):new TextEncoder().encode(decodeURIComponent(m[3]));
    return new Blob([bytes],{type:tipo});
  }

  function criarDb(sb,workspaceId,userId,opcoes={}){
    const ouvintes=[];        // {colecao, id|null, cb}
    const versoes={};         // colecao -> Map(id -> updated_at)
    const timers={};
    const imagens=new Map();  // caminho+versão -> dataURL (evita baixar de novo)

    const tabela=()=>sb.from('app_records');
    const nome=c=>PREFIXO+c;
    const docSnap=(id,data)=>({id,exists:!!data,data:()=>data||undefined});

    function exigirEdicao(){
      if(opcoes.somenteLeitura){
        const e=new Error('Você tem acesso só para ver os territórios.');
        if(window.DesignaUI)DesignaUI.toast(e.message);
        throw e;
      }
    }

    // ── Cartões de mapa no Storage ──
    const caminhoCartao=id=>workspaceId+'/cartoes/'+String(id).replace(/[^\w.-]+/g,'_');
    async function paraBanco(colecao,id,data){
      if(colecao!==COLECAO_CARTOES||!data||typeof data.img!=='string'||!data.img.startsWith('data:'))return data;
      const blob=await dataURLParaBlob(data.img);
      const caminho=caminhoCartao(id);
      const{error}=await sb.storage.from(BUCKET).upload(caminho,blob,{upsert:true,contentType:blob.type,cacheControl:'3600'});
      if(error)throw error;
      const{img,...resto}=data;
      return {...resto,arquivo:caminho,tipo:blob.type};
    }
    async function doBanco(colecao,data,versao){
      if(colecao!==COLECAO_CARTOES||!data||!data.arquivo)return data; // registros antigos com "img" continuam funcionando
      const chave=data.arquivo+'|'+(versao||data.updatedAt||'');
      if(!imagens.has(chave)){
        const{data:blob,error}=await sb.storage.from(BUCKET).download(data.arquivo);
        if(error)return {...data,img:null};
        imagens.set(chave,await blobParaDataURL(blob));
      }
      return {...data,img:imagens.get(chave)};
    }
    async function apagarArquivo(colecao,id){
      if(colecao!==COLECAO_CARTOES)return;
      await sb.storage.from(BUCKET).remove([caminhoCartao(id)]);
    }

    async function lerDoc(colecao,id){
      const{data,error}=await tabela().select('data,updated_at').eq('workspace_id',workspaceId).eq('collection',nome(colecao)).eq('id',String(id)).maybeSingle();
      if(error)throw error;
      if(!data)return null;
      return {...data,data:await doBanco(colecao,data.data,data.updated_at)};
    }

    function avisar(colecao,mudancas){
      if(!mudancas.length)return;
      ouvintes.filter(o=>o.colecao===colecao).forEach(o=>{
        if(o.id===null){
          o.cb({docChanges:()=>mudancas,docs:mudancas.filter(m=>m.type!=='removed').map(m=>m.doc)});
        }else{
          const m=mudancas.find(x=>x.doc.id===o.id);
          if(m)o.cb(m.type==='removed'?docSnap(o.id,null):m.doc);
        }
      });
    }

    // Compara as versões no banco com as conhecidas e busca só o que mudou.
    async function verificar(colecao){
      const{data,error}=await tabela().select('id,updated_at').eq('workspace_id',workspaceId).eq('collection',nome(colecao));
      if(error)return;
      const conhecidas=versoes[colecao]||(versoes[colecao]=new Map());
      const atuais=new Map((data||[]).map(r=>[r.id,r.updated_at]));
      const mudaram=[...atuais].filter(([id,v])=>conhecidas.get(id)!==v).map(([id])=>id);
      const sumiram=[...conhecidas.keys()].filter(id=>!atuais.has(id));
      const mudancas=[];
      if(mudaram.length){
        const{data:linhas,error:e2}=await tabela().select('id,data,updated_at').eq('workspace_id',workspaceId).eq('collection',nome(colecao)).in('id',mudaram);
        if(e2)return;
        for(const r of linhas||[]){
          const dados=await doBanco(colecao,r.data,r.updated_at);
          mudancas.push({type:conhecidas.has(r.id)?'modified':'added',doc:docSnap(r.id,dados)});
          conhecidas.set(r.id,r.updated_at);
        }
      }
      sumiram.forEach(id=>{conhecidas.delete(id);mudancas.push({type:'removed',doc:docSnap(id,null)});});
      avisar(colecao,mudancas);
    }

    function acompanhar(colecao){
      if(timers[colecao])return;
      verificar(colecao);
      timers[colecao]=setInterval(()=>{if(document.visibilityState==='visible')verificar(colecao);},INTERVALO);
    }
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible')Object.keys(timers).forEach(verificar);
    });

    function doc(colecao,id){
      id=String(id);
      return{
        id,
        async get(){const r=await lerDoc(colecao,id);return docSnap(id,r?.data);},
        async set(data){
          exigirEdicao();
          const gravar=await paraBanco(colecao,id,data);
          const linha={id,workspace_id:workspaceId,collection:nome(colecao),data:gravar,owner_id:userId};
          const{data:salvo,error}=await tabela().upsert(linha,{onConflict:'workspace_id,collection,id'}).select('updated_at').single();
          if(error)throw error;
          const conhecidas=versoes[colecao]||(versoes[colecao]=new Map());
          const tipo=conhecidas.has(id)?'modified':'added';
          conhecidas.set(id,salvo?.updated_at);
          if(gravar!==data&&gravar.arquivo)imagens.set(gravar.arquivo+'|'+(salvo?.updated_at||''),data.img);
          avisar(colecao,[{type:tipo,doc:docSnap(id,data)}]);
        },
        async delete(){
          exigirEdicao();
          const{error}=await tabela().delete().eq('workspace_id',workspaceId).eq('collection',nome(colecao)).eq('id',id);
          if(error)throw error;
          await apagarArquivo(colecao,id).catch(()=>{});
          if(versoes[colecao]?.delete(id))avisar(colecao,[{type:'removed',doc:docSnap(id,null)}]);
        },
        onSnapshot(cb){
          const o={colecao,id,cb};ouvintes.push(o);acompanhar(colecao);
          return()=>{const i=ouvintes.indexOf(o);if(i>=0)ouvintes.splice(i,1);};
        }
      };
    }

    async function verificarTudoPara(o,colecao){
      const{data}=await tabela().select('id,data,updated_at').eq('workspace_id',workspaceId).eq('collection',nome(colecao));
      const mudancas=[];
      for(const r of data||[])mudancas.push({type:'added',doc:docSnap(r.id,await doBanco(colecao,r.data,r.updated_at))});
      if(mudancas.length)o.cb({docChanges:()=>mudancas,docs:mudancas.map(m=>m.doc)});
    }

    return{
      collection(colecao){
        return{
          doc:id=>doc(colecao,id),
          onSnapshot(cb){
            const o={colecao,id:null,cb};ouvintes.push(o);
            // Quem entra depois recebe tudo que já se sabe como "added".
            if(versoes[colecao]?.size)verificarTudoPara(o,colecao);
            acompanhar(colecao);
            return()=>{const i=ouvintes.indexOf(o);if(i>=0)ouvintes.splice(i,1);};
          }
        };
      }
    };
  }

  // Faz login/checa acesso. Sem login → vai para a tela inicial e volta depois.
  async function iniciar(){
    const user=await Conta.usuario();
    if(!user){location.replace('/?voltar=/territorios');return null;}
    const vinc=await Conta.vinculo(user);
    if(!vinc||!Conta.podeVer(vinc,'territorios')){location.replace('/');return null;}
    const sb=await Conta.supabase();
    const somenteLeitura=!Conta.podeEditar(vinc,'territorios');
    return{db:criarDb(sb,vinc.workspaceId,user.id,{somenteLeitura}),user,vinculo:vinc,somenteLeitura};
  }

  return{iniciar,criarDb};
})();
