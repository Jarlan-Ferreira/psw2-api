require("dotenv").config();
const mongoose = require("mongoose");
const Usuario  = require("./models/Usuario");
const Livro    = require("./models/Livro");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Conectado ao Atlas");

  // Limpa coleções
  await Usuario.deleteMany();
  await Livro.deleteMany();

  // Cria usuário admin (senha será hasheada automaticamente pelo model)
  await Usuario.create({ email: "jarlan.emanuel70@aluno.ifce.edu.br", senha: "123456" });
  console.log("Usuário criado: admin@email.com / 123456");

  // Cria livros de exemplo
  await Livro.insertMany([
    { titulo: "Clean Code",               autor: "Robert C. Martin", ano: 2008 },
    { titulo: "The Pragmatic Programmer", autor: "Andrew Hunt",      ano: 1999 },
    { titulo: "Design Patterns",          autor: "Gang of Four",     ano: 1994 },
    { titulo: "Refactoring",              autor: "Martin Fowler",    ano: 1999 },
    { titulo: "You Don't Know JS",        autor: "Kyle Simpson",     ano: 2015 },
  ]);
  console.log("5 livros criados");

  await mongoose.disconnect();
  console.log("Pronto!");
}

seed().catch(console.error);
