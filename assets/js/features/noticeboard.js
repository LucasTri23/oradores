// Quadro de anúncios: PDF vetorial A4, sem enviar a programação a terceiros.
document.getElementById('quadroMes').value=isoLocal(new Date()).slice(0,7);
const responsaveisQuadro=new Map();
['quadroMes','quadroQuantidade'].forEach(id=>document.getElementById(id).addEventListener('change',renderResponsaveisQuadro));

function renderResponsaveisQuadro(){
  const painel=document.getElementById('quadroResponsaveis');
  painel.hidden=!document.getElementById('quadroIncluirResponsaveis').checked;
  painel.replaceChildren();if(painel.hidden)return;
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
          input.type='text';input.maxLength=120;input.placeholder='Nome completo';input.value=responsaveisQuadro.get(r.data)?.[chave]||'';
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
    script.src='assets/js/vendor/jspdf.umd.min.js?v=2.5.2';
    script.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(new Error('Biblioteca de PDF indisponível.'));
    script.onerror=()=>{script.remove();reject(new Error('Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.'));};
    document.head.appendChild(script);
  }).catch(error=>{bibliotecaQuadroPromise=null;throw error;});
  return bibliotecaQuadroPromise;
}

function criarPdfQuadro(JsPDF,meses,congregacao,incluirResponsaveis=false){
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

async function baixarQuadroAnuncios(){
  const botao=document.getElementById('quadroBaixar');
  try{
    const inicio=document.getElementById('quadroMes').value,quantidade=Number(document.getElementById('quadroQuantidade').value);
    const meses=dadosQuadroAnuncios(inicio,quantidade),congregacao=String(cfg.cong||'').trim();
    if(!congregacao||congregacao==='Minha Congregação')throw new Error('Cadastre e salve o nome da congregação antes de baixar o PDF.');
    botao.disabled=true;botao.textContent='Gerando PDF…';
    const incluir=document.getElementById('quadroIncluirResponsaveis').checked;
    if(incluir)meses.forEach(m=>m.linhas.forEach(r=>Object.assign(r,responsaveisQuadro.get(r.data)||{})));
    const JsPDF=await carregarBibliotecaQuadro();
    criarPdfQuadro(JsPDF,meses,congregacao,incluir).save('quadro-de-anuncios-'+inicio+'-'+quantidade+'-meses.pdf');
    toast('PDF do quadro de anúncios gerado!');
  }catch(error){toast(error.message||'Não foi possível gerar o PDF.',6000);}
  finally{botao.disabled=false;botao.innerHTML='<i data-lucide="file-down"></i> Baixar PDF';if(window.lucide)lucide.createIcons();}
}
