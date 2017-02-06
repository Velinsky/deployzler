import express from 'express';
import config from 'config';
import util from 'util';
import path from 'path';
import logger from './logger';
import crypto from 'crypto';
import { exec, execSync } from 'child_process';

import { find, propEq, curry } from 'ramda';

import targets from './targets';

process.title = 'deployzler';

const app = express();

const cmd = curry(function(cwd, command) {
	logger.info(`Running command cwd: [${cwd}] [${command}]`);
	
	let ret = execSync('pwd; ' + command, {
		cwd : cwd
	});

	return new Date() + ': ' + command + '<br/><br/>' + ret.toString().replace(/(?:\r\n|\r|\n)/g, '<br />') + '<hr>';
});

const validate = function (secret, receivedSecret, body) {
	let digest = crypto.createHmac('sha1', secret).update(body).digest('hex');
	logger.info(`Validating github request, github secret [${receivedSecret}], calculated [${digest}]. Project secret is [${secret}].`);

	return digest === receivedSecret;
};

function rawBody(req, res, next) {
	req.setEncoding('utf8');
	req.rawBody = '';
	req.on('data', function(chunk) {
		req.rawBody += chunk;
	});
	req.on('end', function(){
		next();
	});
}

app.post('/:name', rawBody, function (req, res) {
	logger.info(`${req.method} ${req.url}`, {
		host : req.headers.host,
		from : req.headers['x-forwarded-for'] || req.connection.remoteAddress
	});

	let projectName = req.params.name;

	let project = find(propEq('name', projectName))(targets);
	let updateStrategy = project.updateStrategy;
	let startStrategy = project.startStrategy;
	let stopStrategy = project.stopStrategy;
	let cwdCmd = cmd(updateStrategy.directory);
	let out = '';

	console.log(req.headers);
	if (!validate(project.secret, req.headers['X-Hub-Signature'], req.rawBody)) {
		logger.error('Validation mismatch.');
		res.status(400);
		res.send('ERR');
		return;
	}

	if (stopStrategy.type === 'script-default') {
		try {
			out += cwdCmd('./stop.sh');
		}
		catch (e) {}
	}

	if (updateStrategy.type === 'pull-local') {
		out += cwdCmd('git fetch; git reset --hard origin/' + updateStrategy.branch);

		if (updateStrategy.runNpmInstall) {
			if (!Array.isArray(updateStrategy.runNpmInstall)) {
				out += cwdCmd('npm i');
			}
			else {
				updateStrategy.runNpmInstall.forEach(function (path) {
					out += cwdCmd(`cd ${path}; npm i`);
				})
			}
		}		
	}

	if (startStrategy.type === 'script-default') {
		try {
			out += cwdCmd(`tmux kill-session -t ${projectName}`);
		}
		catch(e) {}
		
		out += cwdCmd(`tmux new-session -d -s ${projectName}`);
		out += cwdCmd(`tmux send -t ${projectName} ./start.sh ENTER`);
	}

	res.send(out);
});

app.listen(config.get('server.port'), function () {
	logger.info(`Server running on port [${config.get('server.port')}]`);
});