const Joi = require('joi');

const createBatchSchema = Joi.object({
  userIds: Joi.array()
    .items(
      Joi.string()
        .trim()
        .min(1)
        .max(64)
        .pattern(/^[a-zA-Z0-9_-]+$/)
    )
    .min(1)
    .max(1000)
    .required()
});

const objectIdSchema = Joi.string().hex().length(24).required();

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.details.map((detail) => detail.message)
    });
  }
  req.body = value;
  return next();
};

const validateParamObjectId = (paramName) => (req, res, next) => {
  const { error } = objectIdSchema.validate(req.params[paramName]);
  if (error) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${paramName}`
    });
  }
  return next();
};

module.exports = {
  createBatchSchema,
  validateBody,
  validateParamObjectId
};
