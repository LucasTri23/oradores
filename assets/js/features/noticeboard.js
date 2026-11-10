// Quadro de anúncios: PDF vetorial A4, sem enviar a programação a terceiros.
document.getElementById('quadroMes').value=isoLocal(new Date()).slice(0,7);
const responsaveisQuadro=new Map();
['quadroMes','quadroQuantidade'].forEach(id=>document.getElementById(id).addEventListener('change',renderResponsaveisQuadro));

// Presidente e leitor vindos do módulo Designações (data → {presidente, leitor}). Só carrega para quem tem acesso.
let responsaveisDesignacoes=null;
async function carregarResponsaveisDesignacoes(){
  if(responsaveisDesignacoes||typeof FF==='undefined'||!db)return;
  try{
    const[rs,ps,central]=await Promise.all([FF.gets(FF.col(db,'desig_reunioes')),FF.gets(FF.col(db,'desig_pessoas')),FF.gets(FF.col(db,'cong_pessoas')).catch(()=>({docs:[]}))]);
    // Nomes da lista única da congregação (com os cadastros antigos das Designações como reserva).
    const nomes=new Map(ps.docs.map(d=>[d.id,d.data().nome]).filter(([,n])=>n));
    central.docs.forEach(d=>nomes.set(d.id,d.data().nome));
    const mapa={};
    rs.docs.forEach(d=>{const r=d.data();if(!r?.data||r.semReuniao)return;
      const juntar=f=>(r.pessoas?.[f]||[]).map(id=>nomes.get(id)).filter(Boolean).join(', ');
      mapa[r.data]={presidente:juntar('presidente'),leitor:juntar('leitor')};});
    responsaveisDesignacoes=mapa;
  }catch(error){responsaveisDesignacoes={};}
}
const responsavelQuadro=(data,chave)=>responsaveisQuadro.get(data)?.[chave]??responsaveisDesignacoes?.[data]?.[chave]??'';

function renderResponsaveisQuadro(){
  const painel=document.getElementById('quadroResponsaveis');
  painel.hidden=conteudoQuadroAtual()!=='oradores'||!document.getElementById('quadroIncluirResponsaveis').checked;
  painel.replaceChildren();if(painel.hidden)return;
  if(!responsaveisDesignacoes&&typeof FF!=='undefined'&&db){carregarResponsaveisDesignacoes().then(renderResponsaveisQuadro);return;}
  try{
    const meses=dadosQuadroAnuncios(document.getElementById('quadroMes').value,Number(document.getElementById('quadroQuantidade').value));
    meses.forEach(m=>{
      const titulo=document.createElement('h3');titulo.textContent=m.data.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});painel.appendChild(titulo);
      m.linhas.forEach(r=>{
        const grupo=document.createElement('fieldset');grupo.style.cssText='border:1px solid var(--border);border-radius:8px;padding:12px;margin:12px 0';
        const legenda=document.createElement('legend');legenda.textContent=fD(r.data)+' · '+r.nome;grupo.appendChild(legenda);
        const campos=document.createElement('div');campos.className='g2';
        ['presidente','leitor'].forEach(chave=>{
          const campo=document.createElement('div');campo.className='field';
          const label=document.createElement('label'),input=document.createElement('input');
          input.id='quadro-'+chave+'-'+r.data;label.htmlFor=input.id;label.textContent=chave==='presidente'?'Presidente':'Leitor de A Sentinela';
          input.type='text';input.maxLength=120;input.placeholder='Nome completo';input.value=responsavelQuadro(r.data,chave);
          input.addEventListener('input',()=>responsaveisQuadro.set(r.data,{...responsaveisQuadro.get(r.data),[chave]:input.value}));
          campo.append(label,input);campos.appendChild(campo);
        });grupo.appendChild(campos);painel.appendChild(grupo);
      });
    });
  }catch(error){const aviso=document.createElement('p');aviso.textContent=error.message;painel.appendChild(aviso);}
}

function dadosQuadroAnuncios(inicio,quantidade){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(inicio)||![1,2,3].includes(quantidade))throw new Error('Escolha um mês inicial e um período de 1 a 3 meses.');
  const [ano,mes]=inicio.split('-').map(Number);
  if(ano<1900||ano>9998)throw new Error('Escolha um ano entre 1900 e 9998.');
  const porData=new Map();
  discursos.forEach(r=>{if(r.data)porData.set(r.data,r);});
  programa.forEach(r=>{if(r.data)porData.set(r.data,r);});
  return Array.from({length:quantidade},(_,i)=>{
    const data=new Date(ano,mes-1+i,1),chave=isoLocal(data).slice(0,7);
    const datas=new Set(allMeetingDays(data.getFullYear()).filter(d=>d.startsWith(chave)));
    // Inclui também reuniões que foram cadastradas em outro dia da semana.
    porData.forEach((r,d)=>{if(d.startsWith(chave))datas.add(d);});
    return {data,linhas:[...datas].sort().map(d=>{
      const r=completarDadosPrograma(porData.get(d)||{data:d});
      return {data:d,nome:r.semDiscurso?(r.motivo||'Sem discurso nesta data'):(r.nome||'A definir'),congregacao:r.semDiscurso?'—':(r.congregacao||'—'),tema:r.semDiscurso?'—':r.especial?(r.tema||r.especialTitulo||'Discurso especial'):(TL[r.temaNum]||r.tema||'A definir')};
    })};
  });
}

let bibliotecaQuadroPromise;
function carregarBibliotecaQuadro(){
  if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf.jsPDF);
  if(!bibliotecaQuadroPromise)bibliotecaQuadroPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='/assets/js/vendor/jspdf.umd.min.js?v=2.5.2';
    script.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(new Error('Biblioteca de PDF indisponível.'));
    script.onerror=()=>{script.remove();reject(new Error('Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.'));};
    document.head.appendChild(script);
  }).catch(error=>{bibliotecaQuadroPromise=null;throw error;});
  return bibliotecaQuadroPromise;
}

function criarPdfQuadro(JsPDF,meses,congregacao,incluirResponsaveis=false,modelo='cartoes'){
  if(modelo!=='cartoes')return criarPdfQuadroAlternativo(JsPDF,meses,congregacao,incluirResponsaveis,modelo);
  const pdf=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const tinta='#193e49',verde='#2a6770',borda='#d4e5e7',suave='#eef4f4';
  const nomeMes=d=>d.toLocaleDateString('pt-BR',{month:'long'});
  const escrever=(texto,x,y,tamanho=10,estilo='normal',cor=tinta,opcoes={})=>{
    pdf.setFont('helvetica',estilo);pdf.setFontSize(tamanho);pdf.setTextColor(cor);pdf.text(texto,x,y,opcoes);
  };
  let pagina=0;
  meses.forEach(m=>{
    const periodo=nomeMes(m.data)+' de '+m.data.getFullYear();
    let y;
    function abrirPagina(continuacao=false){
      if(pagina++)pdf.addPage();
      pdf.setFillColor(tinta);pdf.rect(0,0,210,61,'F');
      pdf.setFillColor('#9fd3d0');pdf.rect(16,15,13,3,'F');
      pdf.setFont('helvetica','normal');pdf.setFontSize(10);
      const nome=pdf.splitTextToSize('CONGREGAÇÃO '+congregacao.toLocaleUpperCase('pt-BR'),178);
      escrever(nome,16,27,10,'normal','#ffffff');
      const tituloY= Math.max(42,30+nome.length*4);
      escrever('Programação de Oradores',16,tituloY,22,'bold','#ffffff');
      escrever('Discursos públicos  ·  '+periodo,16,tituloY+9,10,'normal','#ffffff');
      pdf.setFillColor(verde);pdf.roundedRect(16,65,178,11,2,2,'F');
      const dias=[...new Set(m.linhas.map(r=>new Date(r.data+'T12:00:00').getDay()))];
      const dia=dias.length===1?(dias[0]===6?'SÁBADOS':dias[0]===0?'DOMINGOS':'REUNIÕES'):'REUNIÕES';
      escrever(dia+'  ·  '+nomeMes(m.data).toLocaleUpperCase('pt-BR')+' '+m.data.getFullYear()+(continuacao?' (continuação)':''),21,72,9,'bold','#ffffff');
      pdf.setDrawColor(borda);pdf.line(16,283,194,283);
      escrever(congregacao,16,288,8,'normal',verde);
      escrever(periodo,194,288,8,'normal',verde,{align:'right'});
      y=81;
    }
    abrirPagina();
    const alturaBase=Math.min(45,(279-81)/Math.max(m.linhas.length,1)-4);
    m.linhas.forEach(r=>{
      pdf.setFont('helvetica','bold');pdf.setFontSize(12);
      const nome=pdf.splitTextToSize(r.nome,134);
      pdf.setFont('helvetica','normal');pdf.setFontSize(9);
      const origem=pdf.splitTextToSize(r.congregacao,134),tema=pdf.splitTextToSize(r.tema,134);
      const conteudo=Math.max(25,9+nome.length*5+origem.length*4+6+tema.length*4);
      let presidente=[],leitor=[],extra=0;
      if(incluirResponsaveis){
        pdf.setFontSize(9);
        presidente=pdf.splitTextToSize(r.presidente||'A definir',80);
        leitor=pdf.splitTextToSize(r.leitor||'A definir',80);
        extra=10+Math.max(presidente.length,leitor.length)*4;
      }
      const altura=Math.max(alturaBase,conteudo+extra+4);
      if(y+altura>279&&y>81)abrirPagina(true);
      pdf.setDrawColor(borda);pdf.setLineWidth(.4);pdf.setFillColor('#ffffff');pdf.roundedRect(16,y,178,altura,4,4,'FD');
      pdf.setFillColor(suave);pdf.roundedRect(21,y+5,24,conteudo-6,3,3,'F');
      escrever(r.data.slice(8,10),33,y+17,22,'bold',verde,{align:'center'});
      escrever(nomeMes(m.data).slice(0,3).toLocaleUpperCase('pt-BR'),33,y+23,8,'bold',verde,{align:'center'});
      let linhaY=y+9;
      escrever(nome,51,linhaY,12,'bold');linhaY+=nome.length*5+1;
      escrever(origem,51,linhaY,9,'normal',verde);linhaY+=origem.length*4+2;
      escrever('TEMA DO DISCURSO',51,linhaY,7,'bold',verde);linhaY+=5;
      escrever(tema,51,linhaY,9);
      if(incluirResponsaveis){
        const separador=y+conteudo+1;
        pdf.setDrawColor(borda);pdf.line(21,separador,189,separador);
        escrever('PRESIDENTE',21,separador+5,7,'bold',verde);
        escrever('LEITOR DE A SENTINELA',106,separador+5,7,'bold',verde);
        escrever(presidente,21,separador+10,9);escrever(leitor,106,separador+10,9);
      }
      y+=altura+4;
    });
  });
  return pdf;
}

async function baixarQuadroAnuncios(enviar=false){
  const botao=document.getElementById(enviar?'quadroEnviar':'quadroBaixar');const textoBotao=botao.innerHTML;
  try{
    const inicio=document.getElementById('quadroMes').value,quantidade=Number(document.getElementById('quadroQuantidade').value);
    const meses=dadosQuadroAnuncios(inicio,quantidade),congregacao=String(cfg.cong||'').trim();
    if(!congregacao||congregacao==='Minha Congregação')throw new Error('Cadastre e salve o nome da congregação antes de baixar o PDF.');
    botao.disabled=true;botao.textContent='Gerando PDF…';
    const incluir=conteudoQuadroAtual()==='oradores'&&document.getElementById('quadroIncluirResponsaveis').checked;
    if(incluir){
      await carregarResponsaveisDesignacoes();
      meses.forEach(m=>m.linhas.forEach(r=>{r.presidente=responsavelQuadro(r.data,'presidente');r.leitor=responsavelQuadro(r.data,'leitor');}));
    }
    const JsPDF=await carregarBibliotecaQuadro();
    const pdf=await gerarPdfQuadroTela(JsPDF,meses,congregacao,incluir),nomeArq='quadro-'+conteudoQuadroAtual()+'-'+inicio+'-'+quantidade+'-meses.pdf';
    // Enviar: abre o compartilhamento do celular (WhatsApp…); no computador, baixa o arquivo.
    if(enviar&&window.DesignaUI){await DesignaUI.compartilharArquivo(pdf.output('blob'),nomeArq,'Quadro de anúncios — '+congregacao);return;}
    pdf.save(nomeArq);
    toast('PDF do quadro de anúncios gerado!');
  }catch(error){toast(error.message||'Não foi possível gerar o PDF.',6000);}
  finally{botao.disabled=false;botao.innerHTML=textoBotao;if(window.lucide)lucide.createIcons();}
}

function modeloQuadroAtual(){return document.querySelector('input[name="quadroModelo"]:checked')?.value||'cartoes';}

function criarPdfQuadroAlternativo(JsPDF,meses,congregacao,incluir,modelo,opcoes={}){
  const pdf=new JsPDF({unit:'mm',format:'a4'}),compacto=modelo==='compacto';
  const azul='#23486b',cinza='#536273',borda='#dce3ea';let pagina=0,y=0;
  const texto=(t,x,top,size=10,bold=false,cor='#172b3e')=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(cor);pdf.text(t,x,top);};
  const quebra=(t,w,size=10,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);return pdf.splitTextToSize(String(t||'A definir'),w);};
  meses.forEach(m=>{
    const periodo=m.data.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    function abrir(continuacao=false){
      if(pagina++)pdf.addPage();
      texto(congregacao,16,20,11,true,azul);
      texto(opcoes.titulo||'Programação de oradores',16,33,opcoes.imagem?18:compacto?20:23,true);
      if(opcoes.imagem)pdf.addImage(opcoes.imagem,'PNG',170,8,24,24);
      texto(periodo+(continuacao?' · continuação':''),16,43,11,false,cinza);
      pdf.setDrawColor(azul);pdf.setLineWidth(compacto?.4:1.3);pdf.line(16,49,194,49);
      texto('Quadro de anúncios · '+pagina,16,287,8,false,cinza);
      y=compacto?64:57;
      if(compacto){pdf.setFillColor('#edf2f7');pdf.rect(16,53,178,9,'F');texto('DATA',19,59,8,true);texto(opcoes.indicadores?'REUNIÃO':'ORADOR / CONGREGAÇÃO',40,59,8,true);texto(opcoes.indicadores?'FUNÇÕES E RESPONSÁVEIS':'TEMA',111,59,8,true);}
    }
    abrir();
    m.linhas.forEach(r=>{
      const nome=quebra(r.nome,compacto?65:144,compacto?10:14,true),origem=quebra(r.congregacao,compacto?65:144,9),tema=quebra(r.tema,compacto?80:144,10);
      const presidente=quebra('Presidente: '+(r.presidente||'A definir'),84,9),leitor=quebra('Leitor: '+(r.leitor||'A definir'),84,9);
      const principal=compacto?Math.max(nome.length*4.4+origem.length*4+4,tema.length*4.4+4):nome.length*5.7+origem.length*4+tema.length*4.4+12;
      const extra=incluir?Math.max(presidente.length,leitor.length)*4+7:0;
      const altura=Math.max(compacto?23:36,principal+extra+6);
      if(y+altura>278)abrir(true);
      texto(r.data.slice(8,10),compacto?19:17,y+(compacto?7:10),compacto?13:25,true,azul);
      if(compacto){
        texto(nome,40,y+6,10,true);texto(origem,40,y+8+nome.length*4.4,9,false,cinza);texto(tema,111,y+6,10);
      }else{
        let ty=y+7;texto(nome,50,ty,14,true);ty+=nome.length*5.7+1;texto(origem,50,ty,9,false,cinza);ty+=origem.length*4+4;texto(tema,50,ty,10);
      }
      if(incluir){const ty=y+principal+5;texto(presidente,18,ty,9);texto(leitor,108,ty,9);}
      pdf.setDrawColor(borda);pdf.setLineWidth(.25);pdf.line(16,y+altura,194,y+altura);y+=altura+(compacto?0:5);
    });
  });return pdf;
}

let previaQuadroUrl=null,previaQuadroVersao=0,previaQuadroTimer;
function agendarPreviaQuadro(){clearTimeout(previaQuadroTimer);previaQuadroTimer=setTimeout(atualizarPreviaQuadro,450);}
async function atualizarPreviaQuadro(){
  const frame=document.getElementById('quadroPreview');if(!frame)return;
  const status=document.getElementById('quadroPreviewStatus'),link=document.getElementById('quadroPreviewLink'),versao=++previaQuadroVersao;
  status.textContent='Gerando prévia…';frame.hidden=true;link.hidden=true;
  try{
    const meses=dadosQuadroAnuncios(document.getElementById('quadroMes').value,Number(document.getElementById('quadroQuantidade').value));
    const incluir=conteudoQuadroAtual()==='oradores'&&document.getElementById('quadroIncluirResponsaveis').checked;
    if(incluir){await carregarResponsaveisDesignacoes();meses.forEach(m=>m.linhas.forEach(r=>{r.presidente=responsavelQuadro(r.data,'presidente');r.leitor=responsavelQuadro(r.data,'leitor');}));}
    const JsPDF=await carregarBibliotecaQuadro();
    if(versao!==previaQuadroVersao)return;
    const pdf=await gerarPdfQuadroTela(JsPDF,meses,String(cfg.cong||'Congregação'),incluir);
    if(versao!==previaQuadroVersao)return;
    if(previaQuadroUrl)URL.revokeObjectURL(previaQuadroUrl);
    previaQuadroUrl=URL.createObjectURL(pdf.output('blob'));frame.src=previaQuadroUrl;link.href=previaQuadroUrl;
    frame.hidden=false;link.hidden=false;status.textContent=pdf.getNumberOfPages()+' página(s). Prévia com os mesmos dados e modelo do download.';
  }catch(error){if(versao===previaQuadroVersao)status.textContent=error.message||'Não foi possível gerar a prévia. Tente novamente.';}
}

const conteudoQuadroAtual=()=>document.getElementById('quadroConteudo')?.value||'oradores';
function alterarConteudoQuadro(){
  const conteudo=conteudoQuadroAtual(),completo=conteudo==='completo';
  const check=document.getElementById('quadroIncluirResponsaveis');
  check.closest('label').hidden=conteudo!=='oradores';
  document.getElementById('quadroResponsaveis').hidden=conteudo!=='oradores'||!check.checked;
  document.querySelectorAll('input[name="quadroModelo"]').forEach(input=>{input.disabled=completo&&input.value!=='word';});
  if(completo)document.querySelector('input[name="quadroModelo"][value="word"]').checked=true;
  document.getElementById('quadroConteudoHint').textContent=completo?'Reúne discursos, presidente/leitor, indicadores, microfones, áudio/vídeo e Zoom no modelo do Word.':conteudo==='indicadores'?'Usa as datas e os nomes cadastrados em Designações, incluindo meio e fim de semana.':'Usa a programação de discursos públicos.';
  agendarPreviaQuadro();
}

async function carregarDadosIndicadores(){
  if(!window.quadroAcesso?.designacoes)throw new Error('Sua conta não tem acesso às Designações.');
  const ler=async collection=>{
    const{data,error}=await supabase.from('app_records').select('id,data').eq('workspace_id',activeWorkspaceId).eq('collection',collection);
    if(error)throw new Error('Não foi possível carregar as designações. Tente novamente.');
    return (data||[]).map(r=>({...r.data,id:r.id}));
  };
  const[reunioes,pessoas,central,config]=await Promise.all([ler('desig_reunioes'),ler('desig_pessoas'),ler('cong_pessoas'),ler('desig_config')]);
  if(config.find(c=>c.id==='app')?.diaMeio==null){const hint=document.getElementById('quadroConteudoHint');if(hint)hint.textContent='O dia da reunião do meio de semana ainda não foi configurado. Defina-o em Configurações → Designações para incluir essas datas.';}
  const nomes=new Map(pessoas.map(p=>[p.id,p]));central.forEach(p=>nomes.set(p.id,{...nomes.get(p.id),...p}));
  return {reunioes,pessoas:[...nomes.values()],cfg:config.find(c=>c.id==='app')||{}};
}
let imagemQuadroPromise;
function carregarImagemQuadro(){
  if(!imagemQuadroPromise)imagemQuadroPromise=fetch('/assets/images/designa-mascote-v1.png').then(r=>{if(!r.ok)throw new Error('Não foi possível carregar a ilustração. Tente novamente ou escolha outro modelo.');return r.blob();}).then(blob=>new Promise((ok,erro)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=()=>erro(new Error('Não foi possível abrir a ilustração.'));reader.readAsDataURL(blob);})).catch(error=>{imagemQuadroPromise=null;throw error;});
  return imagemQuadroPromise;
}
async function gerarPdfQuadroTela(JsPDF,meses,congregacao,incluir){
  const conteudo=conteudoQuadroAtual(),modelo=modeloQuadroAtual(),designacoes=conteudo!=='oradores';
  if(!designacoes&&window.quadroAcesso?.oradores===false)throw new Error('Sua conta não tem acesso aos Oradores.');
  if(!designacoes&&!['word','ilustrado'].includes(modelo))return criarPdfQuadro(JsPDF,meses,congregacao,incluir,modelo);
  if(designacoes&&(!window.quadroAcesso?.designacoes||conteudo==='completo'&&!window.quadroAcesso?.oradores))throw new Error('Sua conta não tem acesso aos módulos deste quadro.');
  const dados=designacoes?await carregarDadosIndicadores():{cfg:{},reunioes:[],pessoas:[]};
  const porData=new Map([...discursos,...programa].map(r=>[r.data,r]));
  const tabelas=meses.map(m=>QuadroDados.montarMes({data:m.data,regras:Regras,...dados,cfgOradores:window.quadroAcesso?.oradores===false?null:cfg,programa:[...porData.values()],temas:TL,incluirDiscursos:conteudo!=='indicadores',incluirDesignacoes:designacoes}));
  if(!designacoes)tabelas.forEach((m,i)=>{m.discursos=meses[i].linhas.map(r=>({data:r.data.slice(8,10)+'/'+r.data.slice(5,7),nome:r.nome,cong:r.congregacao,tema:r.tema}));});
  if(!designacoes&&incluir)tabelas.forEach((m,i)=>{m.presidencia=meses[i].linhas.map(r=>({data:r.data.slice(8,10)+'/'+r.data.slice(5,7),presidente:r.presidente,leitor:r.leitor}));});
  if(modelo==='word'||conteudo==='completo')return PdfDesignacoes.criarPdfTabelas(JsPDF,tabelas,{congregacao,endereco:cfg.end||'',titulo:conteudo==='oradores'?'Programação de oradores':conteudo==='completo'?'Programação da congregação':'Programação de indicadores'});
  if(designacoes&&modelo==='cartoes')return PdfDesignacoes.criarPdfDesignacoes(JsPDF,tabelas,congregacao);
  const imagem=modelo==='ilustrado'?await carregarImagemQuadro():null;
  const linhas=designacoes?tabelas.map(m=>({data:m.data,linhas:m.reunioes.map(r=>({data:r.data,nome:r.tipo==='fim'?'Fim de semana':'Meio de semana',congregacao:r.semReuniao?'Evento da congregação':'Designações da reunião',tema:r.semReuniao?(r.motivo||'Não haverá reunião'):r.linhas.map(l=>l.funcao+': '+l.nomes.join(' / ')).join('\n')}))})):meses;
  return criarPdfQuadroAlternativo(JsPDF,linhas,congregacao,designacoes?false:incluir,modelo==='ilustrado'?'editorial':modelo,{imagem,indicadores:designacoes,titulo:designacoes?'Programação de indicadores':'Programação de oradores'});
}
if(typeof window!=='undefined'){
  document.getElementById('page-quadro')?.addEventListener('input',agendarPreviaQuadro);
  document.getElementById('page-quadro')?.addEventListener('change',agendarPreviaQuadro);
  window.addEventListener('beforeunload',()=>{if(previaQuadroUrl)URL.revokeObjectURL(previaQuadroUrl);});
}
