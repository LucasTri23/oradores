// Limpeza semanal dos arquivos do discurso (.jwpub / .jwlplaylist).
// Chamada pelo Cron da Vercel toda segunda-feira (ver vercel.json): apaga do Storage, em todas as congregações,
// as pastas <congregação>/discursos/<AAAA-MM-DD> de semanas que já terminaram (horário de Brasília).
// Variáveis na Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) e CRON_SECRET.
const BUCKET='oradores';

// Data de hoje em Brasília (AAAA-MM-DD).
export function hojeBrasilia(agora=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(agora);
}
export function segundaDe(data){
  const d=new Date(data+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);
}
// Vencida: a data do discurso é de uma semana que já terminou.
export function vencida(data,hoje){return /^\d{4}-\d{2}-\d{2}$/.test(data)&&data<segundaDe(hoje);}

function cliente(url,chave){
  const base=url.replace(/\/+$/,'')+'/storage/v1';
  const headers={apikey:chave,Authorization:'Bearer '+chave,'Content-Type':'application/json'};
  async function chamar(metodo,caminho,corpo){
    const r=await fetch(base+caminho,{method:metodo,headers,body:JSON.stringify(corpo)});
    if(!r.ok)throw new Error('Storage '+r.status+': '+(await r.text()).slice(0,200));
    return r.json();
  }
  return {
    // Itens de uma "pasta": pastas vêm com id null; arquivos com id.
    listar:async prefixo=>{
      const itens=[];
      for(let offset=0;;offset+=1000){
        const pagina=await chamar('POST','/object/list/'+BUCKET,{prefix:prefixo,limit:1000,offset,sortBy:{column:'name',order:'asc'}});
        itens.push(...pagina);if(pagina.length<1000)return itens;
      }
    },
    apagar:caminhos=>chamar('DELETE','/object/'+BUCKET,{prefixes:caminhos})
  };
}

export async function limpar(storage,hoje){
  let apagados=0;const pastas=[];
  for(const ws of await storage.listar('')){
    if(ws.id)continue; // só pastas de congregação
    for(const dia of await storage.listar(ws.name+'/discursos/')){
      if(dia.id||!vencida(dia.name,hoje))continue;
      const pasta=ws.name+'/discursos/'+dia.name;
      const caminhos=(await storage.listar(pasta+'/')).filter(i=>i.id).map(i=>pasta+'/'+i.name);
      for(let i=0;i<caminhos.length;i+=100){await storage.apagar(caminhos.slice(i,i+100));}
      apagados+=caminhos.length;pastas.push(pasta);
    }
  }
  return {apagados,pastas:pastas.length};
}

export default async function handler(request,response){
  response.setHeader('Cache-Control','no-store');
  const segredo=process.env.CRON_SECRET;
  if(!segredo)return response.status(500).json({erro:'Configure CRON_SECRET na Vercel.'});
  if(request.headers.authorization!=='Bearer '+segredo)return response.status(401).json({erro:'Não autorizado.'});
  const url=process.env.SUPABASE_URL,chave=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!chave)return response.status(500).json({erro:'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.'});
  try{
    const hoje=hojeBrasilia(),resultado=await limpar(cliente(url,chave),hoje);
    return response.status(200).json({ok:true,hoje,...resultado});
  }catch(e){
    // Bucket ainda não criado: nada para limpar.
    if(/404|not found/i.test(e.message))return response.status(200).json({ok:true,apagados:0,aviso:'Bucket "oradores" não encontrado.'});
    return response.status(500).json({erro:e.message});
  }
}
