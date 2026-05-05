# PSW2 API — Roteiro de Apresentação

---

## A. Banco de dados MongoDB em nuvem (MongoDB Atlas)

A conexão com o Atlas é feita no `index.js` usando **Mongoose**.
A URI fica no `.env` para não expor credenciais no código.

```js
// ── Nodemailer ────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// index.js
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch((e) => console.error("Erro MongoDB:", e.message));
```

```env
# .env
MONGO_URI=mongodb+srv://admin:****@cluster0.cn1egpn.mongodb.net/psw2db
```

Os dados ficam em duas coleções no Atlas:
- **usuarios** — email, senha (hash), código 2FA
- **livros** — titulo, autor, ano, imagemUrl

---

## B. Imagem salva em nuvem (Cloudinary)

O upload é feito com **multer** + **multer-storage-cloudinary**.
A imagem vai direto para o Cloudinary e a URL é salva no MongoDB.

```js
// index.js
const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "psw2-livros", allowed_formats: ["jpg", "jpeg", "png"] },
});
const upload = multer({ storage });

// Rota POST /livros — recebe o arquivo e salva a URL
app.post("/livros", autenticar, upload.single("imagem"), async (req, res) => {
  const livro = await Livro.create({
    titulo, autor, ano: Number(ano),
    imagemUrl: req.file?.path || null, // URL do Cloudinary
  });
  res.status(201).json(livro);
});
```

```js
// models/Livro.js
const livroSchema = new mongoose.Schema({
  titulo:    { type: String, required: true },
  autor:     { type: String, required: true },
  ano:       { type: Number, required: true },
  imagemUrl: { type: String, default: null }, // URL da imagem no Cloudinary
});
```

---

## C. Rota PUT — Atualizar livro no banco

```js
// index.js
app.put("/livros/:id", autenticar, upload.single("imagem"), async (req, res) => {
  const { titulo, autor, ano } = req.body;
  const update = {};
  if (titulo) update.titulo = titulo;
  if (autor)  update.autor  = autor;
  if (ano)    update.ano    = Number(ano);
  if (req.file) update.imagemUrl = req.file.path;

  const livro = await Livro.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!livro) return res.status(404).json({ erro: "Livro não encontrado." });
  res.json(livro);
});
```

Exemplo de chamada:
```
PUT /livros/664abc123...
{ "titulo": "Novo Título", "autor": "Novo Autor", "ano": 2024 }
```

---

## D. Testes automatizados com Jest

19 testes cobrindo todas as rotas. Usa **supertest** para simular requisições HTTP e **mocks** para não depender do banco real durante os testes.

```js
// __tests__/api.test.js

describe("POST /logar", () => {
  it("retorna token com credenciais e código válidos", async () => {
    Usuario.findOne.mockResolvedValue({
      _id: "abc", email: "admin@email.com",
      verificarSenha: jest.fn().mockResolvedValue(true),
      codigo2fa: "111111",
      codigo2faExpira: new Date(Date.now() + 60000),
      save: jest.fn(),
    });
    const res = await request(app)
      .post("/logar")
      .send({ email: "admin@email.com", senha: "123456", codigo: "111111" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
});

describe("PUT /livros/:id", () => {
  it("atualiza livro existente", async () => {
    Livro.findByIdAndUpdate.mockReturnValue({ catch: () => ({ titulo: "Novo" }) });
    const res = await request(app)
      .put("/livros/lid1")
      .set(auth)
      .send({ titulo: "Novo" });
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe("Novo");
  });
});
```

Resultado ao rodar `npm test`:
```
PASS __tests__/api.test.js
  19 testes passando ✓
```

---

## E. Documentação no README.md

O `README.md` documenta todas as rotas, middlewares, variáveis de ambiente, exemplos de requisição e instruções de instalação e deploy.

Tabela de rotas documentada:

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/logar/solicitar-codigo` | Envia código 2FA por e-mail |
| POST | `/logar` | Autentica e retorna JWT |
| GET | `/livros` | Lista todos os livros |
| POST | `/livros` | Insere livro com imagem |
| PUT | `/livros/:id` | Atualiza livro |
| DELETE | `/livros/:id` | Remove livro |
| GET | `/distancia` | Calcula distância entre coordenadas |

---

## F. Senha criptografada com bcrypt

A senha nunca é salva em texto puro. O **bcrypt** aplica hash com salt 10 automaticamente antes de salvar no banco.

```js
// models/Usuario.js
const bcrypt = require("bcryptjs");

// Executa antes de qualquer .save()
usuarioSchema.pre("save", async function () {
  if (this.isModified("senha")) {
    this.senha = await bcrypt.hash(this.senha, 10); // hash com salt 10
  }
});

// Método para comparar senha no login
usuarioSchema.methods.verificarSenha = function (senha) {
  return bcrypt.compare(senha, this.senha);
};
```

No banco, a senha fica assim:
```
$2a$10$Xk9mN3pQwLzR8vT2uY5eOeHjK1mN3pQwLzR8vT2uY5eOeHjK1mN3p
```

---

## G. CORS — apenas mesmo servidor

Bloqueia requisições de origens externas. Só aceita chamadas do próprio servidor (`localhost:3000`).

```js
// index.js
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === `http://localhost:${process.env.PORT || 3000}`) {
      cb(null, true);  // permite
    } else {
      cb(new Error("CORS: origem não permitida")); // bloqueia
    }
  },
}));
```

---

## H. Segundo fator de segurança (2FA por e-mail)

O login é feito em **dois passos**:

**Passo 1 — Solicitar código:**
```js
// index.js
app.post("/logar/solicitar-codigo", async (req, res) => {
  const codigo = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
  usuario.codigo2fa = codigo;
  usuario.codigo2faExpira = new Date(Date.now() + 10 * 60 * 1000); // expira em 10 min
  await usuario.save();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Código de verificação PSW2",
    text: `Seu código: ${codigo} (válido por 10 minutos)`,
  });
});
```

**Passo 2 — Login com senha + código:**
```js
app.post("/logar", async (req, res) => {
  const { email, senha, codigo } = req.body;

  // Valida senha
  if (!usuario || !(await usuario.verificarSenha(senha)))
    return res.status(401).json({ erro: "Credenciais inválidas." });

  // Valida código 2FA
  if (usuario.codigo2fa !== codigo || new Date() > usuario.codigo2faExpira)
    return res.status(401).json({ erro: "Código 2FA inválido ou expirado." });

  // Gera JWT válido por 8h
  const token = jwt.sign({ id: usuario._id }, SECRET, { expiresIn: "8h" });
  res.json({ token });
});
```

---

## I. Distância entre dois pontos — Fórmula de Haversine

Calcula a distância real entre duas coordenadas geográficas na superfície da Terra.

```js
// index.js
// GET /distancia?lat1=-23.55&lon1=-46.63&lat2=-22.91&lon2=-43.17
app.get("/distancia", autenticar, (req, res) => {
  const { lat1, lon1, lat2, lon2 } = req.query;

  const R = 6371; // raio da Terra em km
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const distancia = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  res.json({ distanciaKm: distancia.toFixed(2) });
});
```

Exemplo — São Paulo → Rio de Janeiro:
```
GET /distancia?lat1=-23.55&lon1=-46.63&lat2=-22.91&lon2=-43.17

{ "distanciaKm": "357.42" }
```
