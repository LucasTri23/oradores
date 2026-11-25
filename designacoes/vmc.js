// Vida e Ministério (reunião do meio de semana): partes da apostila, vagas, quem pode fazer, avisos e sugestões.
// Sem tela, para poder testar.
(function(raiz){
  const FUNCOES_VMC={
    presidente_vmc:{nome:'Presidente da reunião do meio de semana',curto:'Presidente (meio)',icone:'user-round'},
    oracao_vmc:{nome:'Oração (meio de semana)',curto:'Oração',icone:'hand-heart'},
    tesouros:{nome:'Tesouros da Palavra de Deus',curto:'Tesouros',icone:'gem'},
    joias:{nome:'Joias espirituais',curto:'Joias',icone:'sparkles'},
    leitura_biblia:{nome:'Leitura da Bíblia',curto:'Leitura da Bíblia',icone:'book-open-text'},
    vida_crista:{nome:'Nossa Vida Cristã e considerações',curto:'Vida Cristã',icone:'heart-handshake'},
    dirigente_ebc:{nome:'Dirigente do Estudo bíblico de congregação',curto:'Dirigente EBC',icone:'book-marked'},
    leitor_ebc:{nome:'Leitor do Estudo bíblico de congregação',curto:'Leitor EBC',icone:'book-open'}
  };
  // Partes de estudante: todos fazem, exceto quem for desmarcado (funcoes.estudante === false).
  const ESTUDANTE={chave:'estudante',nome:'Partes de estudante (Faça seu melhor no ministério)',curto:'Estudante',icone:'users'};
  const NOMES_VAGA={estudante:'Estudante',ajudante:'Ajudante'};
  const SECOES={tesouros:'TESOUROS DA PALAVRA DE DEUS',ministerio:'FAÇA SEU MELHOR NO MINISTÉRIO',vida:'NOSSA VIDA CRISTÃ'};

  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const ddmm=d=>d.slice(8,10)+'/'+d.slice(5,7);
  // Irmão ou irmã: o cadastro manda; anciãos e servos são sempre irmãos.
  const sexoDe=p=>p?.sexo==='M'||p?.sexo==='F'?p.sexo:(['anciao','servo'].includes(p?.grupo)?'M':'');
  const fazEstudante=p=>!!p&&p.ativo!==false&&p.funcoes?.estudante!==false;

  // Data da reunião na semana da apostila (semana = segunda-feira; dia = 1..5).
  function dataReuniao(semana,dia){const d=new Date(semana+'T12:00:00');d.setDate(d.getDate()+(Number(dia)||1)-1);return iso(d);}

  // Vagas de uma semana, na ordem da reunião.
  function vagas(s){
    const v=[{chave:'presidente',funcao:'presidente_vmc',rotulo:'Presidente'},{chave:'oracao_inicial',funcao:'oracao_vmc',rotulo:'Oração'}];
    (s?.partes||[]).forEach(p=>{
      const k='p'+p.n,base={parte:p.n};
      if(p.tipo==='tesouros')v.push({...base,chave:k,funcao:'tesouros',rotulo:''});
      else if(p.tipo==='joias')v.push({...base,chave:k,funcao:'joias',rotulo:''});
      else if(p.tipo==='leitura')v.push({...base,chave:k,funcao:'leitura_biblia',rotulo:'Estudante'});
      else if(p.tipo==='vida'||p.tipo==='consideracao')v.push({...base,chave:k,funcao:'vida_crista',rotulo:''});
      else if(p.tipo==='ebc'){v.push({...base,chave:k,funcao:'dirigente_ebc',rotulo:'Dirigente'});v.push({...base,chave:k+'l',funcao:'leitor_ebc',rotulo:'Leitor'});}
      else if(p.tipo==='discurso')v.push({...base,chave:k,funcao:'estudante',rotulo:'Estudante',soIrmao:true});
      else{v.push({...base,chave:k,funcao:'estudante',rotulo:'Estudante'});v.push({...base,chave:k+'a',funcao:'ajudante',rotulo:'Ajudante',de:k});}
    });
    v.push({chave:'oracao_final',funcao:'oracao_vmc',rotulo:'Oração'});
    return v;
  }
  const nomeFuncao=f=>FUNCOES_VMC[f]?.nome||NOMES_VAGA[f]||f;
  const valida=s=>s&&s.data&&!s.semReuniao;
  const idsDe=s=>Object.values(s?.pessoas||{}).filter(Boolean);
  function designacoesDe(s){return vagas(s).map(v=>({...v,pessoa:s.pessoas?.[v.chave]||null})).filter(x=>x.pessoa);}

  function podeVaga(p,vaga,s,pessoas=[]){
    if(!p||p.ativo===false)return false;
    if(vaga.funcao==='estudante'||vaga.funcao==='ajudante'){
      if(!fazEstudante(p))return false;
      if(vaga.soIrmao&&sexoDe(p)!=='M')return false;
      if(vaga.funcao==='ajudante'){
        const est=pessoas.find(x=>x.id===s?.pessoas?.[vaga.de]);
        if(est&&sexoDe(est)&&sexoDe(p)&&sexoDe(est)!==sexoDe(p))return false;
      }
      return true;
    }
    return !!p.funcoes?.[vaga.funcao];
  }

  function ultimaVez(semanas,pessoaId,funcao,antesDe){
    let u=null;
    semanas.forEach(s=>{if(!valida(s)||s.data>=antesDe)return;if(designacoesDe(s).some(d=>d.pessoa===pessoaId&&d.funcao===funcao)&&(!u||s.data>u))u=s.data;});
    return u;
  }

  // Avisos: outra designação na mesma reunião (ou na mesma data, em Designações), mesma parte na semana anterior, sexo.
  function conflitos({semana,pessoa,vaga,semanas=[],reunioes=[],pessoas=[],funcoesReuniao={}}){
    const avisos=[];if(!pessoa||!semana)return avisos;
    designacoesDe(semana).forEach(d=>{if(d.chave!==vaga.chave&&d.pessoa===pessoa.id)avisos.push('Já tem outra designação nesta reunião ('+(d.rotulo||nomeFuncao(d.funcao))+')');});
    const r=reunioes.find(x=>x.data===semana.data&&!x.semReuniao);
    if(r)Object.entries(r.pessoas||{}).forEach(([f,ids])=>{if((ids||[]).includes(pessoa.id))avisos.push('Está como '+(funcoesReuniao[f]?.nome||f)+' nesta reunião');});
    const anterior=semanas.filter(s=>valida(s)&&s.data<semana.data).sort((a,b)=>b.data.localeCompare(a.data))[0];
    if(anterior&&designacoesDe(anterior).some(d=>d.pessoa===pessoa.id&&d.funcao===vaga.funcao))avisos.push('Fez '+nomeFuncao(vaga.funcao).toLowerCase()+' na semana anterior ('+ddmm(anterior.data)+')');
    if(vaga.funcao==='estudante'||vaga.funcao==='ajudante'){
      if(!sexoDe(pessoa))avisos.push('Irmão ou irmã não informado no cadastro');
      const outro=vaga.funcao==='ajudante'?semana.pessoas?.[vaga.de]:semana.pessoas?.[vaga.chave+'a'];
      const o=pessoas.find(x=>x.id===outro);
      if(o&&sexoDe(o)&&sexoDe(pessoa)&&sexoDe(o)!==sexoDe(pessoa))avisos.push('Estudante e ajudante devem ser do mesmo sexo');
    }
    return [...new Set(avisos)];
  }

  // Quem pode fazer a vaga, quem está há mais tempo sem fazer vem primeiro.
  function candidatos({semana,vaga,pessoas,semanas=[],reunioes=[],funcoesReuniao}){
    return pessoas.filter(p=>podeVaga(p,vaga,semana,pessoas)).map(p=>({pessoa:p,ultima:ultimaVez(semanas,p.id,vaga.funcao,semana.data),avisos:conflitos({semana,pessoa:p,vaga,semanas,reunioes,pessoas,funcoesReuniao})}))
      .sort((a,b)=>{if(!a.ultima!==!b.ultima)return a.ultima?1:-1;if(a.ultima!==b.ultima)return a.ultima.localeCompare(b.ultima);return a.pessoa.nome.localeCompare(b.pessoa.nome,'pt-BR');});
  }

  // Preenche só as vagas vazias, sem repetir pessoas na mesma reunião e sem avisos.
  function sugerir({alvo,semanas=[],pessoas,reunioes=[],funcoesReuniao}){
    const historico=new Map(semanas.map(s=>[s.data,s]));
    return alvo.slice().sort((a,b)=>a.data.localeCompare(b.data)).map(original=>{
      if(original.semReuniao)return original;
      const s={...original,pessoas:{...(original.pessoas||{})}};
      vagas(s).forEach(v=>{
        if(s.pessoas[v.chave])return;
        if(v.funcao==='ajudante'&&!s.pessoas[v.de])return;
        historico.set(s.data,s);
        const lista=candidatos({semana:s,vaga:v,pessoas,semanas:[...historico.values()],reunioes,funcoesReuniao}).filter(c=>!idsDe(s).includes(c.pessoa.id));
        const escolha=lista.find(c=>!c.avisos.length);
        if(escolha)s.pessoas[v.chave]=escolha.pessoa.id;
      });
      historico.set(s.data,s);return s;
    });
  }

  // Ao importar de novo, mantém quem já estava designado nas partes que continuam iguais.
  function mesclarImportacao(nova,antiga){
    if(!antiga)return {...nova,pessoas:{}};
    const tipoAntes=new Map(vagas(antiga).map(v=>[v.chave,v.funcao])),pessoas={};
    vagas(nova).forEach(v=>{const id=antiga.pessoas?.[v.chave];if(id&&tipoAntes.get(v.chave)===v.funcao)pessoas[v.chave]=id;});
    return {...antiga,...nova,pessoas,semReuniao:!!antiga.semReuniao,motivo:antiga.motivo||''};
  }

  // Programa da reunião, linha por linha, com horários calculados (null quando não há horário de início).
  const horaValida=h=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(h||''));
  function programa(s,inicio){
    let t=horaValida(inicio)?Number(inicio.slice(0,2))*60+Number(inicio.slice(3)):null;
    const hora=()=>t==null?'':String(Math.floor(t/60)%24).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
    const passar=m=>{if(t!=null)t+=m;};
    const linhas=[],c=s.canticos||[];
    linhas.push({hora:hora(),texto:'Cântico '+(c[0]||'—'),vagas:[{chave:'oracao_inicial',rotulo:'Oração'}]});passar(5);
    linhas.push({hora:hora(),texto:'Comentários iniciais',min:1,vagas:[]});passar(1);
    let secao='';
    (s.partes||[]).forEach(p=>{
      if(p.secao!==secao){
        secao=p.secao;linhas.push({secao,titulo:SECOES[secao]||secao});
        if(secao==='vida'){linhas.push({hora:hora(),texto:'Cântico '+(c[1]||'—'),vagas:[]});passar(5);}
      }
      const vs=vagas({partes:[p]}).filter(v=>v.parte===p.n);
      const texto=p.secao==='ministerio'?p.n+'-'+p.titulo:p.titulo;
      linhas.push({hora:hora(),texto,min:p.min,parte:p.n,tipo:p.tipo,cenario:p.cenario||'',vagas:vs.map(v=>({chave:v.chave,rotulo:v.rotulo}))});
      passar(p.min+(['leitura','demonstracao','discurso'].includes(p.tipo)?1:0));
    });
    linhas.push({hora:hora(),texto:'Comentários finais',min:3,vagas:[]});passar(3);
    linhas.push({hora:hora(),texto:'Cântico '+(c[2]||'—'),vagas:[{chave:'oracao_final',rotulo:'Oração'}]});
    return linhas;
  }

  // Semanas cuja reunião cai no mês (ano, mes 1..12).
  const semanasDoMes=(semanas,ano,mes)=>semanas.filter(s=>s.data?.startsWith(ano+'-'+String(mes).padStart(2,'0'))).sort((a,b)=>a.data.localeCompare(b.data));

  const api={FUNCOES_VMC,ESTUDANTE,SECOES,sexoDe,fazEstudante,dataReuniao,vagas,nomeFuncao,designacoesDe,podeVaga,ultimaVez,conflitos,candidatos,sugerir,mesclarImportacao,programa,horaValida,semanasDoMes};
  raiz.Vmc=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
