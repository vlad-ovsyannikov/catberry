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

module.exports = PlaceholderTransform;

var util = require('util'),
	stream = require('stream'),
	ModuleReadable = require('./ModuleReadable'),
	ParserDuplex = require('./ParserDuplex');

util.inherits(PlaceholderTransform, ParserDuplex);

/**
 * Creates new instance of placeholder transformation stream.
 * @param {Object} parameters Rendering parameters.
 * @param {Object?} options Stream options.
 * @constructor
 * @extends ParserDuplex
 */
function PlaceholderTransform(parameters, options) {
	ParserDuplex.call(this, options);

	this.renderedPlaceholders = {};
	this._parameters = parameters;
	if (!this._parameters.renderedPlaceholders) {
		this._parameters.renderedPlaceholders = {};
	}
}

/**
 * Current rendering context.
 * @type {Object}
 * @private
 */
PlaceholderTransform.prototype._parameters = null;

/**
 * Handles found tag with ID and creates replace stream for its content.
 * @param {string} id HTML element ID.
 * @returns {Stream} Replace stream of HTML element content.
 */
PlaceholderTransform.prototype.foundTagIdHandler = function (id) {
	if (!this._parameters.placeholdersByIds.hasOwnProperty(id) ||
		this._parameters.renderedPlaceholders.hasOwnProperty(id)) {
		return null;
	}

	this._parameters.renderedPlaceholders[id] = true;

	var placeholder = this._parameters.placeholdersByIds[id],
		moduleName = placeholder.moduleName,
		module = this._parameters.modulesByNames[moduleName],
		innerParser = new PlaceholderTransform(this._parameters),
		moduleStream = new ModuleReadable(module, placeholder,
			this._parameters, this._parameters.isRelease);

	moduleStream.on('error', this._errorHandler.bind(this));
	moduleStream.render();

	return moduleStream.pipe(innerParser);
};