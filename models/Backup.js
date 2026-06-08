const mongoose = require("mongoose");

const backupSchema = new mongoose.Schema({
  conteudo: { type: String, required: true },
  criadoEm: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Backup", backupSchema);
