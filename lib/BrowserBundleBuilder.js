/*
 * catberry
 *
 * Copyright (c) 2014 Denis Rechkunov and project contributors.
 *
 * catberry's license follows:
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * This license applies to all parts of catberry that are not externally
 * maintained libraries.
 */

'use strict';

module.exports = BrowserBundleBuilder;

var path = require('path'),
	util = require('util'),
	fs = require('./promises/fs'),
	UglifyJS = require('uglify-js'),
	InjectionFinder = require('./InjectionFinder'),
	browserify = require('browserify'),
	moduleHelper = require('./helpers/moduleHelper'),
	packageDescriptionPath = path.join(process.cwd(), 'package.json'),
	packageDescription;

try {
	packageDescription = require(packageDescriptionPath);
} catch (e) {
	// ok, nothing to do here
}

var DEFAULT_PUBLIC_DIRECTORY = path.join(process.cwd(), 'public'),
	BROWSER_ROOT_PATH = path.join(__dirname, '..', 'browser'),
	INFO_BUILDING_BUNDLE = 'Building browser script bundle...',
	INFO_LOOKING_FOR_MODULES = 'Looking for modules...',
	INFO_OPTIMIZING_BROWSER_BUNDLE = 'Optimizing code of browser bundle...',
	INFO_WATCHING_FILES = 'Watching files for changes to rebuild bundle...',
	INFO_FILES_CHANGED = 'Files were changed, rebuilding browser bundle...',
	TEMPORARY_BOOTSTRAPPER_FILENAME = '__BrowserBundle.js',
	BOOTSTRAPPER_FILENAME = 'Bootstrapper.js',
	BROWSER_SCRIPT_FILENAME = 'browser.js',
	BUNDLE_FILENAME = 'bundle.js',
	MODULE_FORMAT = '{name: \'%s\', implementation: %s},\n',
	MODULES_REPLACE = '/**__modules**/',
	PLACEHOLDERS_REPLACE = '/**__placeholders**/',
	ROUTE_DEFINITIONS_REPLACE = '\'__routeDefinitions\'',
	EVENT_DEFINITIONS_REPLACE = '\'__eventDefinitions\'',
	ROUTE_DEFINITIONS_FILENAME = 'routes.js',
	EVENT_DEFINITIONS_FILENAME = 'events.js',
	TEMPLATE_ENGINE_REPLACE = '\'__templateEngine\'',
	REQUIRE_FORMAT = 'require(\'%s\')',
	HEADER_FORMAT = '/* %s: %s */\n',
	BRACKETS_REGEXP = /(?:^\[)|(?:\]$)/g;

/**
 * Creates new instance of browser bundle builder.
 * @param {ServiceLocator} $serviceLocator Service locator
 * to resolve dependencies.
 * @constructor
 */
function BrowserBundleBuilder($serviceLocator) {
	var config = $serviceLocator.resolve('config');
	this._eventBus = $serviceLocator.resolve('eventBus');
	this._logger = $serviceLocator.resolve('logger');
	this._publicPath = config.publicDirectoryPath || DEFAULT_PUBLIC_DIRECTORY;
	this._templateProvider = $serviceLocator.resolve('templateProvider');

	this._moduleFinder = $serviceLocator.resolve('moduleFinder');
	this._isRelease = Boolean(config.isRelease);

	var self = this;
	if (!this._isRelease) {
		this._logger.info(INFO_WATCHING_FILES);
		this._moduleFinder.watch(function () {
			if (!self._isBuilt) {
				return;
			}
			self._logger.info(INFO_FILES_CHANGED);
			self.build();
		});
	}
}

/**
 * Determines if package was build at least one time.
 * @type {boolean}
 * @private
 */
BrowserBundleBuilder.prototype._isBuilt = false;

/**
 * Current template provider.
 * @type {TemplateProvider}
 * @private
 */
BrowserBundleBuilder.prototype._templateProvider = null;

/**
 * Current module finder.
 * @type {ModuleFinder}
 * @private
 */
BrowserBundleBuilder.prototype._moduleFinder = null;

/**
 * Current event bus.
 * @type {EventEmitter}
 * @private
 */
BrowserBundleBuilder.prototype._eventBus = null;

/**
 * Current logger.
 * @type {Logger}
 * @private
 */
BrowserBundleBuilder.prototype._logger = null;

/**
 * Is current application mode release.
 * @type {boolean}
 * @private
 */
BrowserBundleBuilder.prototype._isRelease = false;

/**
 * Current path where to publish bundle.
 * @type {string}
 * @private
 */
BrowserBundleBuilder.prototype._publicPath = '';

/**
 * Builds browser bundle.
 * @returns {Promise} Promise for nothing.
 */
BrowserBundleBuilder.prototype.build = function () {
	var self = this,
		startTime = Date.now();

	this._logger.info(INFO_LOOKING_FOR_MODULES);

	var bootstrapperPath = path.join(
			process.cwd(),
			TEMPORARY_BOOTSTRAPPER_FILENAME
		),
		entryPath = path.join(process.cwd(), BROWSER_SCRIPT_FILENAME),
		bundlePath = path.join(this._publicPath, BUNDLE_FILENAME),
		bundler = browserify({
			debug: !this._isRelease
		});

	return fs.exists(this._publicPath)
		.then(function (isExists) {
			return !isExists ? fs.makeDir(self._publicPath) : null;
		})
		.then(this._createRealBootstrapper.bind(this))
		.then(function (realBootstrapper) {
			return fs.writeFile(bootstrapperPath, realBootstrapper);
		})
		.then(function () {
			return fs.exists(entryPath);
		})
		.then(function (isExists) {
			// if user defined browser entry script then add it
			return isExists ? bundler.add(entryPath) : null;
		})
		.then(function () {
			return new Promise(function (fulfill, reject) {
				self._logger.info(INFO_BUILDING_BUNDLE);
				bundler.bundle(function (error, buffer) {
					if (error) {
						reject(error);
						return;
					}
					fulfill(buffer.toString());
				});
			});
		})
		.then(function (source) {
			var finalSource = source;
			if (self._isRelease) {
				self._logger.info(INFO_OPTIMIZING_BROWSER_BUNDLE);
				finalSource = self._optimize(source);
			}

			if (packageDescription &&
				packageDescription.name &&
				packageDescription.version) {
				finalSource = util.format(
					HEADER_FORMAT,
					packageDescription.name,
					packageDescription.version
				) + finalSource;
			}
			return fs.writeFile(bundlePath, finalSource);
		})
		.then(function () {
			return fs.unlink(bootstrapperPath);
		})
		.then(function () {
			self._isBuilt = true;
			self._eventBus.emit('bundleBuilt', {
				path: bundlePath,
				time: Date.now() - startTime
			});
		}, function (reason) {
			self._eventBus.emit('error', reason);
		});
};

/**
 * Creates real bootstrapper code for bundle build.
 * @returns {Promise<string>} Promise for source code of real bootstrapper.
 * @private
 */
BrowserBundleBuilder.prototype._createRealBootstrapper = function () {
	var self = this,
		bootstrapperTemplatePath = path.join(
			BROWSER_ROOT_PATH,
			BOOTSTRAPPER_FILENAME
		),
		routeDefinitionsPath = path.join(
			process.cwd(),
			ROUTE_DEFINITIONS_FILENAME
		),
		eventDefinitionsPath = path.join(
			process.cwd(),
			EVENT_DEFINITIONS_FILENAME
		);

	return this._moduleFinder.find()
		.then(function (found) {
			return fs.readFile(bootstrapperTemplatePath, {encoding: 'utf8'})
				.then(function (file) {
					return {
						file: file,
						found: found
					};
				});
		})
		.then(function (context) {
			return Promise.all([
				self._generateRequiresForModules(context.found),
				self._generatePlaceholders(context.found)
			])
				.then(function (results) {
					return {
						file: context.file,
						modules: results[0],
						placeholders: results[1]
					};
				});
		})
		.then(function (context) {
			// check if paths exist and create require statements or undefined
			return Promise.all([
				fs.exists(routeDefinitionsPath)
					.then(function (isExists) {
						return isExists ? util.format(
							REQUIRE_FORMAT,
							// for windows
							routeDefinitionsPath.replace(/\\/g, '\\\\')) :
							'undefined';
					}),
				fs.exists(eventDefinitionsPath)
					.then(function (isExists) {
						return isExists ?
							util.format(REQUIRE_FORMAT,
								// for windows
								eventDefinitionsPath.replace(/\\/g, '\\\\')) :
							'undefined';
					})
			])
				.then(function (requires) {
					return context.file
						.replace(PLACEHOLDERS_REPLACE, context.placeholders)
						.replace(MODULES_REPLACE, context.modules)
						.replace(ROUTE_DEFINITIONS_REPLACE, requires[0])
						.replace(EVENT_DEFINITIONS_REPLACE, requires[1]);
				});
		})
		.then(null, function (reason) {
			self._eventBus.emit('error', reason);
		});
};

/**
 * Generates replaces for every module.
 * @param {Object} found Found paths of modules.
 * @returns {string} Replace string for list of modules.
 * @private
 */
BrowserBundleBuilder.prototype._generateRequiresForModules = function (found) {
	var modules = '';
	Object
		.keys(found)
		.forEach(function (moduleName) {
			var requireExpression = found[moduleName].indexPath ?
				util.format(
					REQUIRE_FORMAT,
					('./' + found[moduleName].indexPath)
						.replace(/\\/g, '\\\\') // for windows
				) : 'null';
			modules += util.format(
				MODULE_FORMAT, moduleName, requireExpression
			);
		});
	return modules.replace(/(,\n)$/, '');
};

/**
 * Generates replaces for every placeholder.
 * @param {Object} found Found paths of modules and placeholders.
 * @returns {Promise<string>} Promise for JSON that describes placeholders.
 * @private
 */
BrowserBundleBuilder.prototype._generatePlaceholders = function (found) {
	var self = this,
		promises = [];
	Object.keys(found)
		.forEach(function (moduleName) {
			var placeholders = found[moduleName].placeholders;
			Object.keys(placeholders)
				.map(function (placeholderName) {
					var fullName = moduleHelper.joinModuleNameAndContext(
						moduleName, placeholderName
					);
					// we do not need root templates in browser
					if (moduleHelper.isRootPlaceholder(placeholderName)) {
						return;
					}

					var promise = fs.readFile(
						placeholders[placeholderName],
						{encoding: 'utf8'}
					)
						.then(function (source) {
							return {
								moduleName: moduleName,
								name: placeholderName,
								compiledSource: self._templateProvider.compile(
									source, fullName
								)
							};
						});
					promises.push(promise);
				});
		});

	return Promise.all(promises)
		.then(function (results) {
			return JSON
				.stringify(results)
				.replace(BRACKETS_REGEXP, '');
		});
};

/**
 * Optimizes bundle source code and does not break it.
 * @param {string} source Bundle source code.
 */
BrowserBundleBuilder.prototype._optimize = function (source) {
	var ast = UglifyJS.parse(source),
		compressor = UglifyJS.Compressor({warnings: false}),
		finder = new InjectionFinder(ast),
		exceptNames = finder.find();

	// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
	ast.figure_out_scope();
	ast = ast.transform(compressor);
	ast.figure_out_scope();
	ast.compute_char_frequency();
	ast.mangle_names({except: exceptNames});

	return ast.print_to_string();
};