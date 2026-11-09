// Ponte entre o app de Territórios (escrito para o Firestore) e o Supabase.
// Imita só o que o app usa: collection(x).doc(id).get/set/delete/onSnapshot e collection(x).onSnapshot.
// Tudo fica em app_records, com o nome da coleção prefixado por "terr_" (é assim que o banco sabe que é Territórios).
window.TerritoriosBridge=(function(){
  const PREFIXO='terr_';
  const INTERVALO=20000; // busca alterações feitas por outras pessoas a cada 20s

  function criarDb(sb,workspaceId,userId){
    const ouvintes=[];        // {colecao, id|null, cb}
    const versoes={};         // colecao -> Map(id -> updated_at)
    const timers={};

    const tabela=()=>sb.from('app_records');
    const nome=c=>PREFIXO+c;
    const docSnap=(id,data)=>({id,exists:!!data,data:()=>data||undefined});

    async function lerDoc(colecao,id){
      const{data,error}=await tabela().select('data,updated_at').eq('workspace_id',workspaceId).eq('collection',nome(colecao)).eq('id',String(id)).maybeSingle();
      if(error)throw error;
      return data;
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
        (linhas||[]).forEach(r=>{
          mudancas.push({type:conhecidas.has(r.id)?'modified':'added',doc:docSnap(r.id,r.data)});
          conhecidas.set(r.id,r.updated_at);
        });
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
          const linha={id,workspace_id:workspaceId,collection:nome(colecao),data,owner_id:userId};
          const{data:salvo,error}=await tabela().upsert(linha,{onConflict:'workspace_id,collection,id'}).select('updated_at').single();
          if(error)throw error;
          const conhecidas=versoes[colecao]||(versoes[colecao]=new Map());
          const tipo=conhecidas.has(id)?'modified':'added';
          conhecidas.set(id,salvo?.updated_at);
          avisar(colecao,[{type:tipo,doc:docSnap(id,data)}]);
        },
        async delete(){
          const{error}=await tabela().delete().eq('workspace_id',workspaceId).eq('collection',nome(colecao)).eq('id',id);
          if(error)throw error;
          if(versoes[colecao]?.delete(id))avisar(colecao,[{type:'removed',doc:docSnap(id,null)}]);
        },
        onSnapshot(cb){
          const o={colecao,id,cb};ouvintes.push(o);acompanhar(colecao);
          return()=>{const i=ouvintes.indexOf(o);if(i>=0)ouvintes.splice(i,1);};
        }
      };
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

    async function verificarTudoPara(o,colecao){
      const{data}=await tabela().select('id,data').eq('workspace_id',workspaceId).eq('collection',nome(colecao));
      const mudancas=(data||[]).map(r=>({type:'added',doc:docSnap(r.id,r.data)}));
      if(mudancas.length)o.cb({docChanges:()=>mudancas,docs:mudancas.map(m=>m.doc)});
    }
  }

  // Faz login/checa acesso. Sem login → vai para a tela inicial e volta depois.
  async function iniciar(){
    const user=await Conta.usuario();
    if(!user){location.replace('/?voltar=/territorios');return null;}
    const vinc=await Conta.vinculo(user);
    if(!vinc||!vinc.modulos.includes('territorios')){location.replace('/');return null;}
    const sb=await Conta.supabase();
    return{db:criarDb(sb,vinc.workspaceId,user.id),user,vinculo:vinc};
  }

  return{iniciar};
})();
