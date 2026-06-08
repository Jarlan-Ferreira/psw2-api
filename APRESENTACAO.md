# Atividade N2 — PSW2

**Professor:** Harley Macêdo de Mello  
**Aluno:** Jarlan Emanuel  
**Entrega:** 09/06/2026

---

## A — Exportar CSV

Botão **"Exportar CSV"** que baixa todos os livros e usuários do banco em formato `.csv`.

**Rota:** `GET /exportar-csv`

**Backend:**
```js
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
```

**Frontend:**
```js
function exportarCSV() {
  downloadComToken('/exportar-csv', 'dados.csv', 'text/csv');
}
```

---

## B — Backup Automático às 17:00

Função agendada com `node-cron` que roda todos os dias às **17:00** e salva um snapshot CSV na collection `backups` do **MongoDB Atlas**.

**Rota manual:** `POST /backup-manual`

**Model (models/Backup.js):**
```js
const backupSchema = new mongoose.Schema({
  conteudo: { type: String, required: true },
  criadoEm: { type: Date, default: Date.now },
});
```

**Backend:**
```js
async function gerarBackup() {
  const [livros, usuarios] = await Promise.all([Livro.find(), Usuario.find().select('-senha -codigo2fa')]);
  let csv = "BACKUP - " + new Date().toISOString() + "\n\nLIVROS\nTitulo;Autor;Ano;URL Imagem\n";
  livros.forEach(l => csv += `${l.titulo};${l.autor};${l.ano};${l.imagemUrl || ''}\n`);
  csv += "\nUSUARIOS\nEmail\n";
  usuarios.forEach(u => csv += `${u.email}\n`);
  const backup = await Backup.create({ conteudo: csv });
  return backup.criadoEm.toISOString();
}

// Agendamento diário às 17:00
cron.schedule('0 17 * * *', async () => {
  await gerarBackup();
});

// Rota manual
app.post("/backup-manual", autenticar, async (_req, res) => {
  const timestamp = await gerarBackup();
  res.json({ mensagem: `Backup criado em ${timestamp}` });
});
```

---

## C — Relatório de Monitoramento (PDF)

Botão **"Relatório de Monitoramento"** que gera um PDF com acessos por rota e horário de pico.

**Rota:** `GET /relatorio-monitoramento`

**Middleware de log (registra cada requisição):**
```js
app.use((req, _res, next) => {
  const rota = `${req.method} ${req.path}`;
  logs.push({ horario: new Date().toISOString(), rota });
  acessosPorRota[rota] = (acessosPorRota[rota] || 0) + 1;
  next();
});
```

**Backend:**
```js
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
```

---

## D — Stream de Vídeo (YouTube)

Aba **"Stream"** com busca integrada à **YouTube Data API v3**. Digita um termo, lista resultados com thumbnail e clica para reproduzir o embed direto na página.

**Rota:** `GET /yt-search?q=<termo>`

**Backend:**
```js
app.get("/yt-search", autenticar, async (req, res) => {
  const { q } = req.query;
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
```

**Frontend:**
```js
async function buscarVideos() {
  const q = document.getElementById('yt-busca').value.trim();
  const res  = await api('GET', `/yt-search?q=${encodeURIComponent(q)}`);
  const data = await res.json();

  document.getElementById('yt-resultados').innerHTML = data.map(v => `
    <div class="yt-item" onclick="reproduzir('${v.id}')">
      <img src="${v.thumb}" />
      <div><p>${v.titulo}</p><span>${v.canal}</span></div>
    </div>
  `).join('');
}

function reproduzir(videoId) {
  document.getElementById('yt-player').innerHTML = `
    <iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}?autoplay=1"
      frameborder="0" allowfullscreen allow="autoplay; encrypted-media"
      style="border-radius:10px;"></iframe>
  `;
}
```

---

## E — Socket.io

Conexão WebSocket que emite `sensor-update` a cada 2 segundos. No Vercel (serverless), usa polling automático como fallback.

**Backend:**
```js
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  socket.emit('sensor-update', sensorData); // envia dado atual ao conectar
  socket.on('disconnect', () => {});
});
```

**Frontend (com fallback para Vercel):**
```js
const socket = typeof io !== 'undefined' ? io() : null;

if (socket) {
  socket.on('sensor-update', (data) => {
    document.getElementById('temp').textContent = data.temperatura;
    document.getElementById('umidade').textContent = data.umidade;
    document.getElementById('ts').textContent = new Date(data.timestamp).toLocaleTimeString();
  });
} else {
  // Polling para ambientes serverless (Vercel)
  async function pollSensor() {
    const res = await fetch('/sensor');
    const data = await res.json();
    document.getElementById('temp').textContent = data.temperatura;
    document.getElementById('umidade').textContent = data.umidade;
    document.getElementById('ts').textContent = new Date(data.timestamp).toLocaleTimeString();
  }
  pollSensor();
  setInterval(pollSensor, 2000);
}
```

---

## F — Sensor Virtual em Tempo Real

Sensor virtual que simula leituras de temperatura (20°C–35°C) e umidade (40%–80%), atualizado a cada 2 segundos via Socket.io.

**Rota:** `GET /sensor`

**Backend:**
```js
let sensorData = { temperatura: 25, umidade: 60, timestamp: new Date() };

setInterval(() => {
  sensorData = {
    temperatura: (20 + Math.random() * 15).toFixed(1),
    umidade:     (40 + Math.random() * 40).toFixed(0),
    timestamp:   new Date()
  };
  io.emit('sensor-update', sensorData);
}, 2000);

app.get("/sensor", (_req, res) => {
  res.json(sensorData);
});
```
