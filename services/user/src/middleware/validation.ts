import Joi from 'joi';

// User tag format: 8 alphanumeric + # + max 3 alphanumeric
const userTagPattern = /^[A-Za-z0-9]{8}#[A-Za-z0-9]{1,3}$/;

export const updateTagSchema = Joi.object({
  newTag: Joi.string().pattern(userTagPattern).required(),
});

export const updatePublicKeySchema = Joi.object({
  publicKey: Joi.string().required(),
});

export const sendContactRequestSchema = Joi.object({
  userTag: Joi.string().pattern(userTagPattern).required(),
});

export const respondContactRequestSchema = Joi.object({
  action: Joi.string().valid('accept', 'reject').required(),
  nickname: Joi.string().max(100).optional(),
});

export const createProfileSchema = Joi.object({
  publicKey: Joi.string().optional(),
});
