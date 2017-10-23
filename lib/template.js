const https        = require('https');
const Promise      = require('bluebird');
const path         = require('path');
const fs           = Promise.promisifyAll(require('fs'));
const Prompt       = require('inquirer');
const mustache     = require('mustache');
const _            = require('lodash');
const json5        = require('json5');
const childProcess = require('child_process');
const chalk        = require('chalk');

const questions  = require('./questions.js');
const plugins    = require('./plugins.json');
const licenses   = require('./licenses.json');

Prompt.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

module.exports = Template;
module.exports.Template = Template;

/**
 * @public
 * @param {Object} options
 * @param {String} options.cwd=process.cwd(
 *
 * @constructor
 */
function Template(options) {
    options = options || {};
    this.CLI = null;

    if (!options.cwd) {
        options.cwd = process.cwd();
    }

    this.options = options;

    this.defaults = {
        scripts: {
            start: "./node_modules/.bin/bi-service run",
        },
        private: true,
        main: 'index.js',
        files: [
            'CHANGELOG.md',
            'README.md',
            'LICENSE',
            'index.js',
            'lib',
            'bin'
        ],
        engines: {
            node: `>=${process.version.slice(1)}`
        },
        contributors: [],
        dependencies: {},
        devDependencies: {},
        peerDependencies: {}
    };
}

/**
 * @param {Object} argv
 * @return {Promise}
 */
Template.prototype.initCmd = Promise.method(function(argv) {
    let pkg, config, dependencies;

    return this._getAnswers().bind(this).then(function(answers) {
        fs.writeFileSync('/tmp/answers.json', JSON.stringify(answers));
        dependencies = Template._normalizeDependencies(answers._dependencies, answers);
        config = Template._normalizeConfig(answers._config);
        pkg = Template._extractNpmPackage(answers);

        if (pkg.license !== 'None') {
            return Template._getLicense(pkg.license);
        }
        return null;
    }).then(function(license) {
        return this.create(pkg, config, dependencies, license, argv.verbose);
    }).then(function() {
        if (!argv.npm) {
            return null;
        }

        return Template._npmInstall(
            dependencies.dependencies,
            ['--save'],
            this.options.cwd,
            argv.verbose
        );
    }).then(function() {
        if (!argv.npm) {
            return null;
        }

        return Template._npmInstall(dependencies.devDependencies,
            ['--save-dev'],
            this.options.cwd,
            argv.verbose
        );
    });
});


/**
 * @param {Object} package
 * @param {Object} config
 * @param {Object} dependencies
 * @param {Object} license
 * @param {String} license.body
 * @param {Integer} verbosity - logging level
 *
 * @return {Promise}
 */
Template.prototype.create = function(package, config, dependencies, license, verbosity) {
    let self = this;
    let appContext = _.reduce(config.apps, function(out, val, app) {
        if (!~['cli'].indexOf(app)) {
            out.apps.push(app);
        }
        return out;
    }, {apps: []});

    let directories = [
        '/lib',
        '/lib/validation',
        '/lib/routes',
        '/lib/routes/v1.0',
        '/config',
        '/config/development',
        '/test',
    ];

    let templates = [
        {
            path: '/package.json',
            data: this._render('package', package)
        },
        {
            path: '/config/development/config.json5',
            data: this._render('config', config, {json5: true})
        },
        {
            path: '/index.js',
            data: this._render('index', {
                package: Object.assign({}, package, {
                    dependencies: dependencies.dependencies,
                    devDependencies: dependencies.devDependencies
                }),
                config: config
            })
        },
        {
            path: '/LICENSE',
            data: this._render('LICENSE', {
                license: license || ''
            })
        },
        {
            path: '/CHANGELOG.md',
            data: this._render('CHANGELOG')
        },
        {
            path: '/README.md',
            data: this._render('README')
        },
        {
            path: '/lib/app.js',
            data: this._render('app', appContext)
        },
        {
            path: '/.gitignore',
            data: this._render('gitignore')
        },
        {
            path: '/.npmignore',
            data: this._render('npmignore')
        },
        {
            path: '/test/test.js',
            data: this._render('test')
        },
    ];

    if (   config.hasOwnProperty('sequelize')
        || _.has(config, 'storage.couchbase')
    ) {
        directories.push('/lib/database');
        directories.push('/lib/models');

        if (config.hasOwnProperty('sequelize')) {
            directories.push('/lib/models/orm');
            templates.push({
                path: '/lib/database/sequelize.js',
                data: this._render('sequelize')
            });
        }

        if (_.has(config, 'storage.couchbase')) {
            directories.push('/lib/models/odm');
            templates.push({
                path: '/lib/database/couchbase.js',
                data: this._render('couchbase')
            });
        }
    }

    appContext.apps.forEach(function(appName) {
        directories.push(`/lib/routes/v1.0/${appName}`);
        directories.push(`/lib/routes/v1.0/${appName}/example`);
        directories.push(`/lib/routes/v1.0/${appName}/example/routes`);

        templates.push({
            path: `/lib/routes/v1.0/${appName}/example/router.js`,
            data: this._render('router', {app: appName})
        });
        templates.push({
            path: `/lib/routes/v1.0/${appName}/example/routes/get.js`,
            data: this._render('route')
        });
    }, this);

    //create directories
    directories.forEach(function(dir) {
        return fs.mkdirSync(path.resolve(this.options.cwd + dir));
    }, this);

    return Promise.map(templates, function(template) {
        if (verbosity) {
            console.info(
                chalk.cyan('[INFO]') +
                ` Creating ${template.path.slice(1)}`
            );
        }
        let p = path.resolve(self.options.cwd + template.path);
        return fs.writeFileAsync(p, template.data);
    });
};

/**
 * @private
 * @return {Object}
 */
Template.prototype._getAnswers = Promise.method(function() {
    return Promise.reduce(questions, function(answers, questionGetter) {
        return Prompt.prompt(questionGetter(answers)).then(function(_answers) {
            return _.merge(answers, _answers);
        });
    }, this.defaults);
});

/**
 * @param {String} name
 * @param {Object} data - template context data
 * @param {Object} options
 * @param {Bolean} options.json5
 *
 * @return {String}
 */
Template.prototype._render = function(name, data, options) {
    options = options || {};

    const tmpl = fs.readFileSync(
        path.resolve(__dirname + `/templates/${name}.mustache`)
    );

    let context = _.reduce(data, function(out, value, key) {
        out['_' + key] = value;

        if (options.json5) {
            out[key] = new Function(`return \`${json5.stringify(value, null, 4)}\`;`);
        } else {
            out[key] = new Function(`return JSON.stringify(this['_${key}'], null, 4);`);
        }
        return out;
    }, {});

    return mustache.render(tmpl.toString(), context);
};

/**
 * @param {Array<String>} dependencies - optional user defined dependencies
 * @param {Object}        answers
 * @param {Object}        answers._config
 * @return {Object}
 */
Template._normalizeDependencies = function normalizeProjectDependencies(dependencies, answers) {
    dependencies = dependencies || [];
    let out = {
        dependencies: {
            'bi-service': '*',
            bluebird: '*',
            lodash: '*'
        },
        devDependencies: {}
    };

    switch (answers._config._sqlProvider) {
        case 'postgres':
            out.dependencies.pg = '^4.5.0';
            break;
        case 'mysql':
            out.dependencies.mysql = '*';
            break;
    }

    return dependencies.reduce(function(out, dep) {
        if (plugins.hasOwnProperty(dep)) {
            if (plugins[dep].dev) {
                out.devDependencies[dep] = '*';
            } else {
                out.dependencies[dep] = '*';
            }
        }

        return out;
    }, out);
}

/**
 * @param {Object} config
 * @return {Object}
 */
Template._normalizeConfig = function normalizeProjectConfig(config) {
    const out = {
        listen: config.listen,
        storage: config.storage || {},
        apps: {}
    };

    //normalize config.storage.mysql/postgres
    if (config._sqlProvider) {
        out.storage[config._sqlProvider] = {
            host: config._sqlHost,
            ssl: false,
            databases: {
                main: {
                    db: config._sqlDatabase,
                    username: config._sqlUsername,
                    password: config._sqlPassword,
                }
            }
        };

        //
        out.sequelize = {
            cache    : false,
            dialect  : config._sqlProvider,
            host     : {$ref: `#/storage/${config._sqlProvider}/host`},
            port     : {$ref: `#/storage/${config._sqlProvider}/port`},
            ssl      : {$ref: `#/storage/${config._sqlProvider}/ssl`},
            db       : {$ref: `#/storage/${config._sqlProvider}/databases/main/db`},
            username : {$ref: `#/storage/${config._sqlProvider}/databases/main/username`},
            password : {$ref: `#/storage/${config._sqlProvider}/databases/main/password`},
        };
    }

    //normalize config.apps
    (config._apps || []).filter(function(appName) {
        return !~appName.indexOf('-doc');
    }).forEach(function(appName) {
        out.apps[appName] = {
            baseUrl: {$join: [
                config._host + ':',
                {$ref: `#/listen/${appName}/port`}
            ]},
            stopOnError: false,
            bodyParser: {$ref: '#/bodyParser'},
            listen: {$ref: `#/listen/${appName}/port`},
            response: {$ref: '#/response'},
        };

        if (   config._apps instanceof Array
            && config._apps.indexOf(`${appName}-doc`) !== -1
        ) {
            out.apps[appName].doc = {
                baseUrl: {$join: [
                    config._host + ':',
                    {$ref: `#/listen/${appName}-doc/port`}
                ]},
                listen: {$ref: `#/listen/${appName}-doc/port`},
                name: `${appName}-doc`,
                title: 'Docs',
                stopOnError: true,
                tryItOut: false
            };
        }
    });

    return out;
}

/**
 * @param {Object} answers
 * @return {Object}
 */
Template._extractNpmPackage = function extractNpmPackage(answers) {
    return _.reduce(answers, function(out, value, key) {
        if (!key.match(/^_.+$/)) {
            out[key] = _.cloneDeep(value);
        }

        return out;
    }, {});
}

/**
 * @param {String} name
 * @return {String}
 */
Template._getLicense = function getLicense(name) {
    const license = _.find(licenses, ['name', name]);

    return new Promise(function(resolve, reject) {
        let req = https.get({
            host: 'api.github.com',
            path: `/licenses/${license.key}`,
            headers: {
                Accept: 'application/vnd.github.drax-preview+json',
                'User-Agent': 'NodeJS'
            },
            method: 'GET'
        }, function(res) {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                data += chunk.toString();
            });

            res.on('end', function() {
                if (res.statusCode !== 200 && res.statusCode !== 302) {
                    return reject(
                        new Error(`Response status code: ${res.statusCode}. ${data}`)
                    );
                }

                return resolve(JSON.parse(data));
            });
        });

        req.once('error', reject);
        req.end();
    });
}

/**
 * @param {Object} dependencies
 * @param {Array<String>} args - optional npm install arguments
 * @param {String} cwd
 * @param {Integer} verbosity
 * @return {Promise}
 */
Template._npmInstall = function npmInstall(dependencies, args, cwd, verbosity) {
    args = _.clone(args) || [];

    return new Promise(function(resolve, reject) {
        args = args.concat(
            _.reduce(dependencies, function(out, val, key) {
                out.push(val !== '*' ? `${key}@${val}`: key);
                return out;
            }, [])
        );

        args.unshift('install');

        let npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

        if (verbosity) {
            console.info(chalk.cyan('[INFO]') + ' Installing npm dependencies...');
            console.info(chalk.cyan(`[${npmCmd} ${args.join(' ')}]`));
        }

        let proc = childProcess.spawn(npmCmd, args, {cwd: cwd});

        let stderr = '';
        proc.stdout.on('data', function(data) {
            if (verbosity >= 2) {
                console.info(data.toString());
            }
        });
        proc.stderr.on('data', function(data) {
            stderr += data.toString();
            if (verbosity >= 2) {
                console.info(data.toString());
            }
        });
        proc.on('close', function(code) {
            if (code !== 0) {
                return reject(new Error(stderr));
            }

            return resolve();
        });
    });
}
