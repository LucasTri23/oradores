// Apostila Nossa Vida e Ministério Cristão (mwb): busca os arquivos oficiais de download do jw.org
// e devolve só a estrutura de cada semana (partes, tempos e cânticos), sem o texto do estudo.
const MESES=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const API='https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS';
const semAcentos=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const iso=d=>d.toISOString().slice(0,10);

// RTF → texto simples (só o necessário para os arquivos da apostila).
const PULAR=new Set(['fonttbl','colortbl','stylesheet','info','pict','header','footer','headerl','headerr','footerl','footerr','listtable','listoverridetable','rsidtbl','generator','xmlnstbl','themedata','latentstyles','datastore','fldinst','object','shp','shpinst','nonshppict','field-mod']);
const SIMBOLOS={emdash:'—',endash:'–',bullet:'•',lquote:'‘',rquote:'’',ldblquote:'“',rdblquote:'”',tab:' ',par:'\n',line:'\n',sect:'\n',row:'\n',cell:' '};
export function rtfParaTexto(rtf){
  const cp=new TextDecoder('windows-1252');let out='',i=0,estado={pular:false,uc:1},pilha=[],saltar=0;
  const emitir=t=>{if(estado.pular)return;if(saltar>0){saltar--;return;}out+=t;};
  while(i<rtf.length){
    const c=rtf[i];
    if(c==='{'){pilha.push(estado);estado={...estado};i++;continue;}
    if(c==='}'){estado=pilha.pop()||{pular:false,uc:1};i++;continue;}
    if(c==='\r'||c==='\n'){i++;continue;}
    if(c!=='\\'){emitir(c);i++;continue;}
    const n=rtf[i+1];
    if(n==="'"){const b=parseInt(rtf.substr(i+2,2),16);if(!estado.pular){if(saltar>0)saltar--;else out+=cp.decode(new Uint8Array([b]));}i+=4;continue;}
    if(n==='*'){estado.pular=true;i+=2;continue;}
    if(n==='\\'||n==='{'||n==='}'){emitir(n);i+=2;continue;}
    if(n==='~'){emitir(' ');i+=2;continue;}
    if(n==='-'||n==='_'){if(n==='_')emitir('-');i+=2;continue;}
    const m=/^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i+1,i+40));
    if(!m){i+=2;continue;}
    i+=1+m[0].length;const w=m[1],p=m[2]==null?null:Number(m[2]);
    if(PULAR.has(w)){estado.pular=true;continue;}
    if(w==='uc'){estado.uc=p??1;continue;}
    if(w==='u'){if(!estado.pular)out+=String.fromCharCode(p<0?p+65536:p);saltar=estado.uc;continue;}
    if(SIMBOLOS[w]!=null)emitir(SIMBOLOS[w]);
  }
  return out.replace(/ /g,' ').split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
}

// "16 a 22 de novembro (Lamentações 1 a 2)" ou "28 de dezembro a 3 de janeiro (Ezequiel 9 a 10)"
export function lerTituloSemana(titulo,anoEdicao,mesEdicao){
  const t=String(titulo||'').replace(/\s+/g,' ').trim();
  const m=semAcentos(t).replace(/(\d)\.?\s*[º°ª]/g,'$1').match(/^(\d{1,2})\s*(?:de\s+([a-z]+)\s*)?(?:a|-|–)\s*(\d{1,2})\s+de\s+([a-z]+)/);
  if(!m)return null;
  const mes1=MESES.indexOf(m[2]||m[4]);if(mes1<0)return null;
  // Semanas na virada do ano: jan/fev pode começar em dezembro; nov/dez pode ter semana de janeiro.
  const dif=mes1-(mesEdicao-1),ano=dif<-6?anoEdicao+1:dif>6?anoEdicao-1:anoEdicao;
  const inicio=new Date(Date.UTC(ano,mes1,Number(m[1])));
  const leitura=(t.match(/\(([^)]+)\)\s*$/)?.[1]||'').replace(/\s+a\s+/g,'-').trim();
  return {semana:iso(inicio),rotulo:t.replace(/\s*\([^)]*\)\s*$/,''),leitura};
}

const SECOES=[['tesouros',/^tesouros da palavra de deus$/],['ministerio',/^faca seu melhor no ministerio$/],['vida',/^nossa vida crista$/]];
// Lê o texto de uma semana: cânticos, partes numeradas com duração, seção e tipo.
export function lerSemana(linhas){
  const partes=[],canticos=[];let secao='',ultima=null;
  for(const linha of linhas){
    const s=semAcentos(linha);
    const sec=SECOES.find(([,r])=>r.test(s));if(sec){secao=sec[0];ultima=null;continue;}
    const cant=s.match(/^cantico (\d{1,3})\b/);if(cant){canticos.push(Number(cant[1]));ultima=null;continue;}
    const p=linha.match(/^(\d{1,2})\.\s+(.+?)\s*\((\d{1,3})\s*min\)/);
    if(p&&secao){ultima={n:Number(p[1]),secao,titulo:p[2].trim(),min:Number(p[3]),tipo:'',cenario:''};partes.push(ultima);continue;}
    if(ultima&&ultima.secao==='ministerio'&&!ultima.tipo){
      const d=semAcentos(linha);
      if(/^discurso\b/.test(d))ultima.tipo='discurso';
      else if(/^consideracao\b/.test(d))ultima.tipo='consideracao';
      else{ultima.tipo='demonstracao';const c=linha.match(/^(De casa em casa|Testemunho [^.]{3,30})\./i);ultima.cenario=c?c[1].trim():'';}
    }
  }
  for(const p of partes){
    const t=semAcentos(p.titulo);
    if(p.secao==='tesouros')p.tipo=/^leitura da biblia/.test(t)?'leitura':/^joias espirituais/.test(t)?'joias':'tesouros';
    else if(p.secao==='vida')p.tipo=/^estudo biblico de congregacao/.test(t)?'ebc':'vida';
    else if(/^discurso(\s|$)/.test(t))p.tipo='discurso';
    else if(!p.tipo)p.tipo='demonstracao';
  }
  return {canticos,partes};
}

export function edicaoDe(data){
  const d=new Date(data+'T12:00:00Z'),mes=d.getUTCMonth()+1,inicio=mes%2?mes:mes-1;
  return {ano:d.getUTCFullYear(),mes:inicio,codigo:d.getUTCFullYear()+String(inicio).padStart(2,'0')};
}

async function buscarJson(url,fetcher){const r=await fetcher(url,{headers:{'User-Agent':'Designa/1.0 (+apostila)'}});if(r.status===404)return null;if(!r.ok)throw new Error('jw.org respondeu '+r.status);return r.json();}
export async function buscarEdicao(codigo,fetcher=fetch){
  const dados=await buscarJson(API+'?pub=mwb&issue='+codigo+'&output=json&fileformat=RTF&alllangs=0&langwritten=T',fetcher);
  const arquivos=(dados?.files?.T?.RTF||[]).filter(f=>/_\d{2}\.rtf$/i.test(f.file?.url||''));
  if(!arquivos.length)return null;
  const ano=Number(codigo.slice(0,4)),mes=Number(codigo.slice(4));
  const semanas=await Promise.all(arquivos.map(async f=>{
    const cab=lerTituloSemana(f.title,ano,mes);if(!cab)return null;
    const r=await fetcher(f.file.url);if(!r.ok)throw new Error('Arquivo da semana indisponível');
    return {...cab,...lerSemana(rtfParaTexto(await r.text()))};
  }));
  return {edicao:codigo,nome:dados.formattedDate||'',semanas:semanas.filter(s=>s&&s.partes.length).sort((a,b)=>a.semana.localeCompare(b.semana))};
}

export default async function handler(request,response){
  const data=String(request.query?.data||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||!Number.isFinite(Date.parse(data)))return response.status(400).json({error:'Data inválida'});
  try{
    const ed=edicaoDe(data),r=await buscarEdicao(ed.codigo);
    if(!r){response.setHeader('Cache-Control','public, s-maxage=3600');return response.status(404).json({error:'A apostila deste período ainda não está disponível no jw.org.',edicao:ed.codigo});}
    response.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
    return response.status(200).json(r);
  }catch(error){
    console.error('[apostila]',data,error);
    return response.status(502).json({error:'Não foi possível buscar a apostila no jw.org agora. Tente novamente mais tarde.'});
  }
}
