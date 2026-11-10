const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const PdfPaleta=require('../assets/shared/pdf-paleta.js'),{jsPDF}=require('../assets/js/vendor/jspdf.umd.min.js'),{criarPdfDesignacoes,criarPdfTabelas}=require('../designacoes/pdf.js');

test('valida cores e escolhe texto de cabeçalho conforme a luminosidade',()=>{
  assert.equal(PdfPaleta.criar('cartoes',{principal:'#ff0000'}).principal,'#ff0000');
  assert.equal(PdfPaleta.criar('cartoes',{principal:'inválida'}).principal,PdfPaleta.padroes.cartoes.principal);
  assert.equal(PdfPaleta.criar('cartoes',null).principal,PdfPaleta.padroes.cartoes.principal);
  assert.equal(PdfPaleta.contraste('#ffffff'),'#10252d');assert.equal(PdfPaleta.contraste('#000000'),'#ffffff');
});

const reunioes=[4,7,11,14,18,21,25,28].map((d,i)=>({data:'2026-11-'+String(d).padStart(2,'0'),tipo:i%2?'fim':'meio',linhas:[{funcao:'Áudio e vídeo',nomes:['Guilherme']},{funcao:'Microfones',nomes:['Marcos Araújo']},{funcao:'Indicadores',nomes:['José Silva','Lucas Costa']}]}));
test('cartões horizontais do anexo acomodam oito reuniões com três funções em uma página',()=>{
  const pdf=criarPdfDesignacoes(jsPDF,[{data:new Date(2026,10,1),reunioes}],'Vera Cruz de Minas',{principal:'#ff0000'});
  assert.equal(pdf.getNumberOfPages(),1);assert(pdf.output().includes('Guilherme'));assert(pdf.output().includes('1. 0. 0. rg'));
});

test('o modelo Word aplica a paleta e mantém os dados das tabelas',()=>{
  const pdf=criarPdfTabelas(jsPDF,[{data:new Date(2026,10,1),discursos:[{data:'07/11',nome:'Orador Teste',tema:'Tema Teste',cong:'Central'}]}],{congregacao:'Central',cores:{principal:'#ff0000',destaque:'#00ff00'}});
  assert(pdf.output().includes('ORADOR TESTE'));assert(pdf.output().includes('1. 0. 0. rg'));assert(pdf.output().includes('0. 1. 0. rg'));
});

test('cores ficam separadas por modelo e congregação; restaurar afeta apenas o modelo atual',()=>{
  const elements={},store=new Map();let modelo='cartoes';
  const el=id=>elements[id]??={value:'',addEventListener(){}};
  const c={document:{getElementById:el,querySelector:()=>({value:modelo})},PdfPaleta,Date,Map,isoLocal:()=> '2026-11-01',activeWorkspaceId:'A',localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setTimeout:()=>0,clearTimeout(){}};
  vm.createContext(c);vm.runInContext(fs.readFileSync('assets/js/features/noticeboard.js','utf8'),c);
  c.sincronizarCoresQuadro();el('quadroCor-principal').value='#ff0000';c.salvarCoresQuadro();assert.equal(c.coresQuadroAtuais().principal,'#ff0000');
  modelo='word';assert.equal(c.coresQuadroAtuais().principal,PdfPaleta.padroes.word.principal);c.sincronizarCoresQuadro();el('quadroCor-principal').value='#00ff00';c.salvarCoresQuadro();
  modelo='cartoes';assert.equal(c.coresQuadroAtuais().principal,'#ff0000');c.salvarCoresQuadro(true);assert.equal(c.coresQuadroAtuais().principal,PdfPaleta.padroes.cartoes.principal);
  modelo='word';assert.equal(c.coresQuadroAtuais().principal,'#00ff00');c.activeWorkspaceId='B';assert.equal(c.coresQuadroAtuais().principal,PdfPaleta.padroes.word.principal);
});
