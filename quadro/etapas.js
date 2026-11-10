window.addEventListener('load',()=>{
  const card=document.querySelector('.quadro-workspace>div>.card');if(!card)return;
  const nomes=['Conteúdo','Período','Modelo e cores','Conferir e baixar'],secoes=nomes.map((nome,i)=>{
    const s=document.createElement('section');s.id='etapa-quadro-'+i;s.className='quadro-etapa';s.setAttribute('aria-labelledby','etapa-quadro-titulo-'+i);
    const h=document.createElement('h2');h.id='etapa-quadro-titulo-'+i;h.textContent=(i+1)+'. '+nome;h.tabIndex=-1;s.appendChild(h);return s;
  });
  const conteudo=document.getElementById('quadroConteudo').closest('.field'),periodo=document.getElementById('quadroMes').closest('.g2'),responsaveis=document.getElementById('quadroResponsaveis'),check=document.getElementById('quadroIncluirResponsaveis').closest('label'),modelos=card.querySelector('.quadro-modelos'),cores=card.querySelector('.quadro-cores'),baixar=document.getElementById('quadroBaixar'),enviar=document.getElementById('quadroEnviar');
  secoes[0].appendChild(conteudo);secoes[1].append(periodo,check,responsaveis);secoes[2].append(modelos,cores);
  const resumo=document.createElement('p');resumo.className='settings-note';resumo.id='quadroResumo';secoes[3].append(resumo,baixar,enviar);
  card.replaceChildren(...secoes);
  const progresso=document.createElement('p');progresso.className='settings-note';progresso.setAttribute('role','status');card.prepend(progresso);
  const acoes=document.createElement('div');acoes.className='etapas-acoes';const voltar=document.createElement('button'),seguir=document.createElement('button');
  voltar.className='btn bo';voltar.textContent='Voltar';seguir.className='btn bp';seguir.textContent='Continuar';voltar.type=seguir.type='button';acoes.append(voltar,seguir);card.appendChild(acoes);
  let atual=0;
  function atualizarResumo(){
    const fonte=document.getElementById('quadroConteudo').selectedOptions[0]?.textContent||'',inicio=document.getElementById('quadroMes').value,qtd=document.getElementById('quadroQuantidade').value;
    const modelos={cartoes:'Cartões',word:'Tabelas do Word',ilustrado:'Ilustrado',editorial:'Editorial',compacto:'Compacto'};
    resumo.textContent=fonte+' · início '+inicio+' · '+qtd+' mês(es) · '+modelos[modeloQuadroAtual()]+'. Confira a prévia antes de baixar ou compartilhar.';
  }
  function ir(n,foco=true){
    if(n>atual&&atual===1&&!document.getElementById('quadroMes').reportValidity())return;
    atual=Math.max(0,Math.min(3,n));secoes.forEach((s,i)=>s.hidden=i!==atual);voltar.hidden=atual===0;seguir.hidden=atual===3;
    progresso.textContent='Etapa '+(atual+1)+' de 4';document.querySelectorAll('[data-quadro-step]').forEach(a=>{a.classList.toggle('active',Number(a.dataset.quadroStep)===atual);if(Number(a.dataset.quadroStep)===atual)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});
    atualizarResumo();if(foco)secoes[atual].querySelector('h2').focus();
  }
  voltar.onclick=()=>ir(atual-1);seguir.onclick=()=>ir(atual+1);
  document.querySelectorAll('[data-quadro-step]').forEach(a=>a.onclick=e=>{e.preventDefault();ir(Number(a.dataset.quadroStep));});
  document.getElementById('page-quadro').addEventListener('change',atualizarResumo);ir(0,false);
});
