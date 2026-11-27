/**
 * The built-in exercise library, written for TeOrganiza in Portuguese.
 * Names, groupings and instructions are our own; the list covers the
 * movements most people do in a gym or at home. People add the rest as
 * custom exercises, with their own photo or video in Arquivos.
 */

export type Muscle =
  | 'peito'
  | 'costas'
  | 'ombros'
  | 'biceps'
  | 'triceps'
  | 'antebraco'
  | 'abdomen'
  | 'lombar'
  | 'trapezio'
  | 'quadriceps'
  | 'posterior'
  | 'gluteos'
  | 'panturrilha'
  | 'adutores'
  | 'cardio'
  | 'corpo'

export type Equipment =
  | 'barra'
  | 'halteres'
  | 'maquina'
  | 'cabo'
  | 'peso-corporal'
  | 'kettlebell'
  | 'elastico'
  | 'barra-ez'
  | 'smith'
  | 'nenhum'

/** How a set is measured: load and reps, reps alone, time, or time and speed. */
export type ExerciseKind = 'weight' | 'bodyweight' | 'time' | 'cardio'

export interface ExerciseDef {
  id: string
  name: string
  muscle: Muscle
  secondary: Muscle[]
  equipment: Equipment
  kind: ExerciseKind
  /** Reps counted per side: lunges, one-arm rows. */
  perSide: boolean
  /** Multi-joint lifts: warm-ups and the 1RM matter most here. */
  compound: boolean
  instructions: string
  custom?: boolean
}

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'peito', label: 'Peito' },
  { id: 'costas', label: 'Costas' },
  { id: 'ombros', label: 'Ombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'antebraco', label: 'Antebraço' },
  { id: 'abdomen', label: 'Abdômen' },
  { id: 'lombar', label: 'Lombar' },
  { id: 'trapezio', label: 'Trapézio' },
  { id: 'quadriceps', label: 'Quadríceps' },
  { id: 'posterior', label: 'Posterior de coxa' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'panturrilha', label: 'Panturrilha' },
  { id: 'adutores', label: 'Adutores e abdutores' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'corpo', label: 'Corpo inteiro' },
]

export const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'barra', label: 'Barra' },
  { id: 'halteres', label: 'Halteres' },
  { id: 'maquina', label: 'Máquina' },
  { id: 'cabo', label: 'Polia / cabo' },
  { id: 'peso-corporal', label: 'Peso corporal' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'elastico', label: 'Elástico' },
  { id: 'barra-ez', label: 'Barra EZ' },
  { id: 'smith', label: 'Smith' },
  { id: 'nenhum', label: 'Sem equipamento' },
]

type Row = [
  id: string,
  name: string,
  muscle: Muscle,
  secondary: Muscle[],
  equipment: Equipment,
  kind: ExerciseKind,
  flags: '' | 'c' | 's' | 'cs',
  instructions: string,
]

/* prettier-ignore */
const ROWS: Row[] = [
  // Peito
  ['supino-reto-barra', 'Supino reto com barra', 'peito', ['triceps', 'ombros'], 'barra', 'weight', 'c', 'Deitado no banco, desça a barra até o meio do peito e empurre de volta, mantendo as escápulas juntas e os pés firmes no chão.'],
  ['supino-inclinado-barra', 'Supino inclinado com barra', 'peito', ['ombros', 'triceps'], 'barra', 'weight', 'c', 'Banco a 30–45°. Desça a barra até a parte alta do peito e empurre para cima.'],
  ['supino-declinado-barra', 'Supino declinado com barra', 'peito', ['triceps'], 'barra', 'weight', 'c', 'Banco declinado, pernas presas. Desça a barra até a parte baixa do peito e empurre.'],
  ['supino-reto-halteres', 'Supino reto com halteres', 'peito', ['triceps', 'ombros'], 'halteres', 'weight', 'c', 'Halteres na altura do peito, cotovelos a cerca de 45° do tronco. Empurre até quase estender os braços.'],
  ['supino-inclinado-halteres', 'Supino inclinado com halteres', 'peito', ['ombros', 'triceps'], 'halteres', 'weight', 'c', 'Banco a 30–45°. Desça os halteres ao lado do peito e empurre de volta.'],
  ['supino-maquina', 'Supino na máquina', 'peito', ['triceps', 'ombros'], 'maquina', 'weight', 'c', 'Ajuste o banco para as pegadas ficarem na linha do peito. Empurre sem travar os cotovelos.'],
  ['supino-smith', 'Supino no Smith', 'peito', ['triceps', 'ombros'], 'smith', 'weight', 'c', 'Banco centralizado sob a barra. Desça até o peito e empurre em linha reta.'],
  ['crucifixo-halteres', 'Crucifixo com halteres', 'peito', ['ombros'], 'halteres', 'weight', '', 'Braços levemente flexionados, abra os halteres em arco até sentir o peito alongar e feche por cima.'],
  ['crucifixo-maquina', 'Crucifixo na máquina (peck deck)', 'peito', ['ombros'], 'maquina', 'weight', '', 'Cotovelos na altura dos ombros. Feche os braços à frente e volte devagar.'],
  ['crossover', 'Crossover na polia', 'peito', ['ombros'], 'cabo', 'weight', '', 'Polias altas, um passo à frente. Puxe os cabos em arco até as mãos se encontrarem à frente do quadril.'],
  ['flexao', 'Flexão de braço', 'peito', ['triceps', 'ombros', 'abdomen'], 'peso-corporal', 'bodyweight', 'c', 'Mãos um pouco mais abertas que os ombros, corpo alinhado. Desça até o peito quase tocar o chão e suba.'],
  ['flexao-inclinada', 'Flexão inclinada', 'peito', ['triceps'], 'peso-corporal', 'bodyweight', 'c', 'Mãos apoiadas num banco ou degrau. Mais fácil que a flexão no chão.'],
  ['mergulho-paralelas', 'Mergulho nas paralelas', 'peito', ['triceps', 'ombros'], 'peso-corporal', 'bodyweight', 'c', 'Tronco levemente inclinado à frente. Desça até os ombros ficarem na altura dos cotovelos e suba.'],
  ['pullover-halter', 'Pullover com halter', 'peito', ['costas', 'triceps'], 'halteres', 'weight', '', 'Deitado, segure um halter com as duas mãos acima do peito e leve-o para trás da cabeça em arco.'],

  // Costas
  ['barra-fixa', 'Barra fixa (pronada)', 'costas', ['biceps', 'antebraco'], 'peso-corporal', 'bodyweight', 'c', 'Pegada aberta, palmas para frente. Puxe até o queixo passar a barra e desça controlando.'],
  ['barra-fixa-supinada', 'Barra fixa supinada', 'costas', ['biceps'], 'peso-corporal', 'bodyweight', 'c', 'Palmas viradas para você, pegada na largura dos ombros. Puxe até o queixo passar a barra.'],
  ['puxada-frente', 'Puxada frontal', 'costas', ['biceps'], 'cabo', 'weight', 'c', 'Pegada aberta. Puxe a barra até a parte alta do peito, levando os cotovelos para baixo e para trás.'],
  ['puxada-triangulo', 'Puxada com triângulo', 'costas', ['biceps'], 'cabo', 'weight', 'c', 'Pegada neutra fechada. Puxe até o peito mantendo o tronco firme.'],
  ['remada-curvada', 'Remada curvada com barra', 'costas', ['biceps', 'lombar', 'trapezio'], 'barra', 'weight', 'c', 'Tronco inclinado à frente, costas retas. Puxe a barra até o umbigo e desça devagar.'],
  ['remada-unilateral', 'Remada unilateral com halter', 'costas', ['biceps'], 'halteres', 'weight', 'cs', 'Uma mão e um joelho no banco. Puxe o halter até o quadril, cotovelo junto ao corpo.'],
  ['remada-baixa', 'Remada baixa no cabo', 'costas', ['biceps', 'trapezio'], 'cabo', 'weight', 'c', 'Sentado, tronco ereto. Puxe o triângulo até o abdômen juntando as escápulas.'],
  ['remada-maquina', 'Remada na máquina', 'costas', ['biceps'], 'maquina', 'weight', 'c', 'Peito apoiado. Puxe as pegadas para trás e volte sem soltar o peso.'],
  ['remada-cavalinho', 'Remada cavalinho (T-bar)', 'costas', ['biceps', 'trapezio'], 'barra', 'weight', 'c', 'Barra apoiada no canto, pegada no triângulo. Puxe até o peito com as costas retas.'],
  ['pulldown-braco-reto', 'Pulldown com braços estendidos', 'costas', ['triceps'], 'cabo', 'weight', '', 'Em pé, braços quase estendidos. Leve a barra da polia alta até as coxas em arco.'],
  ['levantamento-terra', 'Levantamento terra', 'costas', ['posterior', 'gluteos', 'lombar', 'trapezio', 'antebraco'], 'barra', 'weight', 'c', 'Barra sobre o meio do pé. Costas retas, empurre o chão com as pernas e estenda o quadril até ficar em pé.'],
  ['hiperextensao', 'Hiperextensão lombar', 'lombar', ['gluteos', 'posterior'], 'peso-corporal', 'bodyweight', '', 'No banco romano, desça o tronco e suba até alinhar com as pernas, sem arquear demais.'],
  ['good-morning', 'Good morning', 'lombar', ['posterior', 'gluteos'], 'barra', 'weight', 'c', 'Barra nas costas, joelhos levemente flexionados. Incline o tronco à frente pelo quadril e volte.'],

  // Ombros
  ['desenvolvimento-barra', 'Desenvolvimento militar com barra', 'ombros', ['triceps', 'trapezio'], 'barra', 'weight', 'c', 'Em pé, barra na altura das clavículas. Empurre acima da cabeça e volte, com o abdômen firme.'],
  ['desenvolvimento-halteres', 'Desenvolvimento com halteres', 'ombros', ['triceps'], 'halteres', 'weight', 'c', 'Sentado, halteres na altura das orelhas. Empurre para cima sem bater os halteres.'],
  ['desenvolvimento-maquina', 'Desenvolvimento na máquina', 'ombros', ['triceps'], 'maquina', 'weight', 'c', 'Pegadas na altura dos ombros. Empurre para cima e desça controlando.'],
  ['arnold', 'Desenvolvimento Arnold', 'ombros', ['triceps'], 'halteres', 'weight', 'c', 'Comece com as palmas viradas para você e gire os punhos enquanto empurra para cima.'],
  ['elevacao-lateral', 'Elevação lateral com halteres', 'ombros', ['trapezio'], 'halteres', 'weight', '', 'Braços levemente flexionados, eleve os halteres pelos lados até a altura dos ombros.'],
  ['elevacao-lateral-cabo', 'Elevação lateral no cabo', 'ombros', [], 'cabo', 'weight', 's', 'Polia baixa, cabo cruzando à frente do corpo. Eleve o braço pelo lado até a altura do ombro.'],
  ['elevacao-frontal', 'Elevação frontal', 'ombros', ['peito'], 'halteres', 'weight', '', 'Eleve os halteres à frente até a altura dos ombros e desça devagar.'],
  ['crucifixo-inverso', 'Crucifixo inverso', 'ombros', ['trapezio', 'costas'], 'halteres', 'weight', '', 'Tronco inclinado à frente, abra os braços para os lados juntando as escápulas.'],
  ['face-pull', 'Face pull', 'ombros', ['trapezio', 'costas'], 'cabo', 'weight', '', 'Corda na polia alta. Puxe em direção ao rosto, abrindo as mãos e girando os ombros para fora.'],
  ['remada-alta', 'Remada alta', 'trapezio', ['ombros'], 'barra', 'weight', '', 'Pegada fechada. Puxe a barra até o peito com os cotovelos acima das mãos.'],
  ['encolhimento', 'Encolhimento com halteres', 'trapezio', [], 'halteres', 'weight', '', 'Braços estendidos, suba os ombros em direção às orelhas e segure um instante.'],
  ['encolhimento-barra', 'Encolhimento com barra', 'trapezio', [], 'barra', 'weight', '', 'Barra à frente das coxas. Suba os ombros sem dobrar os cotovelos.'],

  // Bíceps
  ['rosca-direta', 'Rosca direta com barra', 'biceps', ['antebraco'], 'barra', 'weight', '', 'Cotovelos junto ao corpo. Suba a barra até os ombros sem balançar o tronco.'],
  ['rosca-ez', 'Rosca com barra EZ', 'biceps', ['antebraco'], 'barra-ez', 'weight', '', 'Como a rosca direta, com a pegada inclinada da barra EZ, mais confortável para os punhos.'],
  ['rosca-alternada', 'Rosca alternada com halteres', 'biceps', ['antebraco'], 'halteres', 'weight', 's', 'Suba um halter de cada vez girando a palma para cima durante a subida.'],
  ['rosca-martelo', 'Rosca martelo', 'biceps', ['antebraco'], 'halteres', 'weight', '', 'Palmas viradas uma para a outra durante todo o movimento.'],
  ['rosca-scott', 'Rosca Scott', 'biceps', [], 'barra-ez', 'weight', '', 'Braços apoiados no banco Scott. Suba sem tirar os cotovelos do apoio.'],
  ['rosca-concentrada', 'Rosca concentrada', 'biceps', [], 'halteres', 'weight', 's', 'Sentado, cotovelo apoiado na parte de dentro da coxa. Suba o halter devagar.'],
  ['rosca-cabo', 'Rosca no cabo', 'biceps', ['antebraco'], 'cabo', 'weight', '', 'Polia baixa com barra reta. Cotovelos fixos, suba até os ombros.'],
  ['rosca-inclinada', 'Rosca inclinada com halteres', 'biceps', [], 'halteres', 'weight', '', 'Sentado num banco inclinado, braços pendendo para trás do tronco. Suba os halteres.'],

  // Tríceps
  ['triceps-polia', 'Tríceps na polia (barra)', 'triceps', [], 'cabo', 'weight', '', 'Cotovelos junto ao corpo. Empurre a barra até estender os braços e volte devagar.'],
  ['triceps-corda', 'Tríceps na polia com corda', 'triceps', [], 'cabo', 'weight', '', 'Empurre a corda para baixo abrindo as pontas no fim do movimento.'],
  ['triceps-testa', 'Tríceps testa', 'triceps', [], 'barra-ez', 'weight', '', 'Deitado, desça a barra em direção à testa dobrando só os cotovelos e estenda de volta.'],
  ['triceps-frances', 'Tríceps francês', 'triceps', [], 'halteres', 'weight', '', 'Halter atrás da cabeça segurado com as duas mãos. Estenda os braços para cima.'],
  ['triceps-coice', 'Tríceps coice', 'triceps', [], 'halteres', 'weight', 's', 'Tronco inclinado, cotovelo ao lado do corpo. Estenda o braço para trás.'],
  ['supino-fechado', 'Supino fechado', 'triceps', ['peito', 'ombros'], 'barra', 'weight', 'c', 'Pegada na largura dos ombros. Desça a barra com os cotovelos junto ao corpo e empurre.'],
  ['mergulho-banco', 'Mergulho no banco', 'triceps', ['peito', 'ombros'], 'peso-corporal', 'bodyweight', '', 'Mãos no banco atrás do corpo. Desça dobrando os cotovelos e suba.'],

  // Antebraço
  ['rosca-punho', 'Rosca de punho', 'antebraco', [], 'barra', 'weight', '', 'Antebraços apoiados nas coxas, palmas para cima. Suba a barra só com os punhos.'],
  ['rosca-punho-inversa', 'Rosca de punho inversa', 'antebraco', [], 'barra', 'weight', '', 'Igual à rosca de punho, com as palmas viradas para baixo.'],
  ['rosca-inversa', 'Rosca inversa', 'antebraco', ['biceps'], 'barra', 'weight', '', 'Pegada pronada. Suba a barra como numa rosca direta.'],
  ['farmer-walk', 'Caminhada do fazendeiro', 'antebraco', ['trapezio', 'abdomen', 'corpo'], 'halteres', 'time', '', 'Segure dois halteres pesados ao lado do corpo e caminhe ereto pelo tempo combinado.'],
  ['pendurar-barra', 'Pendurado na barra', 'antebraco', ['costas'], 'peso-corporal', 'time', '', 'Pendure-se na barra com os braços estendidos e segure o máximo que conseguir.'],

  // Abdômen
  ['abdominal', 'Abdominal no chão', 'abdomen', [], 'peso-corporal', 'bodyweight', '', 'Joelhos dobrados, enrole o tronco tirando os ombros do chão e volte devagar.'],
  ['prancha', 'Prancha', 'abdomen', ['lombar', 'ombros'], 'peso-corporal', 'time', '', 'Apoio nos antebraços e na ponta dos pés, corpo em linha reta. Segure pelo tempo combinado.'],
  ['prancha-lateral', 'Prancha lateral', 'abdomen', ['ombros'], 'peso-corporal', 'time', 's', 'Apoio num antebraço e na lateral do pé, quadril alto. Segure e troque de lado.'],
  ['elevacao-pernas', 'Elevação de pernas', 'abdomen', [], 'peso-corporal', 'bodyweight', '', 'Deitado, eleve as pernas estendidas até 90° e desça sem tocar o chão.'],
  ['elevacao-pernas-barra', 'Elevação de pernas na barra', 'abdomen', ['antebraco'], 'peso-corporal', 'bodyweight', '', 'Pendurado na barra, suba os joelhos ou as pernas estendidas em direção ao peito.'],
  ['abdominal-cabo', 'Abdominal na polia', 'abdomen', [], 'cabo', 'weight', '', 'Ajoelhado de frente para a polia alta, enrole o tronco puxando a corda para baixo.'],
  ['abdominal-maquina', 'Abdominal na máquina', 'abdomen', [], 'maquina', 'weight', '', 'Ajuste o peso e flexione o tronco à frente, voltando devagar.'],
  ['russian-twist', 'Giro russo', 'abdomen', [], 'peso-corporal', 'bodyweight', '', 'Sentado com o tronco inclinado para trás, gire de um lado para o outro.'],
  ['roda-abdominal', 'Roda abdominal', 'abdomen', ['ombros', 'lombar'], 'nenhum', 'bodyweight', '', 'Ajoelhado, role a roda à frente até onde mantiver as costas retas e volte.'],
  ['bicicleta', 'Abdominal bicicleta', 'abdomen', [], 'peso-corporal', 'bodyweight', '', 'Leve o cotovelo em direção ao joelho oposto, alternando os lados.'],
  ['dead-bug', 'Dead bug', 'abdomen', ['lombar'], 'peso-corporal', 'bodyweight', '', 'Deitado, braços e pernas para cima. Estenda braço e perna opostos sem tirar a lombar do chão.'],
  ['mountain-climber', 'Escalador', 'abdomen', ['cardio', 'ombros'], 'peso-corporal', 'time', '', 'Em posição de flexão, traga os joelhos ao peito alternando rápido.'],

  // Quadríceps
  ['agachamento-livre', 'Agachamento livre com barra', 'quadriceps', ['gluteos', 'posterior', 'lombar'], 'barra', 'weight', 'c', 'Barra nas costas, pés na largura dos ombros. Desça até as coxas passarem da paralela e suba empurrando o chão.'],
  ['agachamento-frontal', 'Agachamento frontal', 'quadriceps', ['gluteos', 'abdomen'], 'barra', 'weight', 'c', 'Barra apoiada na frente dos ombros, cotovelos altos. Desça com o tronco ereto.'],
  ['agachamento-smith', 'Agachamento no Smith', 'quadriceps', ['gluteos'], 'smith', 'weight', 'c', 'Pés um pouco à frente da barra. Desça e suba em linha reta.'],
  ['agachamento-goblet', 'Agachamento goblet', 'quadriceps', ['gluteos', 'abdomen'], 'halteres', 'weight', 'c', 'Segure um halter ou kettlebell junto ao peito e agache mantendo o tronco ereto.'],
  ['agachamento-livre-corpo', 'Agachamento livre (sem peso)', 'quadriceps', ['gluteos'], 'peso-corporal', 'bodyweight', '', 'Braços à frente, desça como se fosse sentar e suba.'],
  ['agachamento-bulgaro', 'Agachamento búlgaro', 'quadriceps', ['gluteos'], 'halteres', 'weight', 'cs', 'Pé de trás apoiado num banco. Desça até o joelho de trás quase tocar o chão.'],
  ['hack', 'Agachamento hack', 'quadriceps', ['gluteos'], 'maquina', 'weight', 'c', 'Costas apoiadas na máquina. Desça até 90° ou mais e empurre.'],
  ['leg-press', 'Leg press 45°', 'quadriceps', ['gluteos', 'posterior'], 'maquina', 'weight', 'c', 'Pés na largura dos ombros. Desça a plataforma até os joelhos formarem 90° e empurre sem travar.'],
  ['cadeira-extensora', 'Cadeira extensora', 'quadriceps', [], 'maquina', 'weight', '', 'Estenda as pernas até ficarem retas e desça devagar.'],
  ['afundo', 'Afundo com halteres', 'quadriceps', ['gluteos'], 'halteres', 'weight', 'cs', 'Dê um passo à frente e desça até os dois joelhos formarem 90°. Volte e troque de perna.'],
  ['passada', 'Passada caminhando', 'quadriceps', ['gluteos'], 'halteres', 'weight', 'cs', 'Avance alternando as pernas em afundos contínuos.'],
  ['step-up', 'Subida no banco (step-up)', 'quadriceps', ['gluteos'], 'halteres', 'weight', 'cs', 'Suba num banco com uma perna empurrando pelo calcanhar e desça controlando.'],
  ['sissy', 'Agachamento sissy', 'quadriceps', [], 'peso-corporal', 'bodyweight', '', 'Na ponta dos pés, incline o tronco para trás dobrando os joelhos à frente.'],
  ['agachamento-sumo', 'Agachamento sumô', 'adutores', ['gluteos', 'quadriceps'], 'halteres', 'weight', 'c', 'Pés bem abertos e virados para fora. Segure o halter entre as pernas e agache.'],

  // Posterior e glúteos
  ['stiff', 'Stiff com barra', 'posterior', ['gluteos', 'lombar'], 'barra', 'weight', 'c', 'Joelhos quase estendidos. Desça a barra rente às pernas levando o quadril para trás e volte.'],
  ['terra-romeno', 'Levantamento terra romeno', 'posterior', ['gluteos', 'lombar'], 'barra', 'weight', 'c', 'Joelhos levemente flexionados, desça a barra até o meio da canela empurrando o quadril para trás.'],
  ['stiff-halteres', 'Stiff com halteres', 'posterior', ['gluteos'], 'halteres', 'weight', 'c', 'Como o stiff com barra, com um halter em cada mão.'],
  ['mesa-flexora', 'Mesa flexora', 'posterior', ['panturrilha'], 'maquina', 'weight', '', 'Deitado de bruços, dobre os joelhos trazendo o rolo até os glúteos.'],
  ['cadeira-flexora', 'Cadeira flexora', 'posterior', [], 'maquina', 'weight', '', 'Sentado, empurre o rolo para baixo dobrando os joelhos.'],
  ['nordico', 'Flexão nórdica', 'posterior', [], 'peso-corporal', 'bodyweight', '', 'Ajoelhado com os tornozelos presos, desça o tronco à frente devagar e volte.'],
  ['elevacao-pelvica', 'Elevação pélvica com barra', 'gluteos', ['posterior'], 'barra', 'weight', 'c', 'Costas apoiadas no banco, barra sobre o quadril. Suba o quadril até alinhar com o tronco.'],
  ['ponte-gluteos', 'Ponte de glúteos', 'gluteos', ['posterior'], 'peso-corporal', 'bodyweight', '', 'Deitado com os joelhos dobrados, suba o quadril apertando os glúteos.'],
  ['gluteo-cabo', 'Glúteo no cabo (coice)', 'gluteos', [], 'cabo', 'weight', 's', 'Tornozeleira na polia baixa. Leve a perna para trás estendendo o quadril.'],
  ['gluteo-maquina', 'Glúteo na máquina', 'gluteos', [], 'maquina', 'weight', 's', 'Empurre a plataforma para trás estendendo o quadril.'],
  ['abducao-maquina', 'Cadeira abdutora', 'adutores', ['gluteos'], 'maquina', 'weight', '', 'Sentado, abra as pernas contra a resistência e volte devagar.'],
  ['aducao-maquina', 'Cadeira adutora', 'adutores', [], 'maquina', 'weight', '', 'Sentado, feche as pernas contra a resistência e volte devagar.'],
  ['kettlebell-swing', 'Kettlebell swing', 'gluteos', ['posterior', 'lombar', 'ombros', 'cardio'], 'kettlebell', 'weight', 'c', 'Leve o kettlebell entre as pernas e projete o quadril à frente até ele subir à altura do peito.'],

  // Panturrilha
  ['panturrilha-pe', 'Panturrilha em pé', 'panturrilha', [], 'maquina', 'weight', '', 'Ponta dos pés na plataforma. Suba o máximo e desça alongando.'],
  ['panturrilha-sentado', 'Panturrilha sentado', 'panturrilha', [], 'maquina', 'weight', '', 'Joelhos sob o apoio. Suba os calcanhares e desça devagar.'],
  ['panturrilha-leg', 'Panturrilha no leg press', 'panturrilha', [], 'maquina', 'weight', '', 'Ponta dos pés na borda da plataforma. Empurre só com os tornozelos.'],
  ['panturrilha-unilateral', 'Panturrilha unilateral', 'panturrilha', [], 'peso-corporal', 'bodyweight', 's', 'Num degrau, suba e desça com uma perna de cada vez.'],

  // Corpo inteiro e olímpicos
  ['burpee', 'Burpee', 'corpo', ['cardio', 'peito', 'quadriceps'], 'peso-corporal', 'bodyweight', '', 'Agache, leve os pés para trás, faça uma flexão, volte e salte.'],
  ['thruster', 'Thruster', 'corpo', ['quadriceps', 'ombros'], 'barra', 'weight', 'c', 'Agachamento frontal seguido de desenvolvimento num movimento só.'],
  ['clean', 'Power clean', 'corpo', ['posterior', 'trapezio', 'quadriceps'], 'barra', 'weight', 'c', 'Puxe a barra do chão com explosão e receba-a apoiada na frente dos ombros.'],
  ['snatch-halter', 'Arranco com halter', 'corpo', ['ombros', 'posterior'], 'halteres', 'weight', 'cs', 'Do chão até acima da cabeça num movimento explosivo, um braço de cada vez.'],
  ['turkish-getup', 'Levantamento turco', 'corpo', ['ombros', 'abdomen'], 'kettlebell', 'weight', 's', 'Deitado com o kettlebell acima do peito, fique de pé passo a passo sem baixar o braço.'],
  ['polichinelo', 'Polichinelo', 'cardio', ['corpo'], 'peso-corporal', 'time', '', 'Salte abrindo pernas e braços e volte, em ritmo constante.'],
  ['pular-corda', 'Pular corda', 'cardio', ['panturrilha'], 'nenhum', 'time', '', 'Saltos curtos na ponta dos pés, girando a corda com os punhos.'],

  // Cardio
  ['corrida-esteira', 'Corrida na esteira', 'cardio', ['quadriceps', 'panturrilha'], 'maquina', 'cardio', '', 'Anote o tempo e a velocidade média.'],
  ['caminhada-esteira', 'Caminhada na esteira', 'cardio', [], 'maquina', 'cardio', '', 'Caminhada com ou sem inclinação; anote tempo e velocidade.'],
  ['corrida-rua', 'Corrida ao ar livre', 'cardio', ['quadriceps', 'panturrilha'], 'nenhum', 'cardio', '', 'Anote o tempo e a velocidade média do percurso.'],
  ['bicicleta-ergometrica', 'Bicicleta ergométrica', 'cardio', ['quadriceps'], 'maquina', 'cardio', '', 'Anote o tempo e a velocidade média.'],
  ['eliptico', 'Elíptico', 'cardio', ['corpo'], 'maquina', 'cardio', '', 'Movimento contínuo de braços e pernas; anote tempo e velocidade.'],
  ['remo-ergometro', 'Remo ergômetro', 'cardio', ['costas', 'quadriceps'], 'maquina', 'cardio', '', 'Empurre com as pernas, depois puxe com os braços; anote tempo e ritmo.'],
  ['escada', 'Simulador de escada', 'cardio', ['gluteos', 'quadriceps'], 'maquina', 'cardio', '', 'Ritmo constante, sem se apoiar no corrimão; anote o tempo.'],
  ['natacao', 'Natação', 'cardio', ['corpo'], 'nenhum', 'cardio', '', 'Anote o tempo nadado.'],
]

export const CATALOG: ExerciseDef[] = ROWS.map(([id, name, muscle, secondary, equipment, kind, flags, instructions]) => ({
  id,
  name,
  muscle,
  secondary,
  equipment,
  kind,
  perSide: flags.includes('s'),
  compound: flags.includes('c'),
  instructions,
}))

const BY_ID = new Map(CATALOG.map((exercise) => [exercise.id, exercise]))

export function catalogExercise(id: string): ExerciseDef | undefined {
  return BY_ID.get(id)
}

export function muscleLabel(id: Muscle): string {
  return MUSCLES.find((m) => m.id === id)?.label ?? id
}

export function equipmentLabel(id: Equipment): string {
  return EQUIPMENT.find((e) => e.id === id)?.label ?? id
}

/** Lowercase without accents, for search: "Supino" finds "supino". */
export function searchKey(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
