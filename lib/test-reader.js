'use strict';

const path = require('path');

const _ = require('lodash');
const globExtra = require('glob-extra');
const Promise = require('bluebird');

const SetCollection = require('gemini-core/lib/test-reader/set-collection');
const CoreError = require('gemini-core/lib/errors/core-error');
const GeminiError = require('./errors/gemini-error');
const Suite = require('./suite');
const Events = require('./constants/events');
const testsApi = require('./tests-api');
const utils = require('./utils');

const loadSuites = (sets, emitter) => {
    const rootSuite = Suite.create('');

    sets.forEachFile((path, browsers) => {
        global.gemini = testsApi(rootSuite, browsers);

        emitter.emit(Events.BEFORE_FILE_READ, path);
        utils.requireWithNoCache(path);
        emitter.emit(Events.AFTER_FILE_READ, path);

        delete global.gemini;
    });

    return rootSuite;
};

const filesExist = (configSets, optsPaths) => {
    return !_.isEmpty(configSets) || !_.isEmpty(optsPaths);
};

const getGeminiPath = (projectRoot) => path.resolve(projectRoot, 'gemini');

module.exports = (opts, config, emitter) => {
    const files = filesExist(config.sets, opts.paths)
        ? opts.paths
        : [getGeminiPath(config.system.projectRoot)];

    const expandOpts = {formats: ['.js']};
    const globOpts = {ignore: config.system.exclude};

    return Promise.all([
        SetCollection.create(config, opts, expandOpts, globOpts),
        globExtra.expandPaths(files, expandOpts, globOpts)
    ])
    .spread((sets, paths) => {
        sets.filterFiles(paths);

        return loadSuites(sets, emitter);
    })
    .catch((e) => {
        if (e instanceof CoreError) {
            return Promise.reject(new GeminiError(e.message));
        }

        return Promise.reject(e);
    });
};
