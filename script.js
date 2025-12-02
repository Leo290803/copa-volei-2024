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
    
    // Função auxiliar para identificar placeholders de mata-mata e evitar console noise
    function isPlaceholder(timeName) {
        if (!timeName) return true;
        const name = timeName.toUpperCase();
        return name.includes('º') || name.includes('VENCEDOR') || name.includes('PERDEDOR');
    }

    // 2. Processa cada jogo
    DADOS_CAMPEONATO.jogos.forEach(jogo => {
        const setsA = jogo.sets[0];
        const setsB = jogo.sets[1];

        const timeAStats = timesMap[jogo.timeA];
        const timeBStats = timesMap[jogo.timeB];
        
        // Verifica se o time existe no mapa OU se é um placeholder (para ignorar no cálculo)
        if (!timeAStats || !timeBStats) {
             // Apenas exibe o erro se o time não existir E não for um placeholder.
            if (!timeAStats && !isPlaceholder(jogo.timeA)) console.error(`[ERRO CLASSIFICAÇÃO] Time A "${jogo.timeA}" não encontrado na lista de times.`);
            if (!timeBStats && !isPlaceholder(jogo.timeB)) console.error(`[ERRO CLASSIFICAÇÃO] Time B "${jogo.timeB}" não encontrado na lista de times.`);
            return; // Sai do processamento deste jogo (Correto para placeholders)
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
    
    if (!container) return; // Segurança para o HTML

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
            
            // Reutiliza o filtro de naipe ativo
            const naipeFiltro = document.querySelector('.naipe-button.active')?.dataset.naipe || 'Todos';
            filtrarResultados(date, DADOS_CAMPEONATO.jogos, naipeFiltro);
        });
        
        container.appendChild(button);
    });

    if (uniqueDates.length > 0) {
        // Clica no primeiro botão para carregar a primeira data
        container.querySelector('.date-button').click();
    }
}

function renderizarTabelasClassificacao(classificacaoDados, naipeFiltro = 'Todos') {
    const container = document.getElementById('classificacao-grupos');
    
    if (!container) return; // Segurança para o HTML
    
    container.innerHTML = ''; 

    // 1. FILTRAGEM POR NAIPE
    let dadosFiltrados = classificacaoDados;
    if (naipeFiltro !== 'Todos') {
        dadosFiltrados = dadosFiltrados.filter(time => time.naipe === naipeFiltro);
    }

    const gruposPorNaipe = dadosFiltrados.reduce((acc, time) => {
        // Usa uma string vazia se o grupo for undefined/null para evitar chave "undefined"
        const grupoChave = time.grupo || '';
        const chave = `${time.naipe}_${grupoChave}`;
        if (!acc[chave]) {
            acc[chave] = { naipe: time.naipe, grupo: grupoChave, times: [] };
        }
        acc[chave].times.push(time);
        return acc;
    }, {});

    const chavesOrdenadas = Object.keys(gruposPorNaipe).sort(); 

    if (chavesOrdenadas.length === 0 && naipeFiltro !== 'Todos') {
         container.innerHTML = `<p style="text-align:center; padding: 30px;">Não há grupos para a modalidade ${naipeFiltro === 'F' ? 'Feminina' : 'Masculina'} com jogos jogados ou grupos definidos.</p>`;
         return;
    }


    chavesOrdenadas.forEach(chave => {
        const { naipe, grupo, times } = gruposPorNaipe[chave];
        
        // ORDENAMENTO: 1º PONTOS (P), 2º SALDO DE SETS (SS), 3º SALDO DE PONTOS (SP)
        times.sort((a, b) => {
            if (b.P !== a.P) return b.P - a.P;
            if (b.SS !== a.SS) return b.SS - a.SS;
            return b.SP - a.SP; 
        });

        const naipeNome = naipe === 'F' ? 'Feminino' : 'Masculino';
        // CORREÇÃO: Adiciona " - Grupo X" somente se o grupo existir (não for string vazia)
        const grupoHeader = grupo ? ` - Grupo ${grupo}` : '';
        
        let tabelaHTML = `
            <div class="tabela-grupo">
                <h3>Vôlei ${naipeNome}${grupoHeader}</h3>
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
                            <th>SP</th>
                        </tr>
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
                    <td>${time.SP > 0 ? '+' : ''}${time.SP}</td>
                </tr>
            `;
        });

        tabelaHTML += `</tbody></table></div>`;
        container.innerHTML += tabelaHTML; 
    });
}

function filtrarResultados(dataSelecionada, todosOsJogos, naipeFiltro = 'Todos') {
    // O alvo correto no seu HTML é 'resultados-container'
    const container = document.getElementById('resultados-container'); 
    
    if (!container) {
        console.error("ERRO FATAL: O elemento com id='resultados-container' não foi encontrado no seu HTML. Verifique o arquivo index.html.");
        return; 
    }

    container.innerHTML = ''; 

    if (!dataSelecionada) {
        container.innerHTML = '<p>Por favor, selecione uma data.</p>';
        return;
    }

    // Filtra por data
    let jogosFiltrados = todosOsJogos.filter(jogo => jogo.data === dataSelecionada);

    // Filtra por naipe
    if (naipeFiltro !== 'Todos') {
        jogosFiltrados = jogosFiltrados.filter(jogo => 
            // O jogo agora TEM a propriedade naipe (inferida em carregarDados)
            jogo.naipe && jogo.naipe.toUpperCase() === naipeFiltro.toUpperCase()
        );
    }
    
    if (jogosFiltrados.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding: 30px; color: #6c757d;">Nenhum jogo encontrado para o dia ${formatarData(dataSelecionada)}.</p>`;
        return;
    }
    
    // 1. Agrupar JOGOS por LOCAL
    const jogosPorLocal = jogosFiltrados.reduce((acc, jogo) => {
        const local = jogo.local;
        if (!acc[local]) {
            acc[local] = [];
        }
        acc[local].push(jogo);
        return acc;
    }, {});
    
    const locaisOrdenados = Object.keys(jogosPorLocal).sort();
    
    // Usaremos um Document Fragment para injeção eficiente de DOM
    const fragment = document.createDocumentFragment();

    // 2. Iterar sobre cada LOCAL (Quadra)
    locaisOrdenados.forEach(local => {
        
        const localHeader = document.createElement('h4');
        localHeader.className = 'local-header';
        localHeader.textContent = `Local: ${local}`;
        fragment.appendChild(localHeader);

        const localGroup = document.createElement('div');
        localGroup.className = 'local-group';
        
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
            
            const faseHeader = document.createElement('h4');
            faseHeader.textContent = fase;
            localGroup.appendChild(faseHeader);
            
            jogosPorFaseNesteLocal[fase].forEach(jogo => {
                const setsA = jogo.sets && jogo.sets[0] || 0;
                const setsB = jogo.sets && jogo.sets[1] || 0;
                const hora = jogo.hora || '';
                
                const isFinalizado = (setsA >= 3 || setsB >= 3) && (setsA + setsB >= 3);
                
                let timeA_display = jogo.timeA;
                let timeB_display = jogo.timeB;
                const setsPlacar = isFinalizado ? `${setsA}x${setsB}` : (setsA + setsB > 0 ? `${setsA}x${setsB}` : 'Aguardando');
                
                if (isFinalizado) {
                    if (setsA > setsB) {
                        timeA_display = `<span class="time-vencedor">${jogo.timeA}</span>`;
                    } else if (setsB > setsA) {
                        timeB_display = `<span class="time-vencedor">${jogo.timeB}</span>`;
                    }
                }
                
                // Formata as parciais para a exibição
                const parciaisFormatadas = jogo.parciais && jogo.parciais.length > 0
                    ? jogo.parciais.map(p => `${p[0]}x${p[1]}`).join(', ')
                    : 'Aguardando sets.';

                const jogoDiv = document.createElement('div');
                jogoDiv.className = 'jogo';
                if (isFinalizado) {
                    jogoDiv.classList.add('jogo-finalizado');
                }
                
                // Adiciona a info do grupo/fase apenas se ela existir no objeto jogo
                const grupoInfo = jogo.grupo ? ` - Grupo ${jogo.grupo}` : '';

                // Montagem do HTML do Jogo
                jogoDiv.innerHTML = `
                    <div class="jogo-info">
                        <p>${hora}h - <strong>${timeA_display}</strong> vs <strong>${timeB_display}</strong></p>
                        <p><small>${jogo.naipe === 'F' ? 'Feminino' : (jogo.naipe === 'M' ? 'Masculino' : 'Naipe N/D')}${grupoInfo}</small></p>
                        
                        <div class="parciais-detalhe">
                            <small>Sets: ${parciaisFormatadas}</small>
                        </div>
                    </div>
                    <div class="placar-box ${isFinalizado ? 'placar-final' : ''}">
                        ${setsPlacar}
                    </div>
                `;
                
                localGroup.appendChild(jogoDiv);
            });
            
        }
        
        fragment.appendChild(localGroup);
    });
    
    container.appendChild(fragment);

    // Adiciona o Evento de Clique para Expandir/Ocultar
    document.querySelectorAll('.jogo-finalizado').forEach(jogoElement => {
        jogoElement.addEventListener('click', function(event) { 
            const parciais = this.querySelector('.parciais-detalhe');
            // Impede que o clique no placar feche o detalhe (melhora a UX)
            if (!event.target.classList.contains('placar-box')) {
                parciais.classList.toggle('expanded');
            }
        });
    });
}


// ==========================================================
// FUNÇÕES DE INICIALIZAÇÃO
// ==========================================================

// Esta função agora APENAS carrega e processa os dados, RETORNANDO-OS.
async function carregarDados() {
    try {
        const response = await fetch('dados.json');
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar dados.json: Status ${response.status}`);
        }
        
        DADOS_CAMPEONATO = await response.json();
        
        // CORREÇÃO DE INFERÊNCIA DE NAIPE (Para corrigir o filtro)
        const teamNaipeMap = {};
        DADOS_CAMPEONATO.times.forEach(time => {
            teamNaipeMap[time.time] = time.naipe;
        });

        DADOS_CAMPEONATO.jogos.forEach(jogo => {
            if (!jogo.naipe) {
                const naipeInferido = teamNaipeMap[jogo.timeA];
                if (naipeInferido) {
                    jogo.naipe = naipeInferido;
                } 
            }
        });
        
        const classificacaoCalculada = calcularEstatisticas();
        const uniqueDates = getUniqueDates(DADOS_CAMPEONATO.jogos);
        
        // Configura o evento de clique dos botões de Naipe (o evento precisa existir antes da renderização)
        const naipeButtons = document.querySelectorAll('.naipe-button');
        naipeButtons.forEach(button => {
            button.addEventListener('click', function() {
                naipeButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                const naipeSelecionado = this.dataset.naipe;
                
                renderizarTabelasClassificacao(classificacaoCalculada, naipeSelecionado);
                
                const dataAtiva = document.querySelector('.date-button.active')?.dataset.date;
                if (dataAtiva) {
                    filtrarResultados(dataAtiva, DADOS_CAMPEONATO.jogos, naipeSelecionado); 
                }
            });
        });
        
        // Retorna os dados processados para a função de controle
        return { classificacaoCalculada, uniqueDates };

    } catch (error) {
        console.error("Falha ao carregar ou processar o JSON:", error);
        const gruposDiv = document.getElementById('classificacao-grupos');
        if (gruposDiv) {
             gruposDiv.innerHTML = '<p style="color:red;">Erro ao carregar os dados. Verifique se o arquivo dados.json existe e está no formato correto.</p>';
        }
        // Retorna um objeto vazio em caso de erro
        return { classificacaoCalculada: [], uniqueDates: [] }; 
    }
}

// ==========================================================
// CONTROLE DA TELA DE INÍCIO (O NOVO BLOCO PRINCIPAL)
// ==========================================================

document.addEventListener('DOMContentLoaded', function() {
    const splashScreen = document.getElementById('splash-screen');
    const mainContent = document.getElementById('main-content');
    const startButton = document.getElementById('start-button');

    // Inicia o carregamento e processamento dos dados em segundo plano
    const promiseDados = carregarDados(); 
    
    if (startButton) {
        startButton.addEventListener('click', async function() {
            startButton.disabled = true;
            startButton.textContent = 'Carregando...';

            // Aguarda o processamento de dados ser concluído
            const { classificacaoCalculada, uniqueDates } = await promiseDados;
            
            // 1. Esconde a tela de início
            if (splashScreen) splashScreen.style.display = 'none';
            
            // 2. Mostra o conteúdo principal
            if (mainContent) mainContent.style.display = 'block';

            // 3. Finaliza a renderização do conteúdo (Chamada de renderização final)
            renderizarTabelasClassificacao(classificacaoCalculada);
            renderizarBotoesData(uniqueDates); 
        });
    } else {
        // Fallback: Se o botão não for encontrado, carrega tudo diretamente
        promiseDados.then(({ classificacaoCalculada, uniqueDates }) => {
            if (mainContent) mainContent.style.display = 'block';
            renderizarTabelasClassificacao(classificacaoCalculada);
            renderizarBotoesData(uniqueDates); 
        });
    }
});