// Quadro de anúncios das Designações: PDF A4 no mesmo estilo do quadro do Oradores.
(function(raiz){
  let carregando=null;
  function carregarJsPDF(){
    if(raiz.jspdf?.jsPDF)return Promise.resolve(raiz.jspdf.jsPDF);
    if(!carregando)carregando=new Promise((ok,erro)=>{
      const s=document.createElement('script');s.src='/assets/js/vendor/jspdf.umd.min.js?v=2.5.2';
      s.onload=()=>raiz.jspdf?.jsPDF?ok(raiz.jspdf.jsPDF):erro(new Error('Biblioteca de PDF indisponível.'));
      s.onerror=()=>{s.remove();erro(new Error('Não foi possível carregar o gerador de PDF. Verifique sua conexão.'));};
      document.head.appendChild(s);
    }).catch(e=>{carregando=null;throw e;});
    return carregando;
  }

  // meses: [{data:Date, reunioes:[{data,tipo,semReuniao,motivo,linhas:[{funcao,nomes:[...]}]}]}]
  function criarPdfDesignacoes(JsPDF,meses,congregacao){
    const pdf=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const tinta='#193e49',verde='#2a6770',borda='#d4e5e7',suave='#eef4f4';
    const nomeMes=d=>d.toLocaleDateString('pt-BR',{month:'long'});
    const DIAS=['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
    const escrever=(t,x,y,tam=10,estilo='normal',cor=tinta,op={})=>{pdf.setFont('helvetica',estilo);pdf.setFontSize(tam);pdf.setTextColor(cor);pdf.text(t,x,y,op);};
    let pagina=0;
    meses.forEach(m=>{
      const periodo=nomeMes(m.data)+' de '+m.data.getFullYear();
      let y;
      function abrir(continuacao=false){
        if(pagina++)pdf.addPage();
        pdf.setFillColor(tinta);pdf.rect(0,0,210,52,'F');
        pdf.setFillColor('#9fd3d0');pdf.rect(16,13,13,3,'F');
        const nome=pdf.splitTextToSize('CONGREGAÇÃO '+String(congregacao).toLocaleUpperCase('pt-BR'),178);
        escrever(nome,16,24,10,'normal','#ffffff');
        const ty=Math.max(37,27+nome.length*4);
        escrever('Designações',16,ty,22,'bold','#ffffff');
        escrever('Reuniões da congregação  ·  '+periodo+(continuacao?' (continuação)':''),16,ty+8,10,'normal','#ffffff');
        pdf.setDrawColor(borda);pdf.line(16,283,194,283);
        escrever(congregacao,16,288,8,'normal',verde);
        escrever(periodo,194,288,8,'normal',verde,{align:'right'});
        y=60;
      }
      abrir();
      m.reunioes.forEach(r=>{
        pdf.setFontSize(9);
        const linhas=r.semReuniao?[]:r.linhas.map(l=>({titulo:l.funcao.toLocaleUpperCase('pt-BR'),texto:pdf.splitTextToSize(l.nomes.length?l.nomes.join(', '):'A definir',112)}));
        const corpo=r.semReuniao?10:linhas.reduce((s,l)=>s+Math.max(1,l.texto.length)*4.2+2.6,0);
        const altura=Math.max(26,corpo+14);
        if(y+altura>279&&y>60)abrir(true);
        pdf.setDrawColor(borda);pdf.setLineWidth(.4);pdf.setFillColor('#ffffff');pdf.roundedRect(16,y,178,altura,4,4,'FD');
        pdf.setFillColor(suave);pdf.roundedRect(21,y+5,24,22,3,3,'F');
        const dt=new Date(r.data+'T12:00:00');
        escrever(r.data.slice(8,10),33,y+16,20,'bold',verde,{align:'center'});
        escrever(DIAS[dt.getDay()],33,y+23,8,'bold',verde,{align:'center'});
        escrever(r.tipo==='fim'?'REUNIÃO DO FIM DE SEMANA':'REUNIÃO DO MEIO DE SEMANA',51,y+9,8,'bold',verde);
        let ly=y+15;
        if(r.semReuniao){escrever(r.motivo||'Não haverá reunião nesta data',51,ly,10,'bold');}
        else linhas.forEach(l=>{
          escrever(l.titulo,51,ly,7,'bold',verde);
          escrever(l.texto,82,ly,9.5,'normal');
          ly+=Math.max(1,l.texto.length)*4.2+2.6;
        });
        y+=altura+4;
      });
      if(!m.reunioes.length)escrever('Nenhuma reunião neste mês.',16,70,11);
    });
    return pdf;
  }

  // ── Modelo "Tabelas": programação completa do mês (igual ao modelo em Word) ──
  // mes: {data:Date, discursos:[{data,nome,cong,tema}|{data,mesclado}]|null,
  //       presidencia:[{data,presidente,leitor}|{data,mesclado}]|null,
  //       fim:{grupos:[{titulo,vagas:[rotulo]}],linhas:[{data,valores:[]}|{data,mesclado}]}|null, meio:(igual)|null,
  //       zoom:[{rotulo,nomes}]|null}
  function criarPdfTabelas(JsPDF,meses,{congregacao,endereco='',titulo='Programação de indicadores'}){
    const pdf=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const COR={titulo:'#595959',azul:'#4f81bd',vermelho:'#943634',dourado:'#c99700',zebra:'#d9d9d9',borda:'#8c8c8c',texto:'#1a1a1a'};
    const X=16,L=178,UP=s=>String(s??'').toLocaleUpperCase('pt-BR');
    let y=0;
    const txt=(t,x,yy,tam,estilo,cor,op={})=>{pdf.setFont('helvetica',estilo);pdf.setFontSize(tam);pdf.setTextColor(cor);pdf.text(t,x,yy,op);};

    function cabecalhoPagina(m){
      txt(UP('Congregação '+congregacao),105,18,15,'normal',COR.azul,{align:'center'});
      pdf.setDrawColor(COR.azul);pdf.setLineWidth(.5);pdf.line(30,20.5,180,20.5);
      txt(UP(titulo+' - '+m.data.toLocaleDateString('pt-BR',{month:'long'})+'/'+m.data.getFullYear()),105,32,15,'bold','#000000',{align:'center'});
      if(endereco){pdf.setDrawColor(COR.azul);pdf.setLineWidth(.2);pdf.line(30,284,180,284);txt(endereco,105,289,8,'normal',COR.azul,{align:'center'});}
      y=40;
    }
    // Desenha uma célula com texto centralizado (quebra linhas se precisar).
    function celula(x,yy,w,h,texto,{fundo=null,cor=COR.texto,negrito=false,tam=8.5}={}){
      if(fundo){pdf.setFillColor(fundo);pdf.rect(x,yy,w,h,'F');}
      pdf.setDrawColor(COR.borda);pdf.setLineWidth(.2);pdf.rect(x,yy,w,h);
      pdf.setFont('helvetica',negrito?'bold':'normal');pdf.setFontSize(tam);
      const linhas=pdf.splitTextToSize(UP(texto),w-3);
      const alt=linhas.length*tam*.36;
      pdf.setTextColor(cor);pdf.text(linhas,x+w/2,yy+h/2-alt/2+tam*.3,{align:'center'});
    }
    const alturaLinha=(valores,larguras,tam=8.5)=>{pdf.setFontSize(tam);return Math.max(7,...valores.map((v,i)=>pdf.splitTextToSize(UP(v),larguras[i]-3).length*tam*.36+3.5));};

    // tabela = {titulo, cor, larguras, cabecalho:[[{texto,span}]], linhas:[{valores:[...]}|{data,mesclado}]}
    function tabela(t,m){
      const linhas=t.linhas.map(l=>{
        const vals=l.mesclado!=null?[l.data,l.mesclado]:l.valores;
        const largs=l.mesclado!=null?[t.larguras[0],L-t.larguras[0]]:t.larguras;
        return {vals,largs,h:alturaLinha(vals,largs)};
      });
      const total=7+t.cabecalho.length*6.5+linhas.reduce((s,l)=>s+l.h,0);
      if(y+total>280&&y>40){pdf.addPage();cabecalhoPagina(m);}
      celula(X,y,L,7,t.titulo,{fundo:COR.titulo,cor:'#ffffff',negrito:true,tam:9.5});y+=7;
      t.cabecalho.forEach(linha=>{
        let x=X;
        linha.forEach(c=>{
          const w=t.larguras.slice(c.col,c.col+(c.span||1)).reduce((a,b)=>a+b,0);
          celula(x,y-(c.rowspan?0:0),w,6.5*(c.rowspan||1),c.texto,{fundo:t.cor,cor:'#ffffff',negrito:true,tam:9});
          x+=w;
        });
        y+=6.5;
      });
      linhas.forEach((l,i)=>{
        let x=X;const fundo=i%2===0?COR.zebra:'#ffffff';
        l.vals.forEach((v,j)=>{celula(x,y,l.largs[j],l.h,v,{fundo,negrito:j===0&&!t.semColunaData});x+=l.largs[j];});
        y+=l.h;
      });
      y+=7;
    }
    // Cabeçalho em duas linhas (grupo em cima, vagas embaixo) com "DATA" ocupando as duas.
    function cabecalhoGrupos(grupos){
      const l1=[{texto:'Data',col:0,rowspan:2}],l2=[];let col=1;
      grupos.forEach(g=>{l1.push({texto:g.titulo,col,span:g.vagas.length});g.vagas.forEach(v=>{l2.push({texto:v,col});col++;});});
      return [l1,l2];
    }

    meses.forEach((m,idx)=>{
      if(idx)pdf.addPage();
      cabecalhoPagina(m);
      if(m.discursos)tabela({titulo:'Discursos públicos',cor:COR.azul,larguras:[22,36,48,72],
        cabecalho:[[{texto:'Data',col:0},{texto:'Orador',col:1},{texto:'Congregação',col:2},{texto:'Tema',col:3}]],
        linhas:m.discursos.map(d=>d.mesclado!=null?d:{valores:[d.data,d.nome,d.cong,d.tema]})},m);
      if(m.presidencia)tabela({titulo:'Programação - final de semana',cor:COR.titulo,larguras:[22,78,78],
        cabecalho:[[{texto:'Data',col:0},{texto:'Presidente',col:1},{texto:'Leitor – A Sentinela',col:2}]],
        linhas:m.presidencia.map(d=>d.mesclado!=null?d:{valores:[d.data,d.presidente||'-',d.leitor||'-']})},m);
      [['fim','Programação - final de semana',COR.vermelho],['meio','Programação - meio de semana',COR.dourado]].forEach(([k,titulo,cor])=>{
        const g=m[k];if(!g||!g.grupos.length)return;
        const vagas=g.grupos.reduce((s,x)=>s+x.vagas.length,0);
        const larguras=[22,...Array(vagas).fill((L-22)/vagas)];
        // Desenha o "DATA" de duas linhas: célula alta + linha de cima só com os grupos.
        const cab=cabecalhoGrupos(g.grupos);
        const t={titulo,cor,larguras,cabecalho:[],linhas:g.linhas.map(l=>l.mesclado!=null?l:{valores:[l.data,...l.valores]})};
        const linhas=t.linhas.map(l=>{const vals=l.mesclado!=null?[l.data,l.mesclado]:l.valores;const largs=l.mesclado!=null?[22,L-22]:larguras;return alturaLinha(vals,largs);});
        if(y+7+13+linhas.reduce((a,b)=>a+b,0)>280&&y>40){pdf.addPage();cabecalhoPagina(m);}
        celula(X,y,L,7,titulo,{fundo:COR.titulo,cor:'#ffffff',negrito:true,tam:9.5});y+=7;
        celula(X,y,22,13,'Data',{fundo:cor,cor:'#ffffff',negrito:true,tam:9});
        let x=X+22;cab[0].slice(1).forEach(c=>{const w=larguras.slice(c.col,c.col+c.span).reduce((a,b)=>a+b,0);celula(x,y,w,6.5,c.texto,{fundo:cor,cor:'#ffffff',negrito:true,tam:9});x+=w;});
        x=X+22;cab[1].forEach(c=>{celula(x,y+6.5,larguras[c.col],6.5,c.texto,{fundo:cor,cor:'#ffffff',negrito:true,tam:8.5});x+=larguras[c.col];});
        y+=13;
        t.linhas.forEach((l,i)=>{
          const vals=l.mesclado!=null?[l.data,l.mesclado]:l.valores;const largs=l.mesclado!=null?[22,L-22]:larguras;const h=linhas[i];
          let xx=X;const fundo=i%2===0?COR.zebra:'#ffffff';
          vals.forEach((v,j)=>{celula(xx,y,largs[j],h,v,{fundo,negrito:j===0});xx+=largs[j];});y+=h;
        });
        y+=7;
      });
      if(m.zoom&&m.zoom.length){
        const w=L/m.zoom.length;
        tabela({titulo:'Indicadores do Zoom - semanal',cor:COR.azul,semColunaData:true,larguras:Array(m.zoom.length).fill(w),
          cabecalho:[m.zoom.map((z,i)=>({texto:z.rotulo,col:i}))],linhas:[{valores:m.zoom.map(z=>z.nomes||'-')}]},m);
      }
    });
    return pdf;
  }

  raiz.PdfDesignacoes={carregarJsPDF,criarPdfDesignacoes,criarPdfTabelas};
  if(typeof module!=='undefined')module.exports=raiz.PdfDesignacoes;
})(typeof window!=='undefined'?window:globalThis);
