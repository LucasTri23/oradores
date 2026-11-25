(function(root){
  const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const normalizar=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const chave=i=>[normalizar(i.codigo),normalizar(i.idioma),normalizar(i.formato)].join('|');
  function inteiro(v){const n=Number(v);if(String(v).trim()===''||!Number.isSafeInteger(n)||n<0||n>1000000)throw new Error('Use quantidades inteiras de 0 a 1.000.000.');return n;}
  function validarItens(itens){
    if(!Array.isArray(itens)||!itens.length)throw new Error('Adicione pelo menos uma publicação.');
    if(itens.length>2000)throw new Error('O relatório deve ter até 2.000 publicações.');
    const vistos=new Set();return itens.map(i=>{
      const r={...i,codigo:String(i.codigo||'').trim(),titulo:String(i.titulo||'').trim(),idioma:String(i.idioma||'').trim(),formato:String(i.formato||'').trim(),quantidade:inteiro(i.quantidade)};
      if(!r.codigo||!r.titulo||!r.idioma)throw new Error('Informe código, publicação e idioma de cada item.');
      if(vistos.has(chave(r)))throw new Error('Há publicações repetidas. Junte as quantidades ou diferencie a edição/formato.');vistos.add(chave(r));return r;
    });
  }
  function validarPedido(p){
    if(!['pessoa','congregacao'].includes(p.solicitanteTipo)||!String(p.nome||'').trim())throw new Error('Informe quem solicitou o pedido.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.data||'')||!Number.isFinite(Date.parse(p.data+'T12:00:00Z'))||new Date(p.data+'T12:00:00Z').toISOString().slice(0,10)!==p.data)throw new Error('Informe uma data válida para o pedido.');
    if(p.itens?.length>200)throw new Error('Cada pedido pode ter até 200 publicações.');
    const itens=validarItens(p.itens).map(i=>{
      const r={...i,enviado:inteiro(i.enviado??0),recebido:inteiro(i.recebido??0),entregue:inteiro(i.entregue??0)};
      if(!r.quantidade||r.entregue>r.recebido||r.recebido>r.enviado||r.enviado>r.quantidade)throw new Error('As quantidades devem seguir: entregue ≤ recebido ≤ enviado ≤ pedido.');
      if(p.solicitanteTipo==='congregacao'&&r.entregue)throw new Error('Pedidos da congregação terminam no recebimento.');return r;
    });return {...p,nome:p.nome.trim(),itens};
  }
  function totais(p){return p.itens.reduce((t,i)=>{['quantidade','enviado','recebido','entregue'].forEach(k=>t[k]+=Number(i[k]||0));return t;},{quantidade:0,enviado:0,recebido:0,entregue:0});}
  function situacao(p){
    if(p.cancelado)return 'Cancelado';const t=totais(p);
    if(p.solicitanteTipo==='pessoa'&&t.entregue===t.quantidade)return 'Entregue';
    if(t.recebido===t.quantidade)return p.solicitanteTipo==='congregacao'?'Recebido':'Pronto para retirar';
    if(t.recebido>0)return 'Recebido parcialmente';if(t.enviado===t.quantidade)return 'Aguardando chegada';if(t.enviado>0)return 'Enviado parcialmente';return 'A enviar';
  }
  function movimentar(p,tipo,quantidades,autor,agora=new Date().toISOString()){
    if(p.cancelado)throw new Error('Este pedido está cancelado.');
    if(!['enviado','recebido','entregue'].includes(tipo))throw new Error('Movimento inválido.');
    if(tipo==='entregue'&&p.solicitanteTipo==='congregacao')throw new Error('O recebimento conclui os pedidos da congregação.');
    if(!Array.isArray(quantidades)||quantidades.length!==p.itens.length)throw new Error('Confira os itens do pedido.');
    const q=quantidades.map(inteiro);if(!q.some(Boolean))throw new Error('Informe pelo menos uma quantidade.');
    const novo=validarPedido({...p,itens:p.itens.map((i,n)=>({...i,[tipo]:Number(i[tipo]||0)+q[n]}))});
    return {...novo,eventos:[...(p.eventos||[]),{tipo,quantidades:q,autor,data:agora}]};
  }
  function cancelar(p,autor){if(totais(p).enviado)throw new Error('Este pedido já foi enviado ao JW Hub. Confira o destino do material antes de encerrá-lo.');return {...p,cancelado:true,eventos:[...(p.eventos||[]),{tipo:'cancelado',autor,data:new Date().toISOString()}]};}
  function linhasPagina(items){
    const linhas=[];for(const i of items.filter(i=>i.str?.trim())){const y=i.transform[5],x=i.transform[4];let l=linhas.find(l=>Math.abs(l.y-y)<2);if(!l){l={y,items:[]};linhas.push(l);}l.items.push({x,str:i.str});}
    return linhas.sort((a,b)=>b.y-a.y).map(l=>l.items.sort((a,b)=>a.x-b.x).map(i=>i.str.trim()).join(' ').replace(/\s+/g,' ').trim());
  }
  function lerMovimento(linhas){
    const texto=linhas.join('\n'),ref=normalizar(texto).match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})/);
    if(!/movimento mensal de publica/.test(normalizar(texto)))throw new Error('Selecione o PDF de Movimento mensal de publicações do JW Hub.');
    if(!ref)throw new Error('Não foi possível identificar o mês do relatório.');
    const mes=ref[2]+'-'+String(MESES.map(normalizar).indexOf(ref[1])+1).padStart(2,'0');
    const idioma=texto.match(/(?:20\d{2})\s*\|\s*([^\n]+)/)?.[1]?.trim()||'Português (Brasil)';
    const itens=[],avisos=[];let categoria='';
    for(const linha of linhas){
      const m=linha.match(/^\(([^)]+)\)\s+(.+?)\s+(\d[\d.]*)\s+(\(?-?\d[\d.]*\)?)$/);
      if(m){itens.push({codigo:m[1].replace(/\s+/g,''),titulo:m[2],idioma,formato:'',quantidade:inteiro(m[3].replace(/\./g,'')),media:m[4],categoria});continue;}
      if(/^\([\w.-]+\)/.test(linha))avisos.push('Confira esta linha não reconhecida: '+linha);
      else if(/^(Bíblias|Livros|Brochuras|Formulários|Folhetos|Revistas)/i.test(linha))categoria=linha;
    }
    if(!itens.length)throw new Error('Nenhuma publicação foi reconhecida. Use o PDF com texto exportado do JW Hub; imagens digitalizadas não são lidas automaticamente.');
    return {mes,itens:validarItens(itens),avisos};
  }
  const api={normalizar,chave,inteiro,validarItens,validarPedido,totais,situacao,movimentar,cancelar,linhasPagina,lerMovimento};root.PublicacoesRegras=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
