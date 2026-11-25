# TeOrganiza — Contrato de Módulo e Camada de Storage

Nov 22, 2026 · @Gilvan Oliveira · apiVersion 1 (rascunho)

## O que está congelado aqui

Quatro coisas neste documento são contrato: mudar qualquer uma delas quebra módulos de terceiros e exige subir a `apiVersion`. Todo o resto é implementação livre.

| Congelado (apiVersion 1) | Livre para mudar |
| --- | --- |
| Envelope de registro | Componentes de UI e bibliotecas |
| Interface `Module` e `CollectionDef` | Estrutura interna do `core/` |
| Interface `StorageAdapter` | Nomes e layout de arquivos no destino |
| Algoritmo de merge e resolução | Telas, rotas e estilo |

Quem lê: você, e qualquer pessoa escrevendo um módulo para o TeOrganiza.

## Cinco regras invioláveis

A regra 1 é a que decide se o projeto cresce por contribuição ou por fork divergente.

1. **`core/` nunca importa de `modules/`.** Módulos importam exclusivamente de `core/api`, a única superfície pública. Se um módulo precisa de algo que `core/api` não expõe, isso é uma issue no contrato — não um atalho local.
2. **Sem backend.** Nenhum dado do usuário passa por servidor do projeto. O único tráfego externo é entre o app e o destino escolhido pelo próprio usuário.
3. **Dados são arquivos legíveis.** JSON com schema versionado, exportável e inspecionável a qualquer momento, sem o app.
4. **Nunca perder dado.** Conflito é sempre resolvido pelo usuário. Sobrescrita silenciosa não existe em nenhum caminho de código.
5. **O destino é plugável e opcional.** O app funciona por completo sem destino nenhum configurado.

## Convenções de idioma

Código em inglês, documentação de uso em português, interface nos dois.

| Onde | Idioma |
| --- | --- |
| Código, nomes de API, tipos, coleções, campos | inglês |
| Commits, issues, pull requests | inglês |
| README e documentação do contrato de módulo | inglês |
| Documentação de uso e notas de projeto, como este documento | português |
| Interface | i18n desde o dia 1, pt-BR padrão, en disponível |

O README e o contrato de módulo são o que um contribuidor estrangeiro lê antes de decidir participar — por isso esses dois, e só esses, saem em inglês.

Nenhuma string literal na interface: toda palavra visível passa pelo `useT` do módulo. Rotear desde a primeira tela custa quase nada; retrofitar quinze telas custa caro.

## Camadas

```
  finance        lists        calendar       notes      workouts     goals
     |             |             |             |            |          |
     +-------------+------+------+------+------+------------+----------+
                           |
          core/api  —  ÚNICA superfície pública para módulos
                           |
          Cópia de trabalho · Dexie / IndexedDB
          (leitura e escrita acontecem SEMPRE aqui)
                           |            pull e push
          Camada de sync · base, etag, merge, trava
                           |
     +---------------+-----+-----+---------------+
     |               |           |               |
  disco·web     disco·Tauri   Google Drive   nenhum destino
```

Sem destino escolhido, a cópia local existe e funciona: o navegador não é um
destino, é a ausência de um.

A cópia de trabalho em IndexedDB é o banco real do app, e é sempre ela que os módulos leem e escrevem. O destino só é tocado durante o sync. Isso significa que o modo "navegador" não é um terceiro backend — é simplesmente nenhum destino configurado, e por isso é transitório por desenho.

## O envelope de registro

Todo dado do TeOrganiza é um registro no mesmo envelope, qualquer que seja o módulo. É isso que permite ao núcleo fazer merge sem saber nada sobre finanças, treinos ou listas.

```typescript
interface Envelope<T> {
  id: string                // UUID v7 — ordenável por tempo de criação
  createdAt: string         // ISO 8601, UTC
  updatedAt: string         // ISO 8601, UTC
  deletedAt: string | null  // tombstone
  deviceId: string          // quem fez a última alteração
  rev: number               // revisões locais desde o último sync
  schemaVersion: number     // versão do schema da coleção
  tags: string[]            // ids de core/tags — transversal a todo módulo
  data: T                   // validado pelo schema do módulo
}
```

| Campo | Por que existe |
| --- | --- |
| `id` | UUID v7 em vez de v4: ordena por tempo de criação sem índice extra, e evita colisão entre dispositivos offline |
| `updatedAt` | Base da comparação no merge |
| `deletedAt` | **O campo crítico.** Sem tombstone, um registro apagado num dispositivo parece "ausente" no outro, e o merge o ressuscita. É o bug clássico desse tipo de sync |
| `deviceId` | Permite dizer ao usuário *onde* a alteração foi feita no diálogo de conflito |
| `rev` | Detecta alteração local sem comparar payload inteiro. Zera no sync |
| `schemaVersion` | Migração acontece na leitura, registro por registro |
| `tags` | Aqui e não em `data`, porque o núcleo pode ler qualquer coleção: é o que torna "tudo marcado com reforma" uma consulta só. Ausente num registro antigo, vira `[]` na leitura |

Registros nunca são removidos fisicamente pelo app. `deletedAt` preenchido some da interface e para de contar nos cálculos. Limpeza de tombstones antigos é operação manual, explicitada ao usuário.

## Contrato de módulo

Um módulo é um objeto que declara o que tem; ele nunca registra nada por efeito colateral. O núcleo lê a declaração e monta rotas, navegação, tabelas locais e widgets a partir dela.

```typescript
interface Module {
  id: string                  // 'finance' — slug único, usado em rotas e caminhos
  name: string                // 'Finanças'
  icon: ComponentType
  apiVersion: 1               // versão do contrato que este módulo implementa
  version: string             // semver do próprio módulo

  collections: CollectionDef<any>[]
  routes: RouteDef[]
  widgets?: WidgetDef[]
  settings?: ZodType<unknown>  // config própria do módulo

  emits?: string[]
  listens?: Record<string, EventHandler>

  provides?: {                 // o que este módulo oferece ao resto
    dated?: DatedProvider
    metrics?: MetricDef[]
    searchable?: SearchableDef[]
  }

  migrations?: Record<string, MigrationFn[]>  // por coleção
  locales?: Record<string, Record<string, string>>
}
```

### Coleção

```typescript
interface CollectionDef<T> {
  name: string                        // 'lancamentos'
  schema: ZodType<T>
  schemaVersion: number
  describe: (r: Envelope<T>) => string  // usado no diálogo de conflito
  indexes?: string[]                  // campos indexados no Dexie
  partition?: (r: Envelope<T>) => string  // agrupamento em arquivos
}
```

`describe` é o único ponto em que o módulo participa da resolução de conflito — ele só precisa saber transformar um registro numa linha legível, como `Mercado · R$ 240,00 · 14/11/2026`. Todo o algoritmo de merge fica no núcleo.

`partition` controla o fatiamento em arquivos no destino. Coleção que cresce sem limite particiona (lançamentos por mês); coleção pequena e estável não particiona (categorias, contas).

### Rotas e widgets

```typescript
interface RouteDef {
  path: string              // relativo ao módulo: '', 'new', 'reports'
  element: ComponentType
  label?: string            // se presente, entra na sub-navegação do módulo
  actions?: ComponentType   // slot na barra de topo do shell
}

interface WidgetDef {
  id: string
  label: string
  size: 'sm' | 'md' | 'lg'  // 2, 3 ou 6 colunas na grade do dashboard
  element: ComponentType
}
```

O usuário escolhe quais widgets ficam no dashboard e em que ordem. O módulo oferece, não impõe.

### Eventos entre módulos

Módulos não se importam uns aos outros, nunca. Integração passa por um barramento no núcleo:

- Finanças emite `financas:lancamento-criado`
- Agenda, se instalada, escuta e cria um compromisso
- Se a agenda não existe, nada acontece — sem erro, sem dependência

Isso é o que permite a um módulo da comunidade reagir a outro sem que nenhum dos dois conheça o outro em tempo de compilação.

### Registro

Módulos oficiais entram num array em `src/modules.ts`. Módulo da comunidade é um pacote npm (`@teorganiza/module-x`) que exporta por padrão um `Module` — instala, adiciona uma linha, pronto. Nenhum dos dois casos toca em `core/`.

## core/api — o que um módulo pode fazer

Tudo que um módulo importa vem de um único caminho, e o lint garante que não exista outro.

```typescript
import { useRecords, useCollection, Button, useT } from '@teorganiza/core'
```

### Dados

```typescript
// leitura reativa: a tela atualiza sozinha quando o sync traz dados novos
useRecords<T>(collection: string, query?: Query<T>): Envelope<T>[]
useRecord<T>(collection: string, id: string): Envelope<T> | undefined
useCount<T>(collection: string, query?: Query<T>): number

// escrita
const { create, update, remove } = useCollection<T>(collection)

create(data: T): Promise<string>            // devolve o id gerado
update(id: string, patch: Partial<T>): Promise<void>
remove(id: string): Promise<void>           // preenche deletedAt, nunca apaga
```

**O módulo nunca monta um envelope.** Ele passa apenas `data`; o núcleo preenche `id`, `createdAt`, `updatedAt`, `deviceId`, `rev` e `schemaVersion`. É isso que garante que todo registro do sistema seja mergeable — inclusive os de módulos que ninguém revisou.

`collection` é resolvido dentro do namespace do módulo. Não existe caminho para alcançar a coleção de outro.

### Query

Declarativa e deliberadamente pobre, para que o núcleo possa trocar o banco local sem quebrar módulo nenhum:

```typescript
interface Query<T> {
  where?: { [K in keyof T]?: T[K] | { gte?: T[K]; lte?: T[K]; in?: T[K][] } }
  sort?: { field: keyof T; dir: 'asc' | 'desc' }
  limit?: number
  includeDeleted?: boolean   // default false
}
```

O que não couber aqui, o módulo calcula em memória sobre o resultado. Se isso virar gargalo num módulo real, é sinal de estender o contrato — nunca de contorná-lo.

### Eventos

```typescript
const emit = useEmit()
emit('transaction-created', { id, amount })   // vira 'finance:transaction-created'
```

A escuta é declarativa, no campo `listens` do módulo. Eventos são fire-and-forget: o emissor nunca espera, e um ouvinte que falha nunca quebra quem emitiu.

### Configurações do módulo

```typescript
const [settings, patch] = useSettings<S>()
```

Validado pelo schema `settings` do módulo, guardado no espaço dele e sincronizado como qualquer outro dado.

### Contexto do app

```typescript
const { locale, theme, deviceId, storage } = useAppContext()
// storage: { kind, lastSyncAt, pendingCount } — somente leitura
```

Um módulo pode mostrar "3 alterações não sincronizadas". Ele **não** pode disparar sync, trocar o destino ou falar com o adaptador. Essa fronteira é o que mantém a garantia de não perder dado válida mesmo para módulos que ninguém auditou.

### Interface

```typescript
import { Button, Card, Field, Table, Dialog, EmptyState, Toolbar } from '@teorganiza/core'
const toast = useToast()
const confirm = useConfirm()
```

Módulos não trazem biblioteca de componentes própria. Sem isso o app vira colcha de retalhos e o bundle cresce sem controle.

### Navegação, i18n e formatação

```typescript
const navigate = useNavigate()   // caminhos relativos ao módulo
const { id } = useParams()
const t = useT()                 // chaves no namespace do módulo
const fmt = useFormat()          // fmt.money(cents), fmt.date(iso), fmt.relative(iso)
```

Moeda e data sempre pelo `useFormat`, nunca à mão — é o que mantém o app coerente quando o locale muda.

### O que `core/api` deliberadamente não expõe

| Não exposto | Motivo |
| --- | --- |
| Dexie cru | Trocar o banco local quebraria todos os módulos |
| Adaptador de storage | Sync é responsabilidade exclusiva do núcleo |
| Coleções de outros módulos | Integração acontece por evento |
| Acesso à rede | Módulo não faz requisição; precisar disso é extensão do contrato, com capacidade declarada |
| `localStorage` e IndexedDB direto | Dado fora do envelope não sincroniza, não migra e não entra no merge |

Essa tabela é o contrato de verdade. Um módulo que precise furar qualquer linha dela está pedindo uma mudança no `core/api` — e essa conversa acontece numa issue, não no código dele.

### defineModule

```typescript
export default defineModule({
  id: 'finance',
  apiVersion: 1,
  version: '1.0.0',
  collections: [transactions, categories, accounts, recurrences],
  routes,
  widgets,
  emits: ['transaction-created', 'due-soon']
})
```

`defineModule` serve a inferência de tipos e validação na carga: o núcleo recusa um módulo malformado com mensagem clara, em vez de quebrar numa tela qualquer depois.

## Shell do dashboard

O shell é tudo que existe em volta de um módulo, e ele não conhece nenhum módulo pelo nome — monta a navegação inteira a partir das declarações.

### Quem desenha o quê

| Pertence ao shell | Pertence ao módulo |
| --- | --- |
| Navegação global entre módulos | A área de conteúdo inteira |
| Estado de sync e destino | Sua própria sub-navegação, a partir das rotas com `label` |
| Tema, idioma, configurações do app | Ações da barra de topo, pela rota ativa |
| Grade de widgets do dashboard | O conteúdo de cada widget |
| Rotas `/` e `/settings/*` | Rotas sob `/:moduleId/*` |

Um módulo nunca desenha chrome: não acrescenta item na navegação global além do seu próprio, não altera a barra de topo exceto pelos slots declarados, não abre diálogo fora do `useConfirm` e do `useToast`.

### Slots

A rota ativa pode entregar ações à barra de topo. É o único ponto em que o módulo alcança o chrome, e por isso é declarado, não imperativo:

```typescript
interface RouteDef {
  path: string
  element: ComponentType
  label?: string              // aparece na sub-navegação do módulo
  actions?: ComponentType     // renderizado na barra de topo, à direita
}
```

### Rotas

| Rota | Dono |
| --- | --- |
| `/` | dashboard, do shell |
| `/:moduleId/*` | módulo, que recebe o caminho relativo |
| `/settings/*` | app: destino, tema, idioma, módulos, backup, PIN |

O módulo declara `path` relativo e nunca escreve o próprio prefixo. Trocar o `id` de um módulo reescreve as URLs dele sem que uma linha interna mude.

### Grade de widgets

Seis colunas no desktop, coluna única no celular. O tamanho é declarado pelo módulo, não escolhido pelo usuário — quem escreveu o widget sabe de quanto espaço ele precisa, e redimensionamento livre produz layout quebrado:

| `size` | Colunas |
| --- | --- |
| `sm` | 2 |
| `md` | 3 |
| `lg` | 6 |

Altura é uniforme para todos. Widget que precisa de mais altura não é widget, é tela.

Três regras que mantêm o dashboard legível à medida que os módulos se acumulam:

1. **Widget é só leitura, mais um link.** Clicar leva à rota do módulo. Sem formulário, sem edição em linha — senão cada módulo entrega um mini-app no dashboard e a tela vira ruído.
2. **O usuário escolhe quais widgets e em que ordem.** Instalar um módulo não enche o dashboard sozinho.
3. **Dashboard vazio sugere**, mostrando os widgets disponíveis dos módulos instalados, em vez de uma tela em branco.

### Barra de estado

Sempre visível: destino atual, tempo desde o último sync, contagem de pendências e o botão de sincronizar. Sem destino configurado, ela vira a faixa persistente descrita na seção de sync.

### Celular

Navegação inferior com até cinco itens; o excedente vai para "mais". A grade colapsa em coluna única, na mesma ordem do desktop.

### Coleções do próprio núcleo

O shell também guarda dado do usuário, e ele não é um caso à parte: usa o mesmo envelope, o mesmo merge e o mesmo sync que qualquer módulo.

| Coleção | Conteúdo |
| --- | --- |
| `core/dashboard` | quais widgets, em que ordem |
| `core/preferences` | tema, idioma, política de sync |
| `core/devices` | apelidos dos dispositivos conhecidos |

Isso significa que o arranjo do dashboard acompanha o usuário entre celular e PC, e que um conflito nele é resolvido pelo mesmo diálogo de sempre.

## Camada de storage

Um adaptador de destino sabe apenas ler e escrever partições, e dizer se o conteúdo mudou desde a última leitura. Ele não conhece merge, módulos nem schemas.

```typescript
interface StorageAdapter {
  kind: 'disk-web' | 'disk-tauri' | 'drive'
  capabilities: {
    lock: boolean        // suporta trava de dispositivo
    versioning: boolean  // destino guarda histórico próprio
  }

  init(): Promise<void>
  listPartitions(module: string, collection: string): Promise<string[]>

  read(module: string, collection: string, partition: string):
    Promise<{ records: Envelope<unknown>[]; etag: string } | null>

  write(module: string, collection: string, partition: string,
        records: Envelope<unknown>[], expectedEtag: string | null):
    Promise<{ etag: string }>   // rejeita se o etag divergir

  acquireLock?(device: DeviceInfo): Promise<LockResult>
  releaseLock?(): Promise<void>
}
```

### O etag

É a peça que torna a sobrescrita silenciosa impossível. Cada destino produz o seu de um jeito diferente:

| Destino | Origem do etag |
| --- | --- |
| Drive | `headRevisionId` do arquivo, devolvido pela própria API |
| Disco (web e Tauri) | hash do conteúdo lido |

`write` com `expectedEtag` diferente do atual **falha por desenho**. Isso não é erro: é o sinal de que alguém escreveu antes, e dispara o merge.

### Adaptadores previstos

| Adaptador | Mecanismo | Disponível em |
| --- | --- | --- |
| `disk-web` | File System Access API | Chrome e Edge no desktop |
| `disk-tauri` | API de arquivos do Tauri | app desktop, todos os sistemas |
| `drive` | Drive REST v3, escopo `drive.file` | web |
| nenhum | só a cópia local | padrão inicial, qualquer navegador |

`disk-web` e `disk-tauri` são dois adaptadores atrás da mesma interface, não duas versões do app — é o que permite empacotar com Tauri depois sem tocar em nenhum módulo.

### Layout no destino

```
TeOrganiza/
  _lock.json
  _meta.json                      # schemaVersions, deviceId conhecidos
  finance/
    transactions/2026-11.json
    transactions/2026-10.json
    categories/all.json
    accounts/all.json
```

Cada arquivo é `{ "schemaVersion": 3, "records": [ ... ] }`. Formato legível, diffável, e abrível num editor de texto sem o app — o que satisfaz a regra 3.

## Autenticação Google

Vale só para o adaptador `drive`. Os demais destinos não têm login.

Sem backend não existe refresh token — isso não é limitação a contornar, é a consequência direta de não ter servidor, e qualquer contorno exigiria guardar segredo no cliente. Todo o desenho abaixo parte disso.

### Escopo

Apenas `drive.file`: acesso aos arquivos que o próprio app cria. O app não enxerga o resto do Drive, e é justamente esse limite que mantém o escopo fora da categoria restrita.

Duas consequências que valem registrar:

- Os arquivos ficam **visíveis** no Drive do usuário, e não escondidos numa pasta de aplicativo. Escolha deliberada: a regra 3 diz que o usuário tem que conseguir ver, copiar e versionar os próprios dados.
- Se o usuário apagar a pasta e recriar à mão, o app não a reconhece — ele só enxerga o que criou. A tela de destino precisa explicar isso em uma linha.

### Identidade: o app não pede nenhuma

Não pedimos `openid` nem `email`. O app não precisa saber quem é o usuário: o token dá acesso aos arquivos, e nada além disso é necessário. A interface diz "conectado ao Google Drive", não "conectado como fulano".

Menos escopo significa tela de consentimento mais simples e verificação mais fácil — e nenhum dado pessoal que não precisávamos ter.

### Onde o token vive

Só em memória. Nunca em `localStorage`, nunca em IndexedDB. Token guardado é token que vaza por XSS e sobrevive ao fechamento do navegador.

Consequência: toda abertura do app faz uma renovação silenciosa. É invisível e correto.

### Renovação

O access token vale cerca de uma hora. Enquanto a sessão Google do navegador estiver ativa, dá para renovar sem nenhuma interação. O app renova de forma proativa: ao abrir, e sempre que faltarem poucos minutos ou antes de um sync.

A renovação silenciosa pode falhar — usuário saiu da conta Google, revogou o acesso, bloqueou cookies de terceiros. Aí é preciso interação.

### Token expirado com fila pendente

Este é o caso que o desenho precisa cobrir, e a regra é uma só: **a fila nunca se perde**. Ela vive na cópia local, não na memória da sessão.

1. O sync tenta renovar em silêncio.
2. Deu certo: segue normalmente, o usuário não vê nada.
3. Falhou: o sync **aborta antes de qualquer escrita**, a fila permanece intacta, e a barra de estado passa a "sessão expirada — reconectar".
4. Nenhum popup é aberto sem gesto do usuário: navegadores bloqueiam popup sem interação. O botão "reconectar" é esse gesto.

No sync ao fechar, o app não tenta popup nenhum: marca como pendente e avisa na próxima abertura. Por isso a promessa honesta é que o sync é confiável **enquanto o app está em uso** — nunca a partir de uma aba esquecida.

### Escrita por partição, nunca parcial

Como o token pode morrer no meio de um sync longo, cada partição é escrita inteira em uma única requisição, e o `etag` e a base só são atualizados após o sucesso dela. Uma interrupção deixa algumas partições sincronizadas e outras pendentes — um estado válido, nunca um arquivo pela metade.

### Sair, desconectar, revogar

| Ação | Efeito |
| --- | --- |
| Sair | Descarta o token da memória. Cópia local, base e destino permanecem; reconectar não reimporta nada |
| Desconectar o destino | Pergunta se mantém a cópia local. O padrão é manter |
| Revogar no Google | Disponível nas configurações, deixando explícito que os arquivos no Drive **não** são apagados |

### Desktop

Fora da v1. No Tauri o fluxo é outro — loopback ou deep link, com PKCE — e nesse caso existe refresh token, porque o cliente conta como aplicativo instalado. Isso tornaria o sync em segundo plano viável no desktop, o que não é possível na web.

### Verificação no Google — confirmado

O Google classifica `drive.file` como **não sensível**, e isso resolve a pendência inteira.

|  | `drive.file` — não sensível | `drive` ou `drive.readonly` — restrito |
| --- | --- | --- |
| Revisão de escopo | não exigida | exigida |
| Avaliação de segurança (CASA) | não | sim, se o dado passar por servidor |
| Tela "o Google não verificou este app" | não aparece | aparece até a verificação |
| Teto de 100 usuários | não se aplica | aplica até verificar |

O teto de 100 usuários e a tela de app não verificado valem **apenas** para escopos sensíveis ou restritos ainda não aprovados.

Duas condições para a instância hospedada:

- Publicar como **External / In production**. O status *Testing* impõe teto de 100 usuários de teste e expira as autorizações em 7 dias, qualquer que seja o escopo.
- **Brand verification** (nome, logo, domínio) pode ser exigida para que nome e logo apareçam na tela de consentimento. É gratuita e leva poucos dias úteis.

### Personal mode muda o self-host

Ao criar o app no Google Cloud existe um tipo de usuário **Personal**, em que apenas a conta que criou o app pode autorizá-lo — exatamente o caso de quem hospeda a própria instância para si.

Apps Personal não exigem verificação, não têm teto de usuários, não sofrem a expiração de 7 dias e **não mostram a tela de app não verificado** — que era o passo mais assustador do assistente de onboarding.

Duas ressalvas que o assistente precisa tratar:

- A escolha é feita **uma única vez**, na criação do app, e não pode ser trocada depois.
- Qualquer outra conta que tente autorizar recebe `client_user_mismatch`.

Portanto o assistente pergunta antes: *"esta instância é só para você, ou outras pessoas também vão usá-la?"*, e só sugere Personal na primeira resposta.

Fontes: [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Manage App Audience](https://support.google.com/cloud/answer/15549945), [Unverified apps](https://support.google.com/cloud/answer/7454865). As regras mudam com o tempo — reconfira antes de submeter.

## Sync e resolução de conflito

O merge é de três vias: ele compara o que está local, o que está no destino e a **base** — a cópia do que foi puxado na última vez. Sem a base é impossível distinguir "adicionado aqui" de "apagado lá".

Estado guardado localmente, por partição: a base e o etag da última leitura.

### Pull

1. Lê a partição no destino, obtendo registros e etag.
2. Para cada `id` presente em qualquer das três versões, aplica a tabela abaixo.
3. Conflitos reais vão para o diálogo de resolução; o resto já está resolvido.
4. Resultado vira o novo estado local **e** a nova base. O etag lido é guardado.

### Push

1. Se o etag do destino diverge do guardado, faz pull e merge primeiro — sempre, sem exceção.
2. Escreve com `expectedEtag`.
3. Se a escrita for rejeitada por etag (alguma corrida), volta ao passo 1.
4. Base passa a ser o que foi escrito.

### Tabela de resolução, por registro

| Local | Destino | Resultado |
| --- | --- | --- |
| igual à base | alterado | aceita o destino |
| alterado | igual à base | mantém o local |
| alterado | alterado, payload idêntico | aceita, sem conflito |
| alterado | alterado, payload diferente | **conflito** |
| novo | ausente | aceita o local |
| ausente | novo | aceita o destino |
| apagado | alterado | **conflito** |
| alterado | apagado | **conflito** |
| apagado | apagado | aceita |

Na prática, as duas primeiras linhas cobrem quase tudo. O diálogo de conflito costuma mostrar de zero a três itens.

### O diálogo

Para cada registro em conflito, mostra as duas versões usando o `describe` do módulo, com o apelido do dispositivo e o horário de cada alteração. O usuário escolhe uma das duas, item por item, ou aplica a mesma escolha a todos. Nada é escrito até ele decidir.

### Primeiro sync de um dispositivo com dados

Não existe base para comparar, então o app não adivinha. Oferece três opções explícitas: importar do destino, enviar o que está aqui, ou mesclar tratando cada `id` coincidente como conflito. É uma tela de primeira conexão, não um fluxo recorrente.

### Política de sync

O local salva sempre, automaticamente — isso não é sync, é o app funcionando. O envio ao destino segue a preferência do usuário: manual, ao sair, periódico ou sempre. O padrão é **ao sair**, com o gancho em `visibilitychange` (e não `beforeunload`, que não garante tempo para requisição assíncrona e muitas vezes nem dispara no celular).

Falha de envio não perde nada: a alteração fica na fila local, e o Background Sync do service worker reenvia quando a conexão volta.

### Quando não há destino

A interface deixa claro que os dados estão apenas naquele navegador, com a contagem de registros em risco. O app chama `navigator.storage.persist()` na inicialização, oferece backup em arquivo, e detecta janela privada para avisar que ali a perda é certa ao fechar. É um estado de avaliação, não um destino legítimo de longo prazo.

## Trava de dispositivo

A trava reduz a frequência de conflito; ela não o previne, e não é pré-requisito do merge. É um arquivo de lease no próprio destino:

```json
{
  "deviceId": "b7f1...",
  "nickname": "PC casa",
  "acquiredAt": "2026-11-22T18:40:00Z",
  "expiresAt": "2026-11-22T19:10:00Z"
}
```

- TTL de 30 minutos, renovado a cada 5 minutos de uso ativo
- Liberada no `visibilitychange`, junto com o sync
- Lease expirado é ignorado — cobre o caso de fechar o navegador sem liberar
- Só adaptadores com `capabilities.lock` participam

**Trava suave, não rígida.** Ao encontrar lease ativo de outro dispositivo, o app avisa e oferece assumir o controle: *"Aberto em PC casa há 12 minutos. Assumir aqui?"*. Trava rígida mataria um uso legítimo — consultar algo no celular com o PC aberto.

Sem backend não há como garantir exclusão mútua de verdade, e isso está certo: a garantia de não perder dado vem do etag e do merge, não da trava.

## Export e import

Um formato só atende três necessidades diferentes, e confundi-las é o erro comum: backup, migração entre destinos e saída com os próprios dados.

### Formato

Um único arquivo `.json`, legível e diffável, que comprime bem se o usuário quiser guardar compactado.

```json
{
  "format": "teorganiza-backup",
  "formatVersion": 1,
  "exportedAt": "2026-11-25T03:00:00Z",
  "app": { "version": "1.4.2" },
  "collections": {
    "finance/transactions": { "schemaVersion": 3, "records": [] },
    "finance/categories":   { "schemaVersion": 1, "records": [] },
    "core/dashboard":       { "schemaVersion": 1, "records": [] }
  }
}
```

Três decisões não óbvias:

- **Os registros vêm com o envelope completo, tombstones inclusive.** Sem os `deletedAt`, importar um backup ressuscita tudo que o usuário já apagou. É o mesmo motivo pelo qual o tombstone existe no sync.
- **Sem partições.** O backup carrega coleções inteiras; o fatiamento em arquivos é otimização de destino, não dado. Na importação, o `partition` atual do módulo refaz o corte — então mudar o esquema de partição nunca invalida um backup antigo.
- **`schemaVersion` por coleção.** A importação roda as migrações como qualquer leitura, sem caminho especial.

### O que não entra

| Fora do backup | Motivo |
| --- | --- |
| Token do Google | Credencial, e de vida curta |
| Base de sync e etags | Estado de sincronização de um dispositivo, não dado do usuário |
| `deviceId` local | O dispositivo de destino tem o seu |
| PIN | Bloqueio local daquele dispositivo; levar junto estaria errado |

### Importar

A tela sempre mostra o conteúdo do arquivo antes de qualquer ação: módulos encontrados, contagem por coleção, data de exportação e versão do app. Só depois aparecem as duas opções:

| Modo | Comportamento |
| --- | --- |
| Substituir | Descarta a cópia local e põe o backup no lugar |
| Mesclar | Merge de três vias com base vazia: o que só existe no arquivo entra, o que só existe aqui permanece, e o que existe nos dois com conteúdo diferente vai para o diálogo de conflito |

É o mesmo diálogo e o mesmo algoritmo do sync. Não há um segundo mecanismo de resolução no sistema.

### Dado de módulo não instalado

**Preserva, nunca descarta.** Os registros entram na cópia local e ficam dormentes; instalar o módulo depois revela tudo. O resumo da importação diz isso explicitamente — *"treinos: 240 registros, módulo não instalado, serão preservados"*.

Descartar transformaria o backup numa armadilha: o usuário exporta, desinstala um módulo, importa, e perde o histórico sem nunca ter pedido isso.

### Formato mais novo que o app

Se `formatVersion` for maior do que o app conhece, a importação é recusada inteira, com mensagem clara. Nunca uma importação parcial "do que deu para entender".

### Backup automático no modo sem destino

O navegador não escreve arquivo em silêncio, então o download é sempre um gesto do usuário. O app oferece na faixa persistente depois de alguns dias ou de um certo volume de registros — na faixa, nunca num popup repetido.

### Migração entre destinos

Não passa por arquivo. O usuário escolhe um novo destino e recebe as mesmas três opções da primeira conexão: enviar o que está aqui, importar de lá, ou mesclar. Mesma máquina por baixo.

### Na interface

Tudo em `/settings/backup`: exportar agora, importar arquivo, e o lembrete de backup automático. Export por módulo fica para depois — é adição simples sobre o mesmo formato.

## Mapa de módulos

Sete funcionalidades do brainstorm original viram **seis módulos**, porque o que define um módulo é a forma dos dados, não o assunto.

### As formas

| Forma | O que a caracteriza | Cobre |
| --- | --- | --- |
| **Ledger** | registros datados com valor, categoria e agregação por período | finanças |
| **Calendário** | início, fim, recorrência, lembrete | agenda |
| **Itens com estado** | texto curto, feito ou não, quantidade e prazo opcionais, dentro de uma lista nomeada | compras, estudos, tarefas |
| **Documentos** | texto livre, sem estado de conclusão, encontrado por busca e não por marcação | pensamentos |
| **Modelo + execução** | uma definição reutilizada no tempo, gerando execuções datadas com números | treinos |
| **Alvo + progresso** | uma meta, uma medida, um prazo | metas |

### Os módulos

| Módulo | Forma | Absorve |
| --- | --- | --- |
| `finance` | Ledger | finanças |
| `lists` | Itens com estado | compras, estudos, tarefas e qualquer checklist futura |
| `calendar` | Calendário | agenda |
| `notes` | Documentos | pensamentos |
| `workouts` | Modelo + execução | treinos |
| `goals` | Alvo + progresso | metas |

O ganho real está em `lists`: o usuário cria quantas listas quiser, e "compras" e "estudos" são apenas duas delas. Toda ideia futura do tipo "lista de X" chega sem uma linha de código nova.

### Uma correção ao que eu disse antes

No início afirmei que listas, pensamentos e metas eram "a mesma coisa por baixo". Analisando a fundo, estava exagerado:

- **Pensamentos não são itens de lista.** Uma nota não tem estado de conclusão e é encontrada por busca. Forçar as duas no mesmo molde piora as duas: um item de compras com corpo de texto rico é inchado, e uma nota com caixinha de marcar é ruído.
- **Metas não são itens de lista.** Uma meta tem alvo, medida e progresso, e a medida muitas vezes vem de outro módulo.

Só compras e estudos colapsam de verdade. Duas funcionalidades viram uma, não quatro.

### A regra que protege `lists`

Se um item precisa de campo que uma lista genérica não carrega — valor em centavos, séries e repetições, início e fim — ele **não é uma lista**, é outro módulo. Sem essa regra, `lists` vira depósito e em dois anos carrega campos opcionais de todo mundo.

### Ordem sugerida

1. **`finance`** — já decidido; particiona, agrega, tem recorrência
2. **`lists`** — barato e de uso diário, e pressiona partes diferentes do núcleo: ordenação e aninhamento, sem partição nem agregação
3. **`calendar`** — depois de existir o que agregar; é ele que força o grafo de integração
4. **`notes`** — simples, baixo risco estrutural
5. **`workouts`** — o schema mais complexo, com estrutura aninhada
6. **`goals`** — por último: só faz sentido quando há o que medir

### O que esse mapa revelou

Dois módulos não se encaixam na regra de que módulos só trocam eventos:

- **`calendar` é um módulo e também uma superfície.** Outros módulos têm coisas datadas que deveriam aparecer nele.
- **`goals` precisa medir dados alheios.** "Gastar menos de X por mês" lê finanças; "treinar 3x por semana" lê treinos.

Evento não resolve nenhum dos dois: evento notifica um fato pontual, e aqui é preciso **consultar um estado**. Isso exige um conceito novo no contrato — o próximo item a decidir.

## Provedores — integração sem acoplamento

Um módulo declara o que **oferece** ao resto do sistema. O núcleo é o único que junta essas ofertas, e quem consome pergunta ao núcleo — nunca a outro módulo.

A fronteira continua intacta: ninguém importa ninguém, ninguém lê a coleção de ninguém. O que circula é **superfície declarada, nunca dado cru**.

```typescript
interface Module {
  // ...
  provides?: {
    dated?: DatedProvider
    metrics?: MetricDef[]
    searchable?: SearchableDef[]
  }
}
```

### Datado — para o calendário

```typescript
type DatedProvider = (range: Period) => Promise<DatedItem[]>

interface DatedItem {
  id: string        // estável: '<moduleId>/<collection>/<recordId>'
  title: string
  start: string     // ISO, data ou data-hora
  end?: string
  allDay: boolean
  kind: string      // definido pelo módulo: 'due', 'session', 'deadline'
  href: string      // caminho relativo para abrir o item no módulo
}
```

**Derivado, nunca armazenado.** O calendário não guarda cópia de nada: ele pergunta a cada abertura. É isso que evita o problema clássico de materializar cópias que envelhecem — editar o vencimento em finanças e ficar com duas verdades na tela.

O `href` deixa o calendário linkar de volta sem saber nada sobre as telas do módulo.

O próprio `calendar` também é um provedor dos seus eventos. Assim ele renderiza um agregado uniforme, em que os próprios compromissos não são caso especial.

### Métricas — para as metas

```typescript
interface MetricDef {
  id: string      // 'monthly-spend'
  label: string   // 'Gasto no mês'
  unit: 'currency' | 'count' | 'duration' | 'number'
  read: (period: Period) => Promise<number>
}
```

Uma meta guarda **apenas a meta**, nunca a medição:

```typescript
interface Goal {
  title: string
  source: 'manual' | string   // 'finance/monthly-spend'
  target: number
  direction: 'at-least' | 'at-most'
  period: 'week' | 'month' | 'quarter' | 'year' | 'once'
  deadline: string | null
}
```

O progresso é derivado na leitura. Nada de duplicar os números de finanças dentro de metas, nada de progresso que envelhece, nada de backup inchado com dados que já existem em outro lugar.

### Buscaável — para a busca global

```typescript
interface SearchableDef {
  collection: string
  fields: string[]
  toHit: (record: Envelope<unknown>) => {
    title: string
    snippet?: string
    href: string
  }
}
```

Com isso, **busca global é recurso do shell, não módulo**. Ela pergunta ao núcleo, que consulta o que cada módulo declarou.

### Do lado de quem consome

O `core/api` ganha três hooks, disponíveis a qualquer módulo:

```typescript
useDatedItems(range: Period): DatedItem[]
useMetric(metricId: string, period: Period): number | undefined
useSearch(term: string): SearchHit[]
```

Eles devolvem apenas o que cada módulo **escolheu publicar**. Publicar é opt-in, e o que sai é uma superfície curada — não as linhas da coleção.

### Evento ou provedor

|  | Evento | Provedor |
| --- | --- | --- |
| Natureza | fato pontual, já ocorrido | estado consultável, agora |
| Direção | empurra | puxa |
| O consumidor | reage uma vez | exibe ou calcula |
| Persistência | o ouvinte pode gravar algo | nada é gravado |

**Regra:** se o consumidor precisa que o dado continue correto depois, é provedor. Se ele só precisa reagir uma vez, é evento.

Isso corrige algo que o documento dizia antes: **o provedor é o mecanismo principal de integração**, e o evento é o secundário. Na v1 provavelmente nenhum módulo escuta evento nenhum — eles existem como infraestrutura para notificação e automação mais adiante.

### O preço, declarado

- **É adição ao contrato.** Precisa entrar antes de a `apiVersion 1` congelar, ou vira breaking change.
- **Provedor é leitura sobre dado local, nunca chamada de rede.** O núcleo pode cachear por intervalo, mas não pode salvar um provedor lento.
- **Provedor que falha é ignorado**, com aviso no console, e o agregado mostra o resto — mesma disciplina dos eventos. Um módulo quebrado não derruba o calendário.
- **A ordem do agregado é do núcleo**, por `start`, depois `moduleId`, depois `id`. Nunca a ordem de registro, que mudaria o resultado ao instalar um módulo.

## Grafo de integração

```
  finance    lists    calendar    notes    workouts    goals
     |         |          |         |          |         |
     +---------+----------+----+----+----------+---------+
                               |
        núcleo — junta as superfícies que cada módulo declarou
                               |
     +-------------------------+-------------------------+
     |                         |                         |
  Calendário                 Metas                 Busca global
  itens datados           métricas de              vive no shell,
  de todos                  todos                  não é módulo
```

Não existe seta de módulo para módulo. O núcleo é o único que junta.

Quem publica o quê, e quem consome:

| Módulo | Publica | Consome |
| --- | --- | --- |
| `finance` | datado (vencimentos em aberto) · métricas (gasto, receita, saldo) · busca | — |
| `lists` | datado (itens com prazo) · métricas (concluídos no período) · busca | — |
| `calendar` | datado (eventos próprios) · busca | datado de todos |
| `notes` | busca | — |
| `workouts` | datado (sessões) · métricas (sessões, volume) · busca | — |
| `goals` | datado (prazos) · busca | métricas de todos |
| shell | — | busca de todos |

Quatro módulos não consomem nada. Isso é bom sinal: eles funcionam sozinhos, e quem os instala sem o calendário ou sem as metas não perde nada.

### Eventos

| Emitido por | Evento | Para quê |
| --- | --- | --- |
| `finance` | `transaction-created`, `due-soon` | notificação, automação futura |
| `lists` | `item-completed` | automação futura |
| `workouts` | `session-logged` | automação futura |
| `calendar` | `event-starting-soon` | notificação |

Na v1, **ninguém escuta**. E está certo assim: a integração que o produto precisa hoje é toda por provedor. Os eventos ficam declarados para quando houver notificações e automações — e para que um módulo da comunidade possa reagir a eles sem que nada no núcleo mude.

## Transversais

Quatro coisas atravessam todos os módulos. Uma muda o envelope; as outras três não tocam no contrato.

### Tags: compartilhadas, dentro do envelope

Tags são uma coleção do núcleo (`core/tags`), e o vínculo mora no **envelope**, não em `data`.

Por quê:

- **O núcleo pode ler qualquer coleção** — são os módulos que não podem ler uns aos outros. Com a tag no envelope, "tudo marcado com reforma" vira uma consulta direta do núcleo sobre todas as coleções: sem provedor novo, sem nada a implementar em cada módulo.
- O núcleo indexa `tags` em toda tabela, automaticamente.
- Entra no merge, no backup e na migração como qualquer campo do envelope, de graça.
- Um módulo que ignora tags simplesmente tem arrays vazios. Nada a declarar.

O `core/api` expõe um seletor de tags pronto, para que marcar tenha a mesma cara em todo módulo.

É a maior promessa do sistema cumprida com muito pouco: *"mostre tudo da reforma da casa"* traz a nota, o gasto, a lista de compras e o prazo, de uma consulta só.

### Datas: nada a adicionar

O oposto simétrico das tags, e vale dizer por quê.

**Tag é o mesmo conceito em todo lugar** — um rótulo escolhido pelo usuário. Já **"a data que importa" é semântica de cada módulo**: em finanças é o vencimento, em treinos é a sessão, em listas é o prazo. Só o módulo sabe qual campo significa "quando".

Por isso o provedor `dated` é a abstração certa, e `createdAt` e `updatedAt` seguem sendo metadado de sincronização, nunca eixo de calendário. Nada muda.

### Lixeira: recurso do shell, barato

Nada é apagado de verdade — todo delete é tombstone. Então uma lixeira no shell custa quase nada: listar os tombstones recentes de todas as coleções e permitir restaurar.

Restaurar é limpar `deletedAt` e incrementar `rev`. Mesma operação de um update qualquer, e passa pelo merge como qualquer outra.

Entra na v1: é das melhores relações entre esforço e tranquilidade do usuário no projeto inteiro.

### Anexos: não-objetivo declarado da v1

Foto numa nota, comprovante num lançamento. Tentador, e fora de escopo por um motivo estrutural: **binário não é JSON**.

Hoje tudo no sistema é um registro serializável que o merge compara campo a campo. Um anexo quebra isso: precisa de armazenamento próprio, de um modelo de sincronização diferente (um arquivo não se mescla — ele vence ou perde) e de limite de tamanho no destino.

Fazer bem é um projeto à parte. Fazer pela metade contamina o modelo de dados inteiro. Fica registrado como decisão consciente, não esquecimento.

### Notificações: pós-v1

Os eventos já estão declarados para isso. Falta uma superfície do shell que decida quando e como avisar — e no navegador isso depende de permissão e service worker. Depois do Drive e do `finance` completo.

## Módulo de finanças

Finanças é o primeiro módulo porque estressa o núcleo de verdade: tem partição por período, referência entre coleções, recorrência e agregação. Tudo que ele exigir vira infraestrutura reutilizável.

### Coleções

| Coleção | Partição | Campos principais |
| --- | --- | --- |
| `transactions` | por mês, `YYYY-MM` | date, amount, type, categoryId, accountId, description, paid |
| `categories` | única, `all` | name, type, color, parentId |
| `accounts` | única, `all` | name, type, openingBalance |
| `recurrences` | única, `all` | rule, template, nextDate |

Particionar `transactions` por mês significa que um sync típico lê e escreve um arquivo pequeno, não o histórico inteiro. Meses antigos ficam parados.

### describe

```typescript
describe: (r) => `${r.data.description} · ${fmt.money(r.data.amount)} · ${fmt.date(r.data.date)}`
// "Mercado · R$ 240,00 · 14/11/2026"
```

### Rotas

| Rota | Tela |
| --- | --- |
| `/finance` | lista com filtros por período, categoria e conta |
| `/finance/new` | lançamento avulso ou recorrente |
| `/finance/reports` | gastos por categoria, evolução mensal |
| `/finance/settings` | categorias, contas, recorrências |

### Widgets

- Saldo do mês (`sm`)
- Gastos por categoria (`md`)
- Próximos vencimentos (`sm`)

### Eventos

Emite `finance:transaction-created` e `finance:due-soon`. Não escuta nada — é o primeiro módulo, não tem com quem conversar ainda.

### Decisões de modelagem a fechar na implementação

- Valor em centavos inteiros, nunca `float`
- Recorrência gera lançamentos materializados ou só projeção? Materializar simplifica relatório e complica edição em série
- Transferência entre contas: um registro com duas pontas ou dois registros ligados?

## Estrutura e garantia da fronteira

```
src/
  core/
    api/            # ÚNICA superfície pública para módulos
    db/             # Dexie: cópia de trabalho
    storage/        # adaptadores de destino
    sync/           # merge, base, etag, trava
    registry/       # carga e validação de módulos
    router/
    ui/             # design system
  modules/
    financas/
      module.ts     # a declaração
      schema.ts     # Zod + schemaVersion
      migrations.ts
      routes/
      widgets/
  modules.ts        # registro dos módulos oficiais
```

A regra 1 não é combinado verbal — é verificada por lint, com `import/no-restricted-paths`:

| Regra | Efeito |
| --- | --- |
| `core/**` não importa `modules/**` | o núcleo nunca conhece um módulo específico |
| `modules/**` importa só `core/api` | módulo não alcança o interior do núcleo |
| `modules/a` não importa `modules/b` | integração só por evento |

O CI roda o lint. PR que fura a fronteira não passa, inclusive os seus. É a única forma de a fronteira sobreviver a três anos de pressa.

## Evolução e migrações

Dois números independentes governam a compatibilidade.

**`apiVersion`** é a versão do contrato de módulo, um inteiro. Cada módulo declara qual implementa. O núcleo recusa carregar módulo incompatível e diz exatamente o quê — em vez de quebrar em tempo de execução. Subir esse número é evento raro, com nota de migração no `CHANGELOG`.

**`schemaVersion`** é por coleção, também inteiro. Migrações são funções puras aplicadas em sequência na leitura:

```typescript
migrations: {
  transactions: [
    (r) => ({ ...r, data: { ...r.data, paid: true } }),           // 1 → 2
    (r) => ({ ...r, data: { ...r.data, accountId: 'default' } })  // 2 → 3
  ]
}
```

Três regras que evitam dor:

- **Migração roda na leitura, não numa "janela de migração".** Um dispositivo que não abre há oito meses migra ao abrir, sem cerimônia.
- **Nunca apagar um campo na mesma versão em que ele para de ser usado.** Remove uma versão depois, quando nenhum dispositivo plausível ainda escreve nele. Dispositivos desatualizados coexistem com atualizados no mesmo destino.
- **Migração nunca é destrutiva.** Se não dá para converter, preserva o campo antigo e marca o registro para revisão do usuário.

O módulo usa semver próprio, independente do núcleo.

## Governança

### Oficial ou da comunidade

O padrão é **comunidade**. Um módulo oficial é manutenção para sempre, atravessando toda mudança de contrato — e num projeto com um mantenedor, esse custo é o que mata.

O critério sustentável é direto: **módulo oficial é módulo que você usa.** Os seis do mapa, e mais nada por boa vontade.

Para um módulo de terceiro entrar como oficial, as quatro condições juntas:

1. cobre uma das formas do mapa, sem inventar uma sétima
2. tem testes
3. não exige extensão do contrato que só ele usaria
4. alguém se compromete a mantê-lo através das mudanças de contrato

Falhou alguma: pacote próprio, listado no catálogo. Isso não é rebaixamento — é o caminho normal.

### O que conta como breaking

| Breaking — sobe `apiVersion` | Não é breaking |
| --- | --- |
| remover ou renomear algo de `core/api` | adicionar hook ou componente |
| mudar assinatura de um hook | adicionar campo **opcional** ao `Module` |
| mudar o envelope | mudar implementação interna do núcleo |
| mudar a semântica do merge | mudar UI, CSS, textos, traduções |
| tornar obrigatório um campo opcional | adicionar tipo de provedor |

O `CHANGELOG` tem uma seção própria, **Contract changes**, separada do resto. Quem mantém um módulo só precisa ler essa.

### A regra dos dois módulos

**Nenhuma extensão do contrato entra com um único módulo precisando dela.**

Uma issue de extensão precisa nomear dois módulos reais que a usariam. Sem isso, o contrato cresce caso a caso até virar a soma dos caprichos de quem chegou primeiro — e aí ninguém consegue implementar um módulo sem ler o núcleo inteiro.

`provides` passou nessa regra: calendário e metas precisavam dele, por caminhos diferentes.

### Dois canais, nenhum fork permanente

| Canal | Fluxo |
| --- | --- |
| Núcleo e módulos oficiais | fork temporário → PR → merge → o fork morre |
| Módulos da comunidade | pacote `@teorganiza/module-*` próprio, registrado no catálogo |

Um PR passa se: lint limpo (**inclusive a fronteira**), testes passando, código e mensagem em inglês, e — no caso de módulo — nada em `core/` tocado. Se precisou tocar, o contrato é que está errado: isso vira issue antes de virar PR.

### O catálogo, e um aviso honesto

`community-modules.md` no repositório: nome, autor, link, `apiVersion` suportada.

E um aviso que precisa estar lá, em primeira pessoa: **a fronteira é de tempo de build, não sandbox de execução.** O lint impede que um módulo importe o que não deve, mas uma vez instalado ele roda na mesma página e pode, tecnicamente, fazer o que qualquer JavaScript faz — inclusive ler o IndexedDB inteiro.

Instalar módulo da comunidade é confiar no autor. O catálogo diz isso com todas as letras em vez de dar impressão de segurança que o projeto não entrega. Sandbox de verdade (iframe, worker, permissões declaradas) é assunto sério e fica registrado como possível evolução, não como promessa.

### Quando abrir

Depois do **segundo** módulo real. O contrato precisa ter sido pressionado por algo que não é finanças antes de virar promessa pública — abrir cedo obriga a manter decisões que você ainda vai querer jogar fora.

Na abertura: `README` e docs do contrato em inglês, `CONTRIBUTING`, `CHANGELOG` com a seção de contrato, template de módulo, código de conduta padrão, licença MIT.

## Pendências

| Pendência | O que ela decide |
| --- | --- |
| Domínio e escopo npm `@teorganiza` | Se o nome se sustenta antes de virar convenção dos módulos |
| Recorrência: lançamentos materializados ou projeção | A modelagem de `recurrences`. Materializar simplifica relatório e complica edição em série |
| Transferência entre contas: um registro com duas pontas ou dois ligados | A modelagem de `transactions` |
| Fluxo OAuth no desktop: loopback ou deep link | Só importa quando o Drive chegar ao Tauri |
| Criptografia dos arquivos com chave derivada do PIN | Fora da v1; o PIN hoje é bloqueio, não proteção |

Nenhuma bloqueia o início da implementação. As duas de modelagem se resolvem ao escrever o módulo de finanças; as duas últimas só aparecem bem adiante.

### Desenhos

Nenhum pendente. Arquitetura, contrato, `core/api`, shell, autenticação, sync, export, mapa de módulos, provedores, transversais e governança estão todos neste documento. A concepção está fechada.

### Construção

1. ~~Scaffold do `core/`: Dexie, registry, `core/api`, fronteira no lint, roteamento, i18n~~ — feito
2. Tokens do design system e componentes base, junto das primeiras telas
3. Destino nenhum e adaptador `drive`, com merge de três vias e trava
4. Módulo `finance` completo
5. Lixeira e tags no shell — ambos de baixo custo e alto retorno
6. Módulo `lists`
7. Adaptador `disk-web`
8. Módulo `calendar` — estreia a agregação de provedores no núcleo
9. `notes`, `workouts` e `goals`
10. Assistente de onboarding
11. Empacotamento Tauri, com assinatura de atualização
12. Template de módulo, docs em inglês, `CONTRIBUTING`, abertura sob MIT

O bloco `provides` entra nos tipos desde o início, mesmo sem implementação: ele precisa estar no contrato antes de a `apiVersion 1` congelar. A agregação no núcleo só é escrita na etapa 8.
