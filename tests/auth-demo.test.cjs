const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {MODELS,CYCLE,nextIndex,remainingAfterPause}=require('../assets/shared/auth-demo.js');
test('demonstração possui quatro módulos e ciclo de seis segundos',()=>{
  assert.equal(CYCLE,6000);assert.deepEqual(MODELS.map(m=>m.key),['oradores','designacoes','territorios','publicacoes']);assert.equal(nextIndex(0),1);assert.equal(nextIndex(3),0);
  assert(MODELS.every(m=>m.html&&m.notice&&m.detail));
});
test('pausa conserva o tempo restante e impede tempos negativos ao retomar',()=>{
  assert.equal(remainingAfterPause(6000,1750),4250);assert.equal(remainingAfterPause(4250,500),3750);assert.equal(remainingAfterPause(6000,7000),0);assert.equal(remainingAfterPause(6000,-100),6000);
});
test('componente é isolado de dados reais, mantém a logo e os contratos das telas',()=>{
  const source=fs.readFileSync('assets/shared/auth-demo.js','utf8'),html=fs.readFileSync('index.html','utf8');
  assert(!/\b(?:fetch|XMLHttpRequest|supabase|Conta|requestAnimationFrame)\s*[.(]/.test(source));assert(source.includes('dados exclusivamente fictícios'));assert(source.includes('Demonstração'));
  for(const id of ['vLogin','vSaiu','vConvite','loginEntrar','saiuEntrar','conviteAcao','loginErr','saiuErr','conviteErr'])assert(html.includes('id="'+id+'"'));
  assert.equal((html.match(/class="exit-brand"[\s\S]*?<img src="\/assets\/images\/designa-icon-v1.png"/g)||[]).length,3);
  assert(source.includes('prefers-reduced-motion'));assert(source.includes('visibilitychange'));assert(source.includes('IntersectionObserver'));
});
