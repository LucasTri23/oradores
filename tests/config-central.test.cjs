const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Congregacao=require('../assets/shared/congregacao.js'),Regras=require('../designacoes/regras.js');
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.attributes={};this.value='';this.textContent='';this.className='';this.style={};this.classList={add:(...classes)=>this.className+=' '+classes.join(' ')};}
  append(...nodes){nodes.forEach(n=>{if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(c=>c!==n);n.parentElement=this;this.children.push(n);});}
  appendChild(n){this.append(n);return n;}replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  before(n){const p=this.parentElement;p.children.splice(p.children.indexOf(this),0,n);n.parentElement=p;}
  setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,f){this.listeners[k]=f;}
  add(option){this.append(option);}get options(){return this.children;}get selectedOptions(){return this.children.filter(c=>c.value===this.value);}
  focus(){}querySelector(selector){return this.all().find(n=>selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tagName===selector)||null;}
  all(){return this.children.flatMap(n=>[n,...n.all()]);}
}
test('central mostra dirigentes marcados ao abrir e atualiza a lista após salvar Funções, preservando telefone editado',async()=>{
  const container=new Element('div'),nameCard=new Element('div'),nameButton=new Element('button');nameCard.append(nameButton);
  const ids={configNomeCard:nameCard,cfgNomeBtn:nameButton},central=[{id:'a',nome:'Bruno',telefone:'31999998888'},{id:'b',nome:'Igor'}];
  let desig=[{id:'a',funcoes:{dirigente_campo:true}},{id:'b',funcoes:{}}],pending;
  const store={ler:async()=>({}),salvar:async()=>true};
  const c={window:{},document:{createElement:t=>new Element(t),getElementById:id=>ids[id]||null},Option:function(text,value){const o=new Element('option');o.textContent=text;o.value=value;return o;},
    Conta:{supabase:async()=>({}),podeVer:()=>true,podeEditar:()=>true},ConfigStore:{criar:()=>store},Regras,
    Congregacao:{...Congregacao,listar:async(sb,ws,col)=>col==='cong_pessoas'?central:desig,salvar:async(sb,ws,u,col,id,data)=>{desig=desig.map(p=>p.id===id?{...data,id}:p);}},
    FormUX:{rastrear:()=>({marcar(){}}),executar:(form,b,status,action)=>pending=action()},confirm:()=>true};
  vm.createContext(c);vm.runInContext(fs.readFileSync('assets/shared/config-central.js','utf8'),c);
  await c.window.ConfigCentral.montar({container,vinc:{workspaceId:'w'},user:{id:'u'}});
  const forms=container.all().filter(n=>n.tagName==='form'),find=title=>forms.find(f=>f.children[0].textContent===title);
  const dirigeants=find('Dirigentes — Territórios');assert(dirigeants,'A central terminou de montar');
  assert(dirigeants.all().some(n=>n.tagName==='input'&&n.value==='Bruno'));
  const phone=dirigeants.all().find(n=>n.tagName==='input'&&n.type==='tel');phone.value='5531888887777';
  const functions=find('Funções das pessoas'),check=functions.all().find(n=>n.attributes['aria-label']==='Igor — Dirigente de campo');check.checked=true;
  functions.listeners.submit({preventDefault(){}});await pending;
  assert(dirigeants.all().some(n=>n.tagName==='input'&&n.value==='Igor'));
  assert(dirigeants.all().some(n=>n.tagName==='input'&&n.value==='5531888887777'));
});
