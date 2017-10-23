'use strict';
const _              = require('lodash');
const Promise        = require('bluebird');
const fs             = Promise.promisifyAll(require('fs'));
const sinon          = require('sinon');
const chai           = require('chai');
const sinonChai      = require("sinon-chai");
const chaiAsPromised = require('chai-as-promised');
const tmp            = require('tmp');
const path           = require('path');

Object.defineProperty(global, 'Promise', {
    configurable: false,
    writable: false,
    value: Promise
});

const Template = require('../lib/template.js');
const userInput = require('./userInput.json');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised', Promise);

const expect = chai.expect;

chai.use(sinonChai);
chai.should();
chai.use(chaiAsPromised);

describe('Template', function() {
    beforeEach(function() {
        tmp.setGracefulCleanup();
        this.tmpDir = tmp.dirSync({unsafeCleanup: true});

        this.template = new Template({cwd: this.tmpDir.name});

        this.getAnswersStub = sinon.stub(Template.prototype, '_getAnswers');
        this.npmInstallStub = sinon.stub(Template, '_npmInstall');
    });

    afterEach(function() {
        this.getAnswersStub.restore();
        this.npmInstallStub.restore();
    });

    it('should generate bi-service project files', function() {
        let self = this;
        this.getAnswersStub.resolves(_.cloneDeep(userInput));
        this.npmInstallStub.resolves();

        let files = [
            '/package.json',
            '/config/development/config.json5',
            '/index.js',
            '/LICENSE',
            '/CHANGELOG.md',
            '/README.md',
            '/lib/app.js',
            '/.gitignore',
            '/.npmignore',
            '/test/test.js'
        ];

        return this.template.initCmd({verbose: 0}).bind(this).then(function() {
            return Promise.map(files, function(p) {
                return fs.statAsync(path.resolve(self.template.options.cwd + p))
                    .then(function(stat) {
                        stat.isFile().should.be.equal(true, `${p} should be a file`);
                    });
            });
        });
    });

    it('should populate the project`s LICENSE file', function() {
        let self = this;
        let _userInput = _.cloneDeep(userInput);
        _userInput.license = "MIT License";
        this.getAnswersStub.resolves(_userInput);
        this.npmInstallStub.resolves();

        return this.template.initCmd({verbose: 0}).bind(this).then(function() {
            return fs.readFileAsync(path.resolve(self.template.options.cwd + '/LICENSE'))
                .then(function(data) {
                    let mitLicense = fs.readFileSync(
                        path.resolve(__dirname + '/mitLicense.txt')
                    );

                    data.toString().should.be.equal(mitLicense.toString());
                });
        });
    });
});
