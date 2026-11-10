# Hourglass e Designa: oportunidades de evolução

Análise em 10/11/2026, baseada no código do Designa e nas páginas públicas oficiais do Hourglass. O painel autenticado do Hourglass não foi testado. As prioridades abaixo são recomendações de produto, não funcionalidades já implementadas.

## O que o Designa já oferece

- Login compartilhado, uma congregação por conta, equipe e acesso por módulo, incluindo consulta sem edição.
- Oradores com programação, histórico, temas, discursos especiais e compartilhamento.
- Designações com funções e quantidades configuráveis, sugestão de escala, tempo sem exercer a função e avisos de conflito.
- Territórios com registros, cartões de mapa, dirigentes e campanhas.
- Pessoas e eventos compartilhados entre módulos.
- Quadro de anúncios com conteúdo combinado, modelos de PDF, prévia e cores personalizáveis.
- Instalação como aplicativo web e central de configurações.

## Referência do Hourglass

O Hourglass documenta notificações com aceite ou recusa de designações, ausências que evitam novas designações e uma abrangência maior de escalas, territórios e relatórios. Também oferece importação e exportação em vários formatos. Fontes: [recursos oficiais](https://www.hourglass-app.com/en/features/) e [apresentação do produto](https://www.hourglass-app.com/en/).

A principal oportunidade para o Designa é melhorar o ciclo entre planejar a escala e saber se as pessoas poderão cumpri-la. Mais modelos de PDF ajudam na apresentação, mas não substituem esse acompanhamento.

## Melhorias sugeridas, em ordem

| Prioridade | Melhoria | Situação no Designa | Ganho e implementação necessária |
|---|---|---|---|
| 1 | Ausências e indisponibilidade | Os conflitos atuais consideram escalas; não encontrei períodos pessoais de ausência nas regras | Registrar início/fim e funções ou reuniões afetadas. Excluir indisponíveis da sugestão e avisar no agendamento manual. Exige persistência e integração com `designacoes/regras.js`. |
| 2 | Minha semana + confirmação | As contas acessam módulos; não encontrei um vínculo explícito entre conta e pessoa designada nem confirmação de presença | Vincular conta a `cong_pessoas`, mostrar responsabilidades próprias e permitir confirmar/recusar. Criar acesso restrito a essas informações, sem conceder acesso administrativo ao restante da congregação. |
| 3 | Rascunho e publicação da escala | O quadro é gerado a partir dos registros atuais | Separar planejamento de programação publicada; manter revisão, data de publicação e histórico. Evita distribuir um PDF incompleto e permite identificar versões antigas. |
| 4 | Painel único de pendências | Já há próximos compromissos e pendências de Oradores | Acrescentar funções vagas, recusas aguardando substituição e conflitos de Designações, com botão que abre a reunião correspondente. Reaproveitar as regras existentes, sem duplicar cadastros. |
| 5 | Avisos e calendário pessoal | Compartilhamento e notificações locais já existem | Começar com exportação `.ics` das responsabilidades; depois oferecer lembretes com preferência de horário. Push e confirmação precisam de infraestrutura e vínculo com a conta; compartilhar no WhatsApp continua dependendo da ação do usuário. |
| 6 | Histórico do quadro e preferências compartilhadas | Cores são locais ao navegador e ajustes manuais são temporários | Salvar preferências e revisões por congregação, com permissões e indicação de quem publicou. Conservar as opções pessoais separadas do padrão da equipe. |

## Sequência recomendada

1. Implementar indisponibilidade junto das regras já existentes de sugestão de escala.
2. Criar o vínculo conta–pessoa e a área Minha semana, com confirmação e substituição.
3. Acrescentar publicação, revisão e painel integrado de pendências.

Limpeza, serviço de campo e relatórios ministeriais podem ser expansões futuras. Não recomendo ampliar esses cadastros antes de fechar o fluxo de designações que o sistema já atende.

## Separação do Quadro concluída nesta alteração

`/quadro` agora tem HTML, estilos, carregamento e inicialização próprios. Não redireciona para o Oradores e não carrega o aplicativo desse módulo. Continua reutilizando autenticação, catálogo e funções de geração de PDFs, mantendo os acessos existentes às fontes de dados. Os favoritos antigos `/oradores#quadro` encaminham para a nova página. Não foi necessário alterar o banco.
