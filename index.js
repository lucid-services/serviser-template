const Template = require('./lib/template.js');

module.exports          = cliInterface;
module.exports.Template = Template;

let template = module.exports.template = new Template();

function cliInterface(yargs, strict) {

    template.CLI = true;

    return yargs
    .usage('$0 <command> [options]')
    .command(['init'], 'Initializes a new serviser project', {
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
    .example('$0 init --no-npm', '# Generate project skeleton and skip installation of npm dependencies')
    .strict(typeof strict === 'boolean' ? strict : true);
}
