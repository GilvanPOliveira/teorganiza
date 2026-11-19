import bb from '../gabaritos/bb-conta-corrente.json';
import santanderConta from '../gabaritos/santander-extrato-conta.json';
import santanderConsolidado from '../gabaritos/santander-consolidado.json';
import bradesco from '../gabaritos/bradesco-celular.json';
import type { Gabarito } from '../src/tipos.js';

/** Os gabaritos vêm com o site: corrigir um é publicar de novo. */
export const gabaritos: readonly Gabarito[] = [
  bb, santanderConta, santanderConsolidado, bradesco,
] as unknown as readonly Gabarito[];
