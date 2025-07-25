// Simple test to verify server structure
import Fastify from 'fastify';

const main = async () => {
    const fastify = Fastify({ logger: true });
    
    // Simple route for testing
    fastify.get('/health', async (request, reply) => {
        return { status: 'ok', message: 'Server is running' };
    });

    try {
        await fastify.listen({ port: 3001, host: 'localhost' });
        console.log('Server is listening on http://localhost:3001');
        console.log('Test the server with: curl http://localhost:3001/health');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

main();