(function(root){
  const padroes={
    cartoes:{principal:'#193e49',destaque:'#16818a',apoio:'#9fd3d0',fundo:'#f0f6f6',texto:'#193e49'},
    editorial:{principal:'#23486b',destaque:'#23486b',apoio:'#bed7dd',fundo:'#edf2f7',texto:'#172b3e'},
    compacto:{principal:'#23486b',destaque:'#23486b',apoio:'#bed7dd',fundo:'#edf2f7',texto:'#172b3e'},
    word:{principal:'#943634',destaque:'#4f81bd',apoio:'#c99700',fundo:'#e5e5e5',texto:'#1a1a1a'},
    ilustrado:{principal:'#23594f',destaque:'#37786a',apoio:'#cee0bd',fundo:'#f1f6ee',texto:'#203c35'}
  };
  const valida=c=>/^#[\da-f]{6}$/i.test(c||'');
  function criar(modelo,cores={}){cores=cores&&typeof cores==='object'?cores:{};const p={...(padroes[modelo]||padroes.cartoes)};Object.keys(p).forEach(k=>{if(valida(cores[k]))p[k]=cores[k];});return p;}
  function contraste(c){const rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#10252d':'#ffffff';}
  function ilustrar(pdf,p){
    // Ramo e horizonte em vetor: sem logotipo, texto ou dependência de imagem.
    pdf.setFillColor(p.fundo);pdf.circle(181,20,14,'F');
    pdf.setDrawColor(p.destaque);pdf.setLineWidth(.5);pdf.line(173,31,188,11);
    [[176,27],[179,23],[182,19],[185,15]].forEach(([x,y],i)=>{
      pdf.setFillColor(i%2?p.apoio:p.destaque);pdf.ellipse(x-2.4,y-2,3,1.6,'F');pdf.ellipse(x+2.4,y+.8,3,1.6,'F');
    });pdf.setDrawColor(p.apoio);pdf.line(166,35,196,35);
  }
  root.PdfPaleta={padroes,criar,contraste,ilustrar};
  if(typeof module!=='undefined')module.exports=root.PdfPaleta;
})(typeof window!=='undefined'?window:globalThis);
