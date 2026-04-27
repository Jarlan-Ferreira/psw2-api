const request = require("supertest");
const mongoose = require("mongoose");
const app      = require("../index");
const Usuario  = require("../models/Usuario");
const Livro    = require("../models/Livro");

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Evita conexão real com MongoDB nos testes
jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return { ...actual, connect: jest.fn().mockResolvedValue(true) };
});

// Mock nodemailer
jest.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail: jest.fn().mockResolvedValue(true) }),
}));

// Mock cloudinary + multer-storage-cloudinary
jest.mock("cloudinary", () => ({
  v2: { config: jest.fn(), uploader: { upload: jest.fn() } },
}));
jest.mock("multer-storage-cloudinary", () => ({
  CloudinaryStorage: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("multer", () => {
  const multer = () => ({ single: () => (_req, _res, next) => next() });
  multer.diskStorage = jest.fn();
  return multer;
});

// Mock models
jest.mock("../models/Usuario");
jest.mock("../models/Livro");

// ── Helpers ───────────────────────────────────────────────────────────────────

const jwt = require("jsonwebtoken");
const SECRET = "psw2_secret_key";
const token = jwt.sign({ id: "abc123", email: "admin@email.com" }, SECRET);
const auth  = { Authorization: `Bearer ${token}` };

const livroMock = { _id: "lid1", titulo: "Clean Code", autor: "Martin", ano: 2008, imagemUrl: null };

// ── Testes ────────────────────────────────────────────────────────────────────

describe("POST /logar/solicitar-codigo", () => {
  it("retorna 404 se usuário não existe", async () => {
    Usuario.findOne.mockResolvedValue(null);
    const res = await request(app).post("/logar/solicitar-codigo").send({ email: "x@x.com" });
    expect(res.status).toBe(404);
  });

  it("envia código e retorna 200", async () => {
    const save = jest.fn();
    Usuario.findOne.mockResolvedValue({ email: "admin@email.com", codigo2fa: null, save });
    const res = await request(app).post("/logar/solicitar-codigo").send({ email: "admin@email.com" });
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalled();
  });
});

describe("POST /logar", () => {
  it("retorna 401 com credenciais inválidas", async () => {
    Usuario.findOne.mockResolvedValue(null);
    const res = await request(app).post("/logar").send({ email: "x@x.com", senha: "wrong", codigo: "123456" });
    expect(res.status).toBe(401);
  });

  it("retorna 400 sem código 2FA", async () => {
    Usuario.findOne.mockResolvedValue({ verificarSenha: jest.fn().mockResolvedValue(true) });
    const res = await request(app).post("/logar").send({ email: "admin@email.com", senha: "123456" });
    expect(res.status).toBe(400);
  });

  it("retorna token com credenciais e código válidos", async () => {
    const save = jest.fn();
    Usuario.findOne.mockResolvedValue({
      _id: "abc", email: "admin@email.com",
      verificarSenha: jest.fn().mockResolvedValue(true),
      codigo2fa: "111111",
      codigo2faExpira: new Date(Date.now() + 60000),
      save,
    });
    const res = await request(app).post("/logar").send({ email: "admin@email.com", senha: "123456", codigo: "111111" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
});

describe("GET /livros", () => {
  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/livros");
    expect(res.status).toBe(401);
  });

  it("lista livros com token válido", async () => {
    Livro.find.mockResolvedValue([livroMock]);
    const res = await request(app).get("/livros").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /livros/:id", () => {
  it("retorna 404 para id inexistente", async () => {
    Livro.findById.mockReturnValue({ catch: (fn) => fn(new Error()) });
    const res = await request(app).get("/livros/000").set(auth);
    expect(res.status).toBe(404);
  });

  it("retorna livro existente", async () => {
    Livro.findById.mockReturnValue({ catch: () => livroMock });
    const res = await request(app).get("/livros/lid1").set(auth);
    expect(res.status).toBe(200);
  });
});

describe("POST /livros", () => {
  it("retorna 400 sem campos obrigatórios", async () => {
    const res = await request(app).post("/livros").set(auth).send({ titulo: "X" });
    expect(res.status).toBe(400);
  });

  it("cria livro com dados válidos", async () => {
    Livro.create.mockResolvedValue(livroMock);
    const res = await request(app).post("/livros").set(auth)
      .send({ titulo: "Clean Code", autor: "Martin", ano: 2008 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("titulo");
  });
});

describe("PUT /livros/:id", () => {
  it("retorna 404 para id inexistente", async () => {
    Livro.findByIdAndUpdate.mockReturnValue({ catch: (fn) => fn(new Error()) });
    const res = await request(app).put("/livros/000").set(auth).send({ titulo: "Novo" });
    expect(res.status).toBe(404);
  });

  it("atualiza livro existente", async () => {
    Livro.findByIdAndUpdate.mockReturnValue({ catch: () => ({ ...livroMock, titulo: "Novo" }) });
    const res = await request(app).put("/livros/lid1").set(auth).send({ titulo: "Novo" });
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe("Novo");
  });
});

describe("DELETE /livros/:id", () => {
  it("retorna 404 para id inexistente", async () => {
    Livro.findByIdAndDelete.mockReturnValue({ catch: (fn) => fn(new Error()) });
    const res = await request(app).delete("/livros/000").set(auth);
    expect(res.status).toBe(404);
  });

  it("remove livro existente", async () => {
    Livro.findByIdAndDelete.mockReturnValue({ catch: () => livroMock });
    const res = await request(app).delete("/livros/lid1").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mensagem");
  });
});

describe("GET /distancia", () => {
  it("retorna 400 sem parâmetros", async () => {
    const res = await request(app).get("/distancia").set(auth);
    expect(res.status).toBe(400);
  });

  it("calcula distância entre São Paulo e Rio de Janeiro", async () => {
    const res = await request(app)
      .get("/distancia?lat1=-23.55&lon1=-46.63&lat2=-22.91&lon2=-43.17")
      .set(auth);
    expect(res.status).toBe(200);
    expect(Number(res.body.distanciaKm)).toBeGreaterThan(300);
  });
});

describe("GET /logs", () => {
  it("retorna 400 sem parâmetro data", async () => {
    const res = await request(app).get("/logs").set(auth);
    expect(res.status).toBe(400);
  });

  it("retorna array de logs para data válida", async () => {
    const res = await request(app).get("/logs?data=2099-01-01").set(auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

afterAll(async () => {
  if (mongoose.connection && mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});
