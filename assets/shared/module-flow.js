// A mesma configuração continua usando os formulários e as permissões do módulo.
(()=>{
  const params=new URLSearchParams(location.search),embed=params.has('configEmbed');
  if(embed){
    document.documentElement.classList.add('settings-embedded');
    const base=document.createElement('base');base.target='_top';document.head.appendChild(base);
    const style=document.createElement('style');style.textContent=`
      .settings-embedded header,.settings-embedded nav,.settings-embedded .dz-readonly{display:none!important}
      .settings-embedded body{padding:0!important;margin:0!important}
      .settings-embedded main,.settings-embedded .dz-main,.settings-embedded .main{margin:0!important;padding:12px!important;max-width:none!important}
      .settings-embedded #page-config>.panel-title{display:none}
      .settings-embedded #page-config>.team-card{display:none}
    `;document.head.appendChild(style);
    const ajustar=()=>{
      const main=document.querySelector('main,.main');if(!main)return;
      const altura=Math.ceil(main.getBoundingClientRect().height)+30;
      if(altura>100)parent.postMessage({tipo:'designa-config-altura',altura},location.origin);
    };
    window.addEventListener('load',()=>{ajustar();new ResizeObserver(ajustar).observe(document.querySelector('main,.main')||document.body);});
  }
  if(location.pathname.startsWith('/territorios')){
    const original=window.switchTab;
    if(original)window.switchTab=function(tab){if(tab==='config'&&!embed){location.href='/#configuracoes';return;}return original(tab);};
    if(embed){const timer=setInterval(()=>{if(typeof db!=='undefined'&&db){window.switchTab('config');clearInterval(timer);}},300);setTimeout(()=>clearInterval(timer),30000);}
  }
})();
