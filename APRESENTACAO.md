# Atividade N2 — PSW2

**Professor:** Harley Macêdo de Mello  
**Aluno:** Jarlan Emanuel  
**Entrega:** 09/06/2026

---

## A — Exportar CSV

Botão **"Exportar CSV"** na aba Exportar que baixa todos os livros e usuários do banco em formato `.csv`.

**Rota:**
```
GET /exportar-csv
Authorization: Bearer <token>
```

**Como testar:** acesse a aba **Exportar CSV** no frontend e clique em "Baixar CSV".

---

## B — Backup Automático às 17:00

Função agendada com `node-cron` que roda todos os dias às **17:00** e salva um snapshot CSV na collection `backups` do **MongoDB Atlas**.

**Rota manual:**
```
POST /backup-manual
Authorization: Bearer <token>
```

**Como testar:** acesse a aba **Exportar CSV** e clique em "Backup Agora". O documento é salvo no MongoDB na collection `backups`.

---

## C — Relatório de Monitoramento (PDF)

Botão **"Relatório de Monitoramento"** que gera e baixa um PDF contendo:
- Número de acessos por rota no mês atual
- Horário de pico de uso do sistema

**Rota:**
```
GET /relatorio-monitoramento
Authorization: Bearer <token>
```

**Como testar:** acesse a aba **Monitoramento** e clique em "Baixar Relatório PDF".

---

## D — Stream de Vídeo (YouTube)

Aba **"Stream"** com campo de busca integrado à **YouTube Data API v3**.  
Digite o nome de um vídeo, veja os resultados com thumbnail e canal, clique para reproduzir o player embed direto na página.

**Rota:**
```
GET /yt-search?q=<termo>
Authorization: Bearer <token>
```

**Como testar:** acesse a aba **Stream**, digite qualquer termo (ex: `Harry Potter`) e clique em Buscar. Clique em um resultado para reproduzir.

---

## E — Socket.io

Conexão WebSocket via **Socket.io** que emite o evento `sensor-update` a cada 2 segundos para todos os clientes conectados com os dados do sensor virtual.

Em ambientes serverless (Vercel), o front usa **polling automático** como fallback, chamando `GET /sensor` a cada 2 segundos.

**Como testar:** abra a aba **Sensor** — os dados atualizam automaticamente sem recarregar a página.

---

## F — Sensor Virtual em Tempo Real

Aba **"Sensor"** exibindo temperatura e umidade atualizados em tempo real.  
Sensor virtual simula leituras aleatórias:

- Temperatura: **20°C a 35°C**
- Umidade: **40% a 80%**

**Rota:**
```
GET /sensor
```

**Como testar:** acesse a aba **Sensor** e observe os valores sendo atualizados a cada 2 segundos.
