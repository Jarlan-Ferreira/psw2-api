const express = require("express");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");

const app = express();
app.use(express.json());

const SECRET = "psw2_secret_key";

// ── Dados mockados ────────────────────────────────────────────────────────────

const usuarios = [
  { id: 1, email: "admin@email.com", senha: "123456" },
];

const livros = [
  { id: 1, titulo: "Clean Code", autor: "Robert C. Martin", ano: 2008 },
  { id: 2, titulo: "The Pragmatic Programmer", autor: "Andrew Hunt", ano: 1999 },
  { id: 3, titulo: "Design Patterns", autor: "Gang of Four", ano: 1994 },
];

const logs = []; // { horario, rota }

// ── Middlewares ───────────────────────────────────────────────────────────────

// Registra horário e rota de cada requisição
app.use((req, _res, next) => {
  logs.push({ horario: new Date().toISOString(), rota: req.method + " " + req.path });
  next();
});

// Permite acesso apenas de segunda à sexta
app.use((req, res, next) => {
  const dia = new Date().getDay(); // 0=Dom, 6=Sáb
  if (dia === 0 || dia === 6) {
    return res.status(403).json({ erro: "API disponível apenas de segunda à sexta." });
  }
  next();
});

// Verifica JWT
function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: "Token não informado." });
  try {
    req.usuario = jwt.verify(auth.split(" ")[1], SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido." });
  }
}

// ── Rotas ─────────────────────────────────────────────────────────────────────

// A. Login
app.post("/logar", (req, res) => {
  const { email, senha } = req.body;
  const usuario = usuarios.find((u) => u.email === email && u.senha === senha);
  if (!usuario) return res.status(401).json({ erro: "Credenciais inválidas." });
  const token = jwt.sign({ id: usuario.id, email: usuario.email }, SECRET, { expiresIn: "8h" });
  res.json({ token });
});

// B. Listar livros
app.get("/livros", autenticar, (_req, res) => {
  res.json(livros);
});

// C. Inserir livro
app.post("/livros", autenticar, (req, res) => {
  const { titulo, autor, ano } = req.body;
  if (!titulo || !autor || !ano) return res.status(400).json({ erro: "titulo, autor e ano são obrigatórios." });
  const novoLivro = { id: livros.length + 1, titulo, autor, ano };
  livros.push(novoLivro);
  res.status(201).json(novoLivro);
});

// D. Excluir livro
app.delete("/livros/:id", autenticar, (req, res) => {
  const idx = livros.findIndex((l) => l.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ erro: "Livro não encontrado." });
  const [removido] = livros.splice(idx, 1);
  res.json({ mensagem: "Livro removido.", livro: removido });
});

// F. Buscar livro por ID
app.get("/livros/:id", autenticar, (req, res) => {
  const livro = livros.find((l) => l.id === Number(req.params.id));
  if (!livro) return res.status(404).json({ erro: "Livro não encontrado." });
  res.json(livro);
});

// F. Logs por data (ex: GET /logs?data=2025-03-10)
app.get("/logs", autenticar, (req, res) => {
  const { data } = req.query;
  if (!data) return res.status(400).json({ erro: "Informe o parâmetro 'data' (YYYY-MM-DD)." });
  const filtrados = logs.filter((l) => l.horario.startsWith(data));
  res.json(filtrados);
});

// G. PDF com lista de livros
app.get("/livros/relatorio/pdf", autenticar, (_req, res) => {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=livros.pdf");
  doc.pipe(res);

  doc.fontSize(18).text("Lista de Livros", { align: "center" }).moveDown();
  livros.forEach((l) => {
    doc.fontSize(12).text(`[${l.id}] ${l.titulo} — ${l.autor} (${l.ano})`);
  });

  doc.end();
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
