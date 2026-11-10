// Compatibilidade dos atalhos antigos, sem formulários embutidos.
(()=>{
  const params=new URLSearchParams(location.search),ferramentas=params.has('ferramentas');
  if(params.has('configEmbed')&&!ferramentas){location.replace('/#configuracoes');return;}
  if(location.pathname.startsWith('/territorios')){
    const original=window.switchTab;
    if(original)window.switchTab=function(tab){if(tab==='config'&&!ferramentas){location.href='/#configuracoes';return;}return original(tab);};
    if(ferramentas){const timer=setInterval(()=>{if(typeof db!=='undefined'&&db){window.switchTab('config');clearInterval(timer);}},300);setTimeout(()=>clearInterval(timer),30000);}
    else if(location.hash==='#config')location.replace('/#configuracoes');
  }
})();
