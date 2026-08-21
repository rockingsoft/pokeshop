import { transformAndValidate } from 'class-transformer-validator';

const validate = type => {
  return async function validate(ctx, next) {
    const body = ctx.request.body;
    try {
      const validType = await transformAndValidate(type, body);
      ctx.body = validType;
      return next(ctx);
    } catch (validationErrors) {
      ctx.status = 400;
      const response = mapErrorToResponse(validationErrors);

      ctx.body = response;
      return response;
    }
  };
};

const mapErrorToResponse = errors => {
  const validationErrors = errors.map(error => {
    const errorMessages = Object.values(error.constraints);
    return { property: error.property, constraints: errorMessages };
  });

  return {
    errors: validationErrors,
  };
};

export { validate };
