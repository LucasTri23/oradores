(function(root){
  function montarMes(data,regras,cfg,salvas,pessoas){
    const nomes=new Map(pessoas.map(p=>[p.id,p.nome])),locais=new Map(regras.locaisCampo(cfg).map(l=>[l.id,l.nome]));
    const gruposLocais=new Map(regras.locaisCampo(cfg).map(l=>[l.id,l.grupo||'']));
    const grupos=new Map();
    regras.campoDoMes(data.getFullYear(),data.getMonth()+1,cfg,salvas).forEach(c=>{
      // Apenas recorrências explícitas são unidas. Exceções e saídas distintas permanecem visíveis.
      const chave=c.recorrente?JSON.stringify([c.saidaId,new Date(c.data+'T12:00:00').getDay(),c.hora,c.localId,c.dirigente,c.grupoId||c.grupo||'',!!c.semSaida]):c.id;
      if(!grupos.has(chave))grupos.set(chave,{...c,grupo:c.grupoNome||c.grupo||gruposLocais.get(c.localId)||'',datas:[],local:locais.get(c.localId)||'Local não informado',nome:c.semSaida?'Não haverá saída':nomes.get(c.dirigente)||(c.dirigente?'Pessoa removida':'A definir')});
      grupos.get(chave).datas.push(c.data);
    });
    const linhas=[...grupos.values()].sort((a,b)=>a.data.localeCompare(b.data)||String(a.hora).localeCompare(String(b.hora)));
    linhas.forEach(c=>{
      const dia=new Date(c.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'}).toLocaleUpperCase('pt-BR');
      c.quando=(c.datas.length>1?dia+' · dias ':dia+' · ')+c.datas.map(d=>d.slice(8,10)+'/'+d.slice(5,7)).join(', ');
    });
    return {data,linhas};
  }

  function criarPdf(JsPDF,meses,congregacao,modelo,cores,existente){
    const pdf=existente||new JsPDF({unit:'mm',format:'a4'}),p=PdfPaleta.criar(modelo,cores),word=modelo==='word';
    let pagina=existente?pdf.getNumberOfPages():0;
    const texto=(s,x,y,size=10,bold=false,cor=p.texto,align='left')=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(cor);pdf.text(s,x,y,{align,lineHeightFactor:1.15});};
    const quebra=(s,w,size=10,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);return pdf.splitTextToSize(String(s),w);};
    meses.forEach(m=>{
      if(pagina++)pdf.addPage();
      const nomeCong=quebra('CONGREGAÇÃO '+congregacao.toLocaleUpperCase('pt-BR'),modelo==='ilustrado'?142:178,10,true);
      const tituloY=24+nomeCong.length*4.2;
      if(modelo==='cartoes'){pdf.setFillColor(p.principal);pdf.rect(0,0,210,tituloY+24,'F');}
      const cabCor=modelo==='cartoes'?PdfPaleta.contraste(p.principal):p.destaque;
      texto(nomeCong,105,15,10,true,cabCor,'center');
      pdf.setDrawColor(cabCor);pdf.setLineWidth(.3);pdf.line(16,18+nomeCong.length*4.2,194,18+nomeCong.length*4.2);
      texto('REUNIÕES PARA O SERVIÇO DE CAMPO',105,tituloY+5,word?12:14,true,modelo==='cartoes'?cabCor:p.texto,'center');
      texto(m.data.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),105,tituloY+16,10,false,modelo==='cartoes'?cabCor:p.texto,'center');
      if(modelo==='ilustrado')PdfPaleta.ilustrar(pdf,p);
      const inicio=tituloY+29,disponivel=273-inicio;
      const secoes=[{titulo:'SEGUNDA A SEXTA',tipo:'semana',linhas:[]},{titulo:'SÁBADO',tipo:'sabado',linhas:[]},{titulo:'DOMINGO',tipo:'domingo',linhas:[]}];
      m.linhas.forEach(c=>{const dia=new Date(c.data+'T12:00:00').getDay();secoes[dia===6?1:dia===0?2:0].linhas.push(c);});
      const usadas=secoes.filter(s=>s.linhas.length);
      secoes[0].linhas.sort((a,b)=>new Date(a.data+'T12:00:00').getDay()-new Date(b.data+'T12:00:00').getDay()||String(a.hora).localeCompare(String(b.hora))||a.data.localeCompare(b.data));
      const medidas=size=>usadas.map(s=>{
        const grupos=s.tipo!=='semana'&&s.linhas.some(c=>c.grupo);
        const larguras=grupos?[42,23,57,56]:[42,23,56,57];
        const headers=grupos?['GRUPO / DIA','HORÁRIO','DIRIGENTE','LOCAL']:['DIA','HORÁRIO','LOCAL','DIRIGENTE'];
        const rows=s.linhas.map(c=>{
          const datas=(c.datas||[c.data]).map(d=>d.slice(8,10)+'/'+d.slice(5,7)).join(', ');
          const dia=s.tipo==='sabado'?datas:new Date(c.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'}).toLocaleUpperCase('pt-BR');
          const primeira=grupos&&c.grupo?c.grupo:dia;
          const vals=grupos?[primeira,c.hora||'A definir',c.nome,c.local]:[primeira,c.hora||'A definir',c.local,c.nome];
          const cells=vals.map((v,i)=>quebra(v,larguras[i]-4,size));
          return {cells,h:Math.max(...cells.map(v=>v.length))*size*.3528*1.15+3};
        });
        return {s,larguras,headers,rows,h:16+rows.reduce((n,r)=>n+r.h,0)+9};
      });
      let size=9,layout=medidas(size);
      while(layout.reduce((n,s)=>n+s.h,0)+8>disponivel&&size>6){size-=.25;layout=medidas(size);}
      // Reduz a escala vertical e a fonte em meses excepcionalmente cheios, nunca omite uma saída.
      const total=layout.reduce((n,s)=>n+s.h,0)+8,escala=Math.min(1,disponivel/total);
      let y=inicio;
      if(!usadas.length)texto('Nenhuma saída de campo cadastrada para este mês.',16,y+10);
      else{
        const presencial=word?'#c55a00':p.principal;
        pdf.setFillColor(presencial);pdf.rect(16,y,178,8*escala,'F');texto('PRESENCIAL',105,y+5.5*escala,10*escala,true,PdfPaleta.contraste(presencial),'center');y+=8*escala;
      }
      layout.forEach(({s,larguras,headers,rows})=>{
        const faixa=word?p.destaque:p.principal;
        pdf.setFillColor(faixa);
        if(modelo==='cartoes')pdf.roundedRect(16,y,178,8*escala,2,2,'F');else pdf.rect(16,y,178,8*escala,'F');
        texto(s.titulo,105,y+5.4*escala,9*escala,true,PdfPaleta.contraste(faixa),'center');y+=8*escala;
        let x=16;
        headers.forEach((h,i)=>{pdf.setFillColor(p.fundo);pdf.setDrawColor(word?'#9ca3af':p.apoio);pdf.rect(x,y,larguras[i],8*escala,'FD');texto(h,x+larguras[i]/2,y+5.2*escala,8*escala,true,PdfPaleta.contraste(p.fundo),'center');x+=larguras[i];});y+=8*escala;
        const juntarHorario=word&&s.tipo==='domingo'&&rows.length>1&&rows.every(r=>r.cells[1].join('')===rows[0].cells[1].join(''));
        const inicioLinhas=y;
        rows.forEach((row,ri)=>{
          let x=16;const altura=row.h*escala;
          row.cells.forEach((cell,i)=>{
            if(juntarHorario&&i===1){x+=larguras[i];return;}
            const fundo=word||modelo==='compacto'?'#ffffff':ri%2?p.fundo:'#ffffff';
            pdf.setFillColor(fundo);pdf.setDrawColor(word?'#9ca3af':p.apoio);pdf.setLineWidth(.2);pdf.rect(x,y,larguras[i],altura,'FD');
            const ty=y+(altura-cell.length*size*.3528*1.15*escala)/2+size*.3528*escala;
            texto(cell,x+larguras[i]/2,ty,size*escala,false,p.texto,'center');x+=larguras[i];
          });y+=altura;
        });
        if(juntarHorario){
          pdf.setFillColor('#ffffff');pdf.setDrawColor('#9ca3af');pdf.rect(16+larguras[0],inicioLinhas,larguras[1],y-inicioLinhas,'FD');
          texto(rows[0].cells[1],16+larguras[0]+larguras[1]/2,(inicioLinhas+y)/2+size*.3528*escala/2,size*escala,false,p.texto,'center');
        }
        y+=9*escala;
      });
      pdf.setDrawColor(p.apoio);pdf.line(16,281,194,281);
      texto(quebra(m.endereco||congregacao,178,7),105,286,7,false,p.destaque,'center');
    });
    return pdf;
  }
  root.QuadroCampo={montarMes,criarPdf};if(typeof module!=='undefined')module.exports=root.QuadroCampo;
})(typeof window!=='undefined'?window:globalThis);
