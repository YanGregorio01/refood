# Animação: uma requisição pelo Refood

Vídeo de estudo (1920x1080, ~6 min 50 s, narrado) que segue o `POST /api/reservas` do clique no
checkout até a reserva na tela, passando por Navegador → HTTP → FastAPI → database.py → PyMySQL → MySQL.
Cada etapa mostra o arquivo e as linhas reais do código.

## Como refazer

```bash
cd animacao
npm install
npm run trechos          # copia os trechos do código real para src/trechos.json
node ferramentas/narrar.mjs --conferir   # confere marcas e destaques do roteiro
node ferramentas/narrar.mjs              # gera só as falas novas/alteradas (gasta crédito ElevenLabs)
npm run dev              # Remotion Studio para ver
npm run render           # out/reserva.mp4
```

## Onde mexer

- `src/roteiro.ts`: as 17 cenas, a fala de cada uma e quando cada linha acende (`em` = pedaço da fala).
- `ferramentas/extrair-trechos.mjs`: quais trechos de código aparecem. Acha cada trecho por uma âncora
  de texto, então a numeração das linhas acompanha o código. Se o código mudar, rode `npm run trechos`.
  Se uma âncora sumir, o script avisa.
- `src/Especiais.tsx`: as cenas desenhadas (rede, framework x biblioteca, `%s`, a disputa pela última
  sacola, a tela e o resumo).
- Voz: Will (ElevenLabs), a mesma dos vídeos do perfil. A chave vem do `.env` de `../../instagram`.
