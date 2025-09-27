const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Travel Vista API',
      version: '1.0.0',
      description: 'Comprehensive travel management API with multi-role authentication',
      contact: {
        name: 'API Support',
        email: 'support@travelvista.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:9797',
        description: 'Development server'
      },
      {
        url: 'https://api.travelvista.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken'
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid'
        },
        ValidationError: {
          description: 'Request validation failed'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/models/*.js', './src/controllers/*.js'] // Path to your API files
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };