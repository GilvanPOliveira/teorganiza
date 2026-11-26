# TeOrganiza — instruções do projeto

Dashboard pessoal local-first e modular. Sem backend: os dados do usuário
ficam no destino que ele escolher (disco ou Google Drive dele), e o app
mantém uma cópia de trabalho local.

**A autoridade é `docs/ARQUITETURA.md`.** Ele traz a concepção inteira, com
o porquê de cada decisão. Leia a seção relevante antes de mexer em qualquer
coisa estrutural. O que está abaixo são só as regras que não se negociam.

---

## 1. A fronteira — a regra que sustenta o projeto

```
core/     NUNCA importa de modules/
modules/  importa de @core/api e de mais nada em core/
modules/  NUNCA importa outro módulo
```

Verificada pelo ESLint (`eslint.config.js`), não por convenção. CI falha na
violação.

**Se um módulo precisa de algo que `@core/api` não expõe, isso é uma
mudança no contrato — abra uma issue, nunca um atalho.** Não adicione o
import e siga em frente; não relaxe a regra do lint.

## 2. O envelope

Todo registro do sistema vive no mesmo envelope, e é isso que permite ao
núcleo mesclar dados que ele não conhece.

**Módulos nunca montam um envelope.** Eles passam `data`; o núcleo preenche
`id`, `createdAt`, `updatedAt`, `deviceId`, `rev`, `schemaVersion` e `tags`.

Dois campos que parecem detalhe e não são:

- `deletedAt` — delete é sempre tombstone. Nada é removido fisicamente.
  Sem isso, apagar num dispositivo ressuscita no próximo sync.
- `tags` — mora no envelope, não em `data`, porque o núcleo pode ler
  qualquer coleção e assim resolve consultas transversais sem provedor.

## 3. Provedor ou evento

- **Provedor** (`provides`): estado consultável, puxado, derivado na
  leitura, nunca armazenado. É o mecanismo **principal** de integração.
- **Evento** (`emits`/`listens`): fato pontual, empurrado, fire-and-forget.
  Secundário. Na v1 ninguém escuta.

Regra: se o consumidor precisa que o dado continue correto depois, é
provedor. Se só precisa reagir uma vez, é evento.

Nunca materialize cópia de dado de outro módulo. O calendário pergunta a
cada abertura; metas calculam progresso na leitura.

## 4. O que `@core/api` nunca expõe

| Não exposto | Motivo |
| --- | --- |
| Dexie cru | Trocar o banco local quebraria todos os módulos |
| Adaptadores de storage | Sync é responsabilidade exclusiva do núcleo |
| Coleções de outros módulos | Integração é por provedor ou evento |
| Acesso à rede | Módulo não faz requisição |
| `localStorage` | Dado fora do envelope não sincroniza nem migra |

## 5. Idioma

- Código, tipos, nomes de coleção e campo, commits, issues, PRs: **inglês**
- `README` e docs do contrato: **inglês**
- Documentação de uso e notas de projeto (`docs/`, este arquivo): **português**
- Interface: i18n desde sempre, pt-BR padrão. **Nenhuma string literal na
  UI** — tudo passa pelo `useT` do módulo.

## 6. Dinheiro e datas

- Valores são **inteiros em centavos**. Nunca `float`.
- Datas em ISO 8601. `createdAt`/`updatedAt` são metadado de sync, nunca
  eixo de calendário — a "data que importa" é semântica de cada módulo e
  sai pelo provedor `dated`.
- Formatação sempre por `useFormat`, nunca à mão.

## 7. Comandos

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # typecheck + build de produção
npm test           # suíte do core
npm run lint       # inclui a fronteira arquitetural
```

Antes de dar qualquer tarefa por concluída: `npm run lint && npm test && npm run build`.

## 8. Onde o projeto está

O produto segue o NEXO como referência de estrutura (módulos ligáveis, Início,
Ctrl+K, dock) e continua **sem servidor**. O mapa completo dos módulos e a
ordem das etapas estão em `docs/MODULOS.md`.

Concluídas:

1. Scaffold do core
2. Destino nenhum e adaptador `drive`, com merge de três vias e trava
   (o Drive ainda não foi testado com um client id real)
3. Design system e shell novo: tema escuro padrão, claro e sistema, seis
   cores de destaque, dock ou barra lateral, Início com capa, Ctrl+K,
   atalhos G + letra, módulos ligáveis e lixeira
4. Tags no envelope (`core/tags`), o `TagPicker`/`TagList` no `core/api` e a
   página que junta tudo de uma tag
5. Adaptador `disk-web`: pasta escolhida pelo usuário (Chrome e Edge no
   desktop), mesmo formato de arquivos do Drive, etag por SHA-256 do conteúdo
6. As 27 áreas do NEXO em primeira versão: 13 módulos (`lists`, `calendar`,
   `notes`, `habits`, `goals`, `health`, `workouts`, `diet`, `study`,
   `reading`, `finance` com Cobranças, `clients`, `focus`), Revisão da semana
   e Métricas no shell, e Notícias, Arquivos e Nex como prévias que explicam
   por que ainda não funcionam. Um módulo oferece várias áreas pela
   propriedade `area` das rotas. Os módulos novos só têm textos em pt-BR.
7. Navegação enxugada para 15 áreas. Uma entrada com `within` vira aba de
   outra área, do mesmo módulo ou de outro, sem mover dado: Trabalho e Lar
   em Tarefas, Kanban (Quadro) em Projetos, Lembretes na Agenda, Academia e
   Dieta em Saúde, Filmes e Séries na Estante, Cobranças em Clientes.
   Métricas virou o cartão "Uso por módulo" da Revisão da semana; as três
   prévias saíram e voltam quando funcionarem. `/metrics` e `/previews/*`
   redirecionam.
8. 11 áreas, e o que tinha saído voltou dentro delas:
   - Junções: Diário e Arquivos em Notas, Hábitos em Metas, Foco em
     Tarefas, Cobranças e Clientes em Finanças.
   - Links salvos: aba da Estante, coleção `reading/links`.
   - Nex: por decisão, **sem IA e sem API por enquanto**. Existe só como
     lugar no app (`core/nex/open.ts`, `NexPanel`): um item no Ctrl+K e um
     cartão em Configurações dizendo que ainda não está ativo. Nada sai do
     navegador. Não adicionar SDK, chave ou chamada de API sem pedido
     explícito.
   - Arquivos: coleção `core/files` (metadados, sincroniza como qualquer
     registro) e conteúdo por hash num IndexedDB próprio
     (`core/files/blobs`). Com destino, o conteúdo vai para
     `TeOrganiza/_files/<hash>` depois dos registros. Qualquer módulo
     anexa com `<Attachments collection id />`; hoje: notas, tarefas,
     clientes e lançamentos.
9. Módulos vivos, ligados pelo núcleo:
   - Contrato `provides` no `Module`: `dated` (o que acontece num dia) e
     `progress` (o que uma meta pode seguir). O núcleo chama cada módulo
     com um leitor limitado às coleções dele (`core/providers/collect`) e
     entrega o resultado por `useDated` e `useProgressSources`. Nenhum
     módulo lê dados de outro.
   - Projetos: lista com prazo; abrir um projeto abre o quadro dele
     (A fazer · Fazendo · Feito). Metas podem seguir um projeto. A Agenda
     mostra tarefas com data e prazos de projetos e metas.
   - Início: Hoje (atrasados, hoje, próximos 7 dias, o que foi registrado),
     Semana (a revisão) e Painel (widgets). Avisos do navegador enquanto o
     app está aberto.
   - Tarefas com seletor Todas/Trabalho/Lar. Estante com Livros, Filmes e
     séries e Música, nos estados Quero · Em andamento · Concluído · Tenho.
   - Saúde: Dia · Hábitos · Treino · Refeições · Exames (com laudo anexo).
   - Agenda: Calendário · Lembretes · Notas · Diário.
   - Arquivos como área: filtros, player de áudio e vídeo, e links
     (`core/links`) que se anexam a qualquer registro.
   - `src/migrations.ts` move dados entre módulos quando a forma muda
     (filmes da lista antiga para a Estante, links para Arquivos).

**Próximas etapas — aprofundar o que já existe, nessa ordem:**

6. Módulo `finance` completo, com importação de extrato
7. `lists` · 8. `habits` · 9. `calendar` · 10. `notes` · 11. `health` ·
   12. `workouts` · 13. `goals`, Métricas e Revisão da semana ·
   14. `focus`, `reading`, `study`, `diet`, `clients`

O bloco `provides` já deve existir nos tipos, mesmo sem implementação: ele
precisa estar no contrato antes de a `apiVersion 1` congelar. A agregação no
núcleo só é escrita com o `calendar`.

## 9. Decisões ainda abertas

Nenhuma bloqueia a implementação, mas não as invente sozinho — pergunte:

- Recorrência em `finance`: lançamentos materializados ou projeção?
- Transferência entre contas: um registro com duas pontas ou dois ligados?
- Domínio e escopo npm `@teorganiza`
- Fluxo OAuth no desktop: loopback ou deep link (só quando o Drive chegar ao Tauri)

## 10. Não-objetivos declarados da v1

Registrados como decisão, não esquecimento — não os implemente por conta própria:

- **Anexos / arquivos binários.** Binário não é JSON e quebra o modelo de merge.
- **Notificações.** Os eventos existem para isso, mas a superfície vem depois.
- **Sandbox de módulos.** A fronteira é de build, não de execução. Não prometa
  segurança que o projeto não entrega.
