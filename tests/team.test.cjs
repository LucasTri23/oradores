const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function contexto({member=null,owner=false,confirm=true,rpcError=null}={}){
  const elements={};
  const el=id=>elements[id]??=(id==='leaveTeamTransfer'?{hidden:!owner}:{hidden:true,disabled:false,value:'',selectedOptions:[{textContent:'Novo responsável'}]});
  const calls=[],redirects=[],messages=[],removed=[];
  const ctx={document:{getElementById:el},currentUser:{id:'conta'},activeWorkspaceId:'atual',
    localStorage:{getItem:()=>null,setItem(){},removeItem:k=>removed.push(k)},
    location:{pathname:'/',replace:p=>redirects.push(p),reload:()=>redirects.push('reload')},
    supabase:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:member,error:null})})})}),rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:rpcError};}},
    confirmarModal:async(...args)=>{calls.push({name:'confirm',args});return confirm;},toast:m=>messages.push(m)};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('assets/js/features/team.js','utf8'),ctx);
  return {ctx,el,calls,redirects,messages,removed};
}

test('conta sem equipe não cria workspace automaticamente',async()=>{
  const {ctx,el,calls}=contexto();
  assert.equal(await ctx.initializeWorkspace(),false);
  assert.equal(ctx.activeWorkspaceId,null);
  assert.equal(el('workspaceWelcome').hidden,false);
  assert.equal(calls.length,0);
});
test('conta vinculada mantém sua equipe',async()=>{
  const {ctx,calls}=contexto({member:{workspace_id:'existente'}});
  assert.equal(await ctx.initializeWorkspace(),true);
  assert.equal(ctx.activeWorkspaceId,'existente');assert.equal(calls.length,0);
});
test('cancelar saída não altera o vínculo',async()=>{
  const {ctx,calls,redirects}=contexto({confirm:false});await ctx.sairDaCongregacao();
  assert.equal(calls.length,1);assert.equal(redirects.length,0);assert.equal(ctx.activeWorkspaceId,'atual');
});
test('saída confirmada remove seleção local e volta ao início',async()=>{
  const {ctx,calls,removed,redirects}=contexto();await ctx.sairDaCongregacao();
  assert.equal(calls[1].name,'leave_workspace');assert.equal(calls[1].args.successor_user,null);
  assert.equal(ctx.activeWorkspaceId,null);assert.equal(removed[0],'oradores_workspace');assert.equal(redirects[0],'/');
});
test('falha do banco mantém acesso e permite nova tentativa',async()=>{
  const {ctx,el,redirects}=contexto({rpcError:{message:'Tente novamente'}});await ctx.sairDaCongregacao();
  assert.equal(ctx.activeWorkspaceId,'atual');assert.equal(redirects.length,0);assert.equal(el('leaveTeamBtn').disabled,false);
});
test('proprietário precisa selecionar sucessor e confirmar transferência',async()=>{
  const {ctx,el,calls}=contexto({owner:true});await ctx.sairDaCongregacao();assert.equal(calls.length,0);
  el('leaveTeamSuccessor').value='sucessor';await ctx.sairDaCongregacao();
  assert.equal(calls[1].args.successor_user,'sucessor');assert.match(calls[0].args[1],/Novo responsável assumirá/);
});
