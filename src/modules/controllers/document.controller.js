const documentService = require('../services/document.service');
const { downloadPdfStreamById } = require('../storage/pdf.storage');


const createBatchController = async (req, res) => {
  const { userIds } = req.body;
  try {
    const batch = await documentService.createBatch(userIds);
    if (!batch?.success || !batch?.data?._id) {
      return res.status(batch?.status || 500).send({
        success: false,
        message: batch?.message || 'Error creating batch',
        error: batch?.error || 'Unknown error'
      });
    }

    return res.status(batch.status || 200).send({ batchId: batch.data._id });
  } catch (error) {
    console.error('Error creating batch:', error);
    return res.status(error?.status || 500).send({
      success: false,
      message: 'Unhandled error creating batch',
      error: error.message
    });
  }
};

const getBatchStatus = async (req, res) => {
  try {
    const batch = await documentService.findBatchById(req.params.batchId);
    return res.status(batch?.status || 200).send(batch);
  } catch (error) {
    console.error('Error getting batch status:', error);
    return res.status(error?.status || 500).send({
      success: false,
      message: 'Unhandled error getting batch status',
      error: error.message
    });
  }
};

const getDocument = async (req, res) => {
  try {
    const doc = await documentService.findDocumentById(req.params.documentId);
    if (!doc?.success || !doc?.data) {
      return res.status(doc?.status || 404).send(doc);
    }
    if (!doc.data.fileId) {
      return res.status(409).send({
        success: false,
        message: 'Document is not generated yet',
        status: doc.data.status
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="document-${doc.data._id}.pdf"`);
    return downloadPdfStreamById(doc.data.fileId)
      .on('error', (error) => {
        res.status(404).send({
          success: false,
          message: 'PDF not found',
          error: error.message
        });
      })
      .pipe(res);
  } catch (error) {
    console.error('Error getting document:', error);
    return res.status(error?.status || 500).send({
      success: false,
      message: 'Unhandled error getting document',
      error: error.message
    });
  }
};



module.exports = {
  createBatchController,
  getBatchStatus,
  getDocument
};