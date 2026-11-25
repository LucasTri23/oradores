(function(root){
  function montarMes(data,regras,cfg,salvas,pessoas){
    const nomes=new Map(pessoas.map(p=>[p.id,p.nome])),locais=new Map(regras.locaisCampo(cfg).map(l=>[l.id,l.nome]));
    const grupos=new Map();
    regras.campoDoMes(data.getFullYear(),data.getMonth()+1,cfg,salvas).forEach(c=>{
      // Apenas recorrências explícitas são unidas. Exceções e saídas distintas permanecem visíveis.
      const chave=c.recorrente?JSON.stringify([c.saidaId,new Date(c.data+'T12:00:00').getDay(),c.hora,c.localId,c.dirigente,!!c.semSaida]):c.id;
      if(!grupos.has(chave))grupos.set(chave,{...c,datas:[],local:locais.get(c.localId)||'Local não informado',nome:c.semSaida?'Não haverá saída':nomes.get(c.dirigente)||(c.dirigente?'Pessoa removida':'A definir')});
      grupos.get(chave).datas.push(c.data);
    });
    const linhas=[...grupos.values()].sort((a,b)=>a.data.localeCompare(b.data)||String(a.hora).localeCompare(String(b.hora)));
    linhas.forEach(c=>{
      const dia=new Date(c.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'});
      c.quando=(c.datas.length>1?dia+' · dias ':dia+' · ')+c.datas.map(d=>d.slice(8,10)+'/'+d.slice(5,7)).join(', ');
    });
    return {data,linhas};
  }

  function criarPdf(JsPDF,meses,congregacao,modelo,cores,existente){
    const pdf=existente||new JsPDF({unit:'mm',format:'a4'}),p=PdfPaleta.criar(modelo,cores),tabela=['compacto','word'].includes(modelo);
    let pagina=existente?pdf.getNumberOfPages():0,y=0;
    const texto=(s,x,y,size=10,bold=false,cor=p.texto)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(cor);pdf.text(s,x,y);};
    const quebra=(s,w,size=10,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);return pdf.splitTextToSize(String(s),w);};
    meses.forEach(m=>{
      function abrir(continuacao=false){
        if(pagina++)pdf.addPage();
        if(modelo==='cartoes'){pdf.setFillColor(p.principal);pdf.rect(0,0,210,51,'F');}
        const cor=modelo==='cartoes'?PdfPaleta.contraste(p.principal):p.principal;
        texto('Serviço de campo',16,22,22,true,cor);
        texto(quebra(congregacao,145,10),16,31,10,false,cor);
        texto(m.data.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})+(continuacao?' · continuação':''),16,44,10,false,cor);
        if(modelo==='ilustrado')PdfPaleta.ilustrar(pdf,p);
        texto('Recorrências agrupadas; as datas indicadas mostram quando cada saída acontece.',16,60,8);
        texto('Quadro de anúncios · Serviço de campo · '+pagina,16,287,8,false,p.destaque);
        y=67;
        if(tabela){pdf.setFillColor(p.principal);pdf.rect(16,y,178,10,'F');const c=PdfPaleta.contraste(p.principal);texto('DIAS / HORÁRIO',19,y+7,9,true,c);texto('LOCAL',82,y+7,9,true,c);texto('DIRIGENTE',143,y+7,9,true,c);y+=10;}
      }
      abrir();
      if(!m.linhas.length)texto('Nenhuma saída de campo cadastrada para este mês.',16,y+10);
      m.linhas.forEach(c=>{
        const quando=quebra(c.quando+'\n'+(c.hora||'Horário a definir'),tabela?57:164,10,true);
        const local=quebra((tabela?'':'Local: ')+c.local,tabela?55:164,10);
        const nome=quebra((tabela?'':'Dirigente: ')+c.nome,tabela?48:164,10);
        const h=tabela?Math.max(quando.length,local.length,nome.length)*5+10:(quando.length+local.length+nome.length)*5+18;
        if(y+h>276)abrir(true);
        pdf.setDrawColor(p.apoio);pdf.setFillColor(p.fundo);pdf.setLineWidth(.25);
        if(modelo==='cartoes')pdf.roundedRect(16,y,178,h,3,3,'FD');
        else if(tabela)pdf.rect(16,y,178,h,'FD');
        if(tabela){texto(quando,19,y+7,10,true);texto(local,82,y+7);texto(nome,143,y+7);pdf.line(79,y,79,y+h);pdf.line(140,y,140,y+h);}
        else{let ty=y+8;texto(quando,22,ty,10,true,p.destaque);ty+=quando.length*5+3;texto(local,22,ty);ty+=local.length*5+2;texto(nome,22,ty);if(modelo!=='cartoes')pdf.line(16,y+h,194,y+h);}
        y+=h+(tabela?0:5);
      });
    });
    return pdf;
  }
  root.QuadroCampo={montarMes,criarPdf};if(typeof module!=='undefined')module.exports=root.QuadroCampo;
})(typeof window!=='undefined'?window:globalThis);
