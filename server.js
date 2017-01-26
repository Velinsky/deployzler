import express from 'express';
import config from 'config';
import util from 'util';
import path from 'path';
import logger from './logger';
import { exec, execSync } from 'child_process';

import { find, propEq, curry } from 'ramda';

import targets from './targets';

const app = express();

const cmd = curry(function(cwd, command) {
	logger.info(`Running command cwd: [${cwd}] [${command}]`);
	
	let ret = execSync('pwd; ' + command, {
		cwd : cwd
	});

	return new Date() + ': ' + command + '<br/><br/>' + ret.toString().replace(/(?:\r\n|\r|\n)/g, '<br />') + '<hr>';
});

app.post('/:name', function (req, res) {
	let projectName = req.params.name;

	let project = find(propEq('name', projectName))(targets);
	let updateStrategy = project.updateStrategy;
	let startStrategy = project.startStrategy;
	let stopStrategy = project.stopStrategy;
	let cwdCmd = cmd(updateStrategy.directory);
	let out = '';

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