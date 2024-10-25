import Joi from 'joi';

export default Joi.object({
  rawRequest: Joi.object({
    query: Joi.string().min(1).required(),
    variables: Joi.object().pattern(/^\w+$/, Joi.string()),
    operationName: Joi.string().min(1).optional()
  }),

  response: Joi.object({
    data: Joi.any()
  }),

  session: Joi.object({
    role: Joi.string(),
    variables: Joi.object().pattern(/^\w+$/, Joi.string()),
  })
}).options({ presence: 'required' }).required();
