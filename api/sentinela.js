const MESES=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function semAcentos(valor){return String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function limparTexto(valor){
  return String(valor||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi,'-').replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi,'"')
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/gi,"'").replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();
}
function intervaloDatas(texto){
  const s=semAcentos(texto).replace(/[–—]/g,'-').replace(/\b(1)[.º°]+/g,'$1').replace(/\s+/g,' ').trim();
  const m=s.match(/(\d{1,2})\s*(?:de\s+([a-z]+)\s*)?(?:-|a)\s*(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i);
  if(!m)return null;
  const d1=Number(m[1]),d2=Number(m[3]),mes2=MESES.indexOf(m[4]),ano2=Number(m[5]);if(mes2<0)return null;
  let mes1=m[2]?MESES.indexOf(m[2]):mes2,ano1=ano2;if(mes1<0)return null;if(mes1>mes2)ano1--;
  return [new Date(Date.UTC(ano1,mes1,d1)),new Date(Date.UTC(ano2,mes2,d2,23,59,59))];
}
function extrairArtigos(html){
  const artigos=[],headings=[...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  for(let i=0;i<headings.length;i++){
    const inicio=(headings[i].index||0)+headings[i][0].length,fim=headings[i+1]?.index||Math.min(html.length,inicio+12000);
    const trecho=limparTexto(html.slice(inicio,fim));
    const estudo=trecho.match(/(?:Estudo|Artigo de estudo)\s+para\s+a\s+semana\s+de\s*([^.!?]{5,100})[.!?]/i);
    const titulo=limparTexto(headings[i][1]),intervalo=intervaloDatas(estudo?.[1]);
    if(titulo&&intervalo)artigos.push({titulo,intervalo});
  }
  return artigos;
}
export default async function handler(request,response){
  response.setHeader('Cache-Control','public, s-maxage=21600, stale-while-revalidate=86400');
  const data=String(request.query?.data||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return response.status(400).json({error:'Data inválida'});
  const alvo=new Date(data+'T12:00:00Z');
  const diagnostico=[];
  for(let off=0;off<=4;off++){
    const edicao=new Date(Date.UTC(alvo.getUTCFullYear(),alvo.getUTCMonth()-off,1)),mes=MESES[edicao.getUTCMonth()],ano=edicao.getUTCFullYear();
    const url=`https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-${mes}-${ano}/`;
    try{
      const resultado=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; Oradores/1.0)','Accept-Language':'pt-BR,pt;q=0.9'}});if(!resultado.ok){diagnostico.push({url,status:resultado.status});continue;}
      const artigo=extrairArtigos(await resultado.text()).find(a=>alvo>=a.intervalo[0]&&alvo<=a.intervalo[1]);
      if(artigo)return response.status(200).json({tema:artigo.titulo,data,fonte:url});
    }catch(error){diagnostico.push({url,erro:error.message});console.error('[sentinela]',data,url,error);}
  }
  console.warn('[sentinela] tema não encontrado',data,diagnostico);
  return response.status(404).json({tema:null,data,error:'Tema não encontrado nas edições consultadas.',diagnostico});
}
