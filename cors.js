/**
 * @preserve CORS (Cross-Origin Resource Sharing) library (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
 *
 * @author ShirtlessKirk copyright 2014
 * @license WTFPL (http://www.wtfpl.net/txt/copying)
 */
/*jslint unparam: true */
/*global define: false, module: false, require: false */
(function (global, definition) { // non-exporting module magic dance
    'use strict';

    var
        amd = 'amd',
        exports = 'exports'; // keeps the method names for CommonJS / AMD from being compiled to single character variable

    if (typeof define === 'function' && define[amd]) {
        define(function () {
            return definition(global);
        });
    } else if (typeof module === 'function' && module[exports]) {
        module[exports] = definition(global);
    } else {
        definition(global);
    }
}(this, function (window) {
    'use strict';

    var
        abort               = 'abort',
        arrayPrototypeSlice = Array.prototype.slice,
        /** @type {CORS} */
        cors,
        corsType,
        customErrorPrototype,
        document            = window.document,
        jsonpHttpRequestPrototype,
        key,
        onLoad              = 'onload',
        onReadyStateChange  = 'onreadystatechange',
        open                = 'open',
        readyState          = 'readyState',
        response            = 'response',
        responseText        = 'responseText',
        send                = 'send',
        status              = 'status',
        CORSPrototype,
        CORSStr             = 'CORS',
        /** @enum {number} */
        HTTPCODE = {
            'CONTINUE':    100,
            'CREATED':     201,
            'OK':          200,
            'ACCEPTED':    202,
            'SERVERERROR': 500
        },
        NULL                = null,
        /** @enum {number} */
        STATE = {
            'UNSENT':           0,
            'OPENED':           1,
            'HEADERS_RECEIVED': 2,
            'LOADING':          3,
            'DONE':             4
        },
        TYPE = 'TYPE',
        /** @enum {string} */
        TYPES = {
            XMLHTTP: 'XMLHttpRequest',
            XDOMAIN: 'XDomainRequest',
            JSONP:   'JSONPHttpRequest'
        };

    if (!!window[CORSStr]) { // sanity check
        return;
    }

    /**
     * @this {CustomError}
     * @return {string}
     */
    function customErrorToString() {
        var
            message = this.name;

        if (this.message.length !== 0) {
            message += ': ' + this.message;
        }

        return message;
    }

    /**
     * @constructor
     * @param {string} name
     * @param {string=} opt_message
     */
    function CustomError(name, opt_message) {
        this.name = name;
        this.message = opt_message || '';
    }
    CustomError.prototype = new Error();
    customErrorPrototype = CustomError.prototype;
    customErrorPrototype.toString = customErrorToString;

    /**
     * @this {CORS}
     * @param {number} state
     * @param {number=} opt_status
     */
    function changeState(state, opt_status) {
        if (opt_status !== undefined && opt_status !== this[status]) {
            this[status] = opt_status;
        }

        if (this[readyState] !== state) {
            this[readyState] = state;

            if (typeof this[onReadyStateChange] === 'function') { // run onreadystatechange function if defined
                this[onReadyStateChange]();
            }
        }
    }

    /**
     * @this {JSONPHttpRequest|XDomainRequest|XMLHttpRequest}
     * propagates changes up to parent CORS object (if present) to trigger onreadystatechange (if defined) on that as well
     */
    function transportOnReadyStateChange() {
        var
            parent = this.parent,
            state = HTTPCODE.OK; // default to OK

        if (parent !== undefined) {
            if (this[readyState] === STATE.DONE) {
                parent[response] = this[response];
                parent[responseText] = this[responseText];
            }

            try {
                state = this[status]; // Firefox < 14 throws error on trying to read the status property of XmlHttpRequest if it is undefined
            } catch (ignore) {}

            changeState.call(parent, this[readyState], state);
        }
    }

    /**
     * @this {JSONPHttpRequest|XDomainRequest}
     * @param {number} state
     * @param {number=} opt_status
     */
    function transportReadyStateChange(state, opt_status) {
        this[readyState] = state;
        if (opt_status !== undefined) {
            this[status] = opt_status;
        }

        if (typeof this[onReadyStateChange] === 'function') {
            this[onReadyStateChange]();
        }
    }

    /**
     * @this {JSONPHttpRequest}
     */
    function jsonpHttpRequestOnLoad() {
        var
            complete = 'complete',
            loaded = 'loaded',
            script = this.script,
            state;

        state = script[readyState] || complete;
        if ((state === loaded || state === complete) && !script[loaded]) {
            script[loaded] = true;
            script[onLoad] = script[onReadyStateChange] = NULL;
            script.parentNode.removeChild(script);
            delete this.script;
            transportReadyStateChange.call(this, STATE.DONE, HTTPCODE.OK);
        }
    }

    /**
     * @this {JSONPHttpRequest}
     * @param {string} method
     * @param {string} url
     * @param {boolean=} opt_async
     */
    function jsonpHttpRequestOpen(method, url, opt_async) {
        var
            async = opt_async !== undefined ? opt_async : true,
            fnId,
            script = document.createElement('script'),
            that = this;

        if (async) {
            script.async = async;
        }

        script.id = TYPES.JSONP + '_' + (new Date()).getTime();
        script.loaded = false;
        script[onLoad] = script[onReadyStateChange] = function () {
            jsonpHttpRequestOnLoad.call(that);
        };
        fnId = '__' + script.id;

        window[fnId] = function (data) { // set up auto-callback function
            that[response] = that[responseText] = data;
            window[fnId] = undefined; // self-undefinition
            if (typeof that.callback === 'function') { // if callback function sent, execute in global scope, passing request object
                that.callback.call(window, that);
            }
        };

        script.src = (url.indexOf('//') === 0 ? document.location.protocol : '') + url; // prepend the protocol just in case for old browsers (see IE)
        transportReadyStateChange.call(this, STATE.UNSENT, HTTPCODE.CONTINUE);
        this.script = script;
        transportReadyStateChange.call(this, STATE.OPENED, HTTPCODE.CREATED);
    }

    /**
     * @this {JSONPHttpRequest}
     * @param {Object=} opt_data
     */
    function jsonpHttpRequestSend(opt_data) {
        var
            callback = 'callback',
            counter,
            data,
            head,
            length,
            param,
            query,
            qS,
            queryString,
            script;

        if (this[readyState] !== STATE.OPENED) {
            throw new CustomError('InvalidStateError', 'Failed to execute \'' + send + '\' on \'' + TYPES.JSONP + '\': the object\'s state must be OPENED.');
        }

        script = this.script;
        data = opt_data || NULL;
        head = document.head || document.getElementsByTagName('head')[0];
        query = script.src.split('?');
        qS = queryString = [];

        if (query.length > 1) {
            qS = query[1].split('&');
            script.src = query[0];
        }

        for (counter = 0, length = qS.length; counter < length; counter += 1) {
            if (qS[counter].indexOf(callback + '=') === 0) { // was callback sent in querystring?
                this[callback] = queryString[counter].split('=')[1]; // save in object
            } else {
                queryString.push(qS[counter]);
            }
        }

        for (param in data) {
            if (data.hasOwnProperty(param)) {
                if (param === callback) { // callback sent in data, save in object (overwrites any existing one)
                    this[callback] = data[param];
                } else {
                    queryString.push(encodeURIComponent(param) + '=' + encodeURIComponent(data[param]));
                }
            }
        }

        queryString.push(callback + '=__' + script.id); // add auto-callback reference
        script.src += '?' + queryString.join('&');
        head.appendChild(script);
        transportReadyStateChange.call(this, STATE.LOADING, HTTPCODE.ACCEPTED);
    }

    /**
     * @this {XDomainRequest}
     */
    function xDomainRequestOnError() {
        transportReadyStateChange.call(this, STATE.DONE, HTTPCODE.SERVERERROR);
    }

    /**
     * @this {XDomainRequest}
     */
    function xDomainRequestOnLoad() {
        this[response] = this[responseText];
        transportReadyStateChange.call(this, STATE.DONE, HTTPCODE.OK); // OK
    }

    /**
     * @this {CORS}
     */
    function xDomainRequestOpen() {
        var
            args = arrayPrototypeSlice.call(arguments),
            transport = this.transport;

        this.method = args[0].toUpperCase();
        transport.onerror = xDomainRequestOnError;
        transport[onLoad] = xDomainRequestOnLoad;
        transportReadyStateChange.call(transport, STATE.UNSENT, HTTPCODE.CONTINUE);
        transport[open].apply(transport, args);
        transportReadyStateChange.call(transport, STATE.OPENED, HTTPCODE.CREATED);
    }

    /**
     * @this {CORS}
     */
    function xDomainRequestSend() {
        var
            transport = this.transport;

        transport[send].apply(transport, arguments);
        transportReadyStateChange.call(transport, STATE.LOADING, HTTPCODE.ACCEPTED);
    }

    /**
     * @this {CORS}
     */
    function xmlHttpRequestOpen() {
        var
            args = arrayPrototypeSlice.call(arguments),
            transport = this.transport;

        this.method = args[0].toUpperCase();
        transport[open].apply(transport, args); // automatically triggers onreadystatechange, no need to call here
    }

    /**
     * @this {CORS}
     */
    function xmlHttpRequestSend() {
        var
            setRequestHeader = 'setRequestHeader',
            transport = this.transport;

        transport[setRequestHeader]('Content-Type', (this.method === 'POST' ? 'multipart/form-data' : 'application/x-www-form-urlencoded') + '; charset=UTF-8');
        transport[setRequestHeader]('X-Requested-With', TYPES.XMLHTTP);
        transport[send].apply(transport, arguments); // automatically triggers onreadystatechange, no need to call here
    }

    /**
     * @this {CORS}
     */
    function corsAbort() {
        try {
            this.transport[abort]();
        } catch (ignore) {}
    }

    /**
     * @this {CORS}
     */
    function corsJSONPOpen() {
        var
            args = arrayPrototypeSlice.call(arguments),
            transport = this.transport;

        args[0] = 'get';
        this.method = args[0].toUpperCase();
        transport[onLoad] = jsonpHttpRequestOnLoad;
        transportReadyStateChange.call(transport, STATE.UNSENT, HTTPCODE.CONTINUE);
        transport[open].apply(transport, args);
        transportReadyStateChange.call(transport, STATE.OPENED, HTTPCODE.CREATED);
    }

    /**
     * @this {CORS}
     */
    function corsJSONPSend() {
        var
            transport = this.transport;

        transport[send].apply(transport, arguments);
        transportReadyStateChange.call(transport, STATE.LOADING, HTTPCODE.ACCEPTED);
    }

    /**
     * @this {CORS}
     * @param {string} type
     */
    function corsInit(type) {
        var
            transport;

        this[readyState] = this[response] = this[status] = NULL;
        this[responseText] = '';
        this.transport = new window[type]();
        transport = this.transport;
        transport[onReadyStateChange] = transportOnReadyStateChange;
        transport.parent = this;
    }

    /**
     * @constructor
     * @param {boolean=} forceJSONP
     */
    function CORS(forceJSONP) {
        var
            type = forceJSONP ? TYPES.JSONP : corsType;

        corsInit.call(this, type);
        if (forceJSONP) { // override the prototype methods for this instance
            this[TYPE] = TYPES.JSONP;
            this[open] = corsJSONPOpen;
            this[send] = corsJSONPSend;
        }
    }

    /**
     * @constructor
     */
    function JSONPHttpRequest() {
        this[readyState] = this[status] = NULL;
        this[responseText] = '';
    }

    if (window.XMLHttpRequest !== undefined && (new window.XMLHttpRequest()).withCredentials !== undefined) { // XMLHttp v2
        corsType = TYPES.XMLHTTP;
    } else if (window.XDomainRequest !== undefined) { // 7 < IE < 10
        corsType = TYPES.XDOMAIN;
    } else { // JSONP call fallback
        corsType = TYPES.JSONP;
    }

    jsonpHttpRequestPrototype = JSONPHttpRequest.prototype;
    jsonpHttpRequestPrototype[open] = jsonpHttpRequestOpen;
    jsonpHttpRequestPrototype[send] = jsonpHttpRequestSend;

    CORSPrototype = CORS.prototype;
    CORSPrototype[TYPE] = corsType;
    CORSPrototype[abort] = corsAbort;

    switch (corsType) {
    case TYPES.JSONP:
        CORSPrototype[open] = corsJSONPOpen;
        CORSPrototype[send] = corsJSONPSend;
        break;

    case TYPES.XDOMAIN:
        CORSPrototype[open] = xDomainRequestOpen;
        CORSPrototype[send] = xDomainRequestSend;
        break;

    case TYPES.XMLHTTP:
        CORSPrototype[open] = xmlHttpRequestOpen;
        CORSPrototype[send] = xmlHttpRequestSend;
        break;

    }

    for (key in STATE) {
        if (STATE.hasOwnProperty(key)) {
            CORSPrototype[key] = jsonpHttpRequestPrototype[key] = STATE[key];
        }
    }

    window[CORSStr] = CORS;
    window[TYPES.JSONP] = JSONPHttpRequest;

    if (!window.JSON) { // shim JSON if we don't have it intrinsically
        cors = new CORS(true);
        cors[open]('GET', '//cdnjs.cloudflare.com/ajax/libs/json3/3.3.2/json3.min.js', false);
        cors[send]();
    }

    return CORS;
}));