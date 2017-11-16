# CORS.js

A small (1.85KB minified and gzipped) cross-browser library to support Cross Origin Resource Sharing requests. The script exposes two global constructors; `window.CORS` and `window.JSONPHttpRequest`.

### window.CORS
Acts as a wrapper around the transport used to communicate across origins. The transport is automatically chosen from what the browser supports, either `XMLHttpRequest` v2 (newer browsers) or `XDomainRequest` (IE 8 - 9) or `JSONPHttpRequest` (all others).

#### Parameters
* *forceJSONP* (boolean, optional, default false) Forces the use of the `JSONPHttpRequest` object as the transport even if the browser can use `XMLHttpRequest` v2 or `XDomainRequest` (useful for script loading).

`var cors = new CORS(true);`

### window.JSONPHttpRequest
This is used as a fallback for browsers that support neither `XMLHttpRequest` v2 or `XDomainRequest` and supports the same methods.

## Usage
Invoke as if using `XMLHttpRequest`. That's it.

The same methods and properties as `XMLHttpRequest` are available and use the same parameters. `readyState` and `status` are updated as necessary on the object and `onreadystatechange` is settable and is invoked appropriately.

### Example
    var request = new CORS();
    
    request.onreadystatechange = function () { // 'this' is the CORS object
        var text;

        if (this.readyState === 4) {
            text = this.responseText;
            // do something with the response
        }
    };
    request.open('GET', '//mydomain.me/somefile');
    request.send();

## Browser compatibility
* Internet Explorer 6+
* Firefox 3.6.28+
* Chrome 3+
* Opera 12+
* Safari 4+
* iOS Safari 3.2+
* Android 2.1+

(earlier versions of listed browsers will probably work as well)

### File sizes
As reported by Closure Compiler:

* **Unminified**: 13.98KB (**3.5KB** gzipped)
* **Minified**: 4.12KB (**1.85KB** gzipped)

### Notes and interesting features
In the spirit of dogfooding, if a browser doesn't support `JSON` (I'm looking at *you*, old IE) the library uses itself to load a shim from cloudflare.com's CDN via a `JSONPHttpRequest` object. Incidentally, this also means that *any* script can be loaded using `JSONPHttpRequest`. 
