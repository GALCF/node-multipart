# node multipart

An ES6 multipart/form-data middleware with optional integrated file upload.
The middleware will serve all fields and files sent by adding them to the request variable.

To use the middleware, `req.headers['content-type']` has to be set and `req.body` has to be a Buffer instance.

## Usage

```javascript
const multipart = require('node-multipart');

const upload = multipart({
    // Optional upload path, files can also be read by using the req.files.FILENAME.data Buffer
    dest: '/path/for/uploaded/files',
    // Prefix is only used when dest is defined (default: 'multipart')
    // Sets a prefix to all files uploaded to the directory
    prefix: 'file_prefix_after_upload',
    // Optional mapping functions for fields and files
    mapFields: fields => {
        // Fields will be Buffer instances, this is converting them to string
        Object.keys(fields).forEach(fieldKey => {
            fields[fieldKey] = fields[fieldKey].data.toString();
        });

        return fields;
    },
    // No need to do this, these are optional mapping functions
    mapFiles: files => files
});

app.post('/image', upload, (req, res) => {
    // Use req.files and req.fields here
});
```
