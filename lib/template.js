const Promise      = require('bluebird');
const path         = require('path');
const fs           = require('fs');
const Prompt       = require('inquirer');
const _            = require('lodash');
const childProcess = require('child_process');

const questions  = require('./questions.js');

Prompt.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

module.exports = Template;
module.exports.Template = Template;

/**
 * @public
 * @constructor
 */
function Template() {
    this.CLI = null;

    this.defaults = {
        scripts: {
            start: "./node_modules/.bin/bi-service run",
            private: true,
            main: 'index.js',
            files: [
                'CHANGELOG.md',
                'README.md',
                'LICENCE',
                'index.js',
                'lib',
                'bin'
            ],
            engines: {
                node: `>=${process.version}`
            },
            contributors: [],
        }
    };
}


/**
 * @param {Object} argv
 * @return {Promise}
 */
Template.prototype.initCmd = Promise.method(function(argv) {

    return Promise.reduce(questions, function(answers, questionGetter) {
        return Prompt.prompt(questionGetter(answers)).then(function(_answers) {
            return _.merge(answers, _answers);
        });
    }, this.defaults).then(function(answers) {
        console.log(answers);
    });
});
