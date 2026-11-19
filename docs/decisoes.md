# Decisões de projeto

Este arquivo existe para que qualquer pessoa — ou qualquer sessão de IA — que
abra o repositório saiba **o que foi decidido e por quê**, sem repropor o que
já foi descartado com motivo.

O `README.md` cobre as regras da engine de leitura. Aqui estão as decisões de
produto, de modelo de dados e de plataforma, mais o que está em aberto.

Regra de uso: ao mudar uma decisão, **edite a linha e escreva o novo motivo**.
Uma decisão sem motivo registrado é uma decisão que alguém vai reverter por
engano daqui a três meses.

---

## 1. O que o produto é

Organizador financeiro pessoal. O usuário sobe extratos — PDF, imagem,
planilha — confere o que foi lido, e passa a ver o caminho completo do
dinheiro, inclusive o que apenas mudou de lugar entre as contas dele mesmo.

**Não conecta com banco.** Sem Open Finance, sem senha de banco, sem
scraping. Isso é posição de produto, não limitação técnica: é o que permite
prometer privacidade sem asterisco.

O problema que justifica o produto: quem tem quatro contas e usa Pix não sabe
quanto gastou. O trânsito entre as contas próprias infla os totais. Uma TED do
Itaú para o Nubank não é despesa de um lado e receita do outro — é a mesma nota
mudando de bolso.

## 2. Plataforma

**Site estático, roda inteiro no navegador. Sem backend.**

O caminho até aqui passou por FastAPI + Vue, por app Android nativo, por KMP e
por React Native. Todos foram abandonados, e vale saber por quê:

- **Backend próprio** foi descartado quando ficou claro que o dado não precisa
  sair da máquina do usuário. Backend que guarda extrato bancário de terceiro
  cria obrigação de LGPD, custo de servidor e superfície de vazamento — para
  resolver um problema que não existe, porque o processamento é local.
- **App nativo / KMP / React Native** foram descartados por complicarem sem
  pagar: o usuário perguntou, com razão, se não tínhamos transformado um site
  simples em app. Tínhamos.
- **O movimento que de fato simplificou** foi ir para local-first.

Consequência aceita: **sem servidor, não há como esconder a lógica**. O
gabarito de cada banco é público no repositório. Isso é custo, não bug — e
não há segredo comercial em saber que o Bradesco usa colunas separadas.

## 3. Onde o dado mora

**No Google Drive do próprio usuário**, numa pasta criada pelo site.

| Item | Destino | Motivo |
| --- | --- | --- |
| Arquivo de dados (`TeOrganizaBD`) | Drive do usuário | Ele é o dono. Troca de máquina sem exportar nada. |
| Extratos enviados | **Descartados** após a confirmação | Ver abaixo. |

O extrato é descartado de propósito, por duas razões independentes:

1. **Escopo de OAuth.** O escopo `drive.file` é não-sensível: dá acesso só aos
   arquivos que o próprio app criou, e não exige a auditoria de segurança
   anual paga que o Google impõe aos escopos restritos. Guardar e reler os
   extratos do usuário empurraria o app para o outro lado dessa linha.
2. **Termos do Drive.** Guardar arquivo do usuário por ele aproxima o produto
   da cláusula de "backup de conteúdo do usuário". Descartar depois da
   confirmação mantém o padrão de *editor* — o app abre, transforma, e devolve
   o resultado ao dono.

Por isso a **tela de revisão é obrigatória e não pode ser pulada**: depois da
confirmação o PDF não existe mais, e o que ficou é o que o usuário viu e
aceitou. Não há como reprocessar depois.

## 4. Modelo de dados

**Arquivo como fonte da verdade** — documento versionado, não banco relacional.
Traz versão de esquema e migração progressiva: um arquivo velho abre numa
versão nova do site e é migrado na leitura. O usuário não pode ficar preso a
uma versão do site para abrir o próprio dado.

### Dinheiro

Inteiro em centavos, com o sinal embutido. Nunca ponto flutuante. (Detalhe e
motivo no `README.md`.)

### Identidade de lançamento

```
conta | data | valor | descricao_normalizada | documento | ordinal
```

O `ordinal` existe porque **lançamentos realmente idênticos existem**: duas
passagens de ônibus de R$ 4,40 no mesmo dia são dois fatos, não um em
duplicata. O ordinal distingue sem inventar diferença.

Isso dá idempotência: subir o mesmo extrato duas vezes não duplica nada, e
subir um extrato que se sobrepõe parcialmente a outro traz só o que falta.

### Cartão de crédito é uma conta

O usuário afirmou que não existe fatura, que tudo é extrato. **Isto foi
contestado e o modelo mudou**, porque o modelo ingênuo conta o gasto duas
vezes:

```
fatura de R$ 800 (as compras)      → R$ 800
"PAGAMENTO FATURA" na conta        → R$ 800
                            total  → R$ 1.600   ❌ gastou R$ 800
```

Logo: **o cartão é uma conta**, as compras são lançamentos dela, e o pagamento
da fatura é uma **transferência interna** entre a conta corrente e o cartão —
não uma despesa. O gasto real é a compra, contada uma vez, no mês em que
aconteceu.

### Transferência interna é uma terceira entidade

Ela **aponta para dois lançamentos e não apaga nenhum dos dois**. Apagar ou
mutar um lado quebraria a conferência contra o saldo declarado pelo documento
— que é a prova que sustenta a confiança no produto — e tornaria o pareamento
irreversível quando a heurística erra.

E a heurística erra: dois lançamentos de mesmo valor em contas diferentes no
mesmo dia podem ser duas compras independentes. Por isso o pareamento carrega
**confiança e motivo**, e o usuário pode discordar.

### Categoria vem da contraparte

Não do texto livre do lançamento. A contraparte (loja, pessoa, instituição) é
estável entre bancos; a descrição não é — o mesmo mercado aparece com três
grafias diferentes em três extratos. Regras aprendidas **não nascem sozinhas**:
são adicionadas, e quando se repetem em bancos diferentes, são unidas.

## 5. Identidade visual e layout

Tema escuro. Principal **pansy purple `#50347e`**; laranja neon `#ff8a3d`
**reservado ao que exige atenção** — se tudo é destaque, nada é.

Liquid glass na moldura (navegação, cabeçalho), **sólido no dado**: vidro atrás
de uma tabela de números compete com a leitura. Contraste verificado contra
WCAG — texto ≥ 4,5:1, borda de controle ≥ 3:1.

Layout: **menu na lateral esquerda**, conteúdo centralizado, pouco scroll. O
argumento anterior a favor de navegação no topo era fraco e foi abandonado.

Visões, todas pedidas: isolada e unificada, movimentação uma a uma e visão
geral.

## 6. Roadmap

| Fase | O que | Estado |
| --- | --- | --- |
| 1 | Ler extrato no navegador e conferir contra o saldo declarado | **feito** |
| 2 | Conciliação de transferências internas | **engine feita**; falta ligar na tela |
| 3 | Tela de revisão (obrigatória — ver §3) | |
| 4 | Visões, categorias e a tela "Caminho do dinheiro" | |
| 5 | Google Drive: login, pasta, arquivo, migração | |
| 6 | Domínio, política de privacidade, verificação do OAuth | |

A Fase 5 depende da 6: o OAuth do Google exige origem registrada, e as URLs de
preview da Vercel mudam a cada deploy. Na hora, só o domínio de produção.

## 7. Em aberto

**Esperando documento real do usuário** (nenhum destes tem desenho pronto,
porque desenhar sem o documento na mão é adivinhar — foi exatamente assim que
os quatro modelos de sinal apareceram, nenhum deles previsto):

- fatura de cartão de crédito (modelo decidido, layout desconhecido)
- OFX, CSV, XLSX
- print de tela / imagem (OCR, Tesseract local)
- extrato com saldo negativo
- moeda estrangeira — decisão: manter tudo original, sem conversão

**Decisões adiadas por escolha:** modelo de receita. Hoje: gratuito, três
testadores.

**Dívida conhecida, e a mais urgente: a data é texto cru do extrato.**
`montarRegistros` guarda o que estava escrito no documento, sem normalizar — e
o BB usa a coluna `Dia`, não `Data`. Conciliar entre dois bancos significa
hoje comparar `03/07/2026` com `03/07/26` com possivelmente `03/07` sem ano. A
conciliação cobre os formatos defensivamente e manda o que não entende para
`semData` em vez de adivinhar, mas **a correção certa é a montante**:
normalizar para ISO na importação, tirando o ano do cabeçalho do documento.
Enquanto não for feito, extrato com data sem ano não concilia nada.

Relacionado: **extrato não traz hora.** A janela é parametrizada em horas por
conforto de API, mas a resolução real é de dias — 72h admite até 3 dias.

**Dívida conhecida:** `fimTabela` é obrigatório em todo gabarito novo, e é o
campo mais fácil de esquecer. Sem ele o parser atravessa para a seção seguinte
do documento e os totais inflam — já aconteceu duas vezes, de formas
diferentes. Ainda **não existe validação que recuse um gabarito sem
`fimTabela`**; deveria existir.

## 8. Como o projeto se protege

- **Extrato de banco nunca entra no repositório**, nem privado. Gancho de
  pre-commit recusa PDF, OFX e planilha; ativa-se sozinho no `npm install`.
- **Os testes de integração rodam pelo mesmo `pdf.js` do navegador**, não por
  um caminho paralelo. Isso não é zelo: ligar a engine ao `pdf.js` produziu
  **zero transação em três dos quatro extratos** enquanto o build passava e
  todos os testes de unidade passavam. Teste de unidade verde com o produto
  cego é o modo de falha desta base de código.
- **Teste tenta quebrar, não confirmar.** Um teste escrito para confirmar
  encontrou um erro real de agrupamento de linha que também existia no
  protótipo em Python, e que só não aparecia porque as coordenadas dos quatro
  extratos nunca caíam na fronteira do intervalo.
