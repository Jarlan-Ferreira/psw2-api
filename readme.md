# PSW2 API v2 — Biblioteca de Livros

API REST desenvolvida para a atividade N2 da disciplina PSW2.

**Professor:** Harley Macêdo de Mello  
**Aluno:** Jarlan Emanuel  
**Entrega:** 09/06/2026

---

## Instalação

```bash
npm install
```

Configure o `.env`:

```env
MONGO_URI=mongodb+srv://<usuario>:<senha>@cluster.mongodb.net/psw2db
JWT_SECRET=psw2_secret_key
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>
EMAIL_USER=<seu_email>@gmail.com
EMAIL_PASS=<app_password_gmail>
YOUTUBE_API_KEY=<chave_youtube>
PORT=3000
```

```bash
npm start
```

---

## Funcionalidades da Atividade N2

### A — Exportar CSV
Botão **"Exportar CSV"** na aba Exportar que baixa todos os livros e usuários do banco em formato `.csv`.

```
GET /exportar-csv
Authorization: Bearer <token>
```

---

### B — Backup Automático às 17:00
Função agendada com `node-cron` que roda todos os dias às 17:00 e salva um snapshot CSV no **MongoDB Atlas** (collection `backups`).

Também disponível manualmente:

```
POST /backup-manual
Authorization: Bearer <token>
```

---

### C — Relatório de Monitoramento (PDF)
Botão **"Relatório de Monitoramento"** que gera e baixa um PDF contendo:
- Número de acessos por rota no mês atual
- Horário de pico de uso do sistema

```
GET /relatorio-monitoramento
Authorization: Bearer <token>
```

---

### D — Stream de Vídeo (YouTube)
Aba **"Stream"** com campo de busca integrado à **YouTube Data API v3**.  
Digita o nome de um vídeo, lista os resultados com thumbnail e canal, clica para reproduzir o player embed direto na página.

```
GET /yt-search?q=<termo>
Authorization: Bearer <token>
```

---

### E — Socket.io
Conexão WebSocket via **Socket.io** que emite o evento `sensor-update` a cada 2 segundos para todos os clientes conectados com os dados do sensor virtual.

Em ambientes serverless (Vercel), o front usa **polling** automático como fallback, chamando `GET /sensor` a cada 2 segundos.

---

### F — Sensor Virtual em Tempo Real
Aba **"Sensor"** exibindo temperatura e umidade atualizados em tempo real.  
Sensor virtual simula leituras aleatórias no intervalo de:
- Temperatura: 20°C a 35°C
- Umidade: 40% a 80%

```
GET /sensor
```

---

## Autenticação (2FA)

O login é feito em dois passos:

**1. Solicitar código:**
```
POST /logar/solicitar-codigo
{ "email": "admin@email.com" }
```

**2. Login com código recebido por e-mail:**
```
POST /logar
{ "email": "admin@email.com", "senha": "123456", "codigo": "123456" }
```

Retorna um `token` JWT válido por 8h. Todas as rotas protegidas exigem:
```
Authorization: Bearer <token>
```

---

## Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/logar/solicitar-codigo` | Envia código 2FA por e-mail |
| POST | `/logar` | Autentica e retorna JWT |
| GET | `/livros` | Lista todos os livros |
| POST | `/livros` | Insere livro com upload de imagem |
| PUT | `/livros/:id` | Atualiza livro |
| DELETE | `/livros/:id` | Remove livro |
| GET | `/livros/:id` | Busca livro por ID |
| GET | `/livros/relatorio/pdf` | PDF com lista de livros |
| GET | `/exportar-csv` | Exporta dados em CSV |
| POST | `/backup-manual` | Gera backup manual no MongoDB |
| GET | `/relatorio-monitoramento` | PDF de monitoramento |
| GET | `/yt-search?q=` | Busca vídeos no YouTube |
| GET | `/sensor` | Dados atuais do sensor virtual |
| GET | `/logs?data=YYYY-MM-DD` | Logs de uma data |
| GET | `/distancia?lat1=&lon1=&lat2=&lon2=` | Calcula distância (km) |

---

## Segurança

- Senhas com **bcrypt** (salt 10)
- **JWT** com expiração de 8h
- **2FA por e-mail** obrigatório no login
- **CORS** ativo

## Armazenamento em Nuvem

- **MongoDB Atlas** — livros, usuários e backups
- **Cloudinary** — imagens dos livros
- **YouTube Data API v3** — busca e stream de vídeos

## Deploy

Hospedado no **Vercel** com variáveis de ambiente configuradas no painel.

```bash
npm i -g vercel
vercel
```
