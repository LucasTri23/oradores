// ARQUIVOS DO DISCURSO DA SEMANA (.jwpub / .jwlplaylist)
// Aparecem só no cartão do discurso da semana atual (de segunda até o dia do discurso).
// Quem edita o Oradores envia e remove; quem só vê apenas baixa.
// Ficam só no Storage (bucket "oradores"): <congregação>/discursos/<AAAA-MM-DD>/<id>-<nome>.
// Quando a semana passa, são apagados (o banco permite que qualquer integrante apague arquivos vencidos).
const ARQ_BUCKET='oradores',ARQ_EXTENSOES=['jwpub','jwlplaylist'],ARQ_MAX=50*1024*1024;

const ArquivosDiscurso=(function(){
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  function segundaDe(data){const d=new Date(data+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d);}
  // Liberado de segunda-feira da semana do discurso até o dia do discurso.
  function naSemana(data,hoje=iso(new Date())){return !!data&&hoje>=segundaDe(data)&&hoje<=data;}
  // Vencido: a data do discurso é de uma semana que já terminou.
  function vencido(data,hoje=iso(new Date())){return /^\d{4}-\d{2}-\d{2}$/.test(data)&&data<segundaDe(hoje);}
  function extensao(nome){const m=/\.([a-z0-9]+)$/i.exec(String(nome||''));return m?m[1].toLowerCase():'';}
  function validar(arquivo){
    if(!arquivo)return 'Escolha um arquivo.';
    if(!ARQ_EXTENSOES.includes(extensao(arquivo.name)))return 'Envie só arquivos .jwpub ou .jwlplaylist.';
    if(!arquivo.size)return 'O arquivo está vazio.';
    if(arquivo.size>ARQ_MAX)return 'O arquivo passa de 50 MB.';
    return '';
  }
  // Nome seguro para o Storage; o prefixo evita sobrescrever arquivos com o mesmo nome.
  const nomeSeguro=nome=>String(nome).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+/,'').slice(-90);
  const nomeExibido=objeto=>objeto.replace(/^[a-z0-9]+-/,'');
  const tamanho=b=>b>=1048576?(b/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(b/1024))+' KB';
  const podeEditar=()=>!window.SOMENTE_LEITURA;
  const pasta=data=>activeWorkspaceId+'/discursos/'+data;
  const storage=()=>supabase.storage.from(ARQ_BUCKET);
  const erroAmigavel=m=>/bucket not found/i.test(m||'')?'O envio de arquivos ainda não foi ativado no banco (falta rodar o SQL).':m;

  async function listar(data){
    const{data:itens,error}=await storage().list(pasta(data),{limit:50,sortBy:{column:'name',order:'asc'}});
    if(error)throw new Error(erroAmigavel(error.message));
    return (itens||[]).filter(i=>i.id&&ARQ_EXTENSOES.includes(extensao(i.name)))
      .map(i=>({caminho:pasta(data)+'/'+i.name,nome:nomeExibido(i.name),tamanho:i.metadata?.size||0}));
  }
  async function enviar(data,arquivo){
    const erro=validar(arquivo);if(erro)throw new Error(erro);
    const caminho=pasta(data)+'/'+Date.now().toString(36)+'-'+nomeSeguro(arquivo.name);
    const{error}=await storage().upload(caminho,arquivo,{contentType:'application/octet-stream',upsert:false});
    if(error)throw new Error(erroAmigavel(error.message));
  }
  async function remover(caminho){const{error}=await storage().remove([caminho]);if(error)throw new Error(error.message);}
  async function baixar(a){
    const{data:blob,error}=await storage().download(a.caminho);
    if(error)throw new Error(error.message);
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=a.nome;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }

  // Caixa dentro do cartão do discurso da semana.
  function montar(cartao,data){
    const box=document.createElement('div');box.className='discurso-arquivo';
    const titulo=document.createElement('div');titulo.className='discurso-arquivo-titulo';
    titulo.innerHTML='<i data-lucide="paperclip"></i><span>Arquivos do discurso</span>';
    const lista=document.createElement('div');lista.className='discurso-arquivo-lista';lista.textContent='Carregando…';
    box.append(titulo,lista);
    if(podeEditar()){
      const input=document.createElement('input');input.type='file';input.accept='.jwpub,.jwlplaylist';input.hidden=true;
      const rotulo='<i data-lucide="upload"></i> Adicionar .jwpub ou .jwlplaylist';
      const add=document.createElement('button');add.type='button';add.className='btn bo bs';add.innerHTML=rotulo;
      add.onclick=()=>input.click();
      input.onchange=async()=>{
        const arquivo=input.files[0];input.value='';if(!arquivo)return;
        const erro=validar(arquivo);if(erro)return toast(erro,4500);
        add.disabled=true;add.textContent='Enviando…';
        try{await enviar(data,arquivo);toast('✓ Arquivo enviado. Quem tem acesso já pode baixar.',4000);}
        catch(e){toast('Não foi possível enviar: '+e.message,6000);}
        finally{add.disabled=false;add.innerHTML=rotulo;if(window.lucide)lucide.createIcons();atualizar();}
      };
      const hint=document.createElement('small');hint.className='discurso-arquivo-hint';hint.textContent='Fica disponível só nesta semana e é apagado depois. Até 50 MB por arquivo.';
      box.append(add,input,hint);
    }
    async function atualizar(){
      try{
        const arquivos=await listar(data);lista.replaceChildren();
        if(!arquivos.length){const v=document.createElement('small');v.className='discurso-arquivo-vazio';v.textContent=podeEditar()?'Nenhum arquivo ainda.':'Nenhum arquivo enviado para este discurso.';lista.appendChild(v);return;}
        arquivos.forEach(a=>{
          const row=document.createElement('div');row.className='discurso-arquivo-item';
          const info=document.createElement('span');const n=document.createElement('strong');n.textContent=a.nome;const t=document.createElement('small');t.textContent=extensao(a.nome).toUpperCase()+(a.tamanho?' · '+tamanho(a.tamanho):'');info.append(n,t);
          const baixarBtn=document.createElement('button');baixarBtn.type='button';baixarBtn.className='btn bp bs';baixarBtn.innerHTML='<i data-lucide="download"></i> Baixar';
          baixarBtn.onclick=async()=>{baixarBtn.disabled=true;try{await baixar(a);}catch(err){toast('Não foi possível baixar: '+err.message,6000);}finally{baixarBtn.disabled=false;}};
          row.append(info,baixarBtn);
          if(podeEditar()){
            const rm=document.createElement('button');rm.type='button';rm.className='btn bo bs';rm.title='Remover arquivo';rm.setAttribute('aria-label','Remover '+a.nome);rm.innerHTML='<i data-lucide="trash-2"></i>';
            rm.onclick=async()=>{if(!confirm('Remover "'+a.nome+'"?'))return;rm.disabled=true;try{await remover(a.caminho);toast('Arquivo removido.');}catch(err){toast('Não foi possível remover: '+err.message,6000);}atualizar();};
            row.appendChild(rm);
          }
          lista.appendChild(row);
        });
        if(window.lucide)lucide.createIcons();
      }catch(e){lista.textContent=e.message.includes('SQL')?e.message:'Não foi possível carregar os arquivos.';}
    }
    // Cliques aqui dentro não abrem a edição do cartão.
    box.addEventListener('click',e=>e.stopPropagation());
    cartao.appendChild(box);atualizar();
    if(window.lucide)lucide.createIcons();
  }

  // Apaga do banco os arquivos de semanas que já passaram. Roda ao abrir o Oradores, para qualquer integrante.
  async function limparAntigos(){
    if(!supabase||!activeWorkspaceId)return;
    try{
      const{data:pastas,error}=await storage().list(activeWorkspaceId+'/discursos',{limit:500});
      if(error)return;
      for(const p of pastas||[]){
        if(p.id||!vencido(p.name))continue; // só pastas (datas) vencidas
        const{data:itens}=await storage().list(pasta(p.name),{limit:100});
        const caminhos=(itens||[]).filter(i=>i.id).map(i=>pasta(p.name)+'/'+i.name);
        if(caminhos.length)await storage().remove(caminhos);
      }
    }catch(e){}
  }

  return {naSemana,vencido,segundaDe,extensao,validar,nomeSeguro,nomeExibido,montar,limparAntigos};
})();
if(typeof window!=='undefined')window.ArquivosDiscurso=ArquivosDiscurso;
if(typeof module!=='undefined')module.exports=ArquivosDiscurso;
