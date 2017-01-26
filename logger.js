import winston from 'winston';
import path from 'path';
import util from 'util';
import moment from 'moment';
import fs from 'fs';
import { Mail } from 'winston-mail';
import config from 'config';
import pad from 'pad';

const colors = require('colors/safe');

if (!fs.existsSync('logs')) {
	fs.mkdirSync('logs');
}

let logger = new winston.Logger({
	transports: [
		new winston.transports.File({
			level: 'info',
			filename: path.join(__dirname, 'logs' , 'event-log.json'),
			handleExceptions: true,
			json: true,
			maxsize: 5242880, //5MB
			maxFiles: 5,
			colorize: false
		}),
		new winston.transports.Console({
			level: 'silly',
			handleExceptions: true,
			json: false,
			colorize: false,
			timestamp: function() {
				return Date.now();
			},
			formatter: function(options) {
				let base = '[' + moment(this.timestamp()).format('HH:mm:ss.SS') + '] ';

				let message = winston.config.colorize(options.level, options.level.toUpperCase()) + ': ' + options.message + (Object.keys(options.meta).length > 0 ? (' ' + util.inspect(options.meta)) : '');

				// when log is uncaught exception, have a better logging
				if (options.meta && options.meta.trace && options.meta.stack) {
					let title = 'Uncaught exception:';

					if (options.message === 'ROUTE') {
						title = 'Uncaught route exception:'
					}
					message = colors.bgWhite.black(` ${title} `) + colors.white.bgRed.bold(' ' + options.meta.stack[0] + ' ');
					message += '\n\n';
					
					message += options.meta.trace.map((traceLine, index) => {
						let line;

						line = colors.blue(`[${pad(1, index)}] `);

						if (fs.existsSync(traceLine.file) && !traceLine.file.includes('node_modules')) {
							 line += colors.italic.gray(path.dirname(traceLine.file) + path.sep) + colors.white.bold(path.basename(traceLine.file));
							 line += colors.white(':' + traceLine.line) + '\n';
						}
						else {
							line += colors.gray(traceLine.file) + '\n';
						}

						return line;
					}).join('');
				}

				return base + message
			}
		})
	],
	exitOnError: false
});

export default logger;
