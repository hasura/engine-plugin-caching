import Joi from 'joi';

// The type of a pre-parse plugin request. 
export default Joi.object({
  rawRequest: Joi.object({
    query: Joi.string().min(1).required(),
    variables: Joi.object().pattern(/^\w+$/, Joi.string()).allow(null),
    operationName: Joi.string().min(1).optional().allow(null)
  }),

  session: Joi.object({
    role: Joi.string(),
    variables: Joi.object().pattern(/^\w+$/, Joi.string()),
  }).allow(null),
}).options({ presence: 'required' }).required();
