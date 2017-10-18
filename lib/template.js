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
}


/**
 * @param {Object} argv
 * @return {Promise}
 */
Template.prototype.initCmd = Promise.method(function(argv) {
    let p = Promise.resolve(argv).bind(this)
    ,   project = {}
    ,   config  = {};

    if (argv.interactive) {
        p = p.then(function() {
            return Prompt.prompt(questions.general());
        }).then(function(_project) {

            if (~_project._dependencies.indexOf('bi-service-doc')) {
                _project._apps.forEach(function(app, index, arr) {
                    arr.push(app + '-doc');
                });
            }

            if (~_project._dependencies.indexOf('bi-service-cli')) {
                _project._apps.push('cli');
            }

            _.merge(project, _.cloneDeep(_project));

            _project._apps.forEach(function(app) {
                let type;

                if (~['s2s', 'private', 'cli'].indexOf(app)) {
                    type = 'private;'
                } else if (~['public'].indexOf(app)) {
                    type = 'public';
                }
                if (type) {
                    _.set(config, ['listen', app, 'type'], type);
                }
            });

            return Prompt.prompt(questions.serviceConfig(_project, config));
        }).then(function(_config) {
            _.merge(config, _.cloneDeep(_config));

            console.log(project);
        });
    }
});
