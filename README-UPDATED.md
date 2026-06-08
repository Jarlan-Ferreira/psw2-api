# PSW2 API v2 — Biblioteca de Livros

API REST desenvolvida para a atividade N2B da disciplina PSW2.

## Instalação

```bash
npm install
```

Copie `.env` e preencha as variáveis:

```env
MONGO_URI=mongodb+srv://<usuario>:<senha>@cluster.mongodb.net/psw2db
JWT_SECRET=psw2_secret_key
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>
EMAIL_USER=<seu_email>@gmail.com
EMAIL_PASS=<app_password_gmail>
PORT=3000
```

```bash
npm start
```

## Testes

```bash
npm test
```

## Autenticação (2FA)

O login é feito em **dois passos**:

**1. Solicitar código:**
```
POST /logar/solicitar-codigo
{ "email": "admin@email.com" }
```

**2. Fazer login com o código recebido por e-mail:**
```
POST /logar
{ "email": "admin@email.com", "senha": "123456", "codigo": "123456" }
```
Retorna um `token` JWT válido por 8h.

Todas as demais rotas exigem o header:
```
Authorization: Bearer <token>
```

## Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/logar/solicitar-codigo` | Envia código 2FA por e-mail |
| POST | `/logar` | Autentica com senha + código 2FA e retorna JWT |
| GET | `/livros` | Lista todos os livros |
| POST | `/livros` | Insere livro (suporta upload de imagem) |
| PUT | `/livros/:id` | Atualiza dados de um livro |
| DELETE | `/livros/:id` | Remove um livro pelo ID |
| GET | `/livros/:id` | Busca um livro pelo ID |
| GET | `/livros/relatorio/pdf` | Baixa PDF com lista de livros |
| GET | `/logs?data=YYYY-MM-DD` | Retorna logs de uma data |
| GET | `/distancia?lat1=&lon1=&lat2=&lon2=` | Calcula distância entre dois pontos (km) |
| **GET** | **`/exportar-csv`** | **🆕 A. Exporta todos os dados em CSV** |
| **GET** | **`/relatorio-monitoramento`** | **🆕 C. PDF com estatísticas de acesso** |
| **GET** | **`/video-stream`** | **🆕 D. Stream de vídeo simulado** |
| **GET** | **`/sensor`** | **🆕 F. Dados do sensor virtual** |

## 🆕 Novas Funcionalidades

### A. Exportar CSV
Botão que baixa todos os dados do BD em formato CSV:
```
GET /exportar-csv
```

### B. Backup Automático
Backup diário às 17:00 em formato CSV salvo na pasta `./backups/`

### C. Relatório de Monitoramento
PDF com estatísticas do mês atual:
- Número de acessos por rota
- Horário de pico de uso
```
GET /relatorio-monitoramento
```

### D. Stream de Vídeo
Stream simulado que envia dados em tempo real:
```
GET /video-stream
```

### E. Socket.io
Comunicação em tempo real para dados do sensor. Conecte via JavaScript:
```javascript
const socket = io();
socket.on('sensor-update', (data) => {
    console.log(data); // { temperatura, umidade, timestamp }
});
```

### F. Sensor Virtual
Dados simulados de temperatura e umidade atualizados a cada 2 segundos:
```
GET /sensor
```

## Demonstração

Acesse `/cliente.html` para ver as funcionalidades em ação.

### Inserir livro (com imagem)

```
POST /livros
Content-Type: multipart/form-data

titulo: Refactoring
autor: Martin Fowler
ano: 1999
imagem: <arquivo .jpg/.png>
```

### Atualizar livro

```json
PUT /livros/<id>
{
  "titulo": "Novo Título",
  "autor": "Novo Autor",
  "ano": 2024
}
```

### Calcular distância

```
GET /distancia?lat1=-23.55&lon1=-46.63&lat2=-22.91&lon2=-43.17
```
```json
{ "distanciaKm": "357.42" }
```

## Middlewares

| Middleware | Descrição |
|-----------|-----------|
| CORS | Permite apenas requisições do mesmo servidor |
| Dias úteis | Bloqueia requisições aos sábados e domingos (403) |
| Logger | Registra horário e rota de cada requisição em memória |
| JWT | Protege todas as rotas exceto `/logar` e `/logar/solicitar-codigo` |

## Segurança

- Senhas armazenadas com **bcrypt** (salt 10)
- **JWT** com expiração de 8h
- **2FA por e-mail** obrigatório no login
- **CORS** restrito ao mesmo servidor

## Armazenamento em nuvem

- **MongoDB Atlas** — dados dos livros e usuários
- **Cloudinary** — imagens dos livros

## Deploy — Vercel

```bash
npm i -g vercel
vercel
```