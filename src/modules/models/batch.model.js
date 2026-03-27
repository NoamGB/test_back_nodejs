const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  status: { type: String, default: 'pending' },
  userIds: [String],
  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'documents' }],
  startedAt: Date,
  completedAt: Date
});

batchSchema.set('timestamps', true);
const BatchModel = mongoose.model('batchs', batchSchema);

module.exports = BatchModel;