let DADOS_CAMPEONATO = {};

// Regras de pontuação do voleibol (3x0 ou 3x1 = 3pts, 3x2 = 2pts/1pt)
const REGRAS_PONTUACAO = {
    "3-0": { V: 3, D: 0 },
    "3-1": { V: 3, D: 0 },
    "3-2": { V: 2, D: 1 }
};

// ==========================================================
// FUNÇÕES DE CÁLCULO (INCLUINDO SALDO DE PONTOS - SP)
// ==========================================================

function calcularEstatisticas() {
    const timesMap = {};

    // 1. Inicializa todas as estatísticas dos times
    DADOS_CAMPEONATO.times.forEach(time => {
        timesMap[time.time] = {
            time: time.time,
            grupo: time.grupo,
            naipe: time.naipe,
            P: 0, J: 0, V: 0, D: 0, SS: 0, // Saldo de Sets
            SP: 0 // Saldo de Pontos
        };
    });

    // 2. Processa cada jogo
    DADOS_CAMPEONATO.jogos.forEach(jogo => {
        const setsA = jogo.sets[0];
        const setsB = jogo.sets[1];

        const timeAStats = timesMap[jogo.timeA];
        const timeBStats = timesMap[jogo.timeB];
        
        // Verifica se o time existe no mapa (crítico para ortografia)
        if (!timeAStats || !timeBStats) {
            if (!timeAStats) console.error(`[ERRO CLASSIFICAÇÃO] Time A "${jogo.timeA}" não encontrado na lista de times. Verifique a ortografia em dados.json.`);
            if (!timeBStats) console.error(`[ERRO CLASSIFICAÇÃO] Time B "${jogo.timeB}" não encontrado na lista de times. Verifique a ortografia em dados.json.`);
            return;
        }

        // CÁLCULO DO SALDO DE PONTOS (SP) - Se houver parciais válidas
        if (Array.isArray(jogo.parciais)) {
            let pontosA_total = 0;
            let pontosB_total = 0;

            jogo.parciais.forEach(parcial => {
                pontosA_total += parcial[0] || 0;
                pontosB_total += parcial[1] || 0;
            });

            const saldoPontos = pontosA_total - pontosB_total;
            timeAStats.SP += saldoPontos;
            timeBStats.SP -= saldoPontos;
        }

        // CÁLCULO DE PONTOS (P) E SALDO DE SETS (SS)
        // Só processa se o jogo atingiu o mínimo de sets (3-0, 3-1, 3-2)
        if (setsA + setsB >= 3) {
            
            const diferencaSets = setsA - setsB;
            const placarFinal = setsA > setsB ? `${setsA}-${setsB}` : `${setsB}-${setsA}`;
            const regras = REGRAS_PONTUACAO[placarFinal];

            if (regras) { 
                timeAStats.J++;
                timeBStats.J++;

                timeAStats.SS += diferencaSets;
                timeBStats.SS -= diferencaSets;

                if (diferencaSets > 0) { // Time A Venceu
                    timeAStats.P += regras.V;
                    timeAStats.V++;
                    timeBStats.P += regras.D;
                    timeBStats.D++;
                } else { // Time B Venceu
                    timeBStats.P += regras.V;
                    timeBStats.V++;
                    timeAStats.P += regras.D;
                    timeAStats.D++;
                }
            } else {
                 console.warn(`[AVISO CLASSIFICAÇÃO] Placar de sets inválido: ${setsA} x ${setsB} para ${jogo.timeA} vs ${jogo.timeB}. Pontos não serão contabilizados.`);
            }
        }
    });

    return Object.values(timesMap).filter(time => time.J > 0 || time.grupo);
}

// ==========================================================
// FUNÇÕES DE RENDERIZAÇÃO
// ==========================================================

function formatarData(dataISO) {
    if (!dataISO) return '';
    // Formata YYYY-MM-DD para DD/MM
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}`;
}

function getUniqueDates(jogos) {
    const dates = jogos.map(jogo => jogo.data);
    return [...new Set(dates)].sort();
}

function renderizarBotoesData(uniqueDates) {
    const container = document.getElementById('date-buttons-container');
    container.innerHTML = '';
    
    uniqueDates.forEach(date => {
        const button = document.createElement('button');
        button.className = 'date-button';
        button.textContent = formatarData(date); 
        button.dataset.date = date;
        
        button.addEventListener('click', function() {
            document.querySelectorAll('.date-button').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            filtrarResultados(date, DADOS_CAMPEONATO.jogos);
        });
        
        container.appendChild(button);
    });

    if (uniqueDates.length > 0) {
        container.querySelector('.date-button').click();
    }
}

function renderizarTabelasClassificacao(classificacaoDados) {
    const container = document.getElementById('classificacao-grupos');
    container.innerHTML = ''; 

    const gruposPorNaipe = classificacaoDados.reduce((acc, time) => {
        const chave = `${time.naipe}_${time.grupo}`;
        if (!acc[chave]) {
            acc[chave] = { naipe: time.naipe, grupo: time.grupo, times: [] };
        }
        acc[chave].times.push(time);
        return acc;
    }, {});

    const chavesOrdenadas = Object.keys(gruposPorNaipe).sort(); 

    chavesOrdenadas.forEach(chave => {
        const { naipe, grupo, times } = gruposPorNaipe[chave];
        
        // ORDENAMENTO: 1º PONTOS (P), 2º SALDO DE SETS (SS), 3º SALDO DE PONTOS (SP)
        times.sort((a, b) => {
            if (b.P !== a.P) return b.P - a.P;
            if (b.SS !== a.SS) return b.SS - a.SS;
            return b.SP - a.SP; 
        });

        const naipeNome = naipe === 'F' ? 'Feminino' : 'Masculino';
        
        let tabelaHTML = `
            <div class="tabela-grupo">
                <h3>Vôlei ${naipeNome} - Grupo ${grupo}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Pos.</th>
                            <th>Time</th>
                            <th>P</th>
                            <th>J</th>
                            <th>V</th>
                            <th>D</th>
                            <th>SS</th>
                            <th>SP</th> </tr>
                    </thead>
                    <tbody>
        `;
        
        times.forEach((time, index) => {
            tabelaHTML += `
                <tr>
                    <td>${index + 1}º</td>
                    <td>${time.time}</td>
                    <td>${time.P}</td>
                    <td>${time.J}</td>
                    <td>${time.V}</td>
                    <td>${time.D}</td>
                    <td>${time.SS > 0 ? '+' : ''}${time.SS}</td>
                    <td>${time.SP > 0 ? '+' : ''}${time.SP}</td> </tr>
            `;
        });

        tabelaHTML += `</tbody></table></div>`;
        container.innerHTML += tabelaHTML; 
    });
}

function filtrarResultados(dataSelecionada, todosOsJogos) {
    const container = document.getElementById('resultados-container');
    container.innerHTML = ''; 

    if (!dataSelecionada) {
        container.innerHTML = '<p>Por favor, selecione uma data.</p>';
        return;
    }

    const jogosFiltrados = todosOsJogos.filter(jogo => jogo.data === dataSelecionada);

    if (jogosFiltrados.length === 0) {
        container.innerHTML = `<p>Nenhum jogo encontrado para o dia ${formatarData(dataSelecionada)}.</p>`;
    } else {
        let resultadosHTML = `<h3>Programação do dia ${formatarData(dataSelecionada)}</h3>`;

        // 1. Agrupar JOGOS por LOCAL (A CHAVE PARA A SEPARAÇÃO POR QUADRA)
        const jogosPorLocal = jogosFiltrados.reduce((acc, jogo) => {
            const local = jogo.local;
            if (!acc[local]) {
                acc[local] = [];
            }
            acc[local].push(jogo);
            return acc;
        }, {});
        
        const locaisOrdenados = Object.keys(jogosPorLocal).sort();
        
        // 2. Iterar sobre cada LOCAL (Quadra)
        locaisOrdenados.forEach(local => {
            resultadosHTML += `<div class="local-group">`;
            resultadosHTML += `<h3 class="local-header">Local: ${local}</h3>`; 
            
            const jogosNesteLocal = jogosPorLocal[local];

            // 3. Agrupar JOGOS DENTRO DESTE LOCAL por FASE
            const jogosPorFaseNesteLocal = jogosNesteLocal.reduce((acc, jogo) => {
                const fase = jogo.fase;
                if (!acc[fase]) {
                    acc[fase] = [];
                }
                acc[fase].push(jogo);
                return acc;
            }, {});

            // 4. Iterar sobre cada FASE dentro deste local
            for (const fase in jogosPorFaseNesteLocal) {
                resultadosHTML += `<h4>${fase}</h4>`; 
                
                jogosPorFaseNesteLocal[fase].forEach(jogo => {
                    const setsA = jogo.sets && jogo.sets[0] || 0;
                    const setsB = jogo.sets && jogo.sets[1] || 0;
                    const hora = jogo.hora || '';
                    
                    const jogoconcluido = (setsA >= 3 || setsB >= 3) && (setsA + setsB >= 3);
                    
                    let nomeTimeA = jogo.timeA;
                    let nomeTimeB = jogo.timeB;
                    let placarStr = `? x ?`;
                    let placarClasse = '';
                    let parciaisStr = 'Aguardando Resultados';

                    // NOVO: Formata as parciais
                    if (Array.isArray(jogo.parciais) && jogo.parciais.length > 0) {
                        parciaisStr = jogo.parciais.map(parcial => `${parcial[0]}-${parcial[1]}`).join(', ');
                    }

                    if (jogoconcluido) {
                        placarClasse = 'placar-final';
                        placarStr = `${setsA} x ${setsB}`;
                        
                        if (setsA > setsB) {
                            nomeTimeA = `<span class="time-vencedor">${jogo.timeA}</span>`;
                        } else if (setsB > setsA) {
                            nomeTimeB = `<span class="time-vencedor">${jogo.timeB}</span>`;
                        }
                    } else if (setsA > 0 || setsB > 0) {
                        placarStr = `${setsA} x ${setsB}`;
                    }
                    
                    resultadosHTML += `
                        <div class="jogo">
                            <div class="jogo-info">
                                <p>${hora} - <strong>${nomeTimeA}</strong> vs <strong>${nomeTimeB}</strong></p>
                                <small>Parciais: ${parciaisStr}</small>
                            </div>
                            <div class="placar-box ${placarClasse}">
                                ${placarStr}
                            </div>
                        </div>
                    `;
                });
            }
            
            resultadosHTML += `</div>`;
        });
        
        container.innerHTML = resultadosHTML;
    }
}


// ==========================================================
// FUNÇÕES DE INICIALIZAÇÃO
// ==========================================================

async function carregarDados() {
    try {
        const response = await fetch('dados.json');
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar dados.json: Status ${response.status}`);
        }
        
        DADOS_CAMPEONATO = await response.json();
        
        const classificacaoCalculada = calcularEstatisticas();
        
        renderizarTabelasClassificacao(classificacaoCalculada);
        
        const uniqueDates = getUniqueDates(DADOS_CAMPEONATO.jogos);
        renderizarBotoesData(uniqueDates); 

    } catch (error) {
        console.error("Falha ao carregar ou processar o JSON:", error);
        document.getElementById('classificacao-grupos').innerHTML = 
            '<p style="color:red;">Erro ao carregar os dados. Verifique se o arquivo dados.json existe e está no formato correto.</p>';
    }
}

document.addEventListener('DOMContentLoaded', carregarDados);