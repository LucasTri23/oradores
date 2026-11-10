# Designa

## Escolha de módulos da congregação

Antes de publicar esta atualização, execute `migrations/20261109-workspace-modules.sql` no SQL Editor do Supabase (ou o `supabase.sql` completo atualizado). No próximo acesso do proprietário, inclusive por um link direto de módulo, ele escolhe os módulos usados pela congregação. A escolha aparece uma vez e pode ser alterada em **Início → Configurações → Módulos da congregação**. Integrantes não recebem essa pergunta. Módulos desativados preservam seus dados e permissões, mas ficam indisponíveis; a escolha é aplicada também nas políticas de leitura e gravação do banco.

Sistema da congregação com módulos integrados, preparado para Supabase e Vercel:

- **Oradores** (`/oradores`): programação e histórico de discursos.
- **Territórios** (`/territorios`): registro de territórios, cartões de mapa, dirigentes e campanhas.
- **Designações** (`/designacoes`): presidente, leitor, indicadores, microfones e áudio e vídeo das reuniões do meio de semana e do fim de semana, com avisos de conflito, tempo sem fazer cada função, sugestão automática e PDF do quadro de anúncios.
- **Quadro de anúncios** (`/quadro`): página independente para preparar, conferir e compartilhar os PDFs de Oradores, Designações e programação completa. Usa os acessos existentes às fontes de dados.

A tela inicial (`/`) faz o login com Google e mostra os módulos liberados para a conta. O proprietário da congregação escolhe, na própria tela inicial, quem pode editar Oradores, Territórios ou os dois. O nome do sistema fica em `assets/shared/conta.js` (`APP_NOME`).

## Estrutura

```text
index.html                    Tela inicial: login, escolha do módulo e acessos da equipe
oradores/index.html           Estrutura das telas do Oradores
territorios/index.html        App de Territórios
territorios/bridge.js         Liga o app de Territórios ao Supabase (coleções terr_*)
designacoes/                  Módulo Designações (regras.js, app.js, pdf.js; coleções desig_*)
quadro/                       Página própria, inicialização, leitura de dados e modelos do quadro
assets/shared/conta.js        Login, congregação e módulos compartilhados
assets/css/style.css          Tema, componentes e responsividade
assets/js/app.js              Estado, navegação e utilitários
assets/js/data.js             Catálogo estático de temas
assets/js/supabase-client.js  Autenticação e persistência
assets/js/features/           Funcionalidades separadas por domínio
api/config.js                 Variáveis públicas na Vercel
supabase.sql                  Banco de dados e políticas RLS
```

## Implantação

1. Crie um projeto no Supabase e execute [`supabase.sql`](./supabase.sql) no SQL Editor.
2. Em Authentication → Providers, habilite Google e configure o Client ID e Client Secret. Em URL Configuration, cadastre a URL de produção da Vercel como Site URL e, em Redirect URLs, `https://SEU-DOMINIO/**` (o login pode voltar para `/`, `/oradores` ou `/territorios`).
3. Na Vercel, importe este repositório e configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (ou `SUPABASE_ANON_KEY`).
4. Faça o deploy. A chave usada no navegador é pública por definição; cada conta Google só acessa seus próprios dados graças às políticas RLS.

## Migração do Firebase

Antes de desligar a versão antiga, exporte Oradores, Programação e Histórico em Excel. Na nova versão, entre com a conta Google que será dona dos dados antigos, use **Oradores → Importar lista** para o cadastro inicial e o botão de pasta no topo para o histórico/programação. Registros repetidos da lista são ignorados por nome + congregação.

Cada usuário começa com dados separados. Em **Minha Cong. → Compartilhar oradores**, é possível selecionar oradores marcados como pertencentes à congregação local. O envio pode ser feito dentro do sistema usando o código da congregação destinatária ou por um link temporário válido por sete dias. O destinatário recebe uma notificação, revisa registros novos e duplicados por nome + congregação e decide se aceita ou recusa.

## Uso local

Use `vercel dev` com as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` configuradas no ambiente. As credenciais técnicas não aparecem na interface; o usuário vê somente **Entrar com Google**.
# Acesso compartilhado

Depois de atualizar o projeto, execute novamente todo o arquivo `supabase.sql` no SQL Editor do Supabase. Ele preserva os registros existentes, cria uma equipe para o usuário atual e ativa as políticas de acesso compartilhado.

Em **Configurações > Equipe da congregação**, o proprietário pode criar um convite de uso único, válido por 24 horas. A pessoa convidada abre o link, entra com Google e passa a acessar a mesma programação, histórico, configurações e lista de oradores. O proprietário pode revogar o acesso na mesma tela.

Para grupos do WhatsApp, configure o modelo em **Configurações > Mensagem para grupo**. Na Home, use **Enviar para grupo** e escolha o grupo dentro do WhatsApp. Por segurança, o navegador não recebe a lista de grupos nem seleciona um destinatário automaticamente.

## Um workspace por conta

Cada conta pode pertencer a somente um workspace. Execute o `supabase.sql` atualizado para aplicar a restrição no banco. Convites para outra equipe são recusados enquanto houver um vínculo existente; o convite não é consumido e a conta continua acessando sua equipe atual.

Se a atualização apontar vínculos duplicados, consulte os casos antes de decidir qual acesso manter:

```sql
select user_id, array_agg(workspace_id order by joined_at) as workspaces
from public.workspace_members
group by user_id
having count(*) > 1;
```

A atualização não escolhe nem exclui vínculos automaticamente. Uma conta nova que chega por convite entra diretamente na equipe convidada, sem criar um workspace pessoal antes.

## Módulos e acessos

Depois de atualizar, execute novamente todo o `supabase.sql`. Quem já estava na equipe continua só com **Oradores**; o proprietário acessa tudo. Em **Início → Configurações da congregação**, o proprietário escolhe para cada pessoa, em cada módulo, **Editar**, **Só ver** ou **Sem acesso**, e cria convites já com esses acessos. As imagens dos cartões de mapa ficam no Storage do Supabase (bucket `territorios`, criado pelo `supabase.sql`). O Designa pode ser instalado no celular (`manifest.webmanifest` + `sw.js`).

Para trazer os dados da versão antiga de Territórios (Firebase), abra **Territórios → Config → Importar do Firebase antigo**, cole as credenciais antigas e clique em **Importar dados**. Faça isso uma vez só.

## Dados da congregação (todos os módulos)

- **Pessoas** (Início → Pessoas, coleção `cong_pessoas`): lista única com nome, grupo, telefone e situação. As Designações usam esta lista (as funções de cada pessoa ficam em `desig_pessoas`) e os Territórios permitem escolher dirigentes dela. O botão "Juntar cadastros existentes" traz quem já estava nos módulos.
- **Eventos** (Início → Eventos, coleção `cong_eventos`): assembleia, congresso, visita do superintendente, Celebração. A pessoa escolhe se ocupa só os dias do evento ou a semana toda, se terá designações e se fica sem discurso público. Ao salvar, o Oradores e as Designações são atualizados; ao apagar ou mudar, o que existia antes volta.
- Qualquer integrante vê esses dados; quem pode editar algum módulo pode alterá-los.

## Navegação, configurações e quadro de anúncios

- O seletor compartilhado oferece Início, módulos permitidos, Quadro de anúncios e Configurações.
- **Início → Configurações** reúne congregação, equipe e preferências de cada módulo. Os formulários dos módulos são carregados sob demanda na central e mantêm suas permissões e gravações existentes.
- **Quadro de anúncios** (`/quadro`) está disponível para quem acessa Oradores ou Designações. O seletor de conteúdo oferece Oradores, Indicadores e designações ou Programação completa, conforme as permissões. A prévia é o PDF real, atualizado ao mudar período, modelo ou responsáveis; também pode ser aberta em outra aba.
- Modelos: Cartões, Editorial, Compacto, Tabelas do Word e Ilustrado (com folhas vetoriais, sem logotipo). Os cartões de designações seguem o modelo de escala horizontal, com funções em colunas e paginação para funções extras e nomes longos. A programação completa usa as tabelas do Word, reunindo discursos, presidência/leitor, indicadores, microfones, áudio/vídeo e Zoom, conforme as funções configuradas. O modelo ilustrado está disponível para Oradores e Indicadores.
- **Cores deste modelo** permite escolher principal, destaques, apoio, fundo e texto, com atualização da prévia. As preferências são locais ao navegador, separadas por congregação e modelo, e podem ser restauradas individualmente. O texto sobre fundos de cabeçalho se ajusta automaticamente para manter contraste.
- Presidente e leitor continuam vindo das Designações quando disponíveis, com ajustes manuais no quadro. A opção de baixar ou compartilhar usa o modelo selecionado.
- A rota `/quadro` tem página, estilos e inicialização próprios. Não abre o Oradores por trás. O endereço antigo `/oradores#quadro` encaminha para `/quadro`. Não é necessário executar SQL para esta atualização.
- A barra superior mantém a troca de módulos à esquerda e as ações da conta à direita em todos os módulos e no Início.
