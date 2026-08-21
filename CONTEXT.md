# Contexto — Rally 2D

Glossário do domínio. Apenas linguagem — nada de decisões de implementação.

## Etapa (Stage)

A unidade jogável do jogo: a combinação de um **Bioma** e uma **Volta**. É o que o jogador
enfrenta, o que tem uma **Semente**, e o que guarda um **Melhor Tempo**. "Deserto" não é uma Etapa;
"Deserto na volta 2" é.

Duas Etapas do mesmo Bioma em Voltas diferentes têm a mesma paleta e Pistas diferentes — seus
tempos não são comparáveis entre si.

## Bioma (Biome)

A identidade visual de uma **Etapa** — uma paleta de cores — junto com o catálogo base de
**Segmentos** que dá à sua **Pista** um caráter próprio. O Bioma nunca é jogado diretamente; ele é
jogado através de uma Etapa.

## Volta (Lap)

Quantas vezes o jogador já percorreu o ciclo completo de Biomas. A Volta é o que faz a **Escalada**
avançar: a mesma paleta reaparece numa Volta maior, mas com **Pista** mais estreita e mais
**Segmentos** de curva.

## Escalada (Escalation)

O aumento de dificuldade conforme a **Volta** cresce: a **Pista** estreita e o catálogo de
**Segmentos** favorece curvas mais fechadas. A Escalada tem **Teto** — abaixo de uma largura
mínima e acima de uma agressividade máxima ela para, e as Etapas seguintes se repetem em
dificuldade constante.

## Progressão (Progression)

A sequência de **Etapas** que o jogador atravessa numa sessão. Não termina: os Biomas ciclam
indefinidamente, com a **Volta** aumentando a cada ciclo. Não existe derrota permanente — uma
**Batida** nunca faz o jogador retroceder para uma Etapa anterior.

## Corrida (Race)

Uma tentativa única de percorrer a **Pista** de uma **Etapa**, do início até a **Linha de Chegada**,
numa **Categoria**. Não começa sozinha: nasce do **Grid**. Termina de exatamente duas formas:
**Conclusão** ou **Batida**.

## Grid

O estado em que o jogador está antes de largar. Nele escolhe a **Etapa** — o **Bioma** e a **Volta**,
entre as três primeiras — e a **Categoria**, vê os números dela, vê seu **Melhor Tempo** naquela Etapa
e, no **Modo Online**, o **Ranking Mundial** — e só então larga.

Escolher a Etapa move a **Progressão**: ela é uma só, e daí em diante a sequência segue da Etapa
escolhida. Os **Melhores Tempos** ficam, cada um na sua Etapa.

O Grid existe uma vez por **Etapa**, não por **Corrida**: uma **Batida** devolve o jogador direto à
largada, sem passar por ele. A decisão de que carro correr é da Etapa; repetir a Tentativa não é uma
decisão, é um reflexo.

## Categoria (Class)

O carro que o jogador escolhe no **Grid**. Um pacote fechado — **A**, **B** ou **C** — de velocidade
mínima, velocidade máxima e taxa de giro. Não existe ajustar um carro: existe escolher entre três.

A regra que mantém as três vivas é uma troca, não uma escala: **quem ganha velocidade perde giro**.
A Categoria A anda mais e curva menos; a C perdoa. Nenhuma é melhor — cada uma pede uma **Pista**
diferente.

O **Acelerador** e a **Zona Morta** são idênticos nas três. Se a curva de aceleração mudasse junto,
Categoria deixaria de ser um carro diferente e passaria a ser um jogo diferente.

Trocar de Categoria não mexe na **Progressão** — ela é uma só, e o carro é do momento. Trocar no meio
de uma Corrida reinicia a Corrida: um **Tempo** pertence à Categoria com que foi feito, do começo ao
fim.

## Tentativa (Attempt)

Sinônimo de **Corrida**, usado ao contá-las. O contador de Tentativas pertence à **Etapa** atual e
zera quando o jogador avança para a próxima. Não existe contagem de Tentativas da Progressão
inteira.

## Pista (Track)

O caminho de uma **Etapa**. Tem **comprimento fixo** — é a distância que é igual para todos, e o
**Tempo** é o que varia. Largura constante dentro da Etapa, definida por uma **Linha Central**
curva montada a partir de **Segmentos**. Derivada inteiramente da **Semente** da Etapa — a mesma
Etapa produz sempre a mesma Pista.

## Caminho (Path)

Um traçado percorrível, com sua linha do meio e suas duas **Bordas**. A **Pista** de uma Etapa é
um Caminho; cada **Rota Alternativa** também é. O Carro está sempre em exatamente um Caminho.

## Bifurcação (Fork)

O ponto da **Pista** onde uma **Rota Alternativa** nasce. Na Bifurcação os dois Caminhos ocupam
praticamente o mesmo lugar — o Carro só passa de um para o outro quando **sai das Bordas** do
Caminho em que está e entra nas do outro. Enquanto estiver dentro da Pista, ele está na Pista.

## Rota Alternativa (Branch)

Um **Caminho** que sai da **Pista** numa **Bifurcação**. Pode ser um **Atalho** (mais curta),
um **Desvio** (mais longa) ou um **Beco sem Saída** (termina numa **Barreira**).

Uma Rota nunca é apenas mais curta: encurtar significa cortar por dentro da curva, e cortar por
dentro significa raio menor — ou seja, ter de frear. O Atalho é uma troca, não um presente.

## Placa de Rota (Route Sign)

O aviso antes de uma **Bifurcação** apontando de que lado fica o Caminho mais rápido. É a única
informação que o jogador tem no momento de escolher.

## Fora de Rota (Off Route)

O estado de estar numa **Rota Alternativa** pior que a **Pista**. Só se torna visível — asfalto
escuro, bordas sem cor, aviso na tela — depois que o Carro já entrou nela. Na boca da
**Bifurcação** os dois Caminhos são idênticos de propósito: se o errado já fosse escuro na
entrada, não haveria decisão a tomar, apenas bordas a seguir.

## Barreira (Barrier)

O fim de um **Beco sem Saída**. Tocá-la é **Batida**. Não existe voltar: o **Carro** não para nem
dá ré, e nas larguras menores da **Escalada** não cabe uma meia-volta.

## Aderência (Grip)

Quanto do que o volante pede o chão devolve. Aderência cheia é o chão seco: a direção que o **Carro**
aponta e a direção em que ele anda são a mesma, e o jogo é só o **Ponto de Mira**. Abaixo dela as duas
se separam.

A Aderência é do chão, não do **Carro**: as três **Categorias** escorregam igual. O que muda entre elas
continua sendo velocidade e giro.

## Derrapagem (Slip)

A diferença entre a direção que o **Carro** aponta e a direção em que ele de fato anda, quando a
**Aderência** é baixa. O Carro vira na hora — o deslocamento é que demora a acompanhar.

Frear não desfaz uma Derrapagem em curso, e é isso que a torna uma decisão de traçado: o preço se paga
na entrada, escolhendo por onde passar, não no meio.

## Poça (Puddle)

Um trecho de **Aderência** baixa dentro de uma **Etapa**, nascido da **Semente** como tudo mais. Fica
**sobre** a **Pista**, deslocada do meio: desviar custa ir para a borda. Uma Poça que dá para evitar
sem sair da linha não seria uma decisão.

É o oposto do **Gelo**, onde a Aderência baixa é do **Bioma** inteiro e não existe por onde desviar —
lá a Derrapagem é a Etapa, não um lugar dela.

## Segmento (Segment)

A peça de que a **Linha Central** é montada: reta, curva suave, curva fechada, chicane. O catálogo
de Segmentos e seus pesos vêm do **Bioma**, ajustados pela **Escalada**.

## Cenário (Scenery)

O que se vê de uma **Etapa** além da **Pista**: o chão, a textura do leito, os pórticos de largada e
chegada, os objetos da beira e quem assiste. É decoração — nenhum objeto de Cenário é **Barreira**
nem **Borda**, e tocá-lo não é **Batida**.

Vem de dois lugares que se somam. O **sorteio** enche os 23 mil pixels de Pista a partir da
**Semente**, sem ninguém ter de encostar neles, e desvia da Pista sozinho. O que é **posto à mão**
no editor de pista vai onde quem põe quiser — inclusive por cima da Pista, já que Cenário não é
obstáculo. Uma Etapa pode dispensar o sorteio e ficar só com o que foi posto; não existe meio termo.

## Ponto de Vista (Point of View)

De onde se vê uma **Etapa**, e são duas coisas ao mesmo tempo: o chão — **Pista**, **Terreno**,
**Linha de Chegada** — é visto **de cima**; tudo o que é objeto — **Carro**, **Cenário**, público,
pórtico — é desenhado **em 3/4**, em pé, de frente para quem joga.

A divisão não é descuido. A Pista é definida pela **Linha Central** e por uma largura, e é essa
definição que decide a **Batida**: inclinar o chão mudaria a geometria que mata. Objeto parado nunca
gira, então pode mentir de graça.

O **Carro** é a exceção que custa: ele é objeto, é 3/4 e gira. Por isso ele tem uma direção
desenhada para cada ângulo, em vez de uma só girada pelo jogo — girar um desenho de 3/4 é
exatamente o que se lê como errado.

## Estilo (Style)

O conjunto de regras que faz tudo parecer o mesmo jogo: o **Ponto de Vista**, uma paleta única de
onde toda a arte tira suas cores, um tamanho de pixel só para todos, a direção da luz, e a exigência
de que todo objeto **toque o chão** em vez de flutuar sobre ele.

Existe porque arte boa vinda de fontes diferentes fica ruim junta — e porque sem regra escrita cada
peça nova volta um pouco diferente da anterior. É a diferença entre ter assets e ter um conjunto.

## Noite (Night)

A condição de uma **Etapa** em que o jogador só vê o que os faróis do **Carro** alcançam. Não é uma
paleta escura: o que está fora do facho é invisível, não apenas mais escuro.

Muda o instrumento com que se corre. De dia a **Pista** é lida pelos olhos e o **Caderno de Notas** é
conforto; de noite o facho mostra o presente e o caderno é o único que fala do que vem — a curva que
chega antes de o farol alcançá-la só existe se ela foi anunciada.

O facho gira com o **Carro**, e não com a **Pista**: no meio de uma curva ele aponta para fora dela.
Essa é a dificuldade, e é a mesma tensão de sempre vista por outro lado — quem entra rápido demais
deixa de ver para onde está indo.

## Relevo (Relief)

A impressão de que o chão de um **Bioma** sobe e desce. Sai da mesma altura que decide o **Terreno**,
agora sombreada: encosta virada para a luz clareia, encosta virada para o outro lado escurece.

É só luz. Nada do modelo tem altura — a **Pista** continua plana, a **Borda** continua onde estava, e
a **Batida** não sabe que existe montanha. Um jogo visto de cima não tem a terceira dimensão para
mostrar subida; o que ele tem é sombra.

## Terreno (Terrain)

O chão de um **Bioma**, fora da **Pista**. Não é uma textura só: são tipos de chão que se encostam,
com a passagem de um para o outro desenhada, e as manchas saem da **Semente** — mesma Etapa, mesmo
chão, sempre.

Terreno não é Pista, e a diferença não é visual: ele não tem **Borda**, e pisar nele não é nada,
porque não se chega nele sem já ter batido.

## Linha Central (Centerline)

A curva que define o traçado da **Pista**. A Pista é a região a até meia-largura de distância dela.
Não é um elemento visível — é a definição geométrica da Pista.

## Borda da Pista (Track Edge)

O limite lateral da **Pista**. Tocá-la é a condição de **Batida**.

## Semente (Seed)

O identificador que determina a **Pista** de uma **Etapa**. Fixa: a mesma Etapa tem sempre a mesma
Semente, e portanto a mesma Pista. É o que torna um **Tempo** comparável a outro.

## Carro (Car)

A entidade controlada pelo jogador. Gira em direção ao **Ponto de Mira** a uma taxa de giro máxima
e constante, e avança à velocidade que o **Acelerador** determina. Suas três velocidades — mínima,
máxima e taxa de giro — vêm da **Categoria** escolhida no **Grid**.

Como a taxa de giro é constante, o raio que o Carro consegue fazer cresce com a velocidade: ir
rápido é, por si só, perder capacidade de curva. É daí que vem toda a tensão do jogo.

## Ponto de Mira (Aim Point)

A posição do cursor do mouse no mundo. Carrega os dois controles do jogo ao mesmo tempo: a
**direção** que o **Carro** tenta alcançar, e — pela sua distância ao Carro — o **Acelerador**.

A diferença entre a direção que o Carro tem e a que ele quer é a fonte da dificuldade.

## Acelerador (Throttle)

A distância entre o **Carro** e o **Ponto de Mira**. Cursor esticado é velocidade máxima, cursor
colado é velocidade mínima — nunca zero, o Carro não para.

## Zona Morta (Deadzone)

O raio em torno do **Carro** dentro do qual o **Ponto de Mira** controla apenas o **Acelerador**, e
não a direção. Existe porque um vetor de mira curto tem ângulo instável: sem ela, frear seria
involuntariamente virar.

## Batida (Crash)

O **Carro** tocou a **Borda da Pista**. Encerra a **Corrida** sem produzir **Tempo**, incrementa as
**Tentativas**, e devolve o jogador ao início da mesma **Etapa**. Nunca faz retroceder na
**Progressão**.

## Conclusão (Finish)

O **Carro** cruzou a **Linha de Chegada** sem ter batido. Única forma de produzir um **Tempo**, e
única forma de avançar na **Progressão**.

## Tempo (Time)

A duração de uma **Corrida** concluída. Menor é melhor. Uma **Batida** não produz um Tempo ruim —
não produz Tempo nenhum.

Um Tempo só é comparável a outro da mesma **Etapa** e da mesma **Categoria**. A Etapa garante a
mesma Pista; a Categoria, o mesmo carro. Falta uma das duas e a comparação não significa nada.

## Melhor Tempo (Best Time)

O menor **Tempo** já registrado por este jogador, nesta **Etapa**, nesta **Categoria**. É pessoal e
existe sempre, nos dois **Modos** — não depende de rede, de nome, nem de ninguém mais.

## Ranking Mundial (Leaderboard)

A lista dos **Tempos** de todos os jogadores numa **Etapa** numa **Categoria**, do menor para o
maior. Só existe no **Modo Online**, e é coisa diferente do **Melhor Tempo**: o Melhor Tempo é seu
recorde, o Ranking é o mundo.

Cada Conclusão vira uma linha — o mesmo jogador aparece tantas vezes quantas concluir. É um placar
de fliperama: uma lista de Corridas, não de pessoas.

Cada **Volta** tem seu próprio Ranking, o que é uma consequência aceita: nas Voltas altas o Ranking
pode ter um nome só.

## Nome (Name)

O que identifica um Tempo no **Ranking Mundial**. Digitado na primeira **Conclusão** e lembrado
depois. Não é uma conta: não há login, nada impede dois jogadores usarem o mesmo Nome, e o jogo
aceita isso — o preço de ninguém precisar se cadastrar para correr.

## Modo (Mode)

Escolhido ao abrir o jogo, e trocável no **Grid**. **Offline** é o jogo inteiro, sozinho. **Online**
é o mesmo jogo mais o **Ranking Mundial**. Online só adiciona; nada do jogo depende de rede, e um
Tempo feito Offline nunca sobe depois.
