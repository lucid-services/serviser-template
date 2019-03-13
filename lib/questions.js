const path = require('path');
const _    = require('lodash');
const url  = require('url');

const plugins  = require('./plugins.json');
const licenses = require('./licenses.json');


/**
 * collection of question getters (functions)
 * each function takes answers from previous set of questions and returns
 * a new question set (Array<Object>)
 */
let questions = module.exports = [];

questions.push(function() {
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
                return keywords.split(',').map(function(keyword) {
                    return keyword.trim();
                });
            }
        },
        {
            type: 'autocomplete',
            name: 'license',
            pageSize: 10,
            message: 'License',
            source: searchLicense
        },
        {
            type: 'checkbox',
            name: '_dependencies',
            message: 'Dependencies',
            pageSize: 17,
            default: _.reduce(plugins, function(out, options, name) {
                if (options.default) {
                    out.push(name);
                }
                return out;
            }, []),
            choices: Object.keys(plugins)
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
            name: '_config._apps',
            message: 'Apps (Comma separated list of names of apps which will be created)',
            default: 'public',
            filter: function(apps, argv) {
                apps = apps.split(',').reduce(function(out, app) {
                    app =  app.trim();

                    out.push(app);

                    if (~argv._dependencies.indexOf('serviser-doc')) {
                        out.push(app + '-doc');
                    }

                    return out;
                }, []);

                if (~argv._dependencies.indexOf('serviser-cli')) {
                    apps.push('cli');
                }

                deriveAppTypes(argv, apps);

                return apps;
            }
        }
    ];
});

questions.push(function(argv) {
    let q = [
        {
            name: '_config._host',
            message: 'Service Host',
            default: 'http://127.0.0.1',
            filter: function(host) {
                let data = url.parse(host);
                if (!data.protocol) {
                    return 'http://' + host;
                }
                return host;
            }
        }
    ];

    argv._config._apps.forEach(function(app, index) {
        q.push({
            name: `_config.listen.${app}.port`,
            message: `${app} app port`,
            default: getPort()
        });
    });

    if (~argv._dependencies.indexOf('serviser-couchbase')) {
        q.push({
            name: '_config.storage.couchbase.host',
            message: 'Couchbase Host',
            default: 'couchbase://127.0.0.1',
            filter: function(host) {
                let data = url.parse(host);
                if (!data.protocol) {
                    return 'couchbase://' + host;
                } else {
                    return 'couchbase://' + data.host;
                }
            }
        });

        q.push({
            name: '_config.storage.couchbase.buckets',
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

    if (~argv._dependencies.indexOf('serviser-sequelize')) {
        q.push({
            name: '_config._sqlProvider',
            type: 'list',
            message: 'SQL Provider',
            default: 'postgres',
            choices: ['postgres', 'mysql']
        });

        q.push({
            name: '_config._sqlHost',
            message: function(argv) {
                return _.upperFirst(argv._config._sqlProvider) + ' Host';
            },
            default: '127.0.0.1'
        });

        q.push({
            name: '_config._sqlDatabase',
            message: function(argv) {
                return _.upperFirst(argv._config._sqlProvider) +
                    ' Database';
            },
            default: argv.name,
            filter: function(database) {
                return database.trim();
            }
        });

        q.push({
            name: '_config._sqlUsername',
            message: function(argv) {
                return _.upperFirst(argv._config._sqlProvider) +
                    ' Database username';
            }
        });

        q.push({
            name: '_config._sqlPassword',
            message: function(argv) {
                return _.upperFirst(argv._config._sqlProvider) +
                    ' Database password';
            }
        });
    }

    return q;
});

function searchLicense(answers, input) {
    return new Promise(function(resolve) {
        resolve(_.map(licenses.filter(filter(input)), 'name'));
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
        return port + '';
    }
}

/**
 * @param {Object} argv
 * @param {Array<String>} apps
 * @return {undefined}
 */
function deriveAppTypes(argv, apps) {
    apps.forEach(function(app) {
        let type;

        if (~['s2s', 'private', 'cli'].indexOf(app)) {
            type = 'private'
        } else if (~['public'].indexOf(app)) {
            type = 'public';
        }

        if (type) {
            _.set(argv, ['_config', 'listen', app, 'type'], type);
        }
    });
}
