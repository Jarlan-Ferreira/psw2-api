const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const usuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  codigo2fa: { type: String, default: null },
  codigo2faExpira: { type: Date, default: null },
});

usuarioSchema.pre("save", async function () {
  if (this.isModified("senha")) {
    this.senha = await bcrypt.hash(this.senha, 10);
  }
});

usuarioSchema.methods.verificarSenha = function (senha) {
  return bcrypt.compare(senha, this.senha);
};

module.exports = mongoose.model("Usuario", usuarioSchema);
