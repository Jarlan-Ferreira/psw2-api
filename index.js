require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const jwt        = require("jsonwebtoken");
const bcrypt     = require("bcryptjs");
const cors       = require("cors");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const multer     = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const PDFDocument = require("pdfkit");
const cron        = require("node-cron");
const fs          = require("fs");
const http        = require("http");
const { Server }  = require("socket.io");

const Usuario = require("./models/Usuario");
const Livro   = require("./models/Livro");
const Backup  = require("./models/Backup");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const path = require("path");
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const SECRET = process.env.JWT_SECRET || "psw2_secret_key";

// ── MongoDB ───────────────────────────────────────────────────────────────────
if (process.env.MONGO_URI && !process.env.MONGO_URI.includes("<")) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB conectado"))
    .catch((e) => console.error("Erro MongoDB:", e.message));
}

// ── Cloudinary ────────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "psw2-livros", allowed_formats: ["jpg", "jpeg", "png"] },
});
const upload = multer({ storage });

// ── Nodemailer ────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ── Logs em memória ───────────────────────────────────────────────────────────
const logs = [];
let acessosPorRota = {};

// ── Sensor virtual ────────────────────────────────────────────────────────────
let sensorData = { temperatura: 25, umidade: 60, timestamp: new Date() };

// Simula sensor virtual
setInterval(() => {
  sensorData = {
    temperatura: (20 + Math.random() * 15).toFixed(1),
    umidade: (40 + Math.random() * 40).toFixed(0),
    timestamp: new Date()
  };
  io.emit('sensor-update', sensorData);
}, 2000);

// ── Middlewares globais ───────────────────────────────────────────────────────

app.use((req, _res, next) => {
  const rota = `${req.method} ${req.path}`;
  logs.push({ horario: new Date().toISOString(), rota });
  acessosPorRota[rota] = (acessosPorRota[rota] || 0) + 1;
  next();
});

/* app.use((req, res, next) => {
  const dia = new Date().getDay();
  if (dia === 0 || dia === 6) {
    return res.status(403).json({ erro: "API disponível apenas de segunda à sexta." });
  }
  next();
}); */

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

// ── Criar usuário ────────────────────────────────────────────────────────────
app.post("/usuarios", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "email e senha são obrigatórios." });
  const existe = await Usuario.findOne({ email });
  if (existe) return res.status(409).json({ erro: "E-mail já cadastrado." });
  const usuario = await Usuario.create({ email, senha });
  res.status(201).json({ mensagem: "Usuário criado.", email: usuario.email });
});

// ── H. 2FA — solicitar código ─────────────────────────────────────────────────
app.post("/logar/solicitar-codigo", async (req, res) => {
  const { email } = req.body;
  const usuario = await Usuario.findOne({ email });
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  usuario.codigo2fa = codigo;
  usuario.codigo2faExpira = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await usuario.save();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Código de verificação PSW2",
    text: `Seu código: ${codigo} (válido por 10 minutos)`,
  });

  res.json({ mensagem: "Código enviado para o e-mail." });
});

// ── Login com 2FA ─────────────────────────────────────────────────────────────
app.post("/logar", async (req, res) => {
  const { email, senha, codigo } = req.body;
  const usuario = await Usuario.findOne({ email });
  if (!usuario || !(await usuario.verificarSenha(senha))) {
    return res.status(401).json({ erro: "Credenciais inválidas." });
  }

  // Valida 2FA
  if (!codigo) return res.status(400).json({ erro: "Informe o código 2FA enviado ao e-mail." });
  if (usuario.codigo2fa !== codigo || new Date() > usuario.codigo2faExpira) {
    return res.status(401).json({ erro: "Código 2FA inválido ou expirado." });
  }

  // Limpa código após uso
  usuario.codigo2fa = null;
  usuario.codigo2faExpira = null;
  await usuario.save();

  const token = jwt.sign({ id: usuario._id, email: usuario.email }, SECRET, { expiresIn: "8h" });
  res.json({ token });
});

// ── Livros ────────────────────────────────────────────────────────────────────

// Listar
app.get("/livros", autenticar, async (_req, res) => {
  const livros = await Livro.find();
  res.json(livros);
});

// Buscar por ID
app.get("/livros/:id", autenticar, async (req, res) => {
  const livro = await Livro.findById(req.params.id).catch(() => null);
  if (!livro) return res.status(404).json({ erro: "Livro não encontrado." });
  res.json(livro);
});

// Inserir (B. com upload de imagem para Cloudinary)
app.post("/livros", autenticar, upload.single("imagem"), async (req, res) => {
  const { titulo, autor, ano } = req.body;
  if (!titulo || !autor || !ano) {
    return res.status(400).json({ erro: "titulo, autor e ano são obrigatórios." });
  }
  const livro = await Livro.create({
    titulo, autor, ano: Number(ano),
    imagemUrl: req.file?.path || null,
  });
  res.status(201).json(livro);
});

// C. Atualizar (PUT)
app.put("/livros/:id", autenticar, upload.single("imagem"), async (req, res) => {
  const { titulo, autor, ano } = req.body;
  const update = {};
  if (titulo) update.titulo = titulo;
  if (autor)  update.autor  = autor;
  if (ano)    update.ano    = Number(ano);
  if (req.file) update.imagemUrl = req.file.path;

  const livro = await Livro.findByIdAndUpdate(req.params.id, update, { new: true }).catch(() => null);
  if (!livro) return res.status(404).json({ erro: "Livro não encontrado." });
  res.json(livro);
});

// Excluir
app.delete("/livros/:id", autenticar, async (req, res) => {
  const livro = await Livro.findByIdAndDelete(req.params.id).catch(() => null);
  if (!livro) return res.status(404).json({ erro: "Livro não encontrado." });
  res.json({ mensagem: "Livro removido.", livro });
});

// ── I. Distância entre dois pontos (Haversine) ────────────────────────────────
// GET /distancia?lat1=&lon1=&lat2=&lon2=
app.get("/distancia", autenticar, (req, res) => {
  const { lat1, lon1, lat2, lon2 } = req.query;
  if ([lat1, lon1, lat2, lon2].some((v) => v === undefined)) {
    return res.status(400).json({ erro: "Informe lat1, lon1, lat2, lon2." });
  }
  const R = 6371; // km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const distancia = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  res.json({ distanciaKm: distancia.toFixed(2) });
});

// ── A. Exportar dados em CSV ──────────────────────────────────────────────────
app.get("/exportar-csv", autenticar, async (_req, res) => {
  const [livros, usuarios] = await Promise.all([Livro.find(), Usuario.find().select('-senha -codigo2fa')]);
  let csv = "LIVROS\nTítulo;Autor;Ano;URL Imagem\n";
  livros.forEach(l => csv += `${l.titulo};${l.autor};${l.ano};${l.imagemUrl || ''}\n`);
  csv += "\nUSUÁRIOS\nEmail\n";
  usuarios.forEach(u => csv += `${u.email}\n`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=dados.csv');
  res.send(csv);
});

// ── B. Backup automático diário (17:00) ───────────────────────────────────────
async function gerarBackup() {
  const [livros, usuarios] = await Promise.all([Livro.find(), Usuario.find().select('-senha -codigo2fa')]);
  let csv = "BACKUP - " + new Date().toISOString() + "\n\nLIVROS\nTitulo;Autor;Ano;URL Imagem\n";
  livros.forEach(l => csv += `${l.titulo};${l.autor};${l.ano};${l.imagemUrl || ''}\n`);
  csv += "\nUSUARIOS\nEmail\n";
  usuarios.forEach(u => csv += `${u.email}\n`);
  const backup = await Backup.create({ conteudo: csv });
  return backup.criadoEm.toISOString();
}

cron.schedule('0 17 * * *', async () => {
  try {
    await gerarBackup();
    console.log('Backup automatico salvo no MongoDB');
  } catch (e) {
    console.error('Erro no backup:', e.message);
  }
});

app.post("/backup-manual", autenticar, async (_req, res) => {
  try {
    const timestamp = await gerarBackup();
    res.json({ mensagem: `Backup criado em ${timestamp}` });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── C. Relatório de monitoramento (PDF) ───────────────────────────────────────
app.get("/relatorio-monitoramento", autenticar, (_req, res) => {
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  
  const logsDoMes = logs.filter(l => {
    const data = new Date(l.horario);
    return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
  });
  
  const acessosPorHora = {};
  logsDoMes.forEach(l => {
    const hora = new Date(l.horario).getHours();
    acessosPorHora[hora] = (acessosPorHora[hora] || 0) + 1;
  });
  
  const horarioPico = Object.keys(acessosPorHora).reduce((a, b) => 
    acessosPorHora[a] > acessosPorHora[b] ? a : b, '0');
  
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=monitoramento.pdf');
  doc.pipe(res);
  
  doc.fontSize(18).text('Relatório de Monitoramento', { align: 'center' }).moveDown();
  doc.fontSize(12).text(`Mês: ${mesAtual + 1}/${anoAtual}`).moveDown();
  doc.text(`Horário de pico: ${horarioPico}:00 (${acessosPorHora[horarioPico] || 0} acessos)`).moveDown();
  doc.text('Acessos por rota:').moveDown();
  
  Object.entries(acessosPorRota).forEach(([rota, count]) => {
    doc.text(`${rota}: ${count} acessos`);
  });
  
  doc.end();
});

// ── D. YouTube Search ─────────────────────────────────────────────────────────
app.get("/yt-search", autenticar, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ erro: "Informe o parametro 'q'." });
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q)}&key=${process.env.YOUTUBE_API_KEY}`;
  const data = await fetch(url).then(r => r.json());
  if (data.error) return res.status(500).json({ erro: data.error.message });
  res.json(data.items.map(i => ({
    id:    i.id.videoId,
    titulo: i.snippet.title,
    canal:  i.snippet.channelTitle,
    thumb:  i.snippet.thumbnails.medium.url,
  })));
});

// ── E. Socket.io ──────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  // Envia dados atuais do sensor
  socket.emit('sensor-update', sensorData);
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// ── F. Dados do sensor em tempo real ──────────────────────────────────────────
app.get("/sensor", (_req, res) => {
  res.json(sensorData);
});
app.get("/logs", autenticar, (req, res) => {
  const { data } = req.query;
  if (!data) return res.status(400).json({ erro: "Informe o parâmetro 'data' (YYYY-MM-DD)." });
  res.json(logs.filter((l) => l.horario.startsWith(data)));
});

// ── PDF ───────────────────────────────────────────────────────────────────────
app.get("/livros/relatorio/pdf", autenticar, async (_req, res) => {
  const livros = await Livro.find();
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=livros.pdf");
  doc.pipe(res);
  doc.fontSize(18).text("Lista de Livros", { align: "center" }).moveDown();
  livros.forEach((l) => {
    doc.fontSize(12).text(`${l.titulo} — ${l.autor} (${l.ano})`);
  });
  doc.end();
});

// ── Iniciar ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  // Cria diretório de backups se não existir
  if (!fs.existsSync('./backups')) {
    fs.mkdirSync('./backups');
  }
  
  server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log('Socket.io ativo para dados em tempo real');
    console.log('Backup automático configurado para 17:00 diárias');
  });
}

module.exports = app;
