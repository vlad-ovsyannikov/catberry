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

var assert = require('assert'),
	events = require('events'),
	moduleHelper = require('../../../lib/helpers/moduleHelper'),
	ContentStream = require('../../../lib/streams/ContentReadable'),
	CookiesWrapper = require('../../../lib/CookiesWrapper'),
	ServiceLocator = require('catberry-locator'),
	ModuleApiProvider = require('../../../lib/ModuleApiProvider'),
	ModuleReadable = require('../../../lib/streams/ModuleReadable');

describe('lib/streams/ModuleReadable', function () {
	describe('#render', function () {
		it('should render script element if module called redirect',
			function (done) {
				var location = 'some/uri',
					content = 'some test',
					module = {
						name: 'test',
						implementation: {
							$context: createContext('test'),
							render: function () {
								this.$context.redirect(location);
							}
						},
						placeholders: {
							test: {
								name: 'test',
								getTemplateStream: function () {
									return new ContentStream(content);
								}
							}
						}
					};

				var expected = '<script class="catberry-inline-script">' +
					'if(!window.__cache){window.__cache = {};}' +
					'if(!window.__cache[\'test\'])' +
					'{window.__cache[\'test\'] = {};}' +
					'window.__cache[\'test\'][\'test\']={};' +
					'window.location.assign(\'' +
					location +
					'\');' +
					'</script>' +
					content;

				var parameters = createRenderingParameters(module),
					moduleReadable = new ModuleReadable(module,
						module.placeholders.test, parameters, false),
					result = '';

				moduleReadable
					.on('data', function (chunk) {
						result += chunk;
					})
					.on('end', function () {
						assert.strictEqual(result, expected);
						done();
					});
				moduleReadable.render();
			});

		it('should render script element if cookies.set was called',
			function (done) {
				var cookie1Name = 'cookie1',
					cookie1Value = 'value1',
					cookie2Name = 'cookie2',
					cookie2Value = 'value2',
					content = 'some test',
					module = {
						name: 'test',
						implementation: {
							$context: createContext('test'),
							render: function () {
								this.$context.cookies.set({
									key: cookie1Name,
									value: cookie1Value
								});
								this.$context.cookies.set({
									key: cookie2Name,
									value: cookie2Value
								});
							}
						},
						placeholders: {
							test: {
								name: 'test',
								getTemplateStream: function () {
									return new ContentStream(content);
								}
							}
						}
					};

				var expected = '<script class="catberry-inline-script">' +
					'if(!window.__cache){window.__cache = {};}' +
					'if(!window.__cache[\'test\'])' +
					'{window.__cache[\'test\'] = {};}' +
					'window.__cache[\'test\'][\'test\']={};' +
					'window.document.cookie = \'' +
					cookie1Name + '=' + cookie1Value + '\';' +
					'window.document.cookie = \'' +
					cookie2Name + '=' + cookie2Value + '\';' +
					'</script>' +
					content;

				var parameters = createRenderingParameters(module),
					moduleReadable = new ModuleReadable(module,
						module.placeholders.test, parameters, false),
					result = '';

				moduleReadable
					.on('data', function (chunk) {
						result += chunk;
					})
					.on('end', function () {
						assert.strictEqual(result, expected);
						done();
					});
				moduleReadable.render();
			});

		it('should render script element if clearHash was called',
			function (done) {
				var content = 'some test',
					module = {
						name: 'test',
						implementation: {
							$context: createContext('test'),
							render: function () {
								this.$context.clearHash();
							}
						},
						placeholders: {
							test: {
								name: 'test',
								getTemplateStream: function () {
									return new ContentStream(content);
								}
							}
						}
					};

				var expected = '<script class="catberry-inline-script">' +
					'if(!window.__cache){window.__cache = {};}' +
					'if(!window.__cache[\'test\'])' +
					'{window.__cache[\'test\'] = {};}' +
					'window.__cache[\'test\'][\'test\']={};' +
					'window.location.hash = \'\';' +
					'</script>' +
					content;

				var parameters = createRenderingParameters(module),
					moduleReadable = new ModuleReadable(module,
						module.placeholders.test, parameters, false),
					result = '';

				moduleReadable
					.on('data', function (chunk) {
						result += chunk;
					})
					.on('end', function () {
						assert.strictEqual(result, expected);
						done();
					});
				moduleReadable.render();
			});

		it('should render error placeholder if error', function (done) {
			var content = 'some test',
				errorContent = 'some error content',
				module = {
					name: 'test',
					implementation: {
						$context: createContext('test'),
						render: function () {
							this.$context.clearHash();
							throw new Error('hello');
						}
					},
					errorPlaceholder: {
						name: '__error',
						getTemplateStream: function () {
							return new ContentStream(errorContent);
						}
					},
					placeholders: {
						test: {
							name: 'test',
							getTemplateStream: function () {
								return new ContentStream(content);
							}
						}
					}
				};

			var expected = '<script class="catberry-inline-script">' +
				'window.location.hash = \'\';' +
				'</script>' + errorContent;

			var parameters = createRenderingParameters(module),
				moduleReadable = new ModuleReadable(module,
					module.placeholders.test, parameters, true),
				result = '';

			moduleReadable
				.on('data', function (chunk) {
					result += chunk;
				})
				.on('error', function (error) {
					assert.strictEqual(error.message, 'hello');
					assert.strictEqual(result, expected);
					done();
				});
			moduleReadable.render();
		});

		it('should render nothing if error', function (done) {
			var content = 'some test',
				module = {
					name: 'test',
					implementation: {
						$context: createContext('test'),
						render: function () {
							throw new Error('hello');
						}
					},
					placeholders: {
						test: {
							name: 'test',
							getTemplateStream: function () {
								return new ContentStream(content);
							}
						}
					}
				};

			var parameters = createRenderingParameters(module),
				moduleReadable = new ModuleReadable(module,
					module.placeholders.test, parameters, true),
				result = '';

			moduleReadable
				.on('data', function (chunk) {
					result += chunk;
				})
				.on('error', function (error) {
					assert.strictEqual(error.message, 'hello');
					assert.strictEqual(result, '');
					done();
				});
			moduleReadable.render();
		});

		it('should render nothing if error in template', function (done) {
			var module = {
				name: 'test',
				implementation: {
					$context: createContext('test'),
					render: function () {

					}
				},
				placeholders: {
					test: {
						name: 'test',
						getTemplateStream: function () {
							throw new Error('hello');
						}
					}
				}
			};

			var parameters = createRenderingParameters(module),
				moduleReadable = new ModuleReadable(module,
					module.placeholders.test, parameters, true),
				expected = '<script class="catberry-inline-script">' +
					'if(!window.__cache){window.__cache = {};}' +
					'if(!window.__cache[\'test\'])' +
					'{window.__cache[\'test\'] = {};}' +
					'window.__cache[\'test\'][\'test\']={};' +
					'</script>',
				result = '';

			moduleReadable
				.on('data', function (chunk) {
					result += chunk;
				})
				.on('error', function (error) {
					assert.strictEqual(error.message, 'hello');
					assert.strictEqual(result, expected);
					done();
				});
			moduleReadable.render();
		});

		it('should render nothing if error in template stream',
			function (done) {
				var content = 'some test',
					module = {
						name: 'test',
						implementation: {
							$context: createContext('test'),
							render: function () {

							}
						},
						placeholders: {
							test: {
								name: 'test',
								getTemplateStream: function () {
									var stream = new ContentStream(content);
									setTimeout(function () {
										stream.emit(
											'error', new Error('hello')
										);
									}, 0);
									return stream;
								}
							}
						}
					};

				var parameters = createRenderingParameters(module),
					moduleReadable = new ModuleReadable(module,
						module.placeholders.test, parameters, true),
					expected = '<script class="catberry-inline-script">' +
						'if(!window.__cache){window.__cache = {};}' +
						'if(!window.__cache[\'test\'])' +
						'{window.__cache[\'test\'] = {};}' +
						'window.__cache[\'test\'][\'test\']={};' +
						'</script>' + content,
					result = '';

				moduleReadable
					.on('data', function (chunk) {
						result += chunk;
					})
					.on('error', function (error) {
						assert.strictEqual(error.message, 'hello');
						assert.strictEqual(result, expected);
						done();
					});
				moduleReadable.render();
			});

		it('should emit error if module not defined',
			function (done) {
				var moduleReadable = new ModuleReadable(
						null, null, {}, true
					);

				moduleReadable
					.on('data', function () {
						assert.fail();
					})
					.on('error', function (error) {
						assert.strictEqual(error.message, 'Module not defined');
						done();
					});
				moduleReadable.render();
			});

		it('should emit error if placeholder not defined',
			function (done) {
				var moduleReadable = new ModuleReadable(
					{}, null, {}, true
				);

				moduleReadable
					.on('data', function () {
						assert.fail();
					})
					.on('error', function (error) {
						assert.strictEqual(error.message, 'Placeholder not defined');
						done();
					});
				moduleReadable.render();
			});
	});
});

function createRenderingParameters(module) {
	var locator = new ServiceLocator();
	locator.register('moduleApiProvider', ModuleApiProvider);
	locator.register('cookiesWrapper', CookiesWrapper);
	locator.registerInstance('serviceLocator', locator);
	locator.registerInstance('eventBus', new events.EventEmitter());
	var modulesByNames = {};
	modulesByNames[module.name] = module;

	var placeholdersByIds = {};
	Object.keys(module.placeholders)
		.forEach(function (placeholderName) {
			var id = moduleHelper.joinModuleNameAndContext(
				module.name, placeholderName);
			placeholdersByIds[id] = module.placeholders[placeholderName];
		});

	var context = Object.create(locator.resolve('moduleApiProvider'));
	context.cookies = locator.resolve('cookiesWrapper');
	context.renderedData = {};
	context.state = {};

	return {
		isRelease: false,
		context: context,
		eventBus: locator.resolve('eventBus'),
		modulesByNames: modulesByNames,
		placeholderIds: Object.keys(placeholdersByIds),
		placeholdersByIds: placeholdersByIds
	};
}

function createContext(moduleName) {
	var locator = new ServiceLocator();
	locator.register('moduleApiProvider', ModuleApiProvider);
	locator.register('cookiesWrapper', CookiesWrapper);
	locator.registerInstance('serviceLocator', locator);
	locator.registerInstance('eventBus', new events.EventEmitter());
	var context = Object.create(locator.resolve('moduleApiProvider'));
	context.name = moduleName;
	context.state = {};
	context.renderedData = {};
	context.cookies = locator.resolve('cookiesWrapper');
	return context;
}