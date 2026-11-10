// Quadro de anúncios das Designações: PDF A4 no mesmo estilo do quadro do Oradores.
(function(raiz){
  const Paleta=raiz.PdfPaleta||(typeof require==='function'?require('../assets/shared/pdf-paleta.js'):null);
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
  function criarPdfDesignacoes(JsPDF,meses,congregacao,cores={}){
    const pdf=new JsPDF({unit:'mm',format:'a4'}),p=Paleta.criar('cartoes',cores);
    const txt=(t,x,y,size=9,bold=false,cor=p.texto,op={})=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(cor);pdf.text(t,x,y,op);};
    let pagina=0;
    meses.forEach(m=>{
      const periodo=m.data.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).toLocaleUpperCase('pt-BR');let y;
      const abrir=(continuacao=false)=>{
        if(pagina++)pdf.addPage();
        pdf.setFillColor(p.principal);pdf.rect(0,0,210,43,'F');pdf.setFillColor(p.destaque);pdf.rect(0,0,3,43,'F');
        txt('CONGREGAÇÃO '+congregacao.toLocaleUpperCase('pt-BR'),13,14,9,false,Paleta.contraste(p.principal));
        txt('Programação de designações',13,27,19,true,Paleta.contraste(p.principal));
        txt('Áudio e vídeo  ·  Microfones  ·  Indicadores',13,36,8,false,Paleta.contraste(p.principal));
        pdf.setFillColor(p.destaque);pdf.roundedRect(156,16,41,12,2,2,'F');txt(periodo,176.5,23,8,true,Paleta.contraste(p.destaque),{align:'center'});
        txt('ESCALA DE REUNIÕES'+(continuacao?' · continuação':''),13,53,10,true);
        txt('Designações organizadas por data e função',13,59,8);
        pdf.setDrawColor(p.apoio);pdf.line(13,282,197,282);txt(congregacao,13,288,8,true);txt(periodo,197,288,8,false,p.texto,{align:'right'});y=65;
      };
      abrir();
      m.reunioes.forEach(r=>{
        // Três funções por faixa, preservando funções extras e nomes longos.
        const ordem=['Áudio e vídeo','Microfones','Indicadores'];
        const funcoes=[...(r.linhas||[])].sort((a,b)=>{const ai=ordem.indexOf(a.funcao),bi=ordem.indexOf(b.funcao);return (ai<0?9:ai)-(bi<0?9:bi);});
        const faixas=[];
        for(let i=0;i<funcoes.length;i+=3){
          const cells=funcoes.slice(i,i+3).map(l=>{pdf.setFont('helvetica','normal');pdf.setFontSize(8);return {titulo:l.funcao.toLocaleUpperCase('pt-BR'),nomes:pdf.splitTextToSize(l.nomes?.length?l.nomes.join('\n'):'A definir',47)};});
          faixas.push({cells,altura:5+Math.max(...cells.map(c=>c.nomes.length))*3.3});
        }
        pdf.setFontSize(9);const motivo=pdf.splitTextToSize(r.motivo||'Não haverá reunião nesta data',145);
        const altura=Math.max(22,r.semReuniao?motivo.length*4+12:faixas.reduce((n,f)=>n+f.altura,0)+10);
        if(y+altura>278&&y>65)abrir(true);
        pdf.setFillColor(p.fundo);pdf.roundedRect(12,y,186,altura,3,3,'F');
        const corData=r.tipo==='meio'?p.destaque:p.principal;
        pdf.setFillColor(corData);pdf.roundedRect(15,y+3,19,16,2,2,'F');
        txt(r.data.slice(8,10),24.5,y+10,16,true,Paleta.contraste(corData),{align:'center'});txt(m.data.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toLocaleUpperCase('pt-BR'),17.5,y+16,7,true,Paleta.contraste(corData));
        txt(r.tipo==='fim'?'FIM DE SEMANA':'MEIO DE SEMANA',38,y+5,7,true,p.destaque);
        let ly=y+10;
        if(r.semReuniao)txt(motivo,38,ly+2,9,true);
        else faixas.forEach(f=>{f.cells.forEach((c,i)=>{const x=38+i*53;txt(c.titulo,x,ly,6.5);txt(c.nomes,x,ly+4,8,i===0);});ly+=f.altura;});
        y+=altura+3;
      });
      if(!m.reunioes.length)txt('Nenhuma reunião neste mês.',13,y,10);
    });return pdf;
  }

  // ── Modelo "Tabelas": programação completa do mês (igual ao modelo em Word) ──
  // mes: {data:Date, discursos:[{data,nome,cong,tema}|{data,mesclado}]|null,
  //       presidencia:[{data,presidente,leitor}|{data,mesclado}]|null,
  //       fim:{grupos:[{titulo,vagas:[rotulo]}],linhas:[{data,valores:[]}|{data,mesclado}]}|null, meio:(igual)|null,
  //       zoom:[{rotulo,nomes}]|null}
  function criarPdfTabelas(JsPDF,meses,{congregacao,endereco='',titulo='Programação de indicadores',cores={}}){
    const pdf=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const p=Paleta.criar('word',cores);
    const COR={titulo:p.principal,azul:p.destaque,vermelho:p.principal,dourado:p.apoio,zebra:p.fundo,borda:'#8c8c8c',texto:p.texto};
    const X=16,L=178,UP=s=>String(s??'').toLocaleUpperCase('pt-BR');
    let y=0;
    const txt=(t,x,yy,tam,estilo,cor,op={})=>{pdf.setFont('helvetica',estilo);pdf.setFontSize(tam);pdf.setTextColor(cor);pdf.text(t,x,yy,op);};

    function cabecalhoPagina(m){
      txt(UP('Congregação '+congregacao),105,18,15,'normal',COR.azul,{align:'center'});
      pdf.setDrawColor(COR.azul);pdf.setLineWidth(.5);pdf.line(30,20.5,180,20.5);
      txt(UP(titulo+' - '+m.data.toLocaleDateString('pt-BR',{month:'long'})+'/'+m.data.getFullYear()),105,32,15,'bold',COR.texto,{align:'center'});
      if(endereco){pdf.setDrawColor(COR.azul);pdf.setLineWidth(.2);pdf.line(30,284,180,284);txt(endereco,105,289,8,'normal',COR.azul,{align:'center'});}
      y=40;
    }
    // Desenha uma célula com texto centralizado (quebra linhas se precisar).
    function celula(x,yy,w,h,texto,{fundo=null,cor=COR.texto,negrito=false,tam=8.5}={}){
      if(fundo&&cor==='#ffffff')cor=Paleta.contraste(fundo);
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
