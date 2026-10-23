// Quadro de anúncios: PDF vetorial A4, sem enviar a programação a terceiros.
document.getElementById('quadroMes').value=isoLocal(new Date()).slice(0,7);

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
      return {data:d,nome:r.semDiscurso?(r.motivo||'Sem discurso nesta data'):(r.nome||'A definir'),congregacao:r.semDiscurso?'—':(r.congregacao||'—'),tema:r.semDiscurso?'—':(TL[r.temaNum]||r.tema||'A definir')};
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

function criarPdfQuadro(JsPDF,meses,congregacao){
  const pdf=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const vermelho='#9d2023',escuro='#293234',colunas=[12,34,84,132],larguras=[22,50,48,66];
  const mesNome=d=>d.toLocaleDateString('pt-BR',{month:'long'}).toLocaleUpperCase('pt-BR');
  const primeiro=meses[0].data,ultimo=meses[meses.length-1].data;
  const periodo=meses.length===1?mesNome(primeiro)+' '+primeiro.getFullYear():primeiro.getFullYear()===ultimo.getFullYear()?mesNome(primeiro)+' – '+mesNome(ultimo)+' '+ultimo.getFullYear():mesNome(primeiro)+' '+primeiro.getFullYear()+' – '+mesNome(ultimo)+' '+ultimo.getFullYear();
  let y;
  function cabecalho(){
    pdf.setFillColor(vermelho);pdf.rect(0,0,210,29,'F');
    pdf.setFont('helvetica','bold');pdf.setFontSize(22);pdf.setTextColor('#ffffff');pdf.text('PROGRAMAÇÃO DE ORADORES',105,14,{align:'center'});
    pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.text(periodo,105,23,{align:'center'});
    pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.setTextColor(escuro);
    const nome=pdf.splitTextToSize(congregacao,178);
    const alturaNome=Math.max(14,6+nome.length*5);
    pdf.setFillColor('#ededed');pdf.roundedRect(12,33,186,alturaNome,2,2,'F');
    pdf.text(nome,16,41);y=37+alturaNome;
  }
  function tituloMes(m,continuacao=false){
    pdf.setFillColor(vermelho);pdf.roundedRect(12,y,186,10,2,2,'F');pdf.setTextColor('#ffffff');pdf.setFont('helvetica','bold');pdf.setFontSize(15);
    pdf.text(mesNome(m.data)+' '+m.data.getFullYear()+(continuacao?' (continuação)':''),16,y+7);y+=11;
    pdf.setFillColor(escuro);pdf.roundedRect(12,y,186,9,1,1,'F');pdf.setFontSize(9);
    ['DATA','ORADOR','CONGREGAÇÃO','TEMA'].forEach((t,i)=>pdf.text(t,colunas[i]+3,y+6));y+=10;
  }
  // Ajusta a densidade para manter até três meses usuais em uma folha.
  const total=meses.reduce((n,m)=>n+m.linhas.length,0),fonte=meses.length===3||total>13?9:10,passo=fonte*.43;
  const alturaBase=Math.min(23,(232-meses.length*25)/Math.max(total,1));
  cabecalho();
  meses.forEach(m=>{
    if(y+40>284){pdf.addPage();cabecalho();}
    tituloMes(m);
    m.linhas.forEach(r=>{
      pdf.setFontSize(fonte);
      const textos=[r.nome,r.congregacao,r.tema].map((t,i)=>{pdf.setFont('helvetica',i===0?'bold':'normal');return pdf.splitTextToSize(String(t),larguras[i+1]-6);});
      const altura=Math.max(alturaBase,Math.max(...textos.map(t=>t.length))*passo+4,12);
      if(y+altura>284){pdf.addPage();cabecalho();tituloMes(m,true);}
      pdf.setFillColor('#f3f3f3');pdf.roundedRect(12,y,186,altura-1,2,2,'F');
      pdf.setFillColor('#f3e7e7');pdf.roundedRect(12,y,21,altura-1,2,2,'F');
      pdf.setTextColor(vermelho);pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.text(r.data.slice(8,10),22.5,y+6,{align:'center'});
      pdf.setTextColor(escuro);pdf.setFontSize(8);pdf.text(mesNome(m.data).slice(0,3),22.5,y+10,{align:'center'});
      textos.forEach((linhas,i)=>{
        pdf.setFont('helvetica',i===0?'bold':'normal');pdf.setFontSize(fonte);pdf.setTextColor(escuro);
        pdf.text(linhas,colunas[i+1]+3,y+(altura-linhas.length*passo)/2+passo*.8,{lineHeightFactor:1.22});
      });y+=altura;
    });y+=4;
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
    const JsPDF=await carregarBibliotecaQuadro();
    criarPdfQuadro(JsPDF,meses,congregacao).save('quadro-de-anuncios-'+inicio+'-'+quantidade+'-meses.pdf');
    toast('PDF do quadro de anúncios gerado!');
  }catch(error){toast(error.message||'Não foi possível gerar o PDF.',6000);}
  finally{botao.disabled=false;botao.innerHTML='<i data-lucide="file-down"></i> Baixar PDF';if(window.lucide)lucide.createIcons();}
}
