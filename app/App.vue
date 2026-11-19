<script setup lang="ts">
import { computed, ref } from 'vue';
import { leitorNavegador } from './pdf';
import { gabaritos } from './gabaritos';
import { escolherGabarito, lerExtrato } from '../src/index.js';
import { conferir } from '../src/conferencia.js';
import { formatar } from '../src/dinheiro.js';
import type { Gabarito, LancamentoBruto } from '../src/tipos.js';

const arrastando = ref(false);
const lendo = ref(false);
const erro = ref('');
const nomeArquivo = ref('');
const gabarito = ref<Gabarito | null>(null);
const lancamentos = ref<readonly LancamentoBruto[]>([]);

const total = computed(() => conferir(lancamentos.value));
const liquido = computed(() => total.value.entradas - total.value.saidas);

async function receber(arquivo: File) {
  erro.value = '';
  lendo.value = true;
  nomeArquivo.value = arquivo.name;
  lancamentos.value = [];
  gabarito.value = null;
  try {
    const dados = new Uint8Array(await arquivo.arrayBuffer());
    const paginas = await leitorNavegador.ler(dados);
    const g = escolherGabarito(paginas, gabaritos);
    if (!g) {
      erro.value =
        'Não sei ler este documento ainda. Se o seu banco exporta OFX ou CSV, ' +
        'esses formatos funcionam em qualquer banco.';
      return;
    }
    gabarito.value = g;
    lancamentos.value = lerExtrato(paginas, g);
    if (lancamentos.value.length === 0) {
      erro.value = 'O documento foi reconhecido, mas nenhuma transação foi encontrada.';
    }
  } catch (e) {
    erro.value = `Falha ao ler o arquivo: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    lendo.value = false;
  }
}

function soltar(ev: DragEvent) {
  arrastando.value = false;
  const arquivo = ev.dataTransfer?.files?.[0];
  if (arquivo) void receber(arquivo);
}

function escolher(ev: Event) {
  const arquivo = (ev.target as HTMLInputElement).files?.[0];
  if (arquivo) void receber(arquivo);
}
</script>

<template>
  <header class="topo">
    <span class="ponto" aria-hidden="true"></span>
    <strong class="marca">TeOrganiza</strong>
    <span class="aviso">tudo é lido aqui no seu navegador · nada é enviado</span>
  </header>

  <main class="miolo">
    <section
      class="solta"
      :class="{ ativa: arrastando }"
      @dragover.prevent="arrastando = true"
      @dragleave.prevent="arrastando = false"
      @drop.prevent="soltar"
    >
      <p class="solta-titulo">Arraste um extrato aqui</p>
      <p class="solta-sub">PDF do Banco do Brasil, Santander ou Bradesco</p>
      <label class="botao">
        <input type="file" accept="application/pdf" @change="escolher" hidden>
        Escolher arquivo
      </label>
    </section>

    <p v-if="lendo" class="estado">Lendo {{ nomeArquivo }}…</p>

    <p v-if="erro" class="alerta" role="alert">{{ erro }}</p>

    <section v-if="gabarito && lancamentos.length" class="resultado">
      <div class="resumo">
        <div>
          <span class="rotulo">Documento</span>
          <span class="valor-txt">{{ gabarito.banco }} · {{ gabarito.documento }}</span>
        </div>
        <div>
          <span class="rotulo">Entradas</span>
          <span class="num grande">{{ formatar(total.entradas) }}</span>
        </div>
        <div>
          <span class="rotulo">Saídas</span>
          <span class="num grande">{{ formatar(total.saidas) }}</span>
        </div>
        <div>
          <span class="rotulo">Líquido</span>
          <span class="num grande">{{ formatar(liquido) }}</span>
        </div>
      </div>

      <p class="nota">
        {{ total.quantidade }} lançamentos. Confira este total contra o saldo que o
        extrato declara — é essa conferência que torna seguro descartar o arquivo.
      </p>

      <div class="tabela">
        <div class="cabeca">
          <span class="c-data">Data</span>
          <span class="c-desc">Lançamento</span>
          <span class="c-valor">Valor</span>
        </div>
        <div v-for="(l, i) in lancamentos" :key="i" class="linha">
          <span class="c-data meta">{{ l.data }}</span>
          <span class="c-desc">
            {{ l.historico }}
            <span v-if="l.complemento" class="sub">{{ l.complemento }}</span>
          </span>
          <span class="c-valor num">{{ formatar(l.valor) }}</span>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.topo {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 14px 24px;
  background: rgba(80, 52, 126, 0.18);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.07);
}
.ponto { width: 11px; height: 11px; border-radius: var(--radius-full); background: var(--brand-lift); }
.marca { font-size: 17px; font-weight: 600; }
.aviso { font-size: 13px; color: var(--text-muted); }

.miolo { max-width: 940px; margin: 0 auto; padding: 28px 24px 64px; }

.solta {
  padding: 40px 24px; text-align: center;
  border: 1px dashed var(--border-control); border-radius: var(--radius-lg);
  transition: border-color .12s, background-color .12s;
}
.solta.ativa { border-color: var(--brand-lift); background: rgba(169, 140, 220, 0.08); }
.solta-titulo { margin: 0 0 6px; font-size: 17px; font-weight: 600; }
.solta-sub { margin: 0 0 18px; font-size: 14px; color: var(--text-secondary); }

.botao {
  display: inline-block; padding: 10px 20px; border-radius: var(--radius-sm);
  background: var(--brand); color: var(--text-primary);
  font-size: 15px; font-weight: 600; cursor: pointer;
}

.estado { margin: 20px 0 0; font-size: 14px; color: var(--text-secondary); }

.alerta {
  margin: 20px 0 0; padding: 13px 16px;
  border: 1px solid var(--attention); border-radius: var(--radius-md);
  font-size: 14px; line-height: 21px;
}

.resultado { margin-top: 28px; }

.resumo {
  display: flex; flex-wrap: wrap; gap: 26px;
  padding: 18px 22px; margin-bottom: 14px; border-radius: var(--radius-lg);
  background: rgba(80, 52, 126, 0.18);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  box-shadow: var(--sombra-vidro);
}
.rotulo {
  display: block; font-size: 11px; font-weight: 600;
  letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted);
}
.valor-txt { display: block; margin-top: 5px; font-size: 15px; }
.grande { display: block; margin-top: 5px; font-size: 20px; font-weight: 600; text-align: left; }

.nota { margin: 0 0 18px; font-size: 13px; line-height: 20px; color: var(--text-secondary); }

.tabela { background: var(--bg-raised); border-radius: var(--radius-md); overflow: hidden; }
.cabeca, .linha { display: flex; gap: 16px; padding: 10px 20px; align-items: baseline; }
.cabeca {
  position: sticky; top: 0; background: var(--bg-raised);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 11px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; color: var(--text-muted);
}
.linha { border-bottom: 1px solid var(--border-subtle); }
.linha:last-child { border-bottom: none; }

.c-data { width: 92px; flex: none; }
.c-desc { flex: 1; min-width: 0; font-size: 15px; }
.c-valor { width: 120px; flex: none; font-size: 15px; font-weight: 500; }
.meta { font-size: 12px; color: var(--text-muted); }
.sub { display: block; font-size: 13px; color: var(--text-secondary); }

@media (max-width: 560px) {
  .c-data { width: 68px; }
  .c-valor { width: 96px; }
}
</style>
