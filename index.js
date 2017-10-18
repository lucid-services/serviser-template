const Template = require('./lib/template.js');
const plugins  = require('./lib/plugins.json');

module.exports           = cliInterface;
module.exports.Template = Template;

let template = module.exports.template = new Template();

function cliInterface(yargs, strict) {

    template.CLI = true;

    return yargs
    .usage('$0 <command> [options]')
    .command(['init'], 'Initializes a new bi-service project', {
        plugin: {
            alias: 'p',
            describe: 'List of plugins which will be installed',
            enum: Object.keys(plugins),
            default: [],
            array: true,
            type: 'string'
        },
        app: {
            alias: 'a',
            describe: 'List of app names which will be created',
            default: [],
            array: true,
            type: 'string'
        },
    }, template.initCmd.bind(template))
    .option('interactive', {
        alias: 'i',
        describe: 'if not enabled, it will NOT prompt the user for anything.',
        default: true,
        global: true,
        type: 'boolean'
    })
    .option('verbose', {
        alias: 'v',
        describe: 'Dumps more info to stdout',
        default: 1,
        count: true,
        global: true,
        type: 'boolean'
    })
    .strict(typeof strict === 'boolean' ? strict : true);
}
