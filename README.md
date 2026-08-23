# Oradores

Aplicativo estático para programação e histórico de discursos, preparado para Supabase e Vercel.

## Implantação

1. Crie um projeto no Supabase e execute [`supabase.sql`](./supabase.sql) no SQL Editor.
2. Em Authentication → Providers, habilite Google e configure o Client ID e Client Secret. Em URL Configuration, cadastre a URL de produção da Vercel como Site URL e Redirect URL.
3. Na Vercel, importe este repositório e configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (ou `SUPABASE_ANON_KEY`).
4. Faça o deploy. A chave usada no navegador é pública por definição; cada conta Google só acessa seus próprios dados graças às políticas RLS.

## Migração do Firebase

Antes de desligar a versão antiga, exporte Oradores, Programação e Histórico em Excel. Na nova versão, entre com a conta Google que será dona dos dados antigos, use **Oradores → Importar lista** para o cadastro inicial e o botão de pasta no topo para o histórico/programação. Registros repetidos da lista são ignorados por nome + congregação.

Cada usuário começa com dados separados. Em **Oradores → Compartilhar lista**, é possível gerar uma cópia temporária por link, válida por sete dias. O destinatário entra com Google e confirma a importação para a própria conta.

## Uso local

Use `vercel dev` com as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` configuradas no ambiente. As credenciais técnicas não aparecem na interface; o usuário vê somente **Entrar com Google**.
