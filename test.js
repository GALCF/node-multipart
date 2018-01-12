'use strict';

const assert = require('assert');

const parser = require('./index');
const middleware = parser({
    dest: './',
    mapFields: (fields) => {
        Object.keys(fields).forEach(fieldKey => {
            fields[fieldKey] = fields[fieldKey].data.toString();
        });

        return fields;
    }
});

const demoBoundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

const demoData = () => {
    const boundary = () => '--' + demoBoundary;
    const endBoundary = () => boundary() + '--';
    const contentDisposition = (name, filename) => 'Content-Disposition: form-data; name="' + name + '"' + (filename ? (' filename="' + filename + '"') : '');
    const contentType = type => 'Content-Type: ' + type;
    const newLine = () => '';
    const contentTransferEncoding = enc => 'Content-Transfer-Encoding: ' + enc;

    const field = (name, data) => [
        boundary(),
        contentDisposition(name),
        newLine(),
        data
    ];

    const file = (name, filename, data, type, enc) => {
        const value = [
            boundary(),
            contentType(type),
            contentDisposition(name, filename)
        ];

        if (enc) {
            value.push(contentTransferEncoding(enc));
        }

        value.push(newLine());
        value.push(data);

        return value;
    };

    const body = [
        'trash',
        ...field('testMessage', 'test message 123456 ÄÖÜäöüß'),
        ...file('upload', 'singlefile.txt', 'This is a single file upload with umlaut:\r\näöüÄÖÜß\r\n\r\nSee?', 'text/plain'),
        ...file('uploads[]', 'A.txt', `@11X111Y\r\n111Z\rCCCC\nCCCC\r\nCCCCC@\r\n`, 'text/plain'),
        ...file('uploads[]', 'testenc.txt', '@CCCCCCY\r\nCCCZ\rCCCW\nCCC0\r\n666@', 'text/plain', 'binary'),
        endBoundary()
    ].join('\r\n') + '\r\n';

    return Buffer.from(body, 'utf8');
};

const req = {
    // request data
    headers: {
        'content-type': 'Content-Type: multipart/form-data; boundary=' + demoBoundary
    },
    body: demoData()
};

middleware(req, {
    // response data
}, () => {
    assert.strictEqual(req.fields.testMessage, 'test message 123456 ÄÖÜäöüß');
    assert.strictEqual(req.fields.upload, undefined);
    assert.strictEqual(req.fields['uploads[]'], undefined);

    assert.strictEqual(req.files.testMessage, undefined);
    assert.strictEqual(req.files.upload.data.toString(), 'This is a single file upload with umlaut:\r\näöüÄÖÜß\r\n\r\nSee?');
    assert.strictEqual(req.files['uploads[]'].length, 2);
    assert.strictEqual(req.files['uploads[]'][0].data.toString(), '@11X111Y\r\n111Z\rCCCC\nCCCC\r\nCCCCC@\r\n');
    assert.strictEqual(req.files['uploads[]'][1].data.toString(), '@CCCCCCY\r\nCCCZ\rCCCW\nCCC0\r\n666@');
});
