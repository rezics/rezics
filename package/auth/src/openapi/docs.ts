type OpenApiSchema = any;

export const jsonRequestBody = (schema: OpenApiSchema) => ({
  content: {
    'application/json': {
      schema,
    },
  },
});

export const jsonResponse = (
  description: string,
  schema: OpenApiSchema,
) => ({
  description,
  content: {
    'application/json': {
      schema,
    },
  },
});

export const parameter = ({
  name,
  in: location,
  required,
  schema,
}: {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  schema: OpenApiSchema;
}) => ({
  name,
  in: location,
  required,
  schema,
});
