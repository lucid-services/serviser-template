const path         = require('path');
const _            = require('lodash');

const plugins  = require('./plugins.json');
const licences = require('./licences.json');

let questions = module.exports = {};

questions.general = function() {
    return [
        {
            name: 'name',
            message: 'The project name',
            default: path.basename(process.cwd())
        },
        {
            name: 'version',
            message: 'Version',
            default: '1.0.0'
        },
        {
            name: 'description',
            message: 'Description',
        },
        {
            name: 'author',
            message: 'Author',
        },
        {
            name: 'keywords',
            message: 'Keywords (comma separated)',
            filter: function(keywords) {
                return keywords.split(',');
            }
        },
        {
            type: 'autocomplete',
            name: 'licence',
            pageSize: 10,
            message: 'Licence',
            source: searchLicence
        },
        {
            type: 'checkbox',
            name: '_dependencies',
            message: 'Dependencies',
            pageSize: 17,
            default: [
                "bi-service-doc",
                "bi-service-cli",
                "bi-service-sdk",
                "mocha",
                "chai"
            ],
            choices: _.values(plugins)
        },
        {
            name: 'scripts.test',
            message: 'npm test cmd',
            default: function(argv) {
                if (argv._dependencies.indexOf('mocha')) {
                    return "mocha --ui bdd --colors --check-leaks -t 5000 --reporter spec 'test/**/*.js'";
                }
            }
        },
        {
            name: '_apps',
            message: 'Apps (Comma separated list of names of apps which will be created)',
            default: 'public',
            filter: function(apps) {
                return apps.split(',').map(function(app) {
                    return app.trim();
                });
            }
        }
    ];
};

questions.serviceConfig = function(argv, defaults) {
    defaults = defaults || {};
    let q = [
        {
            name: '_host',
            message: 'Service Host',
            default: 'http://127.0.0.1',
            filter: function(host) {
                //TODO make sure protocol is present
                return host
            }
        }
    ];

    argv._apps.forEach(function(app, index) {
        q.push({
            name: `listen.${app}.type`,
            message: `${app} app type`,
            type: 'list',
            when: getAppTypeQuestionController(argv, app, index, defaults),
            choices: ['private', 'public']
        });
        q.push({
            name: `listen.${app}.port`,
            message: `${app} app port`,
            default: getPort()
        });
    });

    if (~argv._dependencies.indexOf('bi-service-couchbase')) {
        q.push({
            name: 'storage.couchbase.host',
            message: 'Couchbase Host',
            default: 'couchbase://127.0.0.1',
            filter: function(host) {
                //TODO make sure host has couchbase:// protocol
                return host;
            }
        });

        q.push({
            name: 'storage.couchbase.buckets',
            message: 'Buckets (comma separated list)',
            default: 'default',
            filter: function(buckets) {
                return buckets.split(',').reduce(function(out, bucket) {
                    bucket = bucket.trim();
                    out[bucket] = {bucket: bucket};
                    return out;
                }, {});
            }
        });
    }

    if (~argv._dependencies.indexOf('bi-service-sequelize')) {
        q.push({
            name: '_sqlProvider',
            type: 'list',
            message: 'SQL Provider',
            default: 'postgres',
            choices: ['postgres', 'mysql']
        });

        //q.push({
            //name: '_sql',
            //message: 'Buckets (comma separated list of used buckets)',
            //default: 'default',
            //filter: function(buckets) {
                //return buckets.split(',').reduce(function(out, bucket) {
                    //bucket = bucket.trim();
                    //out[bucket] = {bucket: bucket};
                    //return out;
                //}, {});
            //}
        //});
    }

    return q;
};

/**
 * @private
 * @param {Object} argv
 * @param {String} app - app name the question controller is being created for
 * @param {Integer} appIndex
 * @param {Object} defaults
 */
function getAppTypeQuestionController(argv, app, appIndex, defaults) {
    return function(configArgv) {
        //don't ask for information we can derive from data we have
        //we already know app type for app names such as public | private | s2s
        if (_.has(defaults, ['listen', app], 'type')) {
            return false;
        }

        //if we got app name which is in format $APP-doc where
        //$APP is one of the previous apps the question was asked for,
        //we dont have to ask for the app type again.
        //We assume that we want an app and its corresponding documentation app
        //to always have same app "type"
        for (let i = 0, len = appIndex; i < len; i++) {
            let name = argv._apps[i] + '-doc';
            let prop = ['listen', argv._apps[i], 'type'];
            let newProp = ['listen', app, 'type'];

            if (   app === name
                && ( _.has(configArgv, prop) || _.has(defaults, prop) )
            ) {
                //data can be derived and thus be in the "defaults" obj
                //or the data could be previously answered
                //and thus be in configArgv obj
                let value = _.get(configArgv, prop, _.get(defaults, prop, ''));
                _.set(configArgv, newProp, value);
                return false;
            }
        }
        return true;
    };
}

function searchLicence(answers, input) {
    return new Promise(function(resolve) {
        resolve(_.map(licences.filter(filter(input)), 'name'));
    });
}

function filter(input) {
    return function(val) {
        if (!input) {
            return true;
        }
        return new RegExp(input, 'i').exec(val.name) !== null;
    };
}

function getPort() {
    let port = Math.floor(Math.random() * (4000 - 3000 + 1)) + 3000;

    if (!getPort._ports) {
        getPort._ports = [];
    }

    if (~getPort._ports.indexOf(port)) {
        return getPort();
    } else {
        return port;
    }
}
