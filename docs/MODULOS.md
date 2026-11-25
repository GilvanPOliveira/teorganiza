# Mapa de módulos — referência NEXO

O NEXO (nexo.richardtjustke.tech) é a referência de **produto** do TeOrganiza:
módulos que se ligam e se desligam, que conversam entre si, um Início que
junta o dia, Ctrl+K para tudo, temas. Não é a referência de **armazenamento**:
o NEXO tem conta e servidor; o TeOrganiza continua sem servidor, com os dados
no navegador e num destino do usuário (pasta local agora, Google Drive depois).

Também não copiamos a identidade dele: nome, logo, ilustrações, capas e
textos são próprios. Copiamos a estrutura.

Este documento classifica os 27 itens da navegação do NEXO pelas formas de
dados de `ARQUITETURA.md` ("Mapa de módulos"). A regra continua a mesma: o
que define um módulo é a forma dos dados, não o assunto.

## As formas, ampliadas

As seis formas de `ARQUITETURA.md` cobrem a maior parte. O NEXO revela três
que não estavam lá:

| Forma | O que a caracteriza | Nova? |
| --- | --- | --- |
| Ledger | registros datados com valor, categoria e agregação | — |
| Calendário | início, fim, recorrência, lembrete | — |
| Itens com estado | texto curto, estado, prazo opcional, numa lista nomeada | — |
| Documentos | texto livre, encontrado por busca | — |
| Modelo + execução | definição reutilizada, execuções datadas com números | — |
| Alvo + progresso | meta, medida, prazo | — |
| **Check-in recorrente** | uma definição com frequência e uma marca por dia; o valor é a sequência | sim |
| **Registro diário** | um registro por dia com várias medidas pequenas (sono, água, humor) | sim |
| **Revisão espaçada** | cartões com histórico de respostas e data da próxima revisão | sim |

## Os 27, um por um

| NEXO | Vira | Forma | Observação |
| --- | --- | --- | --- |
| Início | shell (`/`) | — | Saudação, capa, captura rápida e widgets. Não é módulo |
| Tarefas | `lists` | Itens com estado | Captura em linguagem natural ("pagar a luz sexta #casa") é parser do módulo |
| Projetos | `lists` | Itens com estado | Projeto é uma lista com progresso |
| Kanban | `lists` | Itens com estado | Visão por coluna. **Decisão**: estado além de feito/não feito |
| Calendário | `calendar` | Calendário | Agrega o provedor `dated` dos outros |
| Lembretes | `calendar` | Calendário | Aparece no app; aviso fora do app depende de notificações (pós-v1) |
| Trabalho | `lists` | Itens com estado | Uma área (lista + tag), não um módulo. **A confirmar** o que o NEXO faz aqui |
| Metas | `goals` | Alvo + progresso | Mede pelo provedor `metrics` |
| Lar | `lists` | Itens com estado | Compras e tarefas da casa são listas; a recorrência vem de `habits` |
| Saúde | `health` | Registro diário | Sono, água, humor; remédios e consultas viram itens datados |
| Hábitos | `habits` | Check-in recorrente | Grade de 28 dias e sequência |
| Academia | `workouts` | Modelo + execução | Treino guiado, 1RM estimado, recordes |
| Dieta | `diet` | Ledger (calorias) | Tabela de alimentos embutida no build, sem rede. **Decisão**: licença da tabela TACO |
| Estudos | `study` | Revisão espaçada + itens | Trilha é lista; resumos são notas; flashcards são a forma nova |
| Leitura | `reading` | Alvo + progresso | Estante, páginas por dia; citações ficam no próprio módulo |
| Diário | `notes` | Documentos | Uma nota por dia; humor e sono ficam em `health` |
| Finanças | `finance` | Ledger | Já existe; importação CSV/OFX vem do protótipo |
| Notas | `notes` | Documentos | Mural e notas privadas; grafo e importação do Keep/Notion depois |
| Notícias | **fora** | — | Exige rede; módulo não faz requisição |
| Filmes e Séries | `lists` | Itens com estado | Lista manual; capa e catálogo exigem rede e ficam fora |
| Clientes | `clients` | Itens com estado | Cadastro simples |
| Cobranças | `finance` | Ledger | Conta a receber ligada a um cliente. **Decisão**: referência entre módulos |
| Arquivos | **fora** | — | Anexos são não-objetivo da v1 |
| Revisão da semana | shell | — | Lê `metrics` de todos; respostas da revisão viram nota |
| Produtividade | `focus` | Modelo + execução | Sessões de foco de 25 min, com estatística |
| Métricas | shell | — | Superfície do provedor `metrics` |
| Nex (IA) | **fora** | — | Exige servidor ou chave de API; incompatível com "sem servidor" |

Resultado: **13 módulos** (`finance`, `lists`, `calendar`, `notes`,
`habits`, `health`, `workouts`, `diet`, `study`, `reading`, `goals`,
`focus`, `clients`), **3 superfícies do shell**
(Início, Revisão da semana, Métricas) e **3 fora** (Notícias, Arquivos, Nex).

## Estrutura e design copiados

Do NEXO, o shell passa a ter:

- **Tema escuro por padrão**, com claro e uma cor de destaque escolhível.
  Os temas extras (vidro, capa) depois.
- **Navegação**: dock flutuante embaixo, com a opção de barra lateral. No
  celular, o dock vira a navegação inferior de até cinco itens.
- **Início**: saudação pela hora, data, capa (imagem própria), uma caixa de
  captura rápida (tarefa ou nota) e os widgets em cards.
- **Ctrl+K**: busca e ações em um lugar ("Nova tarefa", "Ir para Finanças").
  Usa o provedor `searchable`.
- **Atalhos de teclado**: G seguido de uma letra vai para um módulo.
- **Módulos ligáveis**: em Configurações → Módulos, cada um liga ou desliga.
  Desligado some da navegação, mas os dados ficam (mesma regra de
  "dado de módulo não instalado").

## Ordem das etapas

Aprovada em 25/11/2026; substitui a lista antiga de `CLAUDE.md`.

1. Scaffold do core — feita
2. Destino nenhum e adaptador `drive` — feita
3. Design system e shell novo: tokens, temas, dock/barra lateral, Início, Ctrl+K, módulos ligáveis, lixeira — feita
4. Tags no envelope e o seletor no `core/api` — feita
5. Adaptador `disk-web`: pasta local escolhida pelo usuário (Chrome e Edge no desktop) — feita
6. `finance` completo, com importação de extrato
7. `lists`: tarefas, projetos, kanban, lar, filmes
8. `habits`
9. `calendar` e o provedor `dated`
10. `notes` e diário
11. `health`
12. `workouts`
13. `goals`, Métricas e Revisão da semana (provedor `metrics`)
14. `focus`, `reading`, `study`, `diet`, `clients`

A captura rápida do Início ("pagar a luz sexta #casa") chega com `lists`,
que é o primeiro módulo com algo para capturar.

## Decisões abertas criadas por este mapa

- Kanban: `lists` ganha um estado configurável por lista, ou kanban é outro módulo?
- Cobranças: como um lançamento de `finance` aponta para um cliente de `clients` sem um módulo ler o outro?
- Dieta: a tabela TACO pode ser embutida no build (licença)?
- Trabalho: o que exatamente o NEXO agrupa nessa área?
