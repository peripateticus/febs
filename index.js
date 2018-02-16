/* eslint-disable global-require, import/no-dynamic-require */

const wp = require('webpack');
const logger = require('./lib/logger');
const merge = require('webpack-merge');
const path = require('path');
const { spawn } = require('child_process');
const devServer = require('./lib/dev-server');
const webpackConfigBase = require('./webpack-config/webpack.base.conf');
const R = require('ramda');

const projectPath = process.cwd();

let utils;

/**
 * FEBS entry point. The module is initialized with the
 * conf entries from bin/febs.
 *
 * Passed in at run or test time
 * @param conf.env The environment (dev or prod)
 *
 * Passed in at run-time
 * @param conf.command The command received from commander.
 *
 * passed in at test-time
 * @param conf.fs The file system (passed in from unit tests.)

 */
module.exports = function init(conf = {}) {
  const command = conf.command;

  // Allow for in-memory fs for testing.
  const fs = conf.fs || require('fs');

  if (conf.logLevel) logger.setLogLevel(conf.logLevel);

  // Get local overrides WP conf.
  const getOverridesConf = (confOverride) => {
    if (confOverride) return confOverride;

    const overridesConfFile = path.resolve(projectPath, './webpack.overrides.conf.js');

    if (fs.existsSync(overridesConfFile)) {
      logger.info('using overridesConfFile: ', overridesConfFile);
      return require(overridesConfFile);
    }

    return {};
  };

  const getWebpackConfig = (confOverride) => {
    const configsToMerge = [webpackConfigBase];

    // Overrides config.
    configsToMerge.push(getOverridesConf(confOverride));

    // Always replace:
    //  - entry
    const wpConf = merge.smartStrategy({
      entry: 'replace',
    })(configsToMerge);

    // Force output path to always be the same
    wpConf.output.path = webpackConfigBase.output.path;
    logger.verbose(wpConf);
    return wpConf;
  };

 /**
 * Create's compiler instance with appropriate environmental
 * webpack.conf merged with the webpack.overrides.
 *
 * @param {Object} wpConf The final webpack conf object.
 * @return {Object} The webpack compiler.
 */
  const createWebpackCompiler = wpConf => wp(wpConf);

  // Configure utility functions with the final webpack conf.
  const configureUtils = (wpConf) => {
    utils = require('./lib/util')({
      env: conf.env,
      wpConf,
      fs,
    });
    return wpConf;
  };

  const createCompiler = R.compose(
    createWebpackCompiler,
    configureUtils,
    getWebpackConfig,
  );

  /**
 * The Webpack run callback.
 * @param {*} err
 * @param {*} stats
 */
  const webpackCompileDone = (err, stats) => {
    const errors = utils.getWebpackErrors(err, stats);

    // Log errors to console
    if (!process.env.FEBS_TEST) {
      utils.logErrors(errors);
    }

    // Log results to the console.
    if (!process.env.FEBS_TEST) {
      logger.info(stats.toString({
        chunks: false,
        colors: true,
      }));
    }
  };

  /**
   * Simple directory clean. Assumes 1 level of files only.
   * @param dir The directory to clean.
   */
  const cleanDir = (dir = getWebpackConfig().output.path) => {
    if (dir && fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(file => fs.unlinkSync(path.join(dir, file)));
    }
  };

  /**
   * Runs the webpack compile either via 'run' or 'watch'.
   * @returns {*} The webpack compiler instance.
   */
  const runCompile = () => {
    const compilerFn = command.watch ? 'watch' : 'run';
    const compiler = createCompiler();
    if (compilerFn === 'run') {
      compiler[compilerFn](webpackCompileDone);
    } else {
      compiler[compilerFn]({/* watch options */}, webpackCompileDone);
    }
    return compiler;
  };

  /**
   * Compile function.
   *
   * - Cleans the /dist directory
   * - Creates compiler with config object
   * - Runs via webpack run/watch methods
   * - Handles the various WP errors.
   *
   * @returns {Object} Webpack compiler instance.
   */
  const compile = R.compose(
    runCompile,
    cleanDir
  );

  const test = function test() {
    let cmd = spawn('mocha', ['--colors', `${command.watch ? '--watch' : 'test'}`]);

    if (command.cover) {
      cmd = spawn('node_modules/istanbul/lib/cli.js', ['cover', 'node_modules/mocha/bin/_mocha', '--', '--colors', 'test']);
    }

    cmd.stdout.on('data', (data) => {
      logger.info(data.toString());
    });

    // It seems istanbul report output goes to stderr.
    cmd.stderr.on('data', (data) => {
      if (command.cover) {
        logger.info(data.toString());
        return;
      }
      logger.error(data.toString());
    });
  };

  /**
   * Start the webpack dev server.
   */
  function startDevServer() {
    const WDS = require('webpack-dev-server');

    const wpConf = getWebpackConfig();

    // Need to update the app entry for webpack-dev-server. This is necessary for
    // the auto page refresh to happen. See: https://github.com/webpack/webpack-dev-server/blob/master/examples/node-api-simple/webpack.config.js
    const pathToWPDSClient = `${path.resolve(__dirname, 'node_modules/webpack-dev-server/client')}?http://localhost:8080`;

    Object.keys(wpConf.entry).forEach((key) => {
      wpConf.entry[key] = [
        pathToWPDSClient,
        path.resolve(projectPath, wpConf.entry[key]),
      ];
    });

    devServer(createCompiler(wpConf), WDS);
  }

  return {
    test,
    compile,
    createCompiler,
    webpackCompileDone,
    startDevServer,
    getWebpackConfig,
  };
};
