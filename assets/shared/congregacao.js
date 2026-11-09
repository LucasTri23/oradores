// Dados da congregação usados por todos os módulos: lista única de pessoas e eventos (assembleia, congresso, visita…).
// As regras aqui não dependem de tela, para poder testar.
(function(raiz){
  const GRUPOS={anciao:'Ancião',servo:'Servo ministerial',publicador:'Publicador','':'Sem grupo definido'};
  // Padrões de cada tipo (a pessoa pode mudar tudo na hora de cadastrar):
  // semanaToda = ocupa de segunda a domingo; temDesignacoes = as reuniões do período acontecem com designações.
  const TIPOS_EVENTO={
    assembleia:{nome:'Assembleia de circuito',semDiscurso:true,semanaToda:false,temDesignacoes:false},
    congresso:{nome:'Congresso regional',semDiscurso:true,semanaToda:false,temDesignacoes:false},
    visita:{nome:'Visita do superintendente de circuito',semDiscurso:true,semanaToda:true,temDesignacoes:true},
    celebracao:{nome:'Celebração',semDiscurso:false,semanaToda:false,temDesignacoes:false},
    outro:{nome:'Outro evento',semDiscurso:false,semanaToda:false,temDesignacoes:true}
  };
  const isoData=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  // Período que o evento ocupa de fato: os dias escolhidos ou a semana inteira (segunda a domingo).
  function periodo(ev){
    if(!ev)return null;
    const fim=ev.fim||ev.inicio;
    if(!ev.semanaToda)return {inicio:ev.inicio,fim};
    const seg=new Date(ev.inicio+'T12:00:00');seg.setDate(seg.getDate()-((seg.getDay()+6)%7));
    const dom=new Date(fim+'T12:00:00');dom.setDate(dom.getDate()+(7-dom.getDay())%7);
    return {inicio:isoData(seg),fim:isoData(dom)};
  }
  // Compatível com eventos antigos (semReuniaoFim/semReuniaoMeio).
  const semReuniao=ev=>ev?(ev.temDesignacoes===false||(ev.temDesignacoes==null&&(ev.semReuniaoFim||ev.semReuniaoMeio))):false;
  const normalizar=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const novoId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

  // Número para o link do WhatsApp (acrescenta 55 em números brasileiros sem código do país).
  function telefoneWa(t){
    const d=String(t||'').replace(/\D/g,'');
    if(!d)return '';
    return (d.length===10||d.length===11)?'55'+d:d;
  }

  // ── Banco (tabela app_records, separada por congregação) ──
  async function listar(sb,ws,colecao){
    const{data,error}=await sb.from('app_records').select('id,data').eq('workspace_id',ws).eq('collection',colecao);
    if(error)throw error;
    return (data||[]).map(r=>({...r.data,id:r.id}));
  }
  async function salvar(sb,ws,userId,colecao,id,dados){
    const{id:_,...limpo}=dados;
    const{error}=await sb.from('app_records').upsert({id:String(id),workspace_id:ws,collection:colecao,data:limpo,owner_id:userId},{onConflict:'workspace_id,collection,id'});
    if(error)throw error;
  }
  async function apagar(sb,ws,colecao,id){
    const{error}=await sb.from('app_records').delete().eq('workspace_id',ws).eq('collection',colecao).eq('id',String(id));
    if(error)throw error;
  }

  // ── Pessoas: junta os cadastros que já existem nos módulos, sem repetir nomes ──
  // Retorna {novas:[pessoa], atualizadas:[pessoa]} para gravar em cong_pessoas.
  function juntarCadastros({central=[],designacoes=[],dirigentes=[],oradores=[]}){
    const porNome=new Map(central.map(p=>[normalizar(p.nome),{...p}]));
    const novas=[],atualizadas=new Map();
    function incluir({id,nome,grupo='',telefone='',obs='',ativo=true}){
      const chave=normalizar(nome);if(!chave)return;
      const existe=porNome.get(chave);
      if(existe){
        if(!existe.telefone&&telefone){existe.telefone=telefone;if(central.some(c=>c.id===existe.id))atualizadas.set(existe.id,existe);}
        if(!existe.grupo&&grupo){existe.grupo=grupo;if(central.some(c=>c.id===existe.id))atualizadas.set(existe.id,existe);}
        return;
      }
      const p={id:id||novoId(),nome:String(nome).trim(),grupo,telefone,obs,ativo};
      porNome.set(chave,p);novas.push(p);
    }
    // As Designações vêm primeiro e mantêm o mesmo id (assim as funções de cada pessoa continuam ligadas).
    designacoes.filter(p=>p.nome).forEach(p=>incluir({id:p.id,nome:p.nome,grupo:p.grupo||'',obs:p.obs||'',ativo:p.ativo!==false,telefone:p.telefone||''}));
    dirigentes.forEach(c=>incluir({nome:c.nome,telefone:c.num||''}));
    oradores.forEach(o=>incluir({nome:o.nome,telefone:o.tel||''}));
    return {novas,atualizadas:[...atualizadas.values()]};
  }

  // ── Eventos: o que muda no Oradores e nas Designações ──
  // datas = {fim:[iso], meio:[iso]} (dias de reunião que podem ser afetados).
  // Retorna o que gravar/apagar. Ao apagar ou mudar um evento, o que existia antes volta.
  function planejarEvento({novo=null,antigo=null,programa=[],reunioes=[],datas={fim:[],meio:[]}}){
    const ev=novo||antigo;const id=ev.id;
    const p=periodo(novo);
    const dentro=d=>!!p&&d>=p.inicio&&d<=p.fim;
    const titulo=novo?.titulo||'';
    const plano={programaSalvar:[],programaApagar:[],reunioesSalvar:[],conflitos:[]};

    // Oradores: "sem discurso" nos fins de semana do evento.
    const alvoFim=novo&&novo.semDiscurso?datas.fim.filter(dentro):[];
    programa.filter(p=>p.eventoId===id&&!alvoFim.includes(p.data)).forEach(p=>{
      if(p.eventoBackup)plano.programaSalvar.push({id:p.id,dados:p.eventoBackup});
      else plano.programaApagar.push(p.id);
    });
    alvoFim.forEach(d=>{
      const ex=programa.find(p=>p.data===d);
      if(ex&&ex.eventoId===id){plano.programaSalvar.push({id:ex.id,dados:{...semId(ex),motivo:titulo}});return;}
      if(ex&&ex.nome&&!ex.semDiscurso)plano.conflitos.push({data:d,nome:ex.nome});
      const dados={data:d,semDiscurso:true,temaNum:null,tema:'',canticoNum:null,cantico:'',temImagens:false,nome:null,congregacao:'',telefone:'',obs:'',
        motivo:titulo,semDiscursoCor:'#f59e0b',especial:false,especialTitulo:'',especialCor:'#7c3aed',eventoId:id};
      if(ex)dados.eventoBackup=semId(ex);
      plano.programaSalvar.push({id:ex?ex.id:null,dados});
    });

    // Designações: "sem reunião" nas reuniões do evento.
    const alvo=new Map();
    if(semReuniao(novo)){
      // Eventos antigos podiam escolher só o fim ou só o meio de semana.
      const antigoFormato=novo.temDesignacoes==null;
      if(!antigoFormato||novo.semReuniaoFim)datas.fim.filter(dentro).forEach(d=>alvo.set(d,'fim'));
      if(!antigoFormato||novo.semReuniaoMeio)datas.meio.filter(dentro).forEach(d=>alvo.set(d,'meio'));
    }
    reunioes.filter(r=>r.eventoId===id&&!alvo.has(r.data)).forEach(r=>{
      const{eventoId,eventoAntes,...resto}=semId(r);
      plano.reunioesSalvar.push({...resto,semReuniao:!!eventoAntes?.semReuniao,motivo:eventoAntes?.motivo||''});
    });
    alvo.forEach((tipo,d)=>{
      const ex=reunioes.find(r=>r.data===d);
      if(ex&&ex.eventoId===id){plano.reunioesSalvar.push({...semId(ex),motivo:titulo});return;}
      const base=ex?semId(ex):{data:d,tipo,pessoas:{}};
      plano.reunioesSalvar.push({...base,semReuniao:true,motivo:titulo,eventoId:id,eventoAntes:{semReuniao:!!ex?.semReuniao,motivo:ex?.motivo||''}});
    });
    return plano;
  }
  function semId(o){const{id,...r}=o||{};return r;}

  const api={GRUPOS,TIPOS_EVENTO,normalizar,novoId,telefoneWa,listar,salvar,apagar,juntarCadastros,planejarEvento,periodo,semReuniao};
  raiz.Congregacao=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
