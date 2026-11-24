# Cyber Arena 1.7.0 — recuperação da progressão e correção dos Bosses duplicados

## Objetivo
Corrigir problemas relatados no teste da versão 1.6.0: progressão de XP lenta, coleta de cristais difícil sob pressão, sucata insuficiente, oferta inconsistente do Reparo de Emergência e modelos dos quatro Bosses aparecendo duplicados em tamanhos grandes e pequenos.

Esta versão não implementa os dez novos chefões nem altera a estrutura futura de ciclos. A câmera, a arena, o tamanho dos atiradores e dos projéteis aprovados na 1.6.0 são preservados.

## Correção urgente: quatro Bosses e inimigos especiais
- Somente entidades verdadeiras do tipo `boss` podem usar as quatro artes grandes: Titan, Phantom, Siege e Overlord.
- Kamikaze, Bastion, Artilharia e MiniBoss deixam de reutilizar as imagens dos Bosses em tamanho reduzido.
- Esses inimigos recebem silhuetas próprias desenhadas no Canvas, dimensionadas pelas alturas visuais definidas para cada tipo.
- Os quatro Bosses verdadeiros mantêm altura de desenho de 128 px e seus poderes/ataques não são alterados.
- O sorteio das variantes visuais/ataques das unidades comuns passa a usar uma lista independente da lista dos Bosses. Isso evita que o spawn dos inimigos comuns interfira na sequência dos quatro Bosses.
- O comportamento de ataque já existente dos inimigos especiais é preservado; a mudança é de identidade visual, não de poderes.

## XP e progressão
- XP-base dos drones comuns: 2 (era 1 na 1.6.0).
- XP-base do Drone Swarm: 2 (era 1).
- Gunner: 10; Kamikaze: 10; Sniper: 12; Tanque: 20; Bastion: 20; Artilharia: 18.
- Relay: quatro cristais de 8 XP-base (32 no total).
- Supply Pod: seis cristais de 8 XP-base (48 no total).
- XP inicial do próximo nível: 55 (restaurado ao valor da 1.5.0, após a 1.6.0 ter aumentado para 65).
- Crescimento de XP por onda: 4,5% (restaurado do valor da 1.5.0).
- Mantidos os bônus de XP reduzidos das cartas da 1.6.0: Catalisador +10% por nível e Protocolo Sucateiro +20%. Isso evita que a recuperação de XP dos cristais volte a produzir o crescimento excessivo observado antes.
- Sorteio das três cartas passa a usar Fisher–Yates, substituindo o `sort(() => 0.5 - Math.random())`, que não é uma aleatorização uniforme.

## Reparo de Emergência
- O limite de elegibilidade continua em 60% do HP máximo.
- Quando o HP cruza 60% durante o dano recebido, o jogo registra uma oferta pendente.
- Na próxima subida de nível que abrir a seleção de cartas, Reparo de Emergência é incluído obrigatoriamente entre as opções, mesmo se o jogador tiver recebido alguma cura antes dessa seleção.
- A carta continua restaurando 30% do HP máximo e não consome espaço de melhoria passiva.
- A oferta ocorre na próxima seleção de cartas; não abre uma tela de cartas imediatamente no meio do combate.

## Coleta de cristais
- A atração automática continua usando 40% do alcance de ataque, mais 5 px por nível de magnetismo do laboratório.
- A vida dos cristais comuns e dos cristais dos eventos aumenta de 18 para 22 segundos, dando mais tempo para recolhê-los quando a arena está pressionada.
- O simulador agora reproduz a atração de cristais dentro de 40% do alcance de ataque e a expiração de cristais, para que as simulações de XP reflitam melhor o jogo real.

## Sucata
- Aplicado multiplicador global de 1,70× às recompensas de sucata obtidas durante a partida: eliminações, bônus por onda, eventos e recompensas de caixas.
- O fator foi calibrado a partir do relato de 77 sucatas em uma partida de 3:15 até a onda 10. A projeção para uma partida idêntica é aproximadamente 131 sucatas (77 × 1,70), antes de variações de composição, arredondamentos e multiplicadores da build.
- O valor real continua dependendo dos inimigos eliminados, eventos concluídos e cartas escolhidas. O multiplicador é um alvo inicial para testar a faixa de 130–140 sucatas em uma partida de desempenho semelhante, não uma garantia fixa.

## Dificuldade entre ondas 6 e 10
- Ondas 1–5 mantêm a inclinação de HP que o usuário considerou adequada.
- A contribuição de crescimento adicional de HP após a onda 5 passa de 8% para 5,5% por onda, suavizando a transição que ficou abrupta na 1.6.0.
- HP-base intermediário para os inimigos resistentes: Gunner 26; Kamikaze 20; Sniper 34; Tanque 105; Bastion 77; Artilharia 50.
- Frequência de reposição é moderada em relação à 1.6.0: Gunner 4,6 s; Tanque 6,1 s; Kamikaze 6,6 s; Sniper 7,0 s; Bastion 7,5 s; Artilharia 8,2 s.
- Limite global chega a 34 inimigos ativos, com crescimento mais moderado depois da onda 5. Os limites individuais continuam reservando espaço para os inimigos resistentes e impedindo que os drones dominem a arena.
- A curva de drone continua em 0,75 por segundo na onda 1, crescendo até o teto de 1,7/s. A quantidade considerada adequada pelo usuário é preservada; o ajuste desta versão é principalmente a redução do salto de HP e a recuperação do XP.

## Preservado da 1.6.0
- Arena de 2.800 × 2.800 unidades.
- Zoom desktop 0,92×, tablet 0,84× e mobile 0,74×.
- Compensação visual dos sprites em relação ao zoom.
- Tamanhos aprovados: atiradores, Kamikaze e Artilharia 50 px; Bastion 60 px; drones 34 px; quatro Bosses 128 px.
- Projéteis inimigos 38% maiores visualmente e projéteis do jogador 12% maiores, sem aumentar os raios de colisão.
- Identidade visual de avisos de bombardeio e de ataques dos Bosses.
- Atração automática permanente dentro de 40% do alcance de ataque, mais melhorias de laboratório.

## Fora do escopo
- Não criar os dez novos chefões nem a transição entre ondas e confrontos especiais.
- Não mexer nos poderes dos quatro Bosses existentes.
- Não reintroduzir Overclock nem alterar o leaderboard.
