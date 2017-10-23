const Template = require('./lib/template.js');

module.exports          = cliInterface;
module.exports.Template = Template;

let template = module.exports.template = new Template();

function cliInterface(yargs, strict) {

    template.CLI = true;

    return yargs
    .usage('$0 <command> [options]')
    .command(['init'], 'Initializes a new bi-service project', {
        npm: {
            describe: 'Whether to run npm install after a project is generated',
            type: 'boolean',
            default: true
        }
    }, template.initCmd.bind(template))
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
