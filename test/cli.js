'use strict';
const _            = require('lodash');
const http         = require('http');
const Promise      = require('bluebird');
const os           = require('os');
const fs           = Promise.promisifyAll(require('fs'));
const chai         = require('chai');
const tmp          = require('tmp');
const path         = require('path');
const yargs        = require('yargs');
const json5        = require('json5');
const childProcess = require('child_process');

// adds .json5 loader require.extension
require('json5/lib/require');

Object.defineProperty(global, 'Promise', {
    configurable: false,
    writable: false,
    value: Promise
});

const cliInterface = require('../index.js');

chai.should();

describe('yargs cli interface', function() {
    it('should return argv builder object', function() {
        let argvBuilder = cliInterface(yargs, false);
        argvBuilder.should.be.an('object');
        argvBuilder.should.have.property('argv');
        argvBuilder.should.have.property('coerce').that.is.a('function');
        argvBuilder.should.have.property('command').that.is.a('function');
    });
});

describe('bin/bi-service-template', function() {
    before('Generating bi-service skeleton', function(done) {
        this.slow(30000);

        let self = this;
        tmp.setGracefulCleanup();
        this.tmpDir = tmp.dirSync({unsafeCleanup: true});

        this.questions = [
            `? The project name (${path.basename(this.tmpDir.name)})`,
            '? Version (1.0.0)',
            '? Description',
            '? Author',
            '? Keywords (comma separated)',
            '? License (Use arrow keys or type to search)',
            '? Dependencies',
            '? npm test cmd',
            '? Apps',
            '? Service Host (http://127.0.0.1)',
            '? public app port',
            '? public-doc app port',
            '? cli app port',
        ];

        let proc = childProcess.spawn('node', [
            path.resolve(__dirname + '/../bin/bi-service-template.js'),
            'init'
        ], {cwd: this.tmpDir.name});

        proc.stdout.on('data', function(chunk) {
            //when quetion prompt is activated, accept default value
            let questionCandidate = chunk.toString();
            process.stdout.write('      ' + questionCandidate);
            for (let i = 0, len = self.questions.length; i < len; i++) {
                if (   (self.questions[i] instanceof RegExp
                    && questionCandidate.match(self.questions[i]))
                    || (questionCandidate.indexOf(self.questions[i]) !== -1)
                ) {
                    self.questions.splice(i, 1);
                    proc.stdin.write(os.EOL);
                    return;
                }
            }
        });

        proc.on('error', function(e) {
            done(e);
        });

        proc.stderr.on('data', function(chunk) {
            console.error(chunk.toString())
        });

        proc.on('close', function(code) {
            if (code !== 0) {
                return done(new Error(`Exited with status code: ${code}`));
            }
            done();
        });
    });

    it('should generate runnable bi-service project skeleton with default option values', function(done) {
        let config = require(path.resolve(this.tmpDir.name + '/config/development/config.json5'));
        let cliPort = config.listen.cli.port;
        let proc = childProcess.spawn('npm', ['start'], {cwd: this.tmpDir.name});

        proc.on('error', function(e) {
            done(e);
        });

        proc.stdout.on('data', function(chunk) {
            if (chunk.toString().indexOf('cli app listening on port') !== -1) {
                checkServiceIntegrity(cliPort, function(err) {
                    proc.removeAllListeners('close');
                    proc.kill();
                    done(err);
                });
            }
        });

        proc.stderr.on('data', function(chunk) {
            console.error(chunk.toString());
        });

        proc.on('close', function(code) {
            return done(new Error(`Service process exited unexpectedly with status code: ${code}`));
        });

    });
});

function checkServiceIntegrity(port, done) {
    let req = http.get({
        host: '127.0.0.1',
        port: port,
        path: '/api/v1.0/integrity',
        method: 'GET'
    }, function(res) {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            data += chunk.toString();
        });

        res.on('end', function() {
            if (res.statusCode !== 200 && res.statusCode !== 302) {
                return done(
                    new Error(`Response status code: ${res.statusCode}. ${data}`)
                );
            }

            return done(null, JSON.parse(data));
        });
    });

    req.once('error', done);
    req.end();
}
