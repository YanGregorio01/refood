// O roteiro da animação: uma cena por bloco de fala.
//
// "fala" é o texto que o ElevenLabs lê. Alguns nomes estão escritos como se pronunciam
// (djêison, pai-mai-ésse-quê-éle...) para a voz não tropeçar. "em" aponta um pedaço da fala:
// a coisa acende no instante em que a voz diz esse pedaço (vem dos tempos do with-timestamps).
// Trechos de código: ids de src/trechos.json (gerado por ferramentas/extrair-trechos.mjs).

export type CamadaId = "navegador" | "http" | "fastapi" | "ponte" | "pymysql" | "mysql";

export type Destaque = { texto: string; em: string };
export type Nota = { em: string; titulo: string; corpo: string; tom: "ok" | "erro" | "info" };

type Base = {
  id: string;
  etapa: string; // a faixa no topo: "Etapa 6 de 8"
  titulo: string;
  fala: string;
  camadas: CamadaId[]; // camadas acesas no diagrama da esquerda
  sentido?: "ida" | "volta";
};

export type CenaCodigo = Base & {
  tipo: "codigo";
  paineis: string[];
  destaques: Destaque[];
  notas?: Nota[];
};
export type CenaEspecial = Base & {
  tipo: "abertura" | "http" | "biblioteca" | "injecao" | "corrida" | "tela" | "resumo";
  marcas: Record<string, string>; // nome da marca -> pedaço da fala
};
export type Cena = CenaCodigo | CenaEspecial;

export const CAMADAS: { id: CamadaId; nome: string; sub: string }[] = [
  { id: "navegador", nome: "Navegador", sub: "HTML + JS · checkout.js, api.js" },
  { id: "http", nome: "HTTP / JSON", sub: "o pedido viaja como texto" },
  { id: "fastapi", nome: "FastAPI", sub: "framework · rota, Depends, Pydantic" },
  { id: "ponte", nome: "database.py", sub: "a ponte · get_db, buscar_um" },
  { id: "pymysql", nome: "PyMySQL", sub: "biblioteca · o cabo até o banco" },
  { id: "mysql", nome: "MySQL", sub: "tabelas alimentos e reservas" },
];

export const CENAS: Cena[] = [
  {
    id: "01",
    tipo: "abertura",
    etapa: "POST /api/reservas",
    titulo: "Uma requisição, do clique à tela",
    camadas: [],
    fala:
      "Vamos seguir uma única requisição do Refood, do clique até a resposta na tela. A consumidora escolheu uma sacola e apertou: confirmar reserva. Até ela ver o código de retirada, esse pedido atravessa seis camadas.",
    marcas: { botao: "confirmar reserva", camadas: "seis camadas" },
  },
  {
    id: "02",
    tipo: "codigo",
    etapa: "Etapa 1 de 8",
    titulo: "O clique",
    camadas: ["navegador"],
    sentido: "ida",
    fala:
      "Tudo começa no checkout ponto jota ésse. O formulário cancela o envio padrão do navegador, desliga o botão para evitar clique duplo, e chama a função api, com o método POST e um corpo com três campos: a sacola, a quantidade e a forma de pagamento.",
    paineis: ["checkout_submit"],
    destaques: [
      { texto: "evento.preventDefault()", em: "cancela" },
      { texto: "botao.disabled = true", em: "desliga" },
      { texto: 'await api("/reservas"', em: "chama a função" },
      { texto: 'metodo: "POST"', em: "método POST" },
      { texto: "id_alimento:", em: "a sacola" },
      { texto: "quantidade: Number", em: "a quantidade" },
      { texto: "forma_pagamento:", em: "forma de pagamento" },
    ],
  },
  {
    id: "03",
    tipo: "codigo",
    etapa: "Etapa 2 de 8",
    titulo: "Montando o pedido",
    camadas: ["navegador"],
    sentido: "ida",
    fala:
      "A função api, no arquivo api ponto jota ésse, monta o pedido. Ela junta o prefixo barra api com o caminho. Pega o token do login, guardado no local storage, e coloca no cabeçalho Authorization, como Bearer. Depois converte o corpo em texto djêison, e dispara o fetch.",
    paineis: ["api_base", "api_monta"],
    destaques: [
      { texto: "const BASE", em: "prefixo" },
      { texto: "new URL(BASE + caminho", em: "com o caminho" },
      { texto: "const CHAVE_TOKEN", em: "local storage" },
      { texto: "const atual = sessao()", em: "Pega o token" },
      { texto: "cabecalhos.Authorization", em: "cabeçalho" },
      { texto: "JSON.stringify(corpo)", em: "converte" },
      { texto: "await fetch(url", em: "dispara" },
    ],
  },
  {
    id: "04",
    tipo: "http",
    etapa: "Etapa 3 de 8",
    titulo: "Pela rede",
    camadas: ["http"],
    sentido: "ida",
    fala:
      "Agora o pedido sai do navegador, como texto, pelo protocolo HTTP, até o servidor uvicorn, na porta oito mil. E repare: o navegador nunca fala direto com o mai-ésse-quê-éle. Quem conversa com o banco é só a API.",
    marcas: { texto: "como texto", servidor: "uvicorn", nunca: "nunca fala", api: "só a API" },
  },
  {
    id: "05",
    tipo: "codigo",
    etapa: "Etapa 4 de 8",
    titulo: "A rota",
    camadas: ["fastapi"],
    sentido: "ida",
    fala:
      "No servidor, quem recebe é o FastAPI. O mêin ponto pai registrou todos os routers. O router do consumidor tem o prefixo barra api, e o POST barra reservas cai na função reservar. Repare: nenhuma linha do nosso código chama reservar. Quem chama é o FastAPI.",
    paineis: ["main_rotas", "cons_router", "cons_rota"],
    destaques: [
      { texto: "include_router", em: "registrou" },
      { texto: 'prefix="/api"', em: "prefixo" },
      { texto: '@router.post("/reservas"', em: "POST barra" },
      { texto: "def reservar", em: "função reservar" },
    ],
    notas: [
      {
        em: "Quem chama é",
        titulo: "Inversão de controle",
        corpo: "O FastAPI chama reservar() quando chega um POST /api/reservas.",
        tom: "info",
      },
    ],
  },
  {
    id: "06",
    tipo: "biblioteca",
    etapa: "Etapa 4 de 8",
    titulo: "Framework x biblioteca",
    camadas: ["fastapi", "ponte", "pymysql"],
    fala:
      "Essa é a diferença entre framework e biblioteca. O FastAPI é um framework: ele chama o nosso código. Isso se chama inversão de controle. Já o pai-mai-ésse-quê-éle é uma biblioteca: é o nosso código que chama ele. E os dois são independentes. Quem liga um ao outro é o database ponto pai, a ponte.",
    marcas: {
      framework: "framework: ele chama",
      biblioteca: "biblioteca: é o nosso",
      independentes: "independentes",
      ponte: "a ponte",
    },
  },
  {
    id: "07",
    tipo: "codigo",
    etapa: "Etapa 5 de 8",
    titulo: "Dependência 1: a conexão",
    camadas: ["fastapi", "ponte", "pymysql"],
    sentido: "ida",
    fala:
      "Antes de rodar reservar, o FastAPI resolve as dependências: os parâmetros com Depends. A primeira é o guét dê bê. Ele usa o pai-mai-ésse-quê-éle para abrir uma conexão com o banco, com as linhas vindo como dicionário, e com o autocommit desligado: nada é gravado sem commit. A conexão é entregue com iíld, e fica aberta até a resposta sair.",
    paineis: ["cons_rota", "db_conectar", "db_get"],
    destaques: [
      { texto: "conn=Depends(get_db)", em: "Depends" },
      { texto: "def get_db", em: "guét dê bê" },
      { texto: "pymysql.connect(", em: "abrir uma conexão" },
      { texto: "cursorclass=DictCursor", em: "dicionário" },
      { texto: "autocommit=False", em: "autocommit" },
      { texto: "yield conn", em: "iíld" },
    ],
  },
  {
    id: "08",
    tipo: "codigo",
    etapa: "Etapa 5 de 8",
    titulo: "Dependência 2: o login",
    camadas: ["fastapi"],
    sentido: "ida",
    fala:
      "A segunda dependência é o login. No topo do arquivo, consumidor é exigir comum. Ele depende de usuário atual, que decodifica o token jota dáblio tê, e busca a pessoa na tabela usuarios, com a mesma conexão, porque o FastAPI reaproveita a dependência dentro da requisição. Sem token: erro quatrocentos e um. Conta de outro tipo: quatrocentos e três.",
    paineis: ["cons_consumidor", "seg_usuario", "seg_verificar"],
    destaques: [
      { texto: 'consumidor = exigir("COMUM")', em: "consumidor é" },
      { texto: "Depends(usuario_atual)", em: "depende de" },
      { texto: "jwt.decode", em: "decodifica" },
      { texto: "FROM usuarios", em: "tabela usuarios" },
      { texto: "conn=Depends(get_db)", em: "mesma conexão" },
      { texto: "if credenciais is None", em: "Sem token" },
      { texto: "HTTP_403_FORBIDDEN", em: "quatrocentos e três" },
    ],
  },
  {
    id: "09",
    tipo: "codigo",
    etapa: "Etapa 5 de 8",
    titulo: "Dependência 3: a validação",
    camadas: ["fastapi"],
    sentido: "ida",
    fala:
      "Por último, o pai-dântic confere o corpo contra o modelo Nova Reserva. A quantidade tem que ficar entre um e cinco, e a forma de pagamento só pode ser PIX ou cartão. Se chegar quantidade dez, o pedido para aqui, com erro quatrocentos e vinte e dois, e a mensagem em português sai do mêin ponto pai. A função reservar nem chega a rodar.",
    paineis: ["esq_reserva", "main_422"],
    destaques: [
      { texto: "class NovaReserva", em: "Nova Reserva" },
      { texto: "ge=1, le=5", em: "entre um e cinco" },
      { texto: 'Literal["CARTAO", "PIX"]', em: "PIX ou cartão" },
      { texto: "status_code=422", em: "vinte e dois" },
      { texto: "@app.exception_handler", em: "mensagem em português" },
    ],
    notas: [
      { em: "quantidade dez", titulo: "Corpo enviado", corpo: '{"id_alimento": 5, "quantidade": 10}', tom: "info" },
      { em: "vinte e dois", titulo: "422", corpo: "A quantidade precisa ser no máximo 5.", tom: "erro" },
    ],
  },
  {
    id: "10",
    tipo: "codigo",
    etapa: "Etapa 6 de 8",
    titulo: "A transação",
    camadas: ["ponte", "pymysql", "mysql"],
    sentido: "ida",
    fala:
      "Passou por tudo. Agora a função reservar roda, e começa a parte mais importante: uma transação. O biguín abre a transação. O select com for update lê a sacola e trava aquela linha. Depois o código confere: a sacola existe? Está disponível, dentro do prazo, e tem estoque? Se não, rôlbéc, e erro quatrocentos e nove.",
    paineis: ["cons_trans"],
    destaques: [
      { texto: "conn.begin()", em: "biguín" },
      { texto: "FOR UPDATE", em: "for update" },
      { texto: "sacola is None", em: "existe" },
      { texto: '!= "DISPONIVEL"', em: "disponível" },
      { texto: "conn.rollback()", em: "rôlbéc" },
      { texto: "HTTPException(409", em: "quatrocentos e nove" },
    ],
    notas: [
      { em: "trava aquela linha", titulo: "Trava", corpo: "Ninguém mais altera esta sacola até o commit.", tom: "info" },
      { em: "quatrocentos e nove", titulo: "409", corpo: "Esta sacola não está mais disponível.", tom: "erro" },
    ],
  },
  {
    id: "11",
    tipo: "injecao",
    etapa: "Etapa 6 de 8",
    titulo: "O %s contra SQL injection",
    camadas: ["ponte", "pymysql"],
    fala:
      "Repare no por cento ésse. O valor nunca é colado dentro do texto do ésse-quê-éle. Ele vai separado, numa tupla, e o pai-mai-ésse-quê-éle trata o valor antes de mandar ao banco. Se alguém tentar enviar um pedaço de ésse-quê-éle no lugar do número, ele vira só um texto, e não um comando. É a proteção contra ésse-quê-éle injéction.",
    marcas: { porcento: "por cento", tupla: "numa tupla", trata: "trata o valor", ataque: "Se alguém", texto: "só um texto", protecao: "proteção" },
  },
  {
    id: "12",
    tipo: "corrida",
    etapa: "Etapa 6 de 8",
    titulo: "Duas pessoas, uma sacola",
    camadas: ["mysql"],
    fala:
      "E por que travar a linha? Imagine duas pessoas reservando a última sacola no mesmo instante. A Ana chega primeiro e pega a trava. O Bruno também pede, mas fica esperando. A Ana baixa o estoque para zero e faz o commit. Só então a trava solta. O Bruno lê a linha, já vê zero, e recebe quatrocentos e nove. Sem a trava, os dois leriam um, e a mesma sacola seria vendida duas vezes.",
    marcas: {
      ana: "Ana chega",
      bruno: "Bruno também",
      baixa: "baixa o estoque",
      commit: "faz o commit",
      solta: "trava solta",
      zero: "já vê zero",
      erro: "quatrocentos e nove",
      sem: "Sem a trava",
    },
  },
  {
    id: "13",
    tipo: "codigo",
    etapa: "Etapa 6 de 8",
    titulo: "Grava tudo junto",
    camadas: ["pymysql", "mysql"],
    sentido: "ida",
    fala:
      "No caminho feliz, o update baixa o estoque, e marca a sacola como reservada se ela acabar. O insert cria a reserva, com um código de retirada novo. E o commit grava os dois juntos. Se algo falhar no meio, o rôlbéc desfaz tudo: nunca fica estoque baixado sem reserva.",
    paineis: ["cons_grava", "util_codigo"],
    destaques: [
      { texto: "UPDATE alimentos", em: "update" },
      { texto: '"RESERVADO" if restante == 0', em: "reservada" },
      { texto: "INSERT INTO reservas", em: "insert" },
      { texto: "novo_codigo_retirada(conn)", em: "código de retirada" },
      { texto: 'codigo = f"RF-', em: "novo" },
      { texto: "conn.commit()", em: "commit grava" },
    ],
    notas: [
      { em: "update", titulo: "alimentos", corpo: "quantidade 1 → 0", tom: "info" },
      { em: "insert", titulo: "reservas", corpo: "+ reserva RF-24098", tom: "info" },
      { em: "commit grava", titulo: "COMMIT", corpo: "As duas valem juntas.", tom: "ok" },
    ],
  },
  {
    id: "14",
    tipo: "codigo",
    etapa: "Etapa 7 de 8",
    titulo: "A resposta",
    camadas: ["fastapi", "ponte", "http"],
    sentido: "volta",
    fala:
      "Agora, o caminho de volta. A função devolve um dicionário do Python. O FastAPI transforma esse dicionário em djêison e responde com o status duzentos e um, Created, que foi definido na própria rota. E o fáinali do guét dê bê fecha a conexão com o banco.",
    paineis: ["cons_return", "cons_rota", "db_get"],
    destaques: [
      { texto: "return _reserva_do_usuario", em: "dicionário do Python" },
      { texto: "HTTP_201_CREATED", em: "duzentos e um" },
      { texto: "finally:", em: "fáinali" },
      { texto: "conn.close()", em: "fecha" },
    ],
    notas: [
      {
        em: "djêison",
        titulo: "HTTP/1.1 201 Created",
        corpo: '{"id_reserva": 87, "codigo_retirada": "RF-24098", "status": "PENDENTE", ...}',
        tom: "ok",
      },
    ],
  },
  {
    id: "15",
    tipo: "codigo",
    etapa: "Etapa 8 de 8",
    titulo: "De volta ao navegador",
    camadas: ["navegador"],
    sentido: "volta",
    fala:
      "No navegador, a função api lê o djêison. Se a resposta veio ok, devolve os dados, e o checkout leva a consumidora para a página da reserva. Se veio erro, a função lança um Erro-a-pê-í com a mensagem do servidor, e o checkout mostra o aviso. E um quatrocentos e um manda de volta para o login.",
    paineis: ["api_volta", "checkout_destino"],
    destaques: [
      { texto: "resposta.json()", em: "lê o" },
      { texto: "if (resposta.ok) return dados", em: "veio ok" },
      { texto: "location.replace", em: "página da reserva" },
      { texto: "throw new ErroApi", em: "lança" },
      { texto: "irParaLogin", em: "login" },
    ],
  },
  {
    id: "16",
    tipo: "tela",
    etapa: "Etapa 8 de 8",
    titulo: "Na tela",
    camadas: ["navegador"],
    sentido: "volta",
    fala: "E ela vê: reserva confirmada. Código érre éfe, dois quatro zero nove oito. É só mostrar na loja.",
    marcas: { codigo: "Código" },
  },
  {
    id: "17",
    tipo: "resumo",
    etapa: "Resumo",
    titulo: "Um clique, seis camadas, uma transação",
    camadas: [],
    fala:
      "Recapitulando. O navegador monta o pedido. O HTTP leva. O FastAPI roteia, confere o login e valida. O database ponto pai faz a ponte, o pai-mai-ésse-quê-éle leva o ésse-quê-éle, e o banco trava, grava e confirma. Depois, a resposta volta pelo mesmo caminho. Um clique, seis camadas, uma transação.",
    marcas: {
      navegador: "O navegador",
      http: "O HTTP",
      fastapi: "O FastAPI",
      ponte: "O database",
      pymysql: "o pai-mai",
      mysql: "o banco",
      volta: "volta",
      fim: "Um clique",
    },
  },
];
