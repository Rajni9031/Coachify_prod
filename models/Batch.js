const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true,unique:true },
  description: { type: String },
  object: [
    {
      type: mongoose.Schema.Types.ObjectId
    }
  ]
});

const Batch = mongoose.model('Batch', batchSchema);
module.exports = Batch;