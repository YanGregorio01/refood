# Refood: etapas do projeto e divisão de tarefas

Escrito em 10/09/2026 para o grupo decidir quem faz o quê. Três datas mandam no
calendário: apresentação oral em 29/09 (somos o primeiro grupo a apresentar),
envio do PDF da 2ª entrega até 01/10 e fim da última sprint do ClickUp em 25/10.
Do dia de hoje até a apresentação são 19 dias.

## O que a 2ª entrega cobra

O modelo do professor tem cinco blocos: protótipo com imagens das telas,
planejamento Scrum (backlog priorizado, organização das entregas e divisão de
responsabilidades), quadro Kanban com print, início da implementação com
evidências, e o valor gerado pelo projeto. Traduzindo: até 29/09 precisamos ter
telas desenhadas, o ClickUp organizado e código rodando o suficiente para tirar
print e demonstrar. Não precisa estar pronto. Precisa existir, e cada um precisa
saber explicar a própria parte, porque a apresentação é oral e o enunciado avisa
que grupo que não consegue explicar o documento perde ponto.

Parte do documento já está resolvida pela 1ª entrega: identificação do grupo,
tecnologias (Python/FastAPI, MySQL, HTML/CSS/JavaScript, NumPy/Pandas), estrutura
técnica, viabilidade do MVP e valor gerado (ODS 2 e 12). Isso é transporte, não
trabalho novo.

## Como as frentes se encaixam

O projeto tem sete frentes, e elas não são independentes. A ordem em que uma
destrava a outra é esta:

    Protótipo das telas ──> Front-end (telas em HTML/CSS)
                                    │
    Modelagem do banco ──> Back-end (API) ──> Contrato da API (docs/API.md)
                                    │                    │
                                    └──> Integração front + back <──┘
                                                 │
                                    Testes finais e IA (usam dados reais)
                                                 │
                                    Documento final e apresentação

Duas coisas travam todo mundo se atrasarem: o protótipo, porque o front copia
dele, e a modelagem do banco, porque o back-end inteiro é construído em cima das
quatro tabelas. Por isso as duas vêm primeiro.

## As frentes, uma a uma

Para cada frente: o que é, o que sai dela, do que depende, que perfil combina
com ela e uma estimativa de esforço. As estimativas são para uma pessoa
trabalhando algumas horas por semana, sem heroísmo.

### 1. Protótipo das telas

Desenhar as telas do sistema antes de programar: cadastro e login, painel do
comerciante (cadastrar oferta, ver reservas), lista de ofertas para o consumidor
com filtro por cidade e bairro, detalhe da oferta e confirmação de reserva. Pode
ser feito no Figma, no Canva ou até desenhado em papel e fotografado, desde que
as imagens fiquem legíveis no PDF.

Sai daqui: as imagens das telas (seção 1.1 do documento) e o mapa de navegação
entre elas (seção 1.2).

Depende de: nada. É a primeira coisa a fazer.

Perfil: quem tem olho para layout e paciência para pensar no fluxo do usuário.
Não exige programar.

Esforço: 6 a 10 horas. Prazo interno: 20/09, para o front ter uma semana de
folga antes da apresentação.

### 2. Modelagem do banco de dados

Definir as quatro tabelas do MySQL e como se ligam: usuarios, estabelecimentos
(cada um pertence a um usuário), ofertas (cada uma pertence a um
estabelecimento, com quantidade, preço e validade) e reservas (ligam um usuário
a uma oferta e baixam a quantidade). Escrever o `CREATE TABLE` de cada uma e o
diagrama entidade-relacionamento.

Sai daqui: o arquivo `sql/schema.sql` e o diagrama ER para o documento.

Depende de: nada, mas precisa combinar com o back-end os nomes dos campos.

Perfil: quem está mais confortável com SQL. Como o back-end escreve as queries
em cima dessas tabelas, faz sentido a mesma pessoa cuidar das duas coisas, ou
as duas trabalharem lado a lado.

Esforço: 3 a 5 horas. Prazo interno: 14/09.

### 3. Back-end (API em FastAPI)

O servidor que recebe as requisições do site, conversa com o MySQL e devolve
JSON. Está dividido em nove etapas, na ordem em que uma depende da anterior:

| # | Etapa | Pronto quando |
|---|---|---|
| 1 | Configurar o projeto FastAPI | `GET /health` responde e um teste passa |
| 2 | Conexão com o MySQL | `/health` também confere o banco |
| 3 | API de usuários | criar e buscar usuário pela página `/docs` |
| 4 | Autenticação (senha em hash, token JWT) | `POST /login` devolve token e rota protegida recusa sem ele |
| 5 | API de estabelecimentos | só o dono edita o próprio estabelecimento |
| 6 | API de ofertas | oferta vencida não aparece |
| 7 | Consulta com filtro por cidade e bairro | busca filtra e pagina |
| 8 | Reservas | duas reservas ao mesmo tempo não estouram o estoque |
| 9 | Integração com o front | tela lista ofertas e faz reserva de verdade |

Sai daqui: o repositório `refood` no GitHub, o contrato da API em `docs/API.md`
(a lista de rotas, o que cada uma recebe e devolve) e o diário de
desenvolvimento, que vira a seção 4.3 do documento.

Depende de: modelagem do banco (a partir da etapa 2) e do protótipo (para
saber quais dados cada tela precisa).

Perfil: Python e SQL. É a frente com mais horas, então quem pegar deve ter menos
carga nas outras.

Esforço: 25 a 35 horas no total. Meta para 29/09: etapas 1 a 4 prontas e 5 e 6
começadas. O resto até 25/10.

### 4. Front-end (HTML, CSS e JavaScript)

Transformar o protótipo em páginas de verdade. Primeiro as telas estáticas,
sem dados. Depois o JavaScript que chama a API com `fetch`: enviar o formulário
de cadastro, guardar o token do login, pedir a lista de ofertas e mostrar,
clicar em reservar. Sem framework, conforme decidido na 1ª entrega.

Sai daqui: as páginas em `static/` (ou pasta equivalente) e os prints de tela
funcionando para o documento.

Depende de: protótipo (para as telas) e contrato da API (para o JavaScript). As
telas estáticas podem começar assim que o protótipo existir, sem esperar o
back-end.

Perfil: HTML e CSS com segurança, JavaScript básico. É a frente que mais aparece
na apresentação, porque é o que o professor vê na tela.

Esforço: 20 a 30 horas. Meta para 29/09: telas de cadastro, login e lista de
ofertas prontas, mesmo que ainda com dados fixos.

### 5. Módulo de IA (análise preditiva)

A quarta funcionalidade prometida na 1ª entrega: um script em Python com NumPy
e Pandas que olha o histórico de ofertas e reservas e estima quanto excedente
cada estabelecimento terá nos próximos dias. No começo não existe histórico,
então a primeira versão trabalha com dados inventados em CSV, e só depois passa
a ler do banco.

Sai daqui: um notebook ou script em `ia/`, com um gráfico ou tabela de
resultado para o documento.

Depende de: ter dados. Até o banco ter movimento, usa CSV de exemplo. Pode
começar a qualquer momento.

Perfil: quem gosta mais de dados que de tela. Pandas básico resolve.

Esforço: 8 a 12 horas. Não entra na meta de 29/09; é trabalho de outubro.

### 6. Testes finais

Usar o sistema como um usuário usaria e anotar o que quebra: cadastrar,
logar, criar oferta, buscar, reservar, tentar reservar mais do que tem, tentar
editar o estabelecimento de outro. Escrever um roteiro de testes com o resultado
esperado e o obtido. Os testes automáticos do back-end (pytest) são do próprio
back-end; aqui é o teste de ponta a ponta.

Sai daqui: o roteiro de testes preenchido e a lista de bugs para corrigir.

Depende de: front e back integrados (etapa 9 do back-end).

Perfil: qualquer um do grupo. Ajuda ser alguém que não escreveu o código,
porque quem escreve testa com carinho demais.

Esforço: 4 a 6 horas, na segunda quinzena de outubro.

### 7. Documento, Kanban e apresentação

Manter o ClickUp em dia (tarefas com responsável, status correto, print para o
documento), montar o PDF no modelo do professor juntando o que cada frente
produziu, e preparar a apresentação de 29/09. O documento não é só copiar: a
seção 2 pede um backlog priorizado e uma divisão de responsabilidades, que é
exatamente o que este arquivo está tentando fechar.

Sai daqui: o PDF da 2ª entrega, o print do Kanban e os slides ou roteiro da
fala de 29/09.

Depende de: todo mundo entregar sua parte até uns três dias antes.

Perfil: quem escreve bem e é organizado. Quem criou o quadro no ClickUp já
conhece a ferramenta.

Esforço: 8 a 12 horas espalhadas. Prazo interno para o PDF: 27/09, dois dias
antes da apresentação, para todos lerem antes de falar.

## Como as frentes se conversam

Nenhuma frente fecha sozinha. Cada uma entrega algo que outra consome, e é
nesses pontos de contato que o trabalho quebra quando cada um faz a sua parte
isolado. Os pares que mais conversam:

Protótipo e front-end. O desenho é a especificação do front. Quem codifica a
tela precisa saber o que cada campo mostra e para onde cada botão leva; quem
desenha precisa saber o que dá para fazer sem framework. Se forem pessoas
diferentes, uma sentada de meia hora olhando o Figma juntas resolve mais que
dez mensagens.

Banco e back-end. O `schema.sql` é a base de toda query da API. Nome de coluna,
tipo e chave estrangeira definidos aqui aparecem no código do back-end no dia
seguinte. Quem modela precisa saber quais perguntas a API vai fazer ao banco
(buscar oferta por cidade, baixar quantidade na reserva), e isso vem de quem
escreve a API.

Back-end e front-end. Conversam pelo contrato da API em `docs/API.md`: para
cada rota, o que se manda e o que volta, com exemplo de JSON. O front escreve o
`fetch` olhando esse arquivo, e o back-end garante que a rota faz o que o
arquivo diz. Enquanto o back-end não existe, o front trabalha com dados fixos
no mesmo formato do contrato, e a troca depois é só apontar a URL.

Banco e IA. A IA lê as mesmas tabelas de ofertas e reservas. Ela precisa de
coluna de data e de quantidade em cada uma, e quem modela o banco só sabe disso
se quem faz a IA pedir antes. Se a tabela nascer sem `criado_em`, a IA não tem
o que analisar.

Testes e todo mundo. Cada bug encontrado volta para quem fez aquela parte, com
o passo a passo para reproduzir. Quem testa não conserta; quem fez conserta.

Documento e todo mundo. Quem cuida do documento monta, não escreve tudo. Cada
frente entrega o texto da sua parte (o que fez, como funciona, print) e quem
monta encaixa no modelo do professor. Isso também é o que garante que na
apresentação cada um consiga explicar o que fez.

## Como trabalhar de forma cruzada

Como as partes se conversam, todo mundo vai encostar um pouco em cada coisa. O
que evita que isso vire bagunça:

1. Um repositório só no GitHub, com uma pasta por frente: `app/` (back-end),
   `static/` (front), `sql/` (banco), `ia/` e `docs/`. Cada um trabalha em
   branch própria e abre PR. Quem revisa o PR é alguém de outra frente, o que
   já é a forma de "ajudar um pouco em cada coisa" sem tomar o lugar de ninguém,
   e é assim que cada um aprende o suficiente para explicar o todo no dia 29.

2. Três arquivos funcionam como contrato entre frentes, e mudança neles é
   avisada no grupo no mesmo dia: o protótipo (entre desenho e front), o
   `sql/schema.sql` (entre banco, back-end e IA) e o `docs/API.md` (entre
   back-end e front). Ninguém altera um contrato só para si.

3. Um arquivo `sql/dados_exemplo.sql` com meia dúzia de usuários, dois
   estabelecimentos e umas dez ofertas. Serve para o front ter o que listar, para
   a IA ter o que analisar e para quem testa começar do mesmo ponto. Quem faz o
   banco cria; todo mundo usa.

4. Reunião curta no começo de cada sprint, 15 minutos, cada um responde três
   coisas: o que fiz, o que vou fazer, o que está me travando. O "o que está me
   travando" é onde aparece que o front precisa de uma rota que o back-end ainda
   não fez, ou que o banco precisa de uma coluna que ninguém pediu. No meio da
   sprint, uma mensagem no grupo com o mesmo formato.

5. Toda tarefa do ClickUp tem um responsável e muda de status no dia em que
   começa e no dia em que termina. Além do print do Kanban para o documento, é
   o que deixa os outros verem em que pé está cada frente sem perguntar.

6. Quem termina a própria parte antes ajuda a frente que está atrasada, começando
   pelos testes e pela revisão de PR, que qualquer um consegue fazer.

## Divisão de tarefas

Somos quatro e são sete frentes. A ideia é cada um ter uma frente principal,
pela qual responde, e uma ou duas de apoio, onde revisa, testa e cobre quando
precisar. As datas são sugestão e cabem ajuste.

| Frente | Responsável principal | Apoio | Quando |
|---|---|---|---|
| Modelagem do banco | a definir | a definir | até 14/09 |
| Back-end | a definir | a definir | 10/09 a 25/10 |
| Protótipo das telas | a definir | a definir | até 20/09 |
| Front-end | a definir | a definir | 15/09 a 25/10 |
| Módulo de IA | a definir | a definir | outubro |
| Testes finais | a definir | a definir | 13/10 a 25/10 |
| Documento, Kanban e apresentação | a definir | a definir | contínuo, PDF até 27/09 |

Encaixes que costumam funcionar: banco e back-end na mesma pessoa, ou em duas
que sentam juntas na primeira semana; protótipo e front na mesma pessoa se ela
tiver segurança com HTML e CSS; documento e testes na mesma pessoa, porque os
dois exigem olhar o trabalho dos outros. A IA pode ficar com quem tiver a
frente principal mais leve, já que só começa para valer em outubro.

## Sobre o calendário do ClickUp

O quadro atual coloca as tarefas de banco e de API na Sprint 3 (28/09 a 04/10)
e login, cadastro e busca na Sprint 4 (05/10 a 11/10). Isso é depois da
apresentação. Para o Kanban refletir o que vamos mostrar em 29/09, essas
tarefas precisam ir para as Sprints 1 e 2 (14/09 a 27/09). O protótipo também
está na Sprint 2, terminando em 27/09, dois dias antes de apresentar, e vale
adiantar. Vale um ajuste com quem montou o quadro antes de a Sprint 1 começar.
