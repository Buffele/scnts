import Fastify from 'fastify';
import {AddressInfo} from 'net';
import Api from './routes/api';
import cors from '@fastify/cors';
import config from './config';

const fastify = Fastify({
	logger: true,
});

fastify.register(cors, {
	origin: '*',
	methods: [
		'POST',
	],
});

fastify.register(Api);

const start = async () => {
	try {
		await fastify.listen({
			host: config.ip as string,
			port: config.port as number,
		});

		const address = fastify.server.address() as AddressInfo;
		console.log('Server listening on ' + address?.address + ':' + address.port);
	} catch (err) {
		console.log(err);
		process.exit(1);
	}
}

start();