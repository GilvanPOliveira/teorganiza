# fixtures

Os testes de integração leem extratos reais desta pasta. **Ela é ignorada pelo
git de propósito** — extrato de banco não vai para repositório, nem privado.

Coloque aqui os arquivos e descreva cada um em `test/casos.local.json`
(também ignorado), no formato:

```json
[
  {
    "arquivo": "bb-07-26.pdf",
    "gabarito": "bb-conta-corrente",
    "esperado": { "entradas": 2343623, "saidas": 2343696 }
  }
]
```

Os valores esperados são lidos do próprio extrato: saldo inicial e final, ou
a linha de totais. O teste confere o somatório contra eles — nunca contra um
número escrito à mão.

Sem esta pasta preenchida, os testes de integração são pulados e os de
unidade continuam rodando.
