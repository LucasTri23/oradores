const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {jsPDF}=require('../assets/js/vendor/jspdf.umd.min.js');

function setup(){
  const elements={};
  const node=()=>({style:{},children:[],value:'',checked:false,hidden:false,append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},replaceChildren(){this.children=[];},addEventListener(event,fn){this[event]=fn;}});
  const el=id=>elements[id]??=node();
  const c={document:{getElementById:el,createElement:node},Date,Map,isoLocal:()=> '2026-11-01',fD:d=>d,discursos:[],programa:[],TL:{},completarDadosPrograma:r=>r,allMeetingDays:()=>['2026-11-07','2026-11-14','2026-11-21','2026-11-28']};
  vm.createContext(c);vm.runInContext(fs.readFileSync('assets/js/features/noticeboard.js','utf8'),c);
  el('quadroQuantidade').value='1';return {c,el};
}

test('novo PDF inclui responsáveis somente quando solicitado',()=>{
  const {c}=setup();const meses=c.dadosQuadroAnuncios('2026-11',1);
  meses[0].linhas[0].presidente='José da Silva';meses[0].linhas[0].leitor='Lucas Costa';
  const com=c.criarPdfQuadro(jsPDF,meses,'Vera Cruz de Minas',true);
  assert.equal(com.getNumberOfPages(),1);assert(com.output().includes('PRESIDENTE'));assert(com.output().includes('Lucas Costa'));
  const sem=c.criarPdfQuadro(jsPDF,meses,'Vera Cruz de Minas',false);
  assert(!sem.output().includes('PRESIDENTE'));assert(!sem.output().includes('Lucas Costa'));
  assert.equal(c.criarPdfQuadro(jsPDF,[...meses,...meses,...meses],'Vera Cruz de Minas',true).getNumberOfPages(),3);
});

test('nomes manuais ficam associados à data ao alternar a opção',()=>{
  const {c,el}=setup();el('quadroIncluirResponsaveis').checked=true;c.renderResponsaveisQuadro();
  assert.equal(el('quadroResponsaveis').children.length,5,el('quadroResponsaveis').children[0]?.textContent);
  const input=el('quadroResponsaveis').children[1].children[1].children[0].children[1];
  input.value='Presidente manual';input.input();
  el('quadroIncluirResponsaveis').checked=false;c.renderResponsaveisQuadro();assert(el('quadroResponsaveis').hidden);
  el('quadroIncluirResponsaveis').checked=true;c.renderResponsaveisQuadro();
  assert.equal(el('quadroResponsaveis').children[1].children[1].children[0].children[1].value,'Presidente manual');
});
