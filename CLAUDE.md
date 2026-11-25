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

**Próximas etapas, nessa ordem:**

5. Adaptador `disk-web`: pasta local escolhida pelo usuário
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
