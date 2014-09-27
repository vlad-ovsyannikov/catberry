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
	ServiceLocator = require('catberry-locator'),
	CookiesWrapper = require('../../browser/CookiesWrapper');

describe('browser/CookiesWrapper', function () {
	describe('#get', function () {
		it('should return empty string if cookie string is null', function () {
			var locator = createLocator(null),
				cookiesWrapper = locator.resolveInstance(CookiesWrapper);

			assert.strictEqual(cookiesWrapper.get('some'), '');
		});
		it('should return value if cookie string is right', function () {
			var locator = createLocator('some=value; some2=value2'),
				cookiesWrapper = locator.resolveInstance(CookiesWrapper);

			assert.strictEqual(cookiesWrapper.get('some'), 'value');
			assert.strictEqual(cookiesWrapper.get('some2'), 'value2');
		});
		it('should return empty string if cookie string is wrong', function () {
			var locator = createLocator('fasdfa/gafg-sgafga'),
				cookiesWrapper = locator.resolveInstance(CookiesWrapper);

			assert.strictEqual(cookiesWrapper.get('fasdfa/gafg-sgafga'), '');
		});
	});
	describe('#set', function () {
		it('should set cookie by specified parameters',
			function () {
				var locator = createLocator(null),
					cookiesWrapper = locator.resolveInstance(CookiesWrapper),
					expiration = new Date(),
					window = locator.resolve('window'),
					expected = 'some=value' +
						'; max-age=100' +
						'; expire=' +
						expiration.toUTCString() +
						'; path=/some' +
						'; domain=.new.domain' +
						'; secure; HttpOnly';

				cookiesWrapper.set({
					key: 'some',
					value: 'value',
					maxAge: 100,
					expire: expiration,
					domain: '.new.domain',
					path: '/some',
					secure: true,
					httpOnly: true
				});

				assert.strictEqual(window.document.cookie, expected);
			});
		it('should set default expire date by max age',
			function () {
				var locator = createLocator(null),
					cookiesWrapper = locator.resolveInstance(CookiesWrapper),
					expiration = new Date(Date.now() + 3600000),
					window = locator.resolve('window'),
					expected = 'some=value' +
						'; max-age=3600' +
						'; expire=' +
						expiration.toUTCString();

				cookiesWrapper.set({
					key: 'some',
					value: 'value',
					maxAge: 3600
				});

				assert.strictEqual(window.document.cookie, expected);
			});
		it('should throw error if wrong key',
			function () {
				var locator = createLocator(null),
					cookiesWrapper = locator.resolveInstance(CookiesWrapper);

				assert.throws(function () {
					cookiesWrapper.set({
						key: {}
					});
				}, Error);
			});
		it('should throw error if wrong value',
			function () {
				var locator = createLocator(null),
					cookiesWrapper = locator.resolveInstance(CookiesWrapper);

				assert.throws(function () {
					cookiesWrapper.set({
						key: 'some',
						value: {}
					});
				}, Error);
			});
	});
});

function createLocator(cookieString) {
	var locator = new ServiceLocator();
	locator.registerInstance('window', {
		document: {
			cookie: cookieString
		}
	});
	return locator;
}