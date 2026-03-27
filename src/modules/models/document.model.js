const mongoose = require('mongoose');

const docSchema = new mongoose.Schema({
  userId: String,
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'batchs' },
  status: { type: String, default: 'pending' },
  fileId: String,
  error: String
});

docSchema.set('timestamps', true);
const DocumentModel = mongoose.model('documents', docSchema);

module.exports = DocumentModel;