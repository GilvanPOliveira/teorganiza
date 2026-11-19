# TeOrganiza

Organizador financeiro que roda inteiro no navegador. O usuário sobe extratos,
confere o que foi lido e passa a ver o caminho do dinheiro entre as próprias
contas — inclusive o que só mudou de lugar.

**Nada passa por servidor nosso.** Não há backend. O arquivo de dados vive no
Google Drive do próprio usuário, numa pasta que o site cria.

## O que torna isto diferente de uma planilha

Quem tem quatro contas e usa Pix não sabe quanto gastou de verdade: o trânsito
entre as próprias contas infla os números. Uma TED do Itaú para o Nubank não é
"despesa de um lado e receita do outro" — é a mesma nota mudando de bolso. O
TeOrganiza reconcilia esses pares e mostra o gasto real.

## Estado

A engine de leitura está provada contra quatro extratos reais de três bancos.
Em todos os quatro, o somatório dos lançamentos bate **ao centavo** com o saldo
que o próprio documento declara — e a prova roda pelo mesmo `pdf.js` que o
navegador usa, não por um caminho de teste paralelo.

Há uma tela que já funciona: soltar um PDF e ver os lançamentos com os totais.
Falta tudo o mais — Drive, tela de revisão, conciliação e as visões.

## Arquitetura

```
src/            engine em TypeScript puro — sem DOM, sem framework
app/            a interface: Vue, e o adaptador de pdf.js
gabaritos/      um arquivo por banco e tipo de documento. Dados, não código.
test/           unidade + integração; a integração lê fixtures/ (fora do git)
```

### As regras que não mudam

**Dinheiro é inteiro em centavos, com o sinal embutido.** Um débito de
R$ 264,80 é `-26480`. Nunca ponto flutuante: somar centavos em `number`
acumula erro e o total deixa de bater com o saldo declarado — justamente a
conferência que sustenta a confiança no produto.

**O PDF é lido por coordenada, nunca por linha de texto.** No Bradesco,
crédito e débito são colunas separadas e o texto corrido não diz em qual o
valor estava: `17.000,00` poderia ser entrada ou saída. A informação está na
posição horizontal.

**Um banco novo é um arquivo novo, não um `if` novo.** O gabarito descreve
faixas de coluna ancoradas no cabeçalho do próprio documento, o modelo de
sinal, o que ignorar e onde a tabela termina.

**A tabela tem começo e fim declarados.** Achar o cabeçalho não basta. Sem a
fronteira de saída, o parser segue lendo as seções seguintes — foi assim que
um resgate de poupança de R$ 50,00 vazou para dentro de uma conta corrente e
o saldo deixou de fechar.

**A engine não conhece plataforma.** O PDF entra pela interface `LeitorPdf`,
como palavras posicionadas. No navegador isso é `pdf.js`; nos testes, qualquer
coisa que devolva coordenadas.

**Palavra é reconstruída no adaptador, não na engine.** Extratores de PDF não
concordam sobre o que é uma palavra: o mesmo documento sai ora quebrado em
pedaços de letra (`"A"`, `"gên"`, `"c"`), ora colado em blocos maiores que a
palavra (`"Crédito (R$)"` num item só). `segmentarEmPalavras` reconstrói antes
de a engine ver qualquer coisa.

## Os quatro modelos de sinal

Quatro documentos reais produziram quatro convenções, nenhuma repetida:

| Banco | Forma | Exemplo |
| --- | --- | --- |
| Banco do Brasil | sufixo entre parênteses | `450,00 (+)` |
| Santander, Extrato de Conta | valor assinado | `-R$ 264,80` |
| Santander Consolidado | sufixo menos | `9,99-` |
| Bradesco | colunas separadas | coluna Crédito ou Débito |

## Rodar

```bash
npm install
npm run dev       # abre em localhost; solte um PDF na tela
npm test          # 26 testes
npm run typecheck
npm run build     # site estático em dist/
```

Não é preciso publicar para testar: `npm run dev` basta. Deploy serve para
mostrar a outra pessoa.

Para os testes de integração, veja `fixtures/README.md`. **Extrato de banco
nunca entra neste repositório**, nem privado — há um gancho de pre-commit que
recusa PDF, OFX e planilha, ativado automaticamente no `npm install`.

## Decisões de projeto

**[`docs/decisoes.md`](docs/decisoes.md)** — o que foi decidido e por quê: por
que não há backend, por que o extrato é descartado, por que o cartão é uma
conta, o que está em aberto e o roadmap. Leia antes de propor mudança de
arquitetura: alternativas como app nativo e backend próprio já foram
descartadas, com motivo registrado.
