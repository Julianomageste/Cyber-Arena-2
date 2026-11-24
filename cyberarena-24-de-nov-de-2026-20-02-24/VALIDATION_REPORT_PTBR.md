# Relatório de validação — Cyber Arena 1.7.0

## Alterações cobertas por testes
- XP-base restaurado parcialmente para os valores da 1.5.0, com custo inicial de nível 55 e crescimento de XP por onda de 4,5%.
- Recompensas de sucata multiplicadas por 1,70 na lógica principal e na simulação.
- Reparo de Emergência pode ser forçado na próxima seleção após o HP cruzar 60%; o teste verifica também a persistência do gatilho quando o HP voltou acima do limite.
- Identidade dos quatro sprites de Boss restrita às entidades `t='boss'`; Kamikaze, Bastion, Artilharia, MiniBoss e Tanque não devem retornar uma chave de sprite Boss.
- Variantes usadas pelos inimigos comuns e variantes dos quatro Bosses utilizam listas aleatórias separadas.
- Vida dos cristais alterada para 22 segundos; simulador acompanha a atração de cristais dentro de 40% do alcance de ataque.
- Curva de HP pós-onda 5 e limites/frequências de spawn moderados para reduzir o salto de dificuldade entre as ondas 6 e 10.
- Zoom, escalas visuais e multiplicadores de projéteis aprovados na 1.6.0 preservados.

## Verificações técnicas
- Verificação TypeScript dos módulos de balanceamento e simulação.
- Testes unitários de XP, economia, seleção de cartas, Reparo de Emergência, escalas e limites de spawn.
- Testes de integração do bootstrap Playgama, runtime, telemetria, anúncios e leaderboard.
- Verificação sintática do módulo JavaScript distribuído no pacote de upload.
- Verificação de integridade dos arquivos e dos dois ZIPs.

## Limitações
- A simulação automatizada é um modelo aproximado e não substitui uma partida humana. Ela agora modela a atração dos cristais, mas não reproduz perfeitamente todas as decisões de movimentação e navegação do jogador.
- Não foi executada uma partida visual completa no navegador nem um teste em aparelho físico nesta etapa. Os testes automatizados validam a regra de escala dos vetores, mas a semelhança visual final precisa ser conferida na Playgama.
- Em 25 simulações Lab0 (5 builds × 5 seeds), a mediana foi onda 10, nível 7 e 133 sucatas; a média foi onda 9,72, nível 7,4 e 143,7 sucatas. O tempo médio até a primeira melhoria foi 36,4 s. A simulação é aproximada; a sucata real precisa ser confirmada em nova partida. O fator de 1,70× foi escolhido para aproximar os 130–140 desejados a partir do teste real de 77 sucatas.
- O HP dos quatro Bosses verdadeiros permanece no multiplicador existente de 1,50 nesta atualização. O foco urgente é eliminar as cópias visuais pequenas e avaliar os Bosses grandes sem confundir com Kamikaze/Bastion/Artilharia.
- É necessário testar a próxima versão na Playgama, especialmente ondas 6–10, coleta de cristais, oferta do Reparo, sucata acumulada e ausência de sprites Boss pequenos/duplicados.
