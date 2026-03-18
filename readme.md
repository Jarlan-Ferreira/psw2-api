# PSW2 API — Biblioteca de Livros

API REST desenvolvida para a atividade N2A da disciplina PSW2.

## Instalação

```bash
npm install
npm start
```

## Credenciais de teste

| Campo | Valor |
|-------|-------|
| email | admin@email.com |
| senha | 123456 |

## Rotas

Todas as rotas (exceto `/logar`) exigem o header:
```
Authorization: Bearer <token>
```

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/logar` | Autentica e retorna JWT |
| GET | `/livros` | Lista todos os livros |
| POST | `/livros` | Insere um novo livro |
| DELETE | `/livros/:id` | Remove um livro pelo ID |
| GET | `/livros/:id` | Busca um livro pelo ID |
| GET | `/logs?data=YYYY-MM-DD` | Retorna logs de uma data |
| GET | `/livros/relatorio/pdf` | Baixa PDF com lista de livros |

### Exemplo — Inserir livro

```json
POST /livros
{
  "titulo": "Refactoring",
  "autor": "Martin Fowler",
  "ano": 1999
}
```

## Middlewares

- **Dias úteis**: bloqueia requisições aos sábados e domingos (403)
- **Logger**: registra horário e rota de cada requisição em memória
- **JWT**: protege todas as rotas exceto `/logar`

## Deploy — Vercel

```bash
npm i -g vercel
vercel
```
